import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema(
    {
        sNo: Number, // external row identifier from source dataset - used as the real
        // unique key, since sample data can have duplicate/placeholder emails
        name: String,
        email: { type: String, required: true }, // NOT unique - sample data reuses one email
        college: String,
        branch: String,
        cgpa: Number,
        bestAiProject: String,
        researchWork: String,
        githubProfile: String,
        resumeLink: String,

        // Populated after resume processing
        resumeText: String,
        resumeParsed: {
            skills: [String],
            experience: String,
            projects: [String],
            summary: String,
        },

        // AI JD-relevance evaluation
        jdScore: Number, // 0-10
        jdRationale: String,

        // GitHub analysis
        githubScore: Number, // 0-10
        githubRationale: String,
        githubStats: {
            publicRepos: Number,
            topRepos: [
                {
                    name: String,
                    language: String,
                    stars: Number,
                    commitFrequencyScore: Number,
                    readmeQualityScore: Number,
                },
            ],
        },

        // Test performance (from second CSV)
        testLaScore: Number,
        testCodeScore: Number,

        // Final combined ranking
        finalScore: Number,
        rank: Number,

        // Pipeline status - drives the automated progression
        status: {
            type: String,
            enum: [
                "UPLOADED",
                "RESUME_PROCESSED",
                "AI_EVALUATED",
                "GITHUB_ANALYZED",
                "RANKED",
                "TEST_SENT",
                "TEST_RESULT_RECEIVED",
                "SHORTLISTED_FINAL",
                "INTERVIEW_SCHEDULED",
                "REJECTED",
            ],
            default: "UPLOADED",
        },

        interview: {
            scheduledAt: Date,
            googleEventId: String,
            googleMeetLink: String,
        },
    },
    { timestamps: true }
);

const Candidate = mongoose.models.Candidate || mongoose.model("Candidate", candidateSchema);
export default Candidate;