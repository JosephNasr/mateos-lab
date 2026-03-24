function camelCase(str) {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function tryAgainLater(res, error) {
    if (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }

    return res.status(403).json({ bitch: "Try again later" });
}

export function authorize(req, res, ...heads) {
    if (!req.headers["authorization"]) {
        return tryAgainLater(res);
    }

    const token = req.headers["authorization"];
    const headers = { Authorization: token };

    const keys = {};
    heads.forEach(head => {
        if (!req.headers[head]) {
            return tryAgainLater(res);
        }

        keys[camelCase(head)] = req.headers[head];
    });

    return { headers, ...keys };
};
