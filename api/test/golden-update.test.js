import assert from "node:assert/strict";
import test from "node:test";
import {
    buildGoldenUpdatePayload,
    getGoldGramPrices,
    getGoldPurchaseTransactions,
    getTotalGoldWeight,
    normalizeLastAutomatedTxDate,
    parseGoldenUpdateDualPostPayload,
    parseGoldenUpdateSinglePostPayload,
} from "../src/endpoints/golden-update.js";
import { calculateGoldPortfolioAnalytics } from "../src/endpoints/gold-portfolio-analytics-calculator.js";

function createSinglePostPayload(overrides = {}) {
    return {
        gramPrice: "89.99",
        lastAutomatedTxDate: "2024-03-01",
        roi: 180000,
        ...overrides,
    };
}

function createDualPostPayload(overrides = {}) {
    return {
        j: createSinglePostPayload(),
        n: createSinglePostPayload({
            lastAutomatedTxDate: "Never",
            roi: 120000,
        }),
        ...overrides,
    };
}

function shouldAllowRoiUpdate(lastAutomatedTxDate, todayIsoDate) {
    const normalizedLastAutomatedTxDate = normalizeLastAutomatedTxDate(lastAutomatedTxDate);
    return !normalizedLastAutomatedTxDate || normalizedLastAutomatedTxDate !== todayIsoDate;
}

test("getGoldPurchaseTransactions keeps only valid manual purchases and sums their weight", () => {
    const transactions = [
        { amount: 150000, memo: "2g * 60.5", date: "2024-01-03" },
        { amount: 300000, memo: "Automated: 1g * 70", date: "2024-01-04" },
        { amount: 100000, memo: "not a gold purchase", date: "2024-01-05" },
        { amount: -50000, memo: "1g * 50", date: "2024-01-06" },
        { amount: 440000, memo: "4.4g * 65", date: "2024-01-07" },
    ];

    assert.deepEqual(getGoldPurchaseTransactions(transactions), [
        { quantityInGrams: 2, pricePerGram: 60.5, purchaseDate: "2024-01-03", isGift: false },
        { quantityInGrams: 4.4, pricePerGram: 65, purchaseDate: "2024-01-07", isGift: false },
    ]);

    assert.equal(getTotalGoldWeight(transactions), 6.4);
});

