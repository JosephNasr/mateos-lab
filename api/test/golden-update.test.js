import assert from "node:assert/strict";
import test from "node:test";
import { buildGoldenUpdatePayload, getGoldGramPrices, getGoldPurchaseTransactions, getTotalGoldWeight } from "../src/endpoints/golden-update.js";
import { calculateGoldPortfolioAnalytics } from "../src/endpoints/goldPortfolioAnalyticsCalculator.js";

test("getGoldPurchaseTransactions keeps only valid manual purchases and sums their weight", () => {
    const transactions = [
        { amount: 150000, memo: "2g * 60.5", date: "2024-01-03" },
        { amount: 300000, memo: "Automated: 1g * 70", date: "2024-01-04" },
        { amount: 100000, memo: "not a gold purchase", date: "2024-01-05" },
        { amount: -50000, memo: "1g * 50", date: "2024-01-06" },
        { amount: 440000, memo: "4.4g * 65", date: "2024-01-07" },
    ];

    assert.deepEqual(getGoldPurchaseTransactions(transactions), [
        { quantityInGrams: 2, pricePerGram: 60.5, purchaseDate: "2024-01-03" },
        { quantityInGrams: 4.4, pricePerGram: 65, purchaseDate: "2024-01-07" },
    ]);

    assert.equal(getTotalGoldWeight(transactions), 6.4);
});

test("calculateGoldPortfolioAnalytics returns a chronological weighted breakdown and weighted totals", () => {
    const analytics = calculateGoldPortfolioAnalytics([
        { quantityInGrams: 1, pricePerGram: 100, purchaseDate: "2024-02-10" },
        { quantityInGrams: 3, pricePerGram: 50, purchaseDate: "2024-01-01" },
        { quantityInGrams: 2, pricePerGram: 80, purchaseDate: "2024-01-20" },
        { quantityInGrams: 0, pricePerGram: 999, purchaseDate: "2024-03-01" },
        { quantityInGrams: 1.5, pricePerGram: Number.NaN, purchaseDate: "2024-03-02" },
    ], 90, 92);

    assert.deepEqual(analytics.purchaseBreakdown, [
        { quantityInGrams: 3, pricePerGram: 50, purchaseDate: "2024-01-01" },
        { quantityInGrams: 2, pricePerGram: 80, purchaseDate: "2024-01-20" },
        { quantityInGrams: 1, pricePerGram: 100, purchaseDate: "2024-02-10" },
    ]);

    assert.equal(analytics.totalQuantity, 6);
    assert.equal(
        analytics.totalQuantity,
        analytics.purchaseBreakdown.reduce((sum, purchase) => sum + purchase.quantityInGrams, 0)
    );
    assert.equal(analytics.totalInvested, 410);
    assert.equal(
        analytics.totalInvested,
        analytics.purchaseBreakdown.reduce(
            (sum, purchase) => sum + (purchase.quantityInGrams * purchase.pricePerGram),
            0
        )
    );
    assert.equal(analytics.averageCost, 68.333);
    assert.equal(analytics.currentBidPrice, 90);
    assert.equal(analytics.currentAskPrice, 92);
    assert.equal(analytics.spread, 2);
    assert.equal(analytics.spreadPct, 0.0217);
    assert.equal(analytics.currentValue, 540);
    assert.equal(analytics.profit, 130);
    assert.equal(analytics.returnPct, 0.3171);
    assert.equal(analytics.breakEvenPrice, 68.333);
    assert.equal(analytics.distanceToBreakEven, 21.67);

    for (const field of [
        "purchaseBreakdown",
        "totalQuantity",
        "totalInvested",
        "averageCost",
        "currentBidPrice",
        "currentAskPrice",
        "spread",
        "spreadPct",
        "currentValue",
        "profit",
        "returnPct",
        "breakEvenPrice",
        "distanceToBreakEven",
    ]) {
        assert.ok(field in analytics);
    }
});

test("getGoldGramPrices converts ounce prices to gram prices", () => {
    const prices = getGoldGramPrices({
        bid: 2799.12,
        ask: 2810.45,
    });

    assert.deepEqual(prices, {
        gramPrice: "89.99",
        gramBidPrice: 89.99,
        gramAskPrice: 90.36,
    });
});

test("buildGoldenUpdatePayload returns the full single-account response payload", () => {
    const result = buildGoldenUpdatePayload({
        balance: 270,
        goldTransactions: [
            { amount: 120000, memo: "2g * 60", date: "2024-01-03" },
            { amount: 150000, memo: "3g * 50", date: "2024-02-10" },
            { amount: 170000, memo: "Automated: 1g * 89", date: "2024-03-01" },
        ],
        gramPrice: 90,
        gramBidPrice: 88,
        gramAskPrice: 89,
    });

    assert.equal(result.gramPrice, 90);
    assert.equal(result.lastAutomatedTxDate, "2024-03-01");
    assert.equal(result.roi, 180000);
    assert.match(result.displayText, /^1g Price: \$90\n\n\+\$180\.00/);
    assert.equal(result.analytics.totalQuantity, 5);
    assert.equal(result.analytics.totalInvested, 270);
    assert.equal(result.analytics.currentBidPrice, 88);
    assert.equal(result.analytics.currentAskPrice, 89);
    assert.equal(result.analytics.currentValue, 440);
    assert.equal(result.analytics.profit, 170);
    assert.equal(result.analytics.distanceToBreakEven, 34);
});
