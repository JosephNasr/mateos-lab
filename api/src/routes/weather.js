import { Router } from "express";
import axios from "axios";
import { buildDailyWeatherMessage } from "../endpoints/daily-weather.js";
import { getBeirutWeatherData } from "../requests/weather.js";
import { tryAgainLater } from "../utils/errors.js";

const router = Router();

router.get("/weather", async (_req, res) => {
    try {
        const beirutWeatherDataRequest = getBeirutWeatherData();
        const response = await axios.get(beirutWeatherDataRequest.uri);

        if (response.status !== 200) return res.json({ message: "Could not get Weather data: " + response.statusText });

        buildDailyWeatherMessage(response.data);
        return res.json({ status: "🙃 ok 🏎️" });
    } catch (error) {
        return tryAgainLater(res, error);
    }
});

export default router;
