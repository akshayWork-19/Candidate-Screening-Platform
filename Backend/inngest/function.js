import axios from "axios";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { inngest } from "./inngestClient.js";
import Candidate from "../models/candidate.js";
import JobDescription from "../models/jobDescription.js";
import llmService from "../service/llmService.js";
import githubService from "../service/githubService.js";
import emailService from "../service/emailService.js";
import { scheduleInterview } from "../service/calendarService.js";

const W_JD = parseFloat(process.env.JD_SCORE_WEIGHT || 0.4);
const W_GITHUB = parseFloat(process.env.GITHUB_SCORE_WEIGHT || 0.3);
const W_CGPA = parseFloat(process.env.CGPA_WEIGHT || 0.1);
const W_TEST = parseFloat(process.env.TEST_SCORE_WEIGHT || 0.2);
const JD_THRESHOLD = parseFloat(process.env.JD_SCORE_SHORTLIST_THRESHOLD || 6);
const TEST_THRESHOLD = parseFloat(process.env.TEST_SHORTLIST_THRESHOLD || 60);

async function getActiveJD() {
    const jd = await JobDescription.findOne({ active: true }).sort({ createdAt: -1 });
    return jd?.text || "";
}

// STAGE 1: Download + parse resume
export const processResume = inngest.createFunction(
    { id: "process-resume" },
    { event: "candidate/uploaded" },
    async ({ event, step }) => {
        const { candidateId } = event.data;

        const resumeText = await step.run("download-and-extract-pdf", async () => {
            const candidate = await Candidate.findById(candidateId);
            if (!candidate?.resumeLink) return "";
            try {
                const response = await axios.get(candidate.resumeLink, {
                    responseType: "arraybuffer",
                });
                const parsed = await pdfParse(response.data);
                return parsed.text;
            } catch (err) {
                console.error(`[resume] download/parse failed for ${candidateId}:`, err.message);
                return "";
            }
        });

        const parsedResume = await step.run("llm-parse-resume", async () => {
            if (!resumeText) return { skills: [], experience: "", projects: [], summary: "" };
            return llmService.parseResume(resumeText);
        });

        await step.run("save-resume-data", async () => {
            await Candidate.findByIdAndUpdate(candidateId, {
                resumeText: resumeText.slice(0, 10000),
                resumeParsed: parsedResume,
                status: "RESUME_PROCESSED",
            });
        });

        await step.sendEvent("trigger-ai-evaluation", {
            name: "candidate/resume-processed",
            data: { candidateId },
        });
    }
);

// STAGE 2: JD relevance scoring
export const evaluateAgainstJD = inngest.createFunction(
    { id: "evaluate-against-jd" },
    { event: "candidate/resume-processed" },
    async ({ event, step }) => {
        const { candidateId } = event.data;

        const evaluation = await step.run("score-against-jd", async () => {
            const candidate = await Candidate.findById(candidateId);
            const jdText = await getActiveJD();
            const profile = {
                name: candidate.name,
                college: candidate.college,
                branch: candidate.branch,
                cgpa: candidate.cgpa,
                bestAiProject: candidate.bestAiProject,
                researchWork: candidate.researchWork,
                resumeParsed: candidate.resumeParsed,
            };
            return llmService.scoreAgainstJD(profile, jdText);
        });

        await step.run("save-jd-score", async () => {
            await Candidate.findByIdAndUpdate(candidateId, {
                jdScore: evaluation.score,
                jdRationale: evaluation.rationale,
                status: "AI_EVALUATED",
            });
        });

        await step.sendEvent("trigger-github-analysis", {
            name: "candidate/ai-evaluated",
            data: { candidateId },
        });
    }
);

// STAGE 3: GitHub repo-level analysis
export const analyzeGithub = inngest.createFunction(
    { id: "analyze-github" },
    { event: "candidate/ai-evaluated" },
    async ({ event, step }) => {
        const { candidateId } = event.data;

        const githubStats = await step.run("fetch-github-repos", async () => {
            const candidate = await Candidate.findById(candidateId);
            return githubService.analyzeGithubProfile(candidate.githubProfile);
        });

        const githubEval = await step.run("llm-score-github", async () => {
            if (!githubStats.topRepos?.length) {
                return { score: 0, rationale: "No public repositories found or invalid GitHub URL." };
            }
            const jdText = await getActiveJD();
            return llmService.scoreGithubActivity(githubStats.topRepos, jdText);
        });

        await step.run("save-github-data", async () => {
            await Candidate.findByIdAndUpdate(candidateId, {
                githubStats: {
                    publicRepos: githubStats.publicRepos,
                    topRepos: githubStats.topRepos,
                },
                githubScore: githubEval.score,
                githubRationale: githubEval.rationale,
                status: "GITHUB_ANALYZED",
            });
        });

        await step.sendEvent("trigger-ranking", {
            name: "candidate/github-analyzed",
            data: { candidateId },
        });
    }
);

