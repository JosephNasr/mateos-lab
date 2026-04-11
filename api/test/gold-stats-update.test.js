import assert from "node:assert/strict";
import test from "node:test";
import {
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

test("normalizeGoldStatsRows marks fully blank purchase fields as gifts", () => {
    const rows = normalizeGoldStatsRows(sampleRows);

    assert.equal(rows[0].isGift, true);
    assert.equal(rows[0].spending, null);
    assert.equal(rows[2].isGift, false);
    assert.equal(rows[2].quantity, "Ounce");
    assert.equal(rows[2].spending, 4000);
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
