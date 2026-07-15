import express from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import Candidate from "../models/Candidate.js";
import JobDescription from "../models/JobDescription.js";
import { inngest } from "../inngest/client.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// 1. Upload candidate dataset CSV
router.post("/candidates", upload.single("file"), async (req, res) => {
    try {
        const records = parse(req.file.buffer, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });

        const inserted = [];
        for (const row of records) {
            const candidate = await Candidate.findOneAndUpdate(
                { email: row.Email || row.email },
                {
                    name: row.Name || row.name,
                    email: row.Email || row.email,
                    college: row.College || row.college,
                    branch: row.Branch || row.branch,
                    cgpa: parseFloat(row.CGPA || row.cgpa) || null,
                    bestAiProject: row["Best AI Project"] || row.bestAiProject,
                    researchWork: row["Research Work"] || row.researchWork,
                    githubProfile: row["GitHub Profile"] || row.githubProfile,
                    resumeLink: row["Resume Link"] || row.resumeLink,
                    status: "UPLOADED",
                },
                { upsert: true, new: true }
            );
            inserted.push(candidate);
        }

        // Fire one event per candidate to kick off the pipeline in Inngest
        for (const c of inserted) {
            await inngest.send({
                name: "candidate/uploaded",
                data: { candidateId: c._id.toString() },
            });
        }

        res.json({ message: `Uploaded ${inserted.length} candidates`, count: inserted.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Provide job description
router.post("/job-description", express.json(), async (req, res) => {
    const { title, text } = req.body;
    await JobDescription.updateMany({}, { active: false });
    const jd = await JobDescription.create({ title, text, active: true });
    res.json(jd);
});

// 3. Upload test results CSV (fields: test_la, test_code, matched by email)
router.post("/test-results", upload.single("file"), async (req, res) => {
    try {
        const records = parse(req.file.buffer, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });

        let updated = 0;
        for (const row of records) {
            const email = row.Email || row.email;
            const candidate = await Candidate.findOneAndUpdate(
                { email },
                {
                    testLaScore: parseFloat(row.test_la) || 0,
                    testCodeScore: parseFloat(row.test_code) || 0,
                    status: "TEST_RESULT_RECEIVED",
                },
                { new: true }
            );
            if (candidate) {
                updated++;
                await inngest.send({
                    name: "candidate/test-result-received",
                    data: { candidateId: candidate._id.toString() },
                });
            }
        }

        res.json({ message: `Updated ${updated} candidates with test results` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

export default router;