import express, { json } from "express";
import cors from "cors";
import systemRoutes from "./routes/system.js";
import ynabRoutes from "./routes/ynab.js";
import weatherRoutes from "./routes/weather.js";

const app = express();
const PORT = process.env.PORT || 4211;

app.use(cors());
app.use(json());

app.use(systemRoutes);
app.use("/ynab", ynabRoutes);
app.use(weatherRoutes);

app.listen(PORT, "0.0.0.0", () => {
    console.log(`API Server running on port ${PORT}`);
});
