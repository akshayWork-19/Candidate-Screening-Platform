import express from "express";
import Candidate from "../models/Candidate.js";
import { QUESTIONS, publicQuestions } from "../utils/testSubmission.js";
import { inngest } from "../inngest/inngestClient.js";

const router = express.Router();

// GET questions (no answer key included)
router.get("/questions", (req, res) => {
    res.json(publicQuestions());
});

// POST submission: { email, answers: { [questionId]: selectedOptionIndex } }
router.post("/submit", express.json(), async (req, res) => {
    try {
        const { email, answers } = req.body;
        if (!email || !answers) {
            return res.status(400).json({ error: "email and answers are required" });
        }

        const candidate = await Candidate.findOne({ email });
        if (!candidate) {
            return res.status(404).json({ error: "No candidate found with this email" });
        }

        // Prevent re-submission overwriting a real result
        if (candidate.status === "TEST_RESULT_RECEIVED" || candidate.status === "INTERVIEW_SCHEDULED") {
            return res.status(409).json({ error: "Test already submitted for this candidate" });
        }

        let laCorrect = 0, laTotal = 0, codeCorrect = 0, codeTotal = 0;
        for (const q of QUESTIONS) {
            const selected = answers[q.id];
            if (q.category === "la") {
                laTotal++;
                if (selected === q.correct) laCorrect++;
            } else {
                codeTotal++;
                if (selected === q.correct) codeCorrect++;
            }
        }

        const testLaScore = laTotal ? Math.round((laCorrect / laTotal) * 100) : 0;
        const testCodeScore = codeTotal ? Math.round((codeCorrect / codeTotal) * 100) : 0;

        candidate.testLaScore = testLaScore;
        candidate.testCodeScore = testCodeScore;
        candidate.status = "TEST_RESULT_RECEIVED";
        await candidate.save();

        // Reuses the exact same pipeline stage that a CSV upload would trigger -
        // final scoring + interview scheduling happens automatically from here.
        await inngest.send({
            name: "candidate/test-result-received",
            data: { candidateId: candidate._id.toString() },
        });

        res.json({ message: "Test submitted successfully", testLaScore, testCodeScore });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

export default router;