export function tryAgainLater(res, error) {
    if (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }

    return res.status(403).json({ bitch: "Try again later" });
}
