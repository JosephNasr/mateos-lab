import { DateTime } from "luxon";
import { calculateGoldPortfolioAnalytics } from "./goldPortfolioAnalyticsCalculator.js";

const GOLD_MEMO_PATTERN = /([\d.]+)g \* ([\d.]+)/;

function amountWithCommas(amount) {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidNumericValue(value) {
    if (typeof value === "number") {
        return Number.isFinite(value);
    }

    if (typeof value === "string") {
        return value.trim() !== "" && Number.isFinite(Number(value));
    }

    return false;
}

function parseGoldPurchaseMemo(memo) {
    if (typeof memo !== "string") {
        return null;
    }

    const match = memo.match(GOLD_MEMO_PATTERN);

    if (!match) {
        return null;
    }

    const quantityInGrams = Number.parseFloat(match[1]);
    const pricePerGram = Number.parseFloat(match[2]);

    if (!Number.isFinite(quantityInGrams) || !Number.isFinite(pricePerGram) || quantityInGrams <= 0) {
        return null;
    }

    return {
        quantityInGrams,
        pricePerGram,
    };
}

function isManualGoldPurchaseTransaction(tx) {
    return tx.amount > 0 && typeof tx.memo === "string" && !tx.memo.startsWith("Automated");
}

export function getLastAutomatedTxDate(goldTransactions) {
    const dateFormat = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };

    return goldTransactions
        .filter(tx => typeof tx.memo === "string" && tx.memo.startsWith("Automated"))
        .map(tx => new Date(tx.date))
        .sort((a, b) => b - a)[0]?.toLocaleDateString('en-US', dateFormat) || "Never";
}

export function getTotalGoldWeight(goldTransactions) {
    return getGoldPurchaseTransactions(goldTransactions)
        .reduce((acc, transaction) => acc + transaction.quantityInGrams, 0);
}

export function getGoldPurchaseTransactions(goldTransactions) {
    return (goldTransactions || [])
        .filter(isManualGoldPurchaseTransaction)
        .map(tx => {
            const purchaseDetails = parseGoldPurchaseMemo(tx.memo);

            if (!purchaseDetails) {
                return null;
            }

            return {
                ...purchaseDetails,
                purchaseDate: tx.date,
                isGift: tx.isGift === true,
            };
        })
        .filter(Boolean);
}

export function getGoldGramPrices(goldData) {
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

export function buildGoldenUpdatePayload({
    balance,
    goldTransactions,
    gramPrice,
    gramBidPrice,
    gramAskPrice,
    automatedDateTransactions,
}) {
    const purchaseTransactions = getGoldPurchaseTransactions(goldTransactions);
    const lastAutomatedTxDate = getLastAutomatedTxDate(automatedDateTransactions ?? []);
    const currentGoldWeight = getTotalGoldWeight(goldTransactions);
    const roiData = getRoiData(gramPrice, balance, currentGoldWeight);
    const analytics = calculateGoldPortfolioAnalytics(purchaseTransactions, gramBidPrice, gramAskPrice);

    return {
        ...roiData,
        gramPrice,
        lastAutomatedTxDate,
        analytics,
    };
}

export function parseGoldenUpdateSinglePostPayload(payload) {
    if (!isPlainObject(payload) || "j" in payload || "n" in payload) {
        return null;
    }

    const { gramPrice, lastAutomatedTxDate, roi } = payload;

    if (!isValidNumericValue(gramPrice) || typeof lastAutomatedTxDate !== "string" || lastAutomatedTxDate.length === 0) {
        return null;
    }

    if (typeof roi !== "number" || !Number.isFinite(roi)) {
        return null;
    }

    return {
        gramPrice,
        lastAutomatedTxDate,
        roi,
    };
}

export function parseGoldenUpdateDualPostPayload(payload) {
    if (!isPlainObject(payload)) {
        return null;
    }

    const keys = Object.keys(payload);

    if (keys.length !== 2 || !keys.includes("j") || !keys.includes("n")) {
        return null;
    }

    const j = parseGoldenUpdateSinglePostPayload(payload.j);
    const n = parseGoldenUpdateSinglePostPayload(payload.n);

    if (!j || !n || Number(j.gramPrice) !== Number(n.gramPrice)) {
        return null;
    }

    return {
        j,
        n,
        gramPrice: j.gramPrice,
    };
}

export function buildRoiTransaction(account, currentROI, goldPrice) {
    return {
        account_id: account,
        date: DateTime.now().toISODate(),
        amount: currentROI,
        payee_name: "ROI",
        memo: `Automated: 1g * ${goldPrice}`,
        approved: true,
        cleared: "cleared",
        flag_color: "orange",
    };
}

export function getRoiData(gramPrice, balance, currentGoldWeight) {
    const currentROI = (currentGoldWeight * gramPrice) - balance;
    const roiSign = currentROI < 0 ? "-" : "+";

    return {
        roi: Math.floor(currentROI * 1000),
        roiDisplay: roiSign + '$' + amountWithCommas(Math.abs(currentROI).toFixed(2)),
        lastBalance: balance,
        newBalance: balance + currentROI,
    };
}
