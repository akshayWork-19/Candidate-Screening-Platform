# AI-Powered Candidate Screening Platform


## Setup

```bash
cd server
npm install
cp .env.example .env   # fill in your credentials - see comments in the file
npm run dev
```

One-time Google Calendar setup: visit `http://localhost:4000/api/auth/google` in
your browser, log in, approve access, and copy the refresh token shown into
`GOOGLE_REFRESH_TOKEN` in `.env`.

## Workflow
1. `POST /api/upload/candidates` — upload candidate CSV
2. `POST /api/upload/job-description` — provide JD text (`{ title, text }`)
3. `POST /api/upload/test-results` — upload test-results CSV once available
4. `GET /api/candidates` — view ranked candidates (dashboard reads this)

Everything past step 2 runs automatically via the Inngest pipeline: resume
parsing → JD scoring → GitHub analysis → ranking → test email → (after test
results) → final scoring → interview scheduling with Google Meet.

## Stack
Node.js, Express, MongoDB, Inngest (workflow orchestration), Groq (Llama 3.3)
+ Gemini fallback, GitHub REST API, Nodemailer, Google Calendar API.