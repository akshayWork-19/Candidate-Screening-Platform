import express from "express";
import multer from "multer";
import { parseSpreadsheet, normalizeRow } from "../utils/parseSpreadsheet.js";
import Candidate from "../models/Candidate.js";
import JobDescription from "../models/JobDescription.js";
import { inngest } from "../inngest/inngestClient.js";


const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// 1. Upload candidate dataset - accepts .csv or .xlsx
router.post("/candidates", upload.single("file"), async (req, res) => {
    try {
        const rawRecords = parseSpreadsheet(req.file.buffer, req.file.originalname);

        const inserted = [];
        for (let i = 0; i < rawRecords.length; i++) {
            const row = normalizeRow(rawRecords[i]);
            const sNo = rawRecords[i].s_no ?? rawRecords[i]["S.No"] ?? i + 1;

            // Match by sNo, not email - this sample dataset reuses one placeholder
            // email across every row, so email alone would collapse all candidates
            // into a single overwritten record.
            const candidate = await Candidate.findOneAndUpdate(
                { sNo },
                {
                    sNo,
                    name: row.name,
                    email: row.email,
                    college: row.college,
                    branch: row.branch,
                    cgpa: parseFloat(row.cgpa) || null,
                    bestAiProject: row.bestAiProject,
                    researchWork: row.researchWork,
                    githubProfile: row.githubProfile,
                    resumeLink: row.resumeLink,
                    // Some sample rows already carry test scores (even as formula
                    // placeholders) - capture them now if present, and skip the
                    // separate test-results upload step for those candidates later.
                    ...(row.testLa !== undefined && { testLaScore: parseFloat(row.testLa) || 0 }),
                    ...(row.testCode !== undefined && { testCodeScore: parseFloat(row.testCode) || 0 }),
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

// 3. Upload test results separately - accepts .csv or .xlsx, matched by sNo
// (falls back to email if sNo isn't present in a given file)
router.post("/test-results", upload.single("file"), async (req, res) => {
    try {
        const rawRecords = parseSpreadsheet(req.file.buffer, req.file.originalname);

        let updated = 0;
        for (const raw of rawRecords) {
            const row = normalizeRow(raw);
            const sNo = raw.s_no ?? raw["S.No"];
            const query = sNo !== undefined ? { sNo } : { email: row.email };

            const candidate = await Candidate.findOneAndUpdate(
                query,
                {
                    testLaScore: parseFloat(row.testLa) || 0,
                    testCodeScore: parseFloat(row.testCode) || 0,
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