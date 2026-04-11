import express, { json } from "express";
import axios from "axios";
import cors from "cors";
import { DateTime } from "luxon";
import { getGoldPrice, getAccount, getAccountTransactions, postTransaction, getExchangeRate, getBeirutWeatherData } from "./requests.js";
import { getLastAutomatedTxDate, getLastTxDate, getTotalGoldWeight, getRoiData, buildRoiTransaction, getGoldPurchaseTransactions } from "./endpoints/golden-update.js";
import { calculateGoldPortfolioAnalytics } from "./endpoints/goldPortfolioAnalyticsCalculator.js";
import { authorize, tryAgainLater } from "./utils.js";
import { deconstructSms } from "./sms/utils.js";
import { buildDailyWeatherMessage } from "./endpoints/daily-weather.js";
// import { deviceExtractMiddleware } from "./middlewares/device_extract.js";
// import { responseTimeMiddleware } from "./middlewares/response_time.js";


const app = express();
const PORT = process.env.PORT || 4211;

function getGoldGramPrices(goldData) {
    const ouncePrice = Number(goldData?.price ?? goldData?.bid ?? goldData?.ask);
    const ounceBidPrice = Number(goldData?.bid ?? ouncePrice);
    const ounceAskPrice = Number(goldData?.ask ?? ouncePrice);

    if (!Number.isFinite(ouncePrice) || !Number.isFinite(ounceBidPrice) || !Number.isFinite(ounceAskPrice)) {
        throw new Error("Gold price payload is missing bid/ask values");
    }

    return {
        gramPrice: (ouncePrice / 31.1035).toFixed(2),
        gramBidPrice: Number((ounceBidPrice / 31.1035).toFixed(2)),
        gramAskPrice: Number((ounceAskPrice / 31.1035).toFixed(2)),
    };
}

