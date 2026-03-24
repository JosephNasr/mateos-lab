import { DateTime } from "luxon";

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
            const match = tx.memo.match(/([\d\.]+g \* \d+\.\d+)/g);
            return match ? parseFloat(match[0].split('g')[0]) : 0;
        })
        .reduce((acc, weight) => acc + weight, 0);
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
