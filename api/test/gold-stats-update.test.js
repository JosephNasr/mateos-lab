import assert from "node:assert/strict";
import test from "node:test";
import {
    buildGoldenTransactionsByPerson,
    buildGoldStatsUpdatePayload,
    normalizeGoldStatsRows,
} from "../src/endpoints/gold-stats-update.js";

const sampleRows = [
    {
        row_number: 2,
        Date: "11/09/2021",
        Person: "Nada",
        Amount: "",
        Quantity: "",
        Weight: 8,
        "Total Price": "",
        "Price /g": "",
        Notes: "Necklace maybe?",
    },
    {
        row_number: 3,
        Date: "14/07/2024",
        Person: "Joseph",
        Amount: 1,
        Quantity: 100,
        Weight: 100,
        "Total Price": 6380,
        "Price /g": 63.8,
    },
    {
        row_number: 4,
        Date: "14/07/2024",
        Person: "Joseph",
        Amount: 2,
        Quantity: "Ounce",
        Weight: 62.207,
        "Total Price": 4000,
        "Price /g": 64.3014451749803,
    },
    {
        row_number: 5,
        Date: "14/07/2024",
        Person: "Nada",
        Amount: 1,
        Quantity: 100,
        Weight: 100,
        "Total Price": 6380,
        "Price /g": 63.8,
    },
    {
        row_number: 6,
        Date: "02/10/2025",
        Person: "Joseph",
        Amount: "",
        Quantity: "",
        Weight: 5,
        "Total Price": "",
        "Price /g": "",
        Notes: "Amal & Naaman: 30th Birthday Gift",
    },
    {
        row_number: 7,
        Date: "27/07/2025",
        Person: "Nada",
        Amount: "",
        Quantity: "",
        Weight: 2.5,
        "Total Price": "",
        "Price /g": "",
        Notes: "Em Ali Egypt: Wedding Registry",
    },
];

test("normalizeGoldStatsRows marks blank or zeroed purchase fields as gifts", () => {
    const rows = normalizeGoldStatsRows(sampleRows);
    const zeroedRows = normalizeGoldStatsRows([
        {
            row_number: 99,
            Date: "01/01/2026",
            Person: "Joseph",
            Amount: "0",
            Quantity: "0.00",
            Weight: 4,
            "Total Price": "$0",
            "Price /g": 99,
        },
    ]);

    assert.equal(rows[0].isGift, true);
    assert.equal(rows[0].spending, null);
    assert.equal(rows[2].isGift, false);
    assert.equal(rows[2].quantity, "Ounce");
    assert.equal(rows[2].spending, 4000);
    assert.equal(zeroedRows[0].isGift, true);
    assert.equal(zeroedRows[0].spending, null);
});

test("buildGoldStatsUpdatePayload groups rows by person and excludes gifts from spending", () => {
    const result = buildGoldStatsUpdatePayload(sampleRows, { gramPrice: 100 });

    assert.deepEqual(Object.keys(result.byPerson).sort(), ["Joseph", "Nada"]);

    assert.equal(result.byPerson.Joseph.rows.length, 3);
    assert.equal(result.byPerson.Joseph.totals.rowCount, 3);
    assert.equal(result.byPerson.Joseph.totals.purchaseRowCount, 2);
    assert.equal(result.byPerson.Joseph.totals.giftRowCount, 1);
    assert.equal(result.byPerson.Joseph.totals.totalWeight, 167.207);
    assert.equal(result.byPerson.Joseph.totals.purchasedWeight, 162.207);
    assert.equal(result.byPerson.Joseph.totals.giftedWeight, 5);
    assert.equal(result.byPerson.Joseph.totals.totalSpent, 10380);
    assert.equal(result.byPerson.Joseph.totals.netWorth, 16720.7);
    assert.equal(result.byPerson.Joseph.totals.roi, 6340.7);
    assert.equal(result.byPerson.Joseph.totals.roiPercentage, 0.6109);

    assert.equal(result.byPerson.Nada.rows.length, 3);
    assert.equal(result.byPerson.Nada.totals.totalWeight, 110.5);
    assert.equal(result.byPerson.Nada.totals.purchasedWeight, 100);
    assert.equal(result.byPerson.Nada.totals.giftedWeight, 10.5);
    assert.equal(result.byPerson.Nada.totals.totalSpent, 6380);
    assert.equal(result.byPerson.Nada.totals.netWorth, 11050);
    assert.equal(result.byPerson.Nada.totals.roi, 4670);
    assert.equal(result.byPerson.Nada.totals.roiPercentage, 0.732);

    assert.equal(result.totals.totalWeight, 277.707);
    assert.equal(result.totals.purchasedWeight, 262.207);
    assert.equal(result.totals.giftedWeight, 15.5);
    assert.equal(result.totals.totalSpent, 16760);
    assert.equal(result.totals.averageCostPerGram, 63.92);
    assert.equal(result.totals.netWorth, 27770.7);
    assert.equal(result.totals.roi, 11010.7);
    assert.equal(result.totals.roiPercentage, 0.657);
    assert.equal(result.totals.roiMilliunits, 11010700);
});

