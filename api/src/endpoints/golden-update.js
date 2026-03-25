import { DateTime } from "luxon";

const GOLD_MEMO_PATTERN = /([\d.]+)g \* ([\d.]+)/;

function amountWithCommas(amount) {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function getLastTxDate(goldTransactions) {
    return goldTransactions
        .map(tx => new Date(tx.date))
        .sort((a, b) => b - a)[0].toISOString().split('T')[0];
}

export function getLastAutomatedTxDate(goldTransactions) {
    return goldTransactions
        .filter(tx => tx.memo.startsWith("Automated"))
        .map(tx => new Date(tx.date))
        .sort((a, b) => b - a)[0]?.toISOString().split('T')[0] || "Never";
}

export function getTotalGoldWeight(goldTransactions) {
    return goldTransactions
        .filter(tx => tx.amount > 0 && tx.memo)
        .filter(tx => !tx.memo.startsWith("Automated"))
        .map(tx => {
            const match = tx.memo.match(GOLD_MEMO_PATTERN);
            return match ? parseFloat(match[1]) : 0;
        })
        .reduce((acc, weight) => acc + weight, 0);
}

export function getGoldPurchaseTransactions(goldTransactions) {
    return goldTransactions
        .filter(tx => tx.amount > 0 && tx.memo)
        .filter(tx => !tx.memo.startsWith("Automated"))
        .map(tx => {
            const match = tx.memo.match(GOLD_MEMO_PATTERN);

            if (!match) return null;

            const quantityInGrams = Number.parseFloat(match[1]);
            const pricePerGram = Number.parseFloat(match[2]);

            if (!Number.isFinite(quantityInGrams) || !Number.isFinite(pricePerGram) || quantityInGrams <= 0) {
                return null;
            }

            return {
                quantityInGrams,
                pricePerGram,
                purchaseDate: tx.date,
            };
        })
        .filter(Boolean);
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

export function getRoiData(gramPrice, balance, lastTxDate, currentGoldWeight) {
    const currentROI = (currentGoldWeight * gramPrice) - balance;
    const roiSign = currentROI < 0 ? "-" : "+";

    return {
        roi: Math.floor(currentROI * 1000),
        lastUpdated: new Date(lastTxDate).toDateString(),
        displayText: `${roiSign}$${amountWithCommas(Math.abs(currentROI).toFixed(2))}
Total Weight: ${currentGoldWeight}g
Last Balance: $${amountWithCommas(balance)}
New Balance: $${amountWithCommas((balance + currentROI).toFixed(2))}`,
    };
}