// STAGE 4: Rank + shortlist for test, send test link email
export const rankAndShortlist = inngest.createFunction(
    { id: "rank-and-shortlist" },
    { event: "candidate/github-analyzed" },
    async ({ event, step }) => {
        const { candidateId } = event.data;

        const finalScore = await step.run("compute-preliminary-score", async () => {
            const candidate = await Candidate.findById(candidateId);
            const cgpaNorm = Math.min(10, (candidate.cgpa || 0) * 1.1); // normalize ~9 CGPA to ~10
            const score =
                (candidate.jdScore || 0) * W_JD * 10 +
                (candidate.githubScore || 0) * W_GITHUB * 10 +
                cgpaNorm * W_CGPA * 10;
            await Candidate.findByIdAndUpdate(candidateId, {
                finalScore: score,
                status: "RANKED",
            });
            return score;
        });

        await step.run("recompute-all-ranks", async () => {
            const all = await Candidate.find({ finalScore: { $ne: null } }).sort({
                finalScore: -1,
            });
            await Promise.all(
                all.map((c, i) => Candidate.findByIdAndUpdate(c._id, { rank: i + 1 }))
            );
        });

        const shouldSendTest = await step.run("check-shortlist-threshold", async () => {
            const candidate = await Candidate.findById(candidateId);
            return (candidate.jdScore || 0) >= JD_THRESHOLD;
        });

        if (shouldSendTest) {
            await step.run("send-test-link-email", async () => {
                const candidate = await Candidate.findById(candidateId);
                await emailService.sendTestLinkEmail(candidate);
                await Candidate.findByIdAndUpdate(candidateId, { status: "TEST_SENT" });
            });
        } else {
            await step.run("mark-rejected", async () => {
                await Candidate.findByIdAndUpdate(candidateId, { status: "REJECTED" });
            });
        }
    }
);

// STAGE 5: Test result received -> final shortlist -> schedule interview
export const finalizeAndSchedule = inngest.createFunction(
    { id: "finalize-and-schedule" },
    { event: "candidate/test-result-received" },
    async ({ event, step }) => {
        const { candidateId } = event.data;

        const finalCombinedScore = await step.run("compute-final-score", async () => {
            const candidate = await Candidate.findById(candidateId);
            const testAvg = ((candidate.testLaScore || 0) + (candidate.testCodeScore || 0)) / 2;
            const prelim = candidate.finalScore || 0;
            // Blend preliminary (JD+GitHub+CGPA) with test performance
            const combined = prelim * (1 - W_TEST) + testAvg * W_TEST;
            await Candidate.findByIdAndUpdate(candidateId, { finalScore: combined });
            return combined;
        });

        const passed = await step.run("check-test-threshold", async () => {
            const candidate = await Candidate.findById(candidateId);
            const testAvg = ((candidate.testLaScore || 0) + (candidate.testCodeScore || 0)) / 2;
            return testAvg >= TEST_THRESHOLD;
        });

        if (!passed) {
            await step.run("mark-rejected-post-test", async () => {
                await Candidate.findByIdAndUpdate(candidateId, { status: "REJECTED" });
            });
            return { scheduled: false, reason: "Below test threshold" };
        }

        await step.run("schedule-interview-and-invite", async () => {
            const candidate = await Candidate.findById(candidateId);

            // Simple slot logic: schedule 1 day out at 11 AM IST.
            // Replace with real calendar free/busy lookup for production use.
            const startTime = new Date();
            startTime.setDate(startTime.getDate() + 1);
            startTime.setHours(11, 0, 0, 0);

            const { eventId, meetLink } = await scheduleInterview({
                candidateName: candidate.name,
                candidateEmail: candidate.email,
                startTime,
            });

            await Candidate.findByIdAndUpdate(candidateId, {
                status: "INTERVIEW_SCHEDULED",
                interview: {
                    scheduledAt: startTime,
                    googleEventId: eventId,
                    googleMeetLink: meetLink,
                },
            });

            const updated = await Candidate.findById(candidateId);
            await emailService.sendInterviewInviteEmail(updated);
        });

        return { scheduled: true };
    }
);

export const functions = [
    processResume,
    evaluateAgainstJD,
    analyzeGithub,
    rankAndShortlist,
    finalizeAndSchedule,
];