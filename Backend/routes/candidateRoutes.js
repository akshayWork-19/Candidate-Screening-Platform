import express from "express";
import Candidate from "../models/candidate.js";

const router = express.Router();

// Dashboard: list all candidates sorted by rank
router.get("/", async (req, res) => {
    const candidates = await Candidate.find().sort({ finalScore: -1 });
    res.json(candidates);
});

router.get("/:id", async (req, res) => {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Not found" });
    res.json(candidate);
});

export default router;