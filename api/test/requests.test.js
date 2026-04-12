import assert from "node:assert/strict";
import test from "node:test";
import {
    getAccount,
    getAccountTransactions,
    postTransaction,
} from "../src/requests/ynab.js";

test("getAccountTransactions builds the plans account-transactions URI", () => {
    const result = getAccountTransactions("plan-123", "account-456");

    assert.equal(
        result.uri,
        "https://api.ynab.com/v1/plans/plan-123/accounts/account-456/transactions"
    );
    assert.equal(result.params, undefined);
});

test("getAccountTransactions adds since_date query param when provided", () => {
    const result = getAccountTransactions("plan-123", "account-456", {
        sinceDate: "2026-03-12",
    });

    assert.equal(
        result.uri,
        "https://api.ynab.com/v1/plans/plan-123/accounts/account-456/transactions"
    );
    assert.deepEqual(result.params, {
        since_date: "2026-03-12",
    });
});

test("postTransaction builds the plans transactions URI and wraps payload", () => {
    const transaction = {
        account_id: "account-456",
        amount: 12345,
    };
    const result = postTransaction("plan-123", transaction);

    assert.equal(
        result.uri,
        "https://api.ynab.com/v1/plans/plan-123/transactions"
    );
    assert.deepEqual(result.data, { transaction });
});

test("getAccount builds the plans account URI", () => {
    const result = getAccount("plan-123", "account-456");

    assert.equal(
        result.uri,
        "https://api.ynab.com/v1/plans/plan-123/accounts/account-456"
    );
});
