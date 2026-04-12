import { tryAgainLater } from "./errors.js";

function camelCase(str) {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function authorize(req, res, ...heads) {
    if (!req.headers["authorization"]) {
        tryAgainLater(res);
        return null;
    }

    const token = req.headers["authorization"];
    const headers = { Authorization: token };

    const keys = {};
    for (const head of heads) {
        if (!req.headers[head]) {
            tryAgainLater(res);
            return null;
        }

        keys[camelCase(head)] = req.headers[head];
    }

    return { headers, ...keys };
};
