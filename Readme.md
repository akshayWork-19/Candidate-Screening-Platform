# AI-Powered Candidate Screening Platform

Built for the myNachiketa GTM Engineering Intern assignment. Automates the
recruitment pipeline end-to-end: resume parsing, AI-based JD scoring,
repository-level GitHub analysis, ranking, automated test delivery and
scoring, and real Google Calendar/Meet interview scheduling.


## Features

- **Candidate dataset upload** — accepts both `.csv` and `.xlsx` files
  (real-world sample data often comes as Excel with multi-line cells and
  formula-based placeholder scores; both are handled natively, not by
  force-converting to CSV).
- **Duplicate-safe candidate matching** — matches by an external `s_no` row
  identifier rather than email, since sample/dummy datasets can reuse a single
  placeholder email across every row.
- **Resume processing** — downloads resume PDFs from links in the dataset and
  extracts structured data (skills, experience, projects, summary) via LLM.
- **AI-based JD relevance scoring** — scores each candidate 0-10 against the
  active job description, with a written rationale citing specific evidence
  (matched requirements, gaps) rather than a bare number — explainable by
  design, not bolted on.
- **Repository-level GitHub analysis** — evaluates a candidate's top non-forked
  repos on commit recency/frequency and README substance, then has the LLM
  reason about technical depth from those structured signals rather than
  vanity metrics like stars or followers.
- **Weighted, auditable ranking** — JD score, GitHub score, and CGPA combine
  into a single transparent formula (weights configurable in `.env`), so any
  candidate's rank is traceable back to its inputs.
- **Automated test delivery** — shortlisted candidates are emailed a link to a
  self-hosted assessment page automatically.
- **Self-hosted assessment page** (`/test.html`) — a candidate enters their
  email and answers a short logical-aptitude + coding MCQ set; scoring happens
  server-side and updates their record automatically, no manual CSV round-trip
  required. (A CSV upload path for offline test results still exists as a
  fallback.)
- **Automated interview scheduling** — candidates clearing the test threshold
  get a real Google Calendar event created with an auto-generated Google Meet
  link, plus an email invite — no manual scheduling step.
- **Recruiter dashboard** — view all candidates, scores, rationale, and
  pipeline status in one ranked table.
- **Durable, event-driven automation** — every pipeline stage is an
  independently retryable Inngest function, so a transient failure (e.g. a
  flaky GitHub API call) only retries that one step, not the whole candidate.

## Pipeline

```
Upload candidates (CSV/XLSX)
        │
        ▼
Download + parse resume PDF ── LLM structured extraction
        │
        ▼
Score against job description ── LLM score (0-10) + rationale
        │
        ▼
Analyze GitHub repos ── repo-level signals → LLM technical-depth score
        │
        ▼
Weighted ranking ── if above JD threshold → email self-hosted test link
        │
        ▼
Candidate completes assessment on /test.html
        │
        ▼
Score blended into final ranking ── if above test threshold →
        │
        ▼
Google Calendar event + Meet link created ── interview invite emailed
```

## Setup

```bash
cd server
npm install
cp .env.example .env   # fill in your credentials - see comments in the file
npm run dev
```

**One-time Google Calendar setup:** visit `http://localhost:4000/api/auth/google`
in your browser, log in with the account interviews should be scheduled from,
approve access, and copy the refresh token shown into `GOOGLE_REFRESH_TOKEN` in
`.env`. (Requires the account to be added as a test user under the OAuth
consent screen in Google Cloud Console while the app is unverified, and the
Google Calendar API enabled for the project.)

## API Reference

| Route | Method | Purpose |
|---|---|---|
| `/api/upload/candidates` | POST | Upload candidate dataset (CSV or XLSX) |
| `/api/upload/job-description` | POST | Set the active JD (`{ title, text }`) |
| `/api/upload/test-results` | POST | Upload offline test results (CSV/XLSX fallback) |
| `/api/candidates` | GET | List all candidates, ranked, for the dashboard |
| `/api/candidates/:id` | GET | Get a single candidate's full record |
| `/api/test/questions` | GET | Fetch assessment questions (answer key stripped) |
| `/api/test/submit` | POST | Submit assessment answers, triggers final scoring + scheduling |
| `/api/auth/google` | GET | One-time Google OAuth consent flow |
| `/test.html` | GET | Self-hosted candidate assessment page |

## Stack

Node.js, Express, MongoDB (Mongoose), Inngest (workflow orchestration), Groq
(Llama 3.3 70B) with Gemini 1.5 Flash fallback, GitHub REST API, Nodemailer
(Gmail SMTP), Google Calendar API.