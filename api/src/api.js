import express, { json } from "express";
import axios from "axios";
import cors from "cors";
import { DateTime } from "luxon";
import { getGoldPrice, getAccount, getAccountTransactions, postTransaction, getExchangeRate, getBeirutWeatherData } from "./requests.js";
import {
    buildGoldenUpdatePayload,
    buildRoiTransaction,
    getGoldGramPrices,
    parseGoldenUpdateDualPostPayload,
    parseGoldenUpdateSinglePostPayload,
} from "./endpoints/golden-update.js";
import { authorize, tryAgainLater } from "./utils.js";
import { deconstructSms } from "./sms/utils.js";
import { buildDailyWeatherMessage } from "./endpoints/daily-weather.js";
// import { deviceExtractMiddleware } from "./middlewares/device_extract.js";
// import { responseTimeMiddleware } from "./middlewares/response_time.js";


const app = express();
const PORT = process.env.PORT || 4211;

function invalidGoldenUpdatePayload(res) {
    return res.status(400).json({ error: "Invalid golden update payload" });
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
        const [gold, accountJResponse, transactionsJ, accountNResponse, transactionsN] = await Promise.all([
            getGoldResponse(),
            getAccountResponse(accountRequestJ),
            getTransactionsResponse(transactionsRequestJ),
            getAccountResponse(accountRequestN),
            getTransactionsResponse(transactionsRequestN),
        ]);

        const { gramPrice, gramBidPrice, gramAskPrice } = getGoldGramPrices(gold.data);

        return res.json({
            j: buildGoldenUpdatePayload({
                balance: accountJResponse.data.data.account.balance / 1000,
                goldTransactions: transactionsJ.data.data.transactions,
                gramPrice,
                gramBidPrice,
                gramAskPrice,
            }),
            n: buildGoldenUpdatePayload({
                balance: accountNResponse.data.data.account.balance / 1000,
                goldTransactions: transactionsN.data.data.transactions,
                gramPrice,
                gramBidPrice,
                gramAskPrice,
            }),
        });
    } catch (error) {
        return tryAgainLater(res, error);
    }
});

app.post("/ynab/golden-update", async (req, res) => {
    const auth = authorize(req, res, "budget", "account-j", "account-n");

    if (!auth?.headers) {
        return auth;
    }

    const { headers, budget, accountJ, accountN } = auth;
    const goldenUpdatePayload = parseGoldenUpdateDualPostPayload(req.body);

    if (!goldenUpdatePayload) {
        return invalidGoldenUpdatePayload(res);
    }

    const { j: goldenUpdateJ, n: goldenUpdateN, gramPrice } = goldenUpdatePayload;

    const dateWorksJ = !goldenUpdateJ.lastAutomatedTxDate || goldenUpdateJ.lastAutomatedTxDate != DateTime.now().toISODate();
    const dateWorksN = !goldenUpdateN.lastAutomatedTxDate || goldenUpdateN.lastAutomatedTxDate != DateTime.now().toISODate();

    const insignificantRoiJ = goldenUpdateJ.roi < 10 && goldenUpdateJ.roi > -10;
    const insignificantRoiN = goldenUpdateN.roi < 10 && goldenUpdateN.roi > -10;

    const roiTransactionJ = buildRoiTransaction(accountJ, goldenUpdateJ.roi, gramPrice);
    const requestJ = postTransaction(budget, roiTransactionJ);

    const roiTransactionN = buildRoiTransaction(accountN, goldenUpdateN.roi, gramPrice);
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
        const [gold, accountResponse, transactions] = await Promise.all([
            getGoldResponse(),
            getAccountResponse(accountRequest),
            getTransactionsResponse(transactionsRequest),
        ]);

        const { gramPrice, gramBidPrice, gramAskPrice } = getGoldGramPrices(gold.data);

        return res.json(buildGoldenUpdatePayload({
            balance: accountResponse.data.data.account.balance / 1000,
            goldTransactions: transactions.data.data.transactions,
            gramPrice,
            gramBidPrice,
            gramAskPrice,
        }));
    } catch (error) {
        return tryAgainLater(res, error);
    }
});

app.post("/ynab/golden-update-single", async (req, res) => {
    const auth = authorize(req, res, "budget", "account");

    if (!auth?.headers) {
        return auth;
    }

    const { headers, budget, account } = auth;
    const goldenUpdatePayload = parseGoldenUpdateSinglePostPayload(req.body);

    if (!goldenUpdatePayload) {
        return invalidGoldenUpdatePayload(res);
    }

    const { gramPrice, lastAutomatedTxDate, roi } = goldenUpdatePayload;

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
