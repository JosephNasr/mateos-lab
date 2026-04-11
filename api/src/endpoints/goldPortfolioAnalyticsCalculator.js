function toScaledInteger(value, scale) {
    return Math.round(Number(value) * scale);
}

function fromScaledInteger(value, scale) {
    return value / scale;
}

function roundTo(value, decimals) {
    if (!Number.isFinite(value)) return 0;

    return Number(value.toFixed(decimals));
}

function roundCurrency(value) {
    return roundTo(value, 2);
}

function roundQuantity(value) {
    return roundTo(value, 3);
}

function roundPercentage(value) {
    return roundTo(value, 4);
}

function safeDivide(numerator, denominator) {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
        return 0;
    }

    return numerator / denominator;
}

function normalizePrice(value, name) {
    const normalizedValue = Number(value);

    if (!Number.isFinite(normalizedValue)) {
        throw new Error(`Invalid ${name}`);
    }

    return roundCurrency(normalizedValue);
}

function normalizePurchaseTransaction(transaction) {
    const quantityInGrams = Number(transaction?.quantityInGrams);
    const pricePerGram = Number(transaction?.pricePerGram);
    const purchaseDate = transaction?.purchaseDate;
    const isGift = transaction?.isGift === true;

    if (!Number.isFinite(quantityInGrams) || !Number.isFinite(pricePerGram) || quantityInGrams <= 0) {
        return null;
    }

    if (typeof purchaseDate !== "string" || purchaseDate.length === 0) {
        return null;
    }

    return {
        purchaseDate,
        quantityInGrams,
        pricePerGram,
        isGift,
    };
}

function sortPurchaseBreakdown(transactions) {
    return [...transactions].sort((left, right) => left.purchaseDate.localeCompare(right.purchaseDate));
}

export function calculateGoldPortfolioAnalytics(transactions, bidPrice, askPrice) {
    const normalizedBidPrice = normalizePrice(bidPrice, "bidPrice");
    const normalizedAskPrice = normalizePrice(askPrice, "askPrice");
    const purchaseBreakdown = sortPurchaseBreakdown(
        (transactions || [])
            .map(normalizePurchaseTransaction)
            .filter(Boolean)
    );

    const aggregates = purchaseBreakdown.reduce((acc, transaction) => {
        const quantityInGrams = Number(transaction?.quantityInGrams);
        const pricePerGram = Number(transaction?.pricePerGram);
        const isGift = transaction?.isGift === true;

        return {
            totalQuantityScaled: acc.totalQuantityScaled + toScaledInteger(quantityInGrams, 1000),
            totalInvestedCents: isGift
                ? acc.totalInvestedCents
                : acc.totalInvestedCents + toScaledInteger(quantityInGrams * pricePerGram, 100),
        };
    }, {
        totalQuantityScaled: 0,
        totalInvestedCents: 0,
    });

    const totalQuantity = roundQuantity(fromScaledInteger(aggregates.totalQuantityScaled, 1000));
    const totalInvested = roundCurrency(fromScaledInteger(aggregates.totalInvestedCents, 100));
    const averageCost = roundQuantity(safeDivide(totalInvested, totalQuantity));
    const spread = roundCurrency(normalizedAskPrice - normalizedBidPrice);
    const spreadPct = roundPercentage(safeDivide(spread, normalizedAskPrice));
    const currentValue = roundCurrency(totalQuantity * normalizedBidPrice);
    const profit = roundCurrency(currentValue - totalInvested);
    const returnPct = roundPercentage(safeDivide(profit, totalInvested));
    const breakEvenPrice = averageCost;
    const distanceToBreakEven = roundCurrency(normalizedBidPrice - averageCost);

    return {
        purchaseBreakdown,
        totalQuantity,
        totalInvested,
        averageCost,
        currentBidPrice: normalizedBidPrice,
        currentAskPrice: normalizedAskPrice,
        spread,
        spreadPct,
        currentValue,
        profit,
        returnPct,
        breakEvenPrice,
        distanceToBreakEven,
    };
}
