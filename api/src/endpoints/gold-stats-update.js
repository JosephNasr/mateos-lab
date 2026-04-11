import { DateTime } from "luxon";

const UNKNOWN_PERSON = "Unknown";

function normalizeHeaderKey(key) {
    return String(key ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function findMatchingKey(row, matcher) {
    return Object.keys(row).find((key) => matcher(normalizeHeaderKey(key)));
}

function hasCellValue(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
}

function parseNumberish(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== "string" || !hasCellValue(value)) {
        return null;
    }

    const numericText = value.replace(/[^\d.-]/g, "");

    if (!numericText || numericText === "-" || numericText === "." || numericText === "-.") {
        return null;
    }

    const numeric = Number(numericText);
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

function normalizeText(value) {
    return hasCellValue(value) ? String(value).trim() : null;
}

function normalizeQuantity(value) {
    const numericQuantity = parseNumberish(value);

    if (numericQuantity !== null) {
        return numericQuantity;
    }

    return normalizeText(value);
}

function getPurchaseCost({ isGift, totalPrice, weight, price }) {
    if (isGift) {
        return null;
    }

    if (typeof totalPrice === "number") {
        return totalPrice;
    }

    if (typeof weight === "number" && typeof price === "number") {
        return Number((weight * price).toFixed(2));
    }

    return null;
}

function roundTo(value, decimals) {
    if (!Number.isFinite(value)) {
        return null;
    }

    return Number(value.toFixed(decimals));
}

function roundWeight(value) {
    return roundTo(value, 4);
}

function roundCurrency(value) {
    return roundTo(value, 2);
}

function roundPercentage(value) {
    return roundTo(value, 4);
}

function emptyTotals() {
    return {
        rowCount: 0,
        purchaseRowCount: 0,
        giftRowCount: 0,
        totalWeight: 0,
        purchasedWeight: 0,
        giftedWeight: 0,
        totalSpent: 0,
        averageCostPerGram: null,
        currentPricePerGram: null,
        netWorth: null,
        roi: null,
        roiPercentage: null,
        roiMilliunits: null,
    };
}

function addRowToTotals(totals, row) {
    totals.rowCount += 1;

    if (row.isGift) {
        totals.giftRowCount += 1;
    } else {
        totals.purchaseRowCount += 1;
    }

    if (typeof row.weight === "number") {
        totals.totalWeight += row.weight;

        if (row.isGift) {
            totals.giftedWeight += row.weight;
        } else {
            totals.purchasedWeight += row.weight;
        }
    }

    if (!row.isGift && typeof row.spending === "number") {
        totals.totalSpent += row.spending;
    }
}

function finalizeTotals(totals, currentPricePerGram) {
    const totalWeight = roundWeight(totals.totalWeight);
    const purchasedWeight = roundWeight(totals.purchasedWeight);
    const giftedWeight = roundWeight(totals.giftedWeight);
    const totalSpent = roundCurrency(totals.totalSpent);
    const averageCostPerGram = purchasedWeight > 0
        ? roundCurrency(totalSpent / purchasedWeight)
        : null;
    const netWorth = roundCurrency(totalWeight * currentPricePerGram);
    const roi = roundCurrency(netWorth - totalSpent);

    return {
        ...totals,
        count: totals.rowCount,
        totalRows: totals.rowCount,
        totalWeight,
        purchasedWeight,
        giftedWeight,
        totalCost: totalSpent,
        totalSpent,
        averageCostPerGram,
        currentPricePerGram,
        netWorth,
        roi,
        roiPercentage: totalSpent > 0 ? roundPercentage(roi / totalSpent) : null,
        roiMilliunits: Number.isFinite(roi) ? Math.floor(roi * 1000) : null,
    };
}

function normalizeGoldPrices(goldPrices) {
    const currentPricePerGram = parseNumberish(
        goldPrices?.currentPricePerGram
        ?? goldPrices?.gramPrice
        ?? goldPrices?.pricePerGram
    );

    if (currentPricePerGram === null) {
        throw new Error("Missing current gold price per gram");
    }

    return {
        currentPricePerGram,
        gramPrice: currentPricePerGram,
        gramBidPrice: parseNumberish(goldPrices?.gramBidPrice),
        gramAskPrice: parseNumberish(goldPrices?.gramAskPrice),
    };
}

export function extractGoldStatsRows(payload) {
    return Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.rows) ? payload.rows : []);
}

export function getRequestedGoldPricePerGram(payload) {
    if (!payload || Array.isArray(payload)) {
        return null;
    }

    return parseNumberish(
        payload.currentPricePerGram
        ?? payload.gramPrice
        ?? payload.pricePerGram
    );
}

export function normalizeGoldStatsRows(rows) {
    return rows
        .filter((row) => row && typeof row === "object")
        .map((row) => {
            const rowNumberKey = findMatchingKey(row, (k) => k === "row number" || k === "rownumber");
            const personKey = findMatchingKey(row, (k) => k.startsWith("person"));
            const dateKey = findMatchingKey(row, (k) => k.startsWith("date"));
            const amountKey = findMatchingKey(row, (k) => k.startsWith("amount"));
            const quantityKey = findMatchingKey(row, (k) => k.startsWith("quantity"));
            const weightKey = findMatchingKey(row, (k) => k.startsWith("weight"));
            const totalPriceKey = findMatchingKey(row, (k) => k.startsWith("total price"));
            const priceKey = findMatchingKey(row, (k) => k.startsWith("price"));
            const notesKey = findMatchingKey(row, (k) => k.startsWith("notes"));

            const amountRaw = amountKey ? row[amountKey] : null;
            const quantityRaw = quantityKey ? row[quantityKey] : null;
            const totalPriceRaw = totalPriceKey ? row[totalPriceKey] : null;
            const priceRaw = priceKey ? row[priceKey] : null;
            const hasPurchaseFields = [
                amountRaw,
                quantityRaw,
                totalPriceRaw,
                priceRaw,
            ].some(hasCellValue);
            const isGift = !hasPurchaseFields;

            const rowNumber = parseNumberish(rowNumberKey ? row[rowNumberKey] : null);
            const date = parseSheetDate(dateKey ? row[dateKey] : null);
            const person = normalizeText(personKey ? row[personKey] : null);
            const amount = parseNumberish(amountRaw);
            const quantity = normalizeQuantity(quantityRaw);
            const weight = parseNumberish(weightKey ? row[weightKey] : null);
            const totalPrice = parseNumberish(totalPriceRaw);
            const price = parseNumberish(priceRaw);
            const spending = getPurchaseCost({ isGift, totalPrice, weight, price });
            const notes = normalizeText(notesKey ? row[notesKey] : null);

            return {
                rowNumber,
                date,
                person,
                amount,
                quantity,
                weight,
                totalPrice,
                price,
                totalCost: spending,
                spending,
                isGift,
                notes,
            };
        });
}

export function buildGoldStatsUpdatePayload(rows, goldPrices) {
    const prices = normalizeGoldPrices(goldPrices);
    const normalizedRows = normalizeGoldStatsRows(rows).map((row) => {
        const netWorthContribution = typeof row.weight === "number"
            ? roundCurrency(row.weight * prices.currentPricePerGram)
            : null;
        const roiContribution = netWorthContribution !== null
            ? roundCurrency(netWorthContribution - (row.spending ?? 0))
            : null;

        return {
            ...row,
            netWorthContribution,
            roiContribution,
        };
    });
    const overallTotals = emptyTotals();
    const groupedRows = normalizedRows.reduce((acc, row) => {
        const personKey = row.person || UNKNOWN_PERSON;

        if (!acc[personKey]) {
            acc[personKey] = {
                rows: [],
                totals: emptyTotals(),
            };
        }

        acc[personKey].rows.push(row);
        addRowToTotals(acc[personKey].totals, row);
        addRowToTotals(overallTotals, row);

        return acc;
    }, {});

    Object.keys(groupedRows).forEach((person) => {
        groupedRows[person].totals = finalizeTotals(groupedRows[person].totals, prices.currentPricePerGram);
    });

    return {
        prices,
        rows: normalizedRows,
        byPerson: groupedRows,
        totals: {
            ...finalizeTotals(overallTotals, prices.currentPricePerGram),
            byPerson: Object.fromEntries(
                Object.entries(groupedRows).map(([person, group]) => [person, group.totals])
            ),
        },
    };
}
