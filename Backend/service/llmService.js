import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Calls Groq first (fast + cheap), falls back to Gemini if Groq fails.
 * Mirrors the dual-model pattern already used in TicketAssistant.
 * Always asks for strict JSON so downstream parsing is reliable.
 */
async function callLLM(systemPrompt, userPrompt) {
    try {
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            temperature: 0.2,
            response_format: { type: "json_object" },
        });
        return JSON.parse(completion.choices[0].message.content);
    } catch (groqErr) {
        console.warn("[llm] Groq failed, falling back to Gemini:", groqErr.message);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(
            `${systemPrompt}\n\n${userPrompt}\n\nRespond ONLY with valid JSON, no markdown fences.`
        );
        const text = result.response.text().replace(/```json|```/g, "").trim();
        return JSON.parse(text);
    }
}

/**
 * Extracts structured fields from raw resume text.
 */
export async function parseResume(resumeText) {
    const system =
        "You are a resume parser. Extract structured data from resumes accurately without inventing information.";
    const user = `Resume text:\n"""${resumeText.slice(0, 6000)}"""\n\nReturn JSON with keys: skills (array of strings), experience (short string summary), projects (array of strings), summary (2-3 sentence overall summary).`;
    return callLLM(system, user);
}

/**
 * Scores a candidate against a job description with an explainable rationale.
 * This rationale is what earns "Explainable AI scoring" bonus points.
 */
export async function scoreAgainstJD(candidateProfile, jdText) {
    const system =
        "You are a technical recruiter evaluating candidate fit against a job description. Be objective, specific, and reference concrete evidence from the candidate's profile. Do not inflate scores.";
    const user = `Job Description:\n"""${jdText}"""\n\nCandidate Profile:\n${JSON.stringify(
        candidateProfile,
        null,
        2
    )}\n\nReturn JSON with keys: score (integer 0-10), rationale (2-4 sentences citing specific evidence), matchedRequirements (array of strings), gaps (array of strings).`;
    return callLLM(system, user);
}

/**
 * Analyzes a set of repo summaries and produces a technical contribution score.
 */
export async function scoreGithubActivity(repoSummaries, jdText) {
    const system =
        "You are a senior engineer evaluating a candidate's technical depth from their GitHub repository activity. Weigh code substance over vanity metrics like stars.";
    const user = `Job Description context:\n"""${jdText}"""\n\nRepository summaries:\n${JSON.stringify(
        repoSummaries,
        null,
        2
    )}\n\nReturn JSON with keys: score (integer 0-10), rationale (2-4 sentences), strongestRepo (string, repo name), concerns (array of strings, e.g. "mostly forked repos", "no recent activity").`;
    return callLLM(system, user);
}

export default { parseResume, scoreAgainstJD, scoreGithubActivity };