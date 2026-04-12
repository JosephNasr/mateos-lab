import assert from "node:assert/strict";
import test from "node:test";
import { authorize } from "../src/utils.js";

function createMockResponse() {
    const state = {};

    return {
        state,
        status(statusCode) {
            state.statusCode = statusCode;
            return this;
        },
        json(payload) {
            state.payload = payload;
            return this;
        },
    };
}

test("authorize returns null and responds when authorization header is missing", () => {
    const req = { headers: {} };
    const res = createMockResponse();

    const result = authorize(req, res, "budget");

    assert.equal(result, null);
    assert.equal(res.state.statusCode, 403);
    assert.deepEqual(res.state.payload, { bitch: "Try again later" });
});

test("authorize returns null and responds when a required custom header is missing", () => {
    const req = {
        headers: {
            authorization: "Bearer token-123",
            budget: "budget-1",
        },
    };
    const res = createMockResponse();

    const result = authorize(req, res, "budget", "account-j");

    assert.equal(result, null);
    assert.equal(res.state.statusCode, 403);
    assert.deepEqual(res.state.payload, { bitch: "Try again later" });
});

test("authorize returns normalized auth object when all headers are present", () => {
    const req = {
        headers: {
            authorization: "Bearer token-abc",
            budget: "budget-123",
            account: "account-xyz",
            "account-j": "account-j-1",
            "account-n": "account-n-2",
        },
    };
    const res = createMockResponse();

    const result = authorize(req, res, "budget", "account", "account-j", "account-n");

    assert.deepEqual(result, {
        headers: { Authorization: "Bearer token-abc" },
        budget: "budget-123",
        account: "account-xyz",
        accountJ: "account-j-1",
        accountN: "account-n-2",
    });
    assert.equal(res.state.statusCode, undefined);
    assert.equal(res.state.payload, undefined);
});
