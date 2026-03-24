
export function responseTimeMiddleware() {
    return (req, res, next) => {
        const start = process.hrtime.bigint();

        res.on("finish", () => {
            const end = process.hrtime.bigint();
            const durationMs = Number(end - start) / 1_000_000;

            if (req.deviceInfo) req.deviceInfo.responseTimeMs = durationMs;

            console.log(
                `[${req.method}] ${req.originalUrl} -> ${durationMs.toFixed(2)} ms ${JSON.stringify(req.deviceInfo)}`
            );
        });

        next();
    };
}
