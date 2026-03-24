export function deconstructSms(smsText) {
    if (!smsText || typeof smsText !== "string") {
        return _nulls();
    }

    const text = smsText.trim();

    // --- quick exits for obvious non-transactions ---
    // OTP messages
    if (/^\s*your\s+otp\b/i.test(text) || /\bUse it to complete trn?x\b/i.test(text)) {
        return _nulls();
    }
    // Rejected/declined attempts → treat as non-transaction
    if (/\b(rejected|declined)\b/i.test(text)) {
        return _nulls();
    }

    // --- detect inflow vs outflow ---
    // Heuristics:
    // - "approved for" => card purchase => OUTFLOW
    // - "has been credited" / "credited with|for" => credit/refund/payment => INFLOW
    // (If both appear, "credited" wins.)
    const isCredited =
        /\bhas been credited\b/i.test(text) ||
        /\bcredited (with|for)\b/i.test(text);

    const isApproved = /\bwas approved\b/i.test(text);

    const direction = isCredited ? "inflow" : (isApproved ? "outflow" : null);
    if (!direction) {
        // Unknown pattern → not a transaction
        return _nulls();
    }

    // --- extract account label ---
    // e.g., "Your neo Cedar Miles Credit Card ending 2988"
    //       "Your neo Debit card ending 1234"
    const accountMatch = text.match(
        /\bYour\s+([^\.]*?)(?:\s+ending\s+(\d{3,4}))?\b/i
    );
    let account = null;
    if (accountMatch) {
        const name = (accountMatch[1] || "").replace(/\s+/g, " ").trim();
        const last4 = accountMatch[2] || null;
        if (name) {
            account = last4 ? `${name} ending ${last4}` : name;
        }
    }

    // --- extract amount + currency ---
    // Accepts: "USD22.47", "USD 22.47", "EURO 5,000.00", "GBP.5", "EUR12.08", "GBP 30.20"
    // Capture currency token + number (with optional commas) and optional leading dot
    const moneyRegex = new RegExp(
        String.raw`\b(` +
        // common currency labels: USD, EUR, GBP, EURO, LBP, etc. (add more if needed)
        `USD|EUR|GBP|EURO|LBP|AED|SAR|TRY|CAD|AUD|CHF|JPY` +
        String.raw`)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|\.[0-9]+)\b`,
        "i"
    );

    // Prefer the amount that appears right after "approved for" or "credited ..."
    let amountCurrency = null;

    // 1) look near "approved for" / "credited (with|for)"
    const aroundDirMatch = (() => {
        const approvedFor = text.match(
            /\bapproved\s+for\s+([A-Z]{3,5}\s*[0-9.,]*\b|\b[A-Z]{3,5}\s*\.[0-9]+\b|\bEURO\s*[0-9.,]+\b)/i
        );
        if (approvedFor) return approvedFor[0];

        const creditedWithFor = text.match(
            /\bcredited\s+(?:with|for)\s+([A-Z]{3,5}\s*[0-9.,]*\b|\b[A-Z]{3,5}\s*\.[0-9]+\b|\bEURO\s*[0-9.,]+\b)/i
        );
        if (creditedWithFor) return creditedWithFor[0];

        return null;
    })();

    if (aroundDirMatch) {
        const m = aroundDirMatch.match(moneyRegex);
        if (m) amountCurrency = m;
    }

    // 2) fallback: first money occurrence in the text
    if (!amountCurrency) {
        amountCurrency = text.match(moneyRegex);
    }

    if (!amountCurrency) {
        return _nulls(); // transaction-like wording but no amount/currency = bail
    }

    let rawCurr = amountCurrency[1].toUpperCase();
    let rawNum = amountCurrency[2];

    // Normalize currency
    const currency = normalizeCurrency(rawCurr);

    // Normalize number: "5,000.00" -> 5000.00 ; ".5" -> 0.5
    const amountAbs = parseNumber(rawNum);
    if (amountAbs == null) return _nulls();

    const signedAmount = direction === "outflow" ? -amountAbs : amountAbs;

    // --- extract payee (if any) ---
    // e.g., "... at THAMESLINK WEBTIS. Available" -> "THAMESLINK WEBTIS"
    //       If not present (like "credited with ... from your account"), payee_raw = null
    let payee_raw = null;
    const atMatch = text.match(/\bat\s+(.+?)(?:\.|$)/i);
    if (atMatch) {
        // trim common tails like "Available:", timestamps, or trailing labels
        payee_raw = atMatch[1]
            .replace(/\bAvailable:.*$/i, "")
            .replace(/\bon\s+\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}.*/i, "")
            .trim();
        if (!payee_raw) payee_raw = null;
    }

    return {
        amount: signedAmount,
        currency,
        payee_raw,
        account,
    };

    // --- helpers ---
    function _nulls() {
        return { amount: null, currency: null, payee_raw: null, account: null };
    }

    function normalizeCurrency(c) {
        // Map EURO -> EUR (expand as needed)
        const map = { EURO: "EUR" };
        return map[c] || c;
    }

    function parseNumber(nstr) {
        try {
            const cleaned = nstr.replace(/,/g, "");
            if (/^\.\d+$/.test(cleaned)) {
                return Number("0" + cleaned); // ".5" -> 0.5
            }
            const num = Number(cleaned);
            return Number.isFinite(num) ? num : null;
        } catch {
            return null;
        }
    }
}
