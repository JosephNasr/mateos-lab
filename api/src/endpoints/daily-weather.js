
export function buildDailyWeatherMessage(apiJson, opts = {}) {
    const city = opts.city ?? "Beirut";
    const tz = apiJson.timezone ?? "UTC";

    // ---- helpers ----
    const round1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : n);
    const fmtNum = (n, digits = 0) =>
        Number.isFinite(n) ? n.toFixed(digits) : String(n);

    const fmtTempRange = (min, max) => `~${round1(min)}–${round1(max)}°C`;
    const fmtTimeHHMM = (isoString) => {
        if (!isoString) return "";
        const d = new Date(isoString);
        return new Intl.DateTimeFormat("en-GB", {
            timeZone: tz,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        }).format(d);
    };
    const fmtWeekdayDate = (isoDate) => {
        // isoDate like "2026-02-18"
        const d = new Date(`${isoDate}T00:00:00`);
        return new Intl.DateTimeFormat("en-GB", {
            timeZone: tz,
            weekday: "short",
            month: "short",
            day: "2-digit",
        }).format(d); // e.g. "Wed, Feb 18"
    };

    // Safe accessor for daily arrays (day 0)
    const d0 = (key) => apiJson?.daily?.[key]?.[0];

    // ---- extract daily values ----
    const dateIso = d0("time");
    const tminFeels = d0("apparent_temperature_min");
    const tmaxFeels = d0("apparent_temperature_max");
    const tminAir = d0("temperature_2m_min");
    const tmaxAir = d0("temperature_2m_max");

    const precipProbMax = d0("precipitation_probability_max");
    const precipSum = d0("precipitation_sum");
    const precipHours = d0("precipitation_hours");

    const windMax = d0("wind_speed_10m_max");
    const gustMax = d0("wind_gusts_10m_max");

    const sunrise = d0("sunrise");
    const sunset = d0("sunset");
    const uvMax = d0("uv_index_max");

    const swingFeels = Number.isFinite(tmaxFeels) && Number.isFinite(tminFeels)
        ? tmaxFeels - tminFeels
        : null;

    // ---- classify conditions (human words) ----
    const isWindy = (Number.isFinite(windMax) && windMax >= 25) || (Number.isFinite(gustMax) && gustMax >= 40);
    const isVeryWindy = (Number.isFinite(windMax) && windMax >= 35) || (Number.isFinite(gustMax) && gustMax >= 60);

    const rainLikely = (Number.isFinite(precipProbMax) && precipProbMax >= 60) || (Number.isFinite(precipSum) && precipSum >= 2);
    const realRain = Number.isFinite(precipSum) && precipSum >= 8;

    const uvNote =
        Number.isFinite(uvMax) && uvMax >= 6 ? "Sunscreen / sunglasses." : null;

    // ---- outfit rules (based on feels-like MIN; then wind/rain adjustments) ----
    function baseWearFromFeelsMin(tmin) {
        if (!Number.isFinite(tmin)) return "Dress in comfortable layers.";

        if (tmin >= 24) return "Light shirt.";
        if (tmin >= 18) return "T-shirt or light long-sleeve.";
        if (tmin >= 12) return "Long-sleeve + a light jacket/hoodie.";
        if (tmin >= 6) return "Sweater + a medium jacket.";
        if (tmin >= 0) return "Warm layers + a heavy coat.";
        return "Heavy coat + warm base layer (hat/gloves if needed).";
    }

    let wearLine = baseWearFromFeelsMin(tminFeels);

    // Wind upgrade: if it’s cool + windy, push to windproof medium jacket language
    if (Number.isFinite(tminFeels) && tminFeels <= 12 && isWindy) {
        wearLine = "Long-sleeve + a windproof medium jacket/hoodie (the wind will make it feel colder).";
    } else if (isWindy) {
        wearLine = wearLine.replace(".", "") + " (windproof layer helps).";
    }

    const bottomsLine =
        Number.isFinite(tminFeels) && tminFeels >= 20
            ? "Shorts are fine if you prefer."
            : "Pants/jeans.";

    const layeringLine =
        Number.isFinite(swingFeels) && swingFeels >= 10
            ? "Layers recommended (it changes a lot through the day)."
            : null;

    // ---- bring rules ----
    let bringLine;
    if (realRain || (rainLikely && isWindy)) {
        bringLine = "A waterproof outer layer (better than an umbrella with this wind).";
    } else if (rainLikely) {
        bringLine = "An umbrella (showers likely).";
    } else if (Number.isFinite(precipProbMax) && precipProbMax >= 30) {
        bringLine = "A small umbrella (just in case).";
    } else {
        bringLine = null;
    }

    const shoesLine =
        Number.isFinite(precipSum) && precipSum >= 5
            ? "Closed shoes (wet ground likely)."
            : null;

    // ---- “next 12 hours” callout from hourly ----
    const h = apiJson?.hourly;
    const hTimes = h?.time ?? [];
    const hPrecip = h?.precipitation ?? [];
    const hPrecipProb = h?.precipitation_probability ?? [];
    const hWind = h?.wind_speed_10m ?? [];
    const hGust = h?.wind_gusts_10m ?? [];

    function buildNext12HoursCallout() {
        if (!Array.isArray(hTimes) || hTimes.length === 0) return null;

        // Find wind ramp time: first time wind >= 25 OR gust >= 40 after the first hour
        let windRampIdx = -1;
        for (let i = 0; i < hTimes.length; i++) {
            const w = hWind[i];
            const g = hGust[i];
            if ((Number.isFinite(w) && w >= 25) || (Number.isFinite(g) && g >= 40)) {
                windRampIdx = i;
                break;
            }
        }

        // Find any rain soon in next 12h (actual precip), else check high hourly probability
        let rainIdx = -1;
        for (let i = 0; i < hTimes.length; i++) {
            if (Number.isFinite(hPrecip[i]) && hPrecip[i] >= 0.2) {
                rainIdx = i;
                break;
            }
        }
        if (rainIdx === -1) {
            for (let i = 0; i < hTimes.length; i++) {
                if (Number.isFinite(hPrecipProb[i]) && hPrecipProb[i] >= 50) {
                    rainIdx = i;
                    break;
                }
            }
        }

        const parts = [];

        // Rain phrasing
        if (rainIdx >= 0) {
            parts.push(`Showers could start around ${fmtTimeHHMM(hTimes[rainIdx])}.`);
        } else if (rainLikely) {
            parts.push("Dry early, but showers are likely later today.");
        } else {
            parts.push("No rain expected soon.");
        }

        // Wind phrasing
        if (windRampIdx >= 0 && windRampIdx > 0) {
            parts.push(`Wind ramps up after ~${fmtTimeHHMM(hTimes[windRampIdx])}.`);
        } else if (isWindy) {
            parts.push("Windy through the morning.");
        }

        return parts.join(" ");
    }

    const next12hLine = buildNext12HoursCallout();

    // ---- top summary lines (friendly wording) ----
    const tempFeelStr = fmtTempRange(tminFeels, tmaxFeels);
    const tempAirStr = Number.isFinite(tminAir) && Number.isFinite(tmaxAir)
        ? ` (actual temp ~${round1(tminAir)}–${round1(tmaxAir)}°C)`
        : "";

    const windWord = isVeryWindy ? "Very windy" : isWindy ? "Windy" : "Breezy";
    const rainWord = rainLikely ? "Rain is likely" : "Low chance of rain";

    const rainDetail =
        Number.isFinite(precipProbMax) && Number.isFinite(precipSum) && Number.isFinite(precipHours)
            ? `(${fmtNum(precipProbMax, 0)}% chance • ${fmtNum(precipSum, 1)} mm)`
            : "";

    const sunLine =
        sunrise && sunset
            ? `Sun: ${fmtTimeHHMM(sunrise)}–${fmtTimeHHMM(sunset)}${Number.isFinite(uvMax) ? ` • UV ~${round1(uvMax)}` : ""}`
            : null;

    // ---- build message ----
    const lines = [];

    lines.push(`Good morning — ${city} today${dateIso ? ` (${fmtWeekdayDate(dateIso)})` : ""}:`);
    lines.push(`- ${windWord} and cool: feels like ${tempFeelStr}${tempAirStr}.`);
    lines.push(`- ${rainWord}${rainDetail ? ` ${rainDetail}` : ""}.`);
    if (sunLine) lines.push(`- ${sunLine}.`);
    lines.push("");
    lines.push("What to wear");
    lines.push(`- ${wearLine}`);
    lines.push(`- ${bottomsLine}`);
    if (layeringLine) lines.push(`- ${layeringLine}`);
    lines.push("");
    lines.push("What to bring");
    if (bringLine) lines.push(`- ${bringLine}`);
    if (shoesLine) lines.push(`- ${shoesLine}`);
    if (uvNote) lines.push(`- ${uvNote}`);
    if (next12hLine) {
        lines.push("");
        lines.push(`Quick note: ${next12hLine}`);
    }

    // One-line summary
    const quickTakeParts = [];
    if (Number.isFinite(tminFeels) && tminFeels <= 12) quickTakeParts.push("Cool");
    if (isVeryWindy) quickTakeParts.push("very windy");
    else if (isWindy) quickTakeParts.push("windy");
    if (rainLikely) quickTakeParts.push("showers likely");
    const quickTake = quickTakeParts.length ? quickTakeParts.join(", ") : "Pretty normal weather";
    lines.push("");
    lines.push(`Quick take: ${quickTake}.`);

    return lines.join("\n");
}

// Example usage:
// const msg = buildDailyWeatherMessage(openMeteoJson, { city: "Beirut" });
// console.log(msg);