test("buildGoldenTransactionsByPerson maps Joseph/Nada rows into j/n synthetic transactions", () => {
    const result = buildGoldenTransactionsByPerson([
        {
            row_number: 10,
            Date: "14/07/2024",
            Person: "joseph",
            Amount: 1,
            Quantity: 100,
            Weight: 100,
            "Total Price": 6380,
            "Price /g": 63.8,
        },
        {
            row_number: 11,
            Date: "15/07/2024",
            Person: "NADA",
            Amount: "0",
            Quantity: "0.00",
            Weight: 8,
            "Total Price": "$0",
            "Price /g": 63.8,
        },
    ]);

    assert.equal(result.error, undefined);
    assert.deepEqual(result.byPerson, {
        j: [
            {
                amount: 1,
                memo: "100g * 63.8",
                date: "2024-07-14",
                isGift: false,
            },
        ],
        n: [
            {
                amount: 1,
                memo: "8g * 0",
                date: "2024-07-15",
                isGift: true,
            },
        ],
    });
});

test("buildGoldenTransactionsByPerson rejects unsupported people with row details", () => {
    const result = buildGoldenTransactionsByPerson([
        {
            row_number: 30,
            Date: "14/07/2024",
            Person: "Ali",
            Amount: 1,
            Quantity: 10,
            Weight: 10,
            "Total Price": 600,
            "Price /g": 60,
        },
    ]);

    assert.equal(result.byPerson, undefined);
    assert.deepEqual(result.error, {
        row: 30,
        message: "row 30 has unsupported person. Expected Joseph or Nada.",
    });
});

test("buildGoldenTransactionsByPerson rejects purchase rows that cannot derive a price per gram", () => {
    const result = buildGoldenTransactionsByPerson([
        {
            row_number: 40,
            Date: "14/07/2024",
            Person: "Joseph",
            Amount: 1,
            Quantity: 10,
            Weight: 10,
            "Total Price": "",
            "Price /g": "",
        },
    ]);

    assert.equal(result.byPerson, undefined);
    assert.deepEqual(result.error, {
        row: 40,
        message: "row 40 is missing a derivable price per gram for a purchase row.",
    });
});

test("buildGoldenTransactionsByPerson rejects rows with missing date or invalid weight", () => {
    const missingDateResult = buildGoldenTransactionsByPerson([
        {
            row_number: 50,
            Date: "",
            Person: "Joseph",
            Amount: "",
            Quantity: "",
            Weight: 5,
            "Total Price": "",
            "Price /g": "",
        },
    ]);

    assert.deepEqual(missingDateResult.error, {
        row: 50,
        message: "row 50 is missing a valid date.",
    });

    const invalidWeightResult = buildGoldenTransactionsByPerson([
        {
            row_number: 51,
            Date: "14/07/2024",
            Person: "Nada",
            Amount: "",
            Quantity: "",
            Weight: 0,
            "Total Price": "",
            "Price /g": "",
        },
    ]);

    assert.deepEqual(invalidWeightResult.error, {
        row: 51,
        message: "row 51 is missing a valid positive weight.",
    });
});
