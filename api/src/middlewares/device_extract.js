
function coarseIp(ip) {
    if (!ip) return "";
    return ip.includes(":")
        ? ip.replace(/:[0-9a-f]+(?::|$)/i, ":0000$1") // IPv6: zero last block
        : ip.replace(/\d+$/, "0");                    // IPv4: zero last octet
}

export function extractDeviceInfo(req) {
    const h = req.headers || {};
    const ipChain = (h["x-forwarded-for"] || "").toString().split(",").map(s => s.trim()).filter(Boolean);
    const clientIp = (ipChain[0] || req.socket?.remoteAddress || "") + "";
    const proxyChain = ipChain.length > 1 ? ipChain.slice(1) : [];

    const tls = (req.socket && typeof req.socket.getProtocol === "function")
        ? {
            protocol: req.socket.getProtocol(),
            alpn: req.socket.alpnProtocol || undefined,
            cipher: req.socket.getCipher?.() || undefined,
            authorized: req.socket.authorized ?? undefined
        }
        : undefined;

    const ua = h["user-agent"] || "";

    // UA-Client-Hints (arrive on HTTPS, often from 2nd request after you advertise Accept-CH)
    const ch = {
        brands: h["sec-ch-ua"],                            // e.g., `"Chromium";v="126", "Google Chrome";v="126"...`
        fullVersionList: h["sec-ch-ua-full-version-list"],
        platform: h["sec-ch-ua-platform"],                 // "Windows" | "Android" | "iOS" | "macOS" | "Linux"
        platformVersion: h["sec-ch-ua-platform-version"],  // e.g., "16.5.0"
        mobile: h["sec-ch-ua-mobile"],                     // "?0" | "?1"
        model: h["sec-ch-ua-model"],                       // device model (Chromium on Android)
        arch: h["sec-ch-ua-arch"],                         // "arm" | "x86"
        bitness: h["sec-ch-ua-bitness"]                    // "64"
    };

    // Lightweight classification without any parser lib
    const isMobile =
        ch.mobile === "?1" ||
        /\b(Mobile|Android|iPhone|iPad|iPod|Windows Phone)\b/i.test(ua);
    const deviceType = isMobile ? "mobile" : "desktop/unknown";

    // Fetch metadata
    const fetchMeta = {
        site: h["sec-fetch-site"],     // "same-origin" | "cross-site" | "none"
        mode: h["sec-fetch-mode"],     // "cors" | "navigate" | "no-cors" | "same-origin"
        dest: h["sec-fetch-dest"],     // "empty" | "document" | "script" | etc.
        user: h["sec-fetch-user"],     // "?1" for top-level navigations
    };

    return {
        // Connection / transport
        ip: clientIp,
        ipCoarse: coarseIp(clientIp),
        proxyChain,
        httpVersion: req.httpVersion,            // "1.1" | "2.0"
        method: req.method,
        protocol: req.protocol,                  // requires app.set('trust proxy', true) for correctness behind proxies
        host: h.host,
        portLocal: req.socket?.localPort,
        tls,                                     // undefined if TLS terminates before Node
        fetchMeta,

        // Core headers
        userAgent: ua,
        acceptLanguage: h["accept-language"],
        accept: h["accept"],
        encoding: h["accept-encoding"],
        dnt: h["dnt"],                           // "1" if Do Not Track (deprecated but sometimes present)
        referer: h["referer"],
        origin: h["origin"],

        // Client Hints (as-is)
        clientHints: ch,

        // Derived
        device: {
            type: deviceType,                      // "mobile" | "desktop" (coarse)
            isMobile
        },

        // Proxy awareness
        forwarded: {
            for: h["x-forwarded-for"],
            proto: h["x-forwarded-proto"],
            host: h["x-forwarded-host"],
            port: h["x-forwarded-port"]
        }
    };
}

export function deviceExtractMiddleware() {
    return (req, _res, next) => {
        req.deviceInfo = extractDeviceInfo(req);
        next();
    };
}
