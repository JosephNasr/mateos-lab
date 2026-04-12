import express, { json } from "express";
import axios from "axios";
import cors from "cors";
import { DateTime } from "luxon";
import { getGoldPrice, getAccount, getAccountTransactions, postTransaction, getBeirutWeatherData } from "./requests.js";
import {
    buildGoldenUpdatePayload,
    buildRoiTransaction,
    getGoldGramPrices,
    normalizeLastAutomatedTxDate,
    parseGoldenUpdateDualPostPayload,
    parseGoldenUpdateSinglePostPayload,
} from "./endpoints/golden-update.js";
import { authorize, tryAgainLater } from "./utils.js";
import { buildDailyWeatherMessage } from "./endpoints/daily-weather.js";
import {
    buildGoldenTransactionsByPerson,
    extractGoldStatsRows,
} from "./endpoints/gold-stats-update.js";


const app = express();
const PORT = process.env.PORT || 4211;

function invalidGoldenUpdatePayload(res) {
    return res.status(400).json({ error: "Invalid golden update payload" });
}

app.use(cors());
app.use(json());


app.listen(PORT, '0.0.0.0', () => {
    console.log(`API Server running on port ${PORT}`);
});

app.get("/health", (req, res) => {
    return res.json({ status: "🙃 ok 🏎️" });
});

app.get("/device", (req, res) => res.json(req.deviceInfo));

app.post("/ynab/gold-stats-update", async (req, res) => {
    const auth = authorize(req, res, "budget", "account-j", "account-n");

    if (!auth) {
        return;
    }

    const incomingRows = extractGoldStatsRows(req.body);
    if (!incomingRows.length) {
        return res.status(400).json({
            message: "Request body must be an array of rows or an object with a rows array",
        });
    }

    const { byPerson, error: rowValidationError } = buildGoldenTransactionsByPerson(incomingRows);
    if (rowValidationError) {
        return res.status(400).json({
            error: "Invalid gold stats row",
            details: rowValidationError,
        });
    }

    const { headers, budget, accountJ, accountN } = auth;
    const sinceDate = DateTime.now().minus({ months: 1 }).toISODate();
    const goldRequest = getGoldPrice();
    const accountRequestJ = getAccount(budget, accountJ);
    const transactionsRequestJ = getAccountTransactions(budget, accountJ, { sinceDate });
    const accountRequestN = getAccount(budget, accountN);
    const transactionsRequestN = getAccountTransactions(budget, accountN, { sinceDate });

    const getGoldResponse = () => axios.get(goldRequest.uri);
    const getAccountResponse = (request) => axios.get(request.uri, { headers: headers });
    const getTransactionsResponse = (request) => axios.get(request.uri, {
        headers: headers,
        params: request.params,
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
                goldTransactions: byPerson.j,
                automatedDateTransactions: transactionsJ.data.data.transactions,
                gramPrice,
                gramBidPrice,
                gramAskPrice,
            }),
            n: buildGoldenUpdatePayload({
                balance: accountNResponse.data.data.account.balance / 1000,
                goldTransactions: byPerson.n,
                automatedDateTransactions: transactionsN.data.data.transactions,
                gramPrice,
                gramBidPrice,
                gramAskPrice,
            }),
        });
    } catch (error) {
        return tryAgainLater(res, error);
    }
});

app.get("/ynab/golden-update", async (req, res) => {
    const auth = authorize(req, res, "budget", "account-j", "account-n");
    if (!auth) {
        return;
    }

    const { headers, budget, accountJ, accountN } = auth;

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
                automatedDateTransactions: transactionsJ.data.data.transactions,
                gramPrice,
                gramBidPrice,
                gramAskPrice,
            }),
            n: buildGoldenUpdatePayload({
                balance: accountNResponse.data.data.account.balance / 1000,
                goldTransactions: transactionsN.data.data.transactions,
                automatedDateTransactions: transactionsN.data.data.transactions,
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

    if (!auth) {
        return;
    }

    const { headers, budget, accountJ, accountN } = auth;
    const goldenUpdatePayload = parseGoldenUpdateDualPostPayload(req.body);

    if (!goldenUpdatePayload) {
        return invalidGoldenUpdatePayload(res);
    }

    const { j: goldenUpdateJ, n: goldenUpdateN, gramPrice } = goldenUpdatePayload;
    const normalizedLastAutomatedTxDateJ = normalizeLastAutomatedTxDate(goldenUpdateJ.lastAutomatedTxDate);
    const normalizedLastAutomatedTxDateN = normalizeLastAutomatedTxDate(goldenUpdateN.lastAutomatedTxDate);

    const dateWorksJ = !normalizedLastAutomatedTxDateJ || normalizedLastAutomatedTxDateJ !== DateTime.now().toISODate();
    const dateWorksN = !normalizedLastAutomatedTxDateN || normalizedLastAutomatedTxDateN !== DateTime.now().toISODate();

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
            messageN += "Something went wrong";
        }

        const result = res.json({ message: `${messageJ}\n${messageN}` });

        // console.log(result);
        return result;
    } catch (error) {
        return tryAgainLater(res, error);
    }
});

app.get("/ynab/golden-update-single", async (req, res) => {
    const auth = authorize(req, res, "budget", "account");
    if (!auth) {
        return;
    }

    const { headers, budget, account } = auth;

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
            automatedDateTransactions: transactions.data.data.transactions,
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

    if (!auth) {
        return;
    }

    const { headers, budget, account } = auth;
    const goldenUpdatePayload = parseGoldenUpdateSinglePostPayload(req.body);

    if (!goldenUpdatePayload) {
        return invalidGoldenUpdatePayload(res);
    }

    const { gramPrice, lastAutomatedTxDate, roi } = goldenUpdatePayload;
    const normalizedLastAutomatedTxDate = normalizeLastAutomatedTxDate(lastAutomatedTxDate);

    const dateWorks = !normalizedLastAutomatedTxDate || normalizedLastAutomatedTxDate !== DateTime.now().toISODate();
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
    try {
        const beirutWeatherDataRequest = getBeirutWeatherData();
        const response = await axios.get(beirutWeatherDataRequest.uri);

        if (response.status !== 200) return res.json({ message: "Could not get Weather data: " + response.statusText });

        buildDailyWeatherMessage(response.data);
        return res.json({ status: "🙃 ok 🏎️" });
    } catch (error) {
        return tryAgainLater(res, error);
    }
});
