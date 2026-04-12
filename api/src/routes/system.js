import { Router } from "express";

const router = Router();

router.get("/health", (_req, res) => {
    return res.json({ status: "🙃 ok 🏎️" });
});

router.get("/device", (req, res) => res.json(req.deviceInfo));

export default router;