test("calculateGoldPortfolioAnalytics returns a chronological weighted breakdown and weighted totals", () => {
    const analytics = calculateGoldPortfolioAnalytics([
        { quantityInGrams: 1, pricePerGram: 100, purchaseDate: "2024-02-10" },
        { quantityInGrams: 3, pricePerGram: 50, purchaseDate: "2024-01-01" },
        { quantityInGrams: 2, pricePerGram: 80, purchaseDate: "2024-01-20" },
        { quantityInGrams: 0.5, pricePerGram: 200, purchaseDate: "2024-02-15", isGift: true },
        { quantityInGrams: 0, pricePerGram: 999, purchaseDate: "2024-03-01" },
        { quantityInGrams: 1.5, pricePerGram: Number.NaN, purchaseDate: "2024-03-02" },
    ], 90, 92);

    assert.deepEqual(analytics.purchaseBreakdown, [
        { quantityInGrams: 3, pricePerGram: 50, purchaseDate: "2024-01-01", isGift: false },
        { quantityInGrams: 2, pricePerGram: 80, purchaseDate: "2024-01-20", isGift: false },
        { quantityInGrams: 1, pricePerGram: 100, purchaseDate: "2024-02-10", isGift: false },
        { quantityInGrams: 0.5, pricePerGram: 200, purchaseDate: "2024-02-15", isGift: true },
    ]);

    assert.equal(analytics.totalQuantity, 6.5);
    assert.equal(
        analytics.totalQuantity,
        analytics.purchaseBreakdown.reduce((sum, purchase) => sum + purchase.quantityInGrams, 0)
    );
    assert.equal(analytics.totalInvested, 410);
    assert.equal(
        analytics.totalInvested,
        analytics.purchaseBreakdown.reduce(
            (sum, purchase) => sum + (purchase.isGift ? 0 : (purchase.quantityInGrams * purchase.pricePerGram)),
            0
        )
    );
    assert.equal(analytics.averageCost, 78.462);
    assert.equal(analytics.currentBidPrice, 90);
    assert.equal(analytics.currentAskPrice, 92);
    assert.equal(analytics.spread, 2);
    assert.equal(analytics.spreadPct, 0.0217);
    assert.equal(analytics.currentValue, 585);
    assert.equal(analytics.profit, 75);
    assert.equal(analytics.returnPct, 0.1471);
    assert.equal(analytics.breakEvenPrice, 78.462);
    assert.equal(analytics.distanceToBreakEven, 11.54);

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

test("normalizeLastAutomatedTxDate parses supported date formats and treats never/invalid as empty", () => {
    assert.equal(normalizeLastAutomatedTxDate("2026-04-12"), "2026-04-12");
    assert.equal(normalizeLastAutomatedTxDate("Sunday, April 12, 2026"), "2026-04-12");
    assert.equal(normalizeLastAutomatedTxDate("Never"), null);
    assert.equal(normalizeLastAutomatedTxDate(""), null);
    assert.equal(normalizeLastAutomatedTxDate("not a date"), null);
});

test("same-day guard blocks today's updates for ISO and long display dates", () => {
    const todayIsoDate = "2026-04-12";

    assert.equal(shouldAllowRoiUpdate("2026-04-12", todayIsoDate), false);
    assert.equal(shouldAllowRoiUpdate("Sunday, April 12, 2026", todayIsoDate), false);
    assert.equal(shouldAllowRoiUpdate("Never", todayIsoDate), true);
    assert.equal(shouldAllowRoiUpdate("nonsense", todayIsoDate), true);
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

    assert.deepEqual(result, {
        roi: 180000,
        roiDisplay: "+$180.00",
        lastBalance: 270,
        newBalance: 450,
        gramPrice: 90,
        lastAutomatedTxDate: "Never",
        analytics: {
            purchaseBreakdown: [
                { purchaseDate: "2024-01-03", quantityInGrams: 2, pricePerGram: 60, isGift: false },
                { purchaseDate: "2024-02-10", quantityInGrams: 3, pricePerGram: 50, isGift: false },
            ],
            totalQuantity: 5,
            totalInvested: 270,
            investedIncludingGifts: 270,
            averageCost: 54,
            currentBidPrice: 88,
            currentAskPrice: 89,
            spread: 1,
            spreadPct: 0.0112,
            currentValue: 440,
            profit: 170,
            returnPct: 0.6296,
            breakEvenPrice: 54,
            distanceToBreakEven: 34,
        },
    });
});

test("buildGoldenUpdatePayload uses automatedDateTransactions override for last automated date", () => {
    const result = buildGoldenUpdatePayload({
        balance: 270,
        goldTransactions: [
            { amount: 120000, memo: "2g * 60", date: "2024-01-03" },
            { amount: 150000, memo: "3g * 50", date: "2024-02-10" },
        ],
        automatedDateTransactions: [
            { amount: 170000, memo: "Automated: 1g * 89", date: "2024-03-03" },
            { amount: 180000, memo: "Automated: 1g * 91", date: "2024-03-10" },
        ],
        gramPrice: 90,
        gramBidPrice: 88,
        gramAskPrice: 89,
    });

    assert.equal(normalizeLastAutomatedTxDate(result.lastAutomatedTxDate), "2024-03-10");
});

test("parseGoldenUpdateSinglePostPayload accepts the core fields by themselves", () => {
    assert.deepEqual(
        parseGoldenUpdateSinglePostPayload(createSinglePostPayload()),
        createSinglePostPayload()
    );
});

test("parseGoldenUpdateSinglePostPayload ignores displayText and analytics", () => {
    assert.deepEqual(
        parseGoldenUpdateSinglePostPayload(createSinglePostPayload({
            displayText: "ignored",
            analytics: { totalQuantity: 5 },
        })),
        createSinglePostPayload()
    );
});

test("parseGoldenUpdateSinglePostPayload rejects invalid single-account payloads", () => {
    assert.equal(
        parseGoldenUpdateSinglePostPayload({
            gramPrice: "89.99",
            roi: 180000,
        }),
        null
    );

    assert.equal(
        parseGoldenUpdateSinglePostPayload({
            gramPrice: "89.99",
            lastAutomatedTxDate: "2024-03-01",
        }),
        null
    );

    assert.equal(
        parseGoldenUpdateSinglePostPayload(createSinglePostPayload({
            j: createSinglePostPayload(),
        })),
        null
    );
});

test("parseGoldenUpdateDualPostPayload accepts the nested dual-account shape", () => {
    assert.deepEqual(
        parseGoldenUpdateDualPostPayload(createDualPostPayload({
            j: createSinglePostPayload({
                displayText: "ignored",
                analytics: { totalQuantity: 5 },
            }),
            n: createSinglePostPayload({
                lastAutomatedTxDate: "Never",
                roi: 120000,
                displayText: "ignored too",
                analytics: { totalQuantity: 3 },
            }),
        })),
        {
            j: createSinglePostPayload(),
            n: createSinglePostPayload({
                lastAutomatedTxDate: "Never",
                roi: 120000,
            }),
            gramPrice: "89.99",
        }
    );
});

test("parseGoldenUpdateDualPostPayload rejects flat, mixed, and malformed payloads", () => {
    assert.equal(
        parseGoldenUpdateDualPostPayload({
            gramPrice: "89.99",
            lastAutomatedTxDateJ: "2024-03-01",
            roiJ: 180000,
            lastAutomatedTxDateN: "Never",
            roiN: 120000,
        }),
        null
    );

    assert.equal(
        parseGoldenUpdateDualPostPayload({
            ...createDualPostPayload(),
            gramPrice: "89.99",
        }),
        null
    );

    assert.equal(
        parseGoldenUpdateDualPostPayload({
            j: createSinglePostPayload(),
        }),
        null
    );

    assert.equal(
        parseGoldenUpdateDualPostPayload(createDualPostPayload({
            n: createSinglePostPayload({
                gramPrice: "90.50",
                lastAutomatedTxDate: "Never",
                roi: 120000,
            }),
        })),
        null
    );

    assert.equal(
        parseGoldenUpdateDualPostPayload(createDualPostPayload({
            n: {
                gramPrice: "89.99",
                roi: 120000,
            },
        })),
        null
    );
});