function normalizeHeaderKey(key) {
    return String(key ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function findMatchingKey(row, matcher) {
    return Object.keys(row).find((key) => matcher(normalizeHeaderKey(key)));
}

function parseNumberish(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== "string") {
        return null;
    }

    const numeric = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
}

function parseSheetDate(value) {
    if (typeof value !== "string" || !value.trim()) {
        return null;
    }

    const trimmed = value.trim();
    const formatAttempt = DateTime.fromFormat(trimmed, "d/M/yyyy");
    if (formatAttempt.isValid) {
        return formatAttempt.toISODate();
    }

    const isoAttempt = DateTime.fromISO(trimmed);
    if (isoAttempt.isValid) {
        return isoAttempt.toISODate();
    }

    return null;
}

app.use(cors());
app.use(json());

// app.set("trust proxy", true);
// app.use(deviceExtractMiddleware()); // /\ order matters here
// app.use(responseTimeMiddleware()); //  \/ and here


app.listen(PORT, '0.0.0.0', () => {
    console.log(`API Server running on port ${PORT}`);
});

app.get("/health", (req, res) => {
    return res.json({ status: "🙃 ok 🏎️" });
});

app.get("/device", (req, res) => res.json(req.deviceInfo));

app.post("/gold-update-stats", async (req, res) => {
    authorize(req, res, "budget", "account-j", "account-n");

    const incomingRows = Array.isArray(req.body)
        ? req.body
        : (Array.isArray(req.body?.rows) ? req.body.rows : []);

    if (!incomingRows.length) {
        return res.status(400).json({
            message: "Request body must be an array of rows or an object with a rows array",
        });
    }

    const normalizedRows = incomingRows
        .filter((row) => row && typeof row === "object")
        .map((row) => {
            const rowNumberKey = findMatchingKey(row, (k) => k === "row number" || k === "rownumber");
            const personKey = findMatchingKey(row, (k) => k === "person" || k === "name");
            const dateKey = findMatchingKey(row, (k) => k === "date");
            const notesKey = findMatchingKey(row, (k) => k === "notes" || k === "note");
            const weightKey = findMatchingKey(row, (k) => k.startsWith("weight"));
            const priceKey = findMatchingKey(row, (k) => k.startsWith("price"));

            const rowNumber = parseNumberish(rowNumberKey ? row[rowNumberKey] : null);
            const person = personKey ? String(row[personKey] ?? "").trim() : null;
            const dateRaw = dateKey ? row[dateKey] : null;
            const date = parseSheetDate(dateRaw);
            const weight = parseNumberish(weightKey ? row[weightKey] : null);
            const price = parseNumberish(priceKey ? row[priceKey] : null);
            const notes = notesKey ? String(row[notesKey] ?? "").trim() : null;
            const totalCost = (weight !== null && price !== null) ? Number((weight * price).toFixed(2)) : null;

            return {
                rowNumber,
                person: person || null,
                date,
                dateRaw,
                weight,
                price,
                totalCost,
                notes: notes || null,
                detectedColumns: {
                    rowNumber: rowNumberKey || null,
                    person: personKey || null,
                    date: dateKey || null,
                    weight: weightKey || null,
                    price: priceKey || null,
                    notes: notesKey || null,
                },
                raw: row,
            };
        });

    const totals = normalizedRows.reduce((acc, row) => {
        const personKey = row.person || "Unknown";

        if (!acc.byPerson[personKey]) {
            acc.byPerson[personKey] = {
                count: 0,
                totalWeight: 0,
                totalCost: 0,
            };
        }

        acc.byPerson[personKey].count += 1;
        acc.totalRows += 1;

        if (typeof row.weight === "number") {
            acc.totalWeight += row.weight;
            acc.byPerson[personKey].totalWeight += row.weight;
        }

        if (typeof row.totalCost === "number") {
            acc.totalCost += row.totalCost;
            acc.byPerson[personKey].totalCost += row.totalCost;
        }

        return acc;
    }, {
        totalRows: 0,
        totalWeight: 0,
        totalCost: 0,
        byPerson: {},
    });

    totals.totalWeight = Number(totals.totalWeight.toFixed(4));
    totals.totalCost = Number(totals.totalCost.toFixed(2));

    Object.keys(totals.byPerson).forEach((person) => {
        totals.byPerson[person].totalWeight = Number(totals.byPerson[person].totalWeight.toFixed(4));
        totals.byPerson[person].totalCost = Number(totals.byPerson[person].totalCost.toFixed(2));
    });

    return res.json({
        rows: normalizedRows,
        totals,
    });
});

/*
Sample body:
[
  {
    "row_number": 2,
    "Person": "Nada",
    "Date": "11/09/2021",
    "Weight (g)": 8,
    "Price ($/g)": 0
  }
]
*/

app.get("/ynab/golden-update", async (req, res) => {
    const { headers, budget, accountJ, accountN } = authorize(req, res, "budget", "account-j", "account-n");

    const goldRequest = getGoldPrice();
    const accountRequestJ = getAccount(budget, accountJ);
    const transactionsRequestJ = getAccountTransactions(budget, accountJ);
    const accountRequestN = getAccount(budget, accountN);
    const transactionsRequestN = getAccountTransactions(budget, accountN);

    const getGoldResponse = () => axios.get(goldRequest.uri);
    const getAccountResponse = (req) => axios.get(req.uri, { headers: headers });
    const getTransactionsResponse = (req) => axios.get(req.uri, {
        headers: headers,
        params: req.params,
    });

    try {
        await Promise.all([
            getGoldResponse(),
            getAccountResponse(accountRequestJ),
            getTransactionsResponse(transactionsRequestJ),
            getAccountResponse(accountRequestN),
            getTransactionsResponse(transactionsRequestN),
        ]).then(([gold, accountJ, transactionsJ, accountN, transactionsN]) => {
            const { gramPrice } = getGoldGramPrices(gold.data);

            const balanceJ = accountJ.data.data.account.balance / 1000;
            const balanceN = accountN.data.data.account.balance / 1000;

            const goldTransactionsJ = transactionsJ.data.data.transactions;
            const goldTransactionsN = transactionsN.data.data.transactions;

            const lastAutomatedTxDateJ = getLastAutomatedTxDate(goldTransactionsJ);
            const lastAutomatedTxDateN = getLastAutomatedTxDate(goldTransactionsN);

            const lastTxDateJ = getLastTxDate(goldTransactionsJ);
            const lastTxDateN = getLastTxDate(goldTransactionsN);

            const currentGoldWeightJ = getTotalGoldWeight(goldTransactionsJ);
            const currentGoldWeightN = getTotalGoldWeight(goldTransactionsN);

            const roiDataJ = getRoiData(gramPrice, balanceJ, lastTxDateJ, currentGoldWeightJ);
            const roiDataN = getRoiData(gramPrice, balanceN, lastTxDateN, currentGoldWeightN);

            const result = res.json({
                gramPrice: gramPrice,
                lastAutomatedTxDateJ: lastAutomatedTxDateJ,
                lastAutomatedTxDateN: lastAutomatedTxDateN,
                roiJ: roiDataJ.roi,
                roiN: roiDataN.roi,
                displayText: [
                    [
                        `1g: $${gramPrice}`,
                        `1oz: $${(gold.data.price).toFixed(2)}`,
                    ].join("\n"),
                    `Joseph: ${roiDataJ.displayText}`,
                    `Nada: ${roiDataN.displayText}`,
                    `Since ${roiDataJ.lastUpdated}`,
                ].join("\n\n"),
            });

            // console.log(result);
            return result;
        });
    } catch (error) {
        return tryAgainLater(res, error);
    }
});

app.post("/ynab/golden-update", async (req, res) => {
    const { headers, budget, accountJ, accountN } = authorize(req, res, "budget", "account-j", "account-n");
    const { gramPrice, lastAutomatedTxDateJ, lastAutomatedTxDateN, roiJ, roiN } = req.body;

    const dateWorksJ = !lastAutomatedTxDateJ || lastAutomatedTxDateJ != DateTime.now().toISODate();
    const dateWorksN = !lastAutomatedTxDateN || lastAutomatedTxDateN != DateTime.now().toISODate();

    const insignificantRoiJ = roiJ < 10 && roiJ > -10;
    const insignificantRoiN = roiN < 10 && roiN > -10;

    const roiTransactionJ = buildRoiTransaction(accountJ, roiJ, gramPrice);
    const requestJ = postTransaction(budget, roiTransactionJ);

    const roiTransactionN = buildRoiTransaction(accountN, roiN, gramPrice);
    const requestN = postTransaction(budget, roiTransactionN);

    let messageJ = "Joseph: ";
    let messageN = "Nada: ";

    try {
        if (dateWorksJ && !insignificantRoiJ) {
            await axios.post(requestJ.uri, requestJ.data, { headers: headers });
            messageJ += roiTransactionJ.memo;
        } else if (insignificantRoiJ) {
            messageJ += "ROI is insignificant";
        } else if (!dateWorksJ) {
            messageJ += "Cannot update on the same day";
        } else {
            messageJ += "Something went wrong";
        }

        if (dateWorksN && !insignificantRoiN) {
            await axios.post(requestN.uri, requestN.data, { headers: headers });
            messageN += roiTransactionN.memo;
        } else if (insignificantRoiN) {
            messageN += "ROI is insignificant";
        } else if (!dateWorksN) {
            messageN += "Cannot update on the same day";
        } else {
            messageJ += "Something went wrong";
        }

        const result = res.json({ message: `${messageJ}\n${messageN}` });

        // console.log(result);
        return result;
    } catch (error) {
        return tryAgainLater(res, error);
    }
});

app.get("/ynab/golden-update-single", async (req, res) => {
    const { headers, budget, account } = authorize(req, res, "budget", "account");

    const goldRequest = getGoldPrice();
    const accountRequest = getAccount(budget, account);
    const transactionsRequest = getAccountTransactions(budget, account);

    const getGoldResponse = () => axios.get(goldRequest.uri);
    const getAccountResponse = (req) => axios.get(req.uri, { headers: headers });
    const getTransactionsResponse = (req) => axios.get(req.uri, {
        headers: headers,
        params: req.params,
    });

    try {
        await Promise.all([
            getGoldResponse(),
            getAccountResponse(accountRequest),
            getTransactionsResponse(transactionsRequest),
        ]).then(([gold, account, transactions]) => {
            const { gramPrice, gramBidPrice, gramAskPrice } = getGoldGramPrices(gold.data);
            const balance = account.data.data.account.balance / 1000;
            const goldTransactions = transactions.data.data.transactions;
            const purchaseTransactions = getGoldPurchaseTransactions(goldTransactions);

            const lastAutomatedTxDate = getLastAutomatedTxDate(goldTransactions);
            const lastTxDate = getLastTxDate(goldTransactions);
            const currentGoldWeight = getTotalGoldWeight(goldTransactions);
            const roiData = getRoiData(gramPrice, balance, lastTxDate, currentGoldWeight);
            const analytics = calculateGoldPortfolioAnalytics(purchaseTransactions, gramBidPrice, gramAskPrice);

            return res.json({
                gramPrice: gramPrice,
                lastAutomatedTxDate: lastAutomatedTxDate,
                roi: roiData.roi,
                displayText: [
                    `1g Price: $${gramPrice}`,
                    roiData.displayText,
                ]
                    .join("\n\n"),
                analytics,
            });
        });
    } catch (error) {
        return tryAgainLater(res, error);
    }
});

app.post("/ynab/golden-update-single", async (req, res) => {
    const { headers, budget, account } = authorize(req, res, "budget", "account");
    const { gramPrice, lastAutomatedTxDate, roi } = req.body;

    const dateWorks = !lastAutomatedTxDate || lastAutomatedTxDate != DateTime.now().toISODate();
    const insignificantRoi = roi < 10 && roi > -10;

    const roiTransaction = buildRoiTransaction(account, roi, gramPrice);
    const request = postTransaction(budget, roiTransaction);

    let message = "";

    try {
        if (dateWorks && !insignificantRoi) {
            await axios.post(request.uri, request.data, { headers: headers });
            message += roiTransaction.memo;
        } else if (insignificantRoi) {
            message += "ROI is insignificant";
        } else if (!dateWorks) {
            message += "Cannot update on the same day";
        } else {
            message += "Something went wrong";
        }

        return res.json({ message: message });
    } catch (error) {
        return tryAgainLater(res, error);
    }
});


app.get("/weather", async (req, res) => {
    const beirutWeatherDataRequest = getBeirutWeatherData();
    const response = await axios.get(beirutWeatherDataRequest.uri);

    if (response.status !== 200) return res.json({ message: "Could not get Weather data: " + response.statusText });

    const message = buildDailyWeatherMessage(beirutWeatherData)
    return res.json({ status: "🙃 ok 🏎️" });
});
