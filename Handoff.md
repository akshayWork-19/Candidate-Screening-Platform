# HANDOFF: myNachiketa GTM Engineering Intern Assignment

**If you're a new AI agent picking this up:** read this whole file first. It has
everything you need — the assignment brief, architecture decisions already made,
what's built, what's left, and how to run it. Don't re-derive the architecture;
extend what's here unless something is actually broken.

## Deadline / context
- Interview: Friday 17 July 2026, 11:00 AM, in-person in Gurgaon.
- The assessment (this whole build) must be **emailed to the recruiter before
  arriving at the interview** — so the real deadline is the morning of the 17th.
- Candidate: Akshay Kumar, final-year B.Tech CSE, already has a TCS offer, using
  this project as a lever for a better role.
- Stack choice reuses his existing MERN + Inngest + Groq/Gemini pattern from his
  live project "TicketAssistant" — no new tech was introduced except Google
  Calendar/Meet OAuth, which is the highest-risk unfamiliar piece.

## Assignment brief (condensed)
Build an AI-powered candidate screening platform that:
1. Accepts a candidate CSV (Name, Email, College, Branch, CGPA, Best AI Project,
   Research Work, GitHub Profile, Resume Link).
2. Accepts a job description.
3. Downloads + parses resumes (PDF links).
4. Scores candidates against the JD using an LLM.
5. Analyzes GitHub profiles at the **repository level** (not just profile stats).
6. Ranks candidates with an explainable score.
7. Emails a test link to shortlisted candidates (candidate's own email/SMTP).
8. Accepts a test-results CSV (test_la, test_code fields).
9. Shortlists based on test performance.
10. Automatically schedules interviews with **real Google Calendar + Meet**
    integration and sends invites.

**Hard constraints:** must be publicly hosted, real Google Calendar integration
(not fake), GitHub analysis must be repo-level, any LLM/framework allowed.

**Deliverables:** hosted app link, GitHub repo w/ setup instructions,
architecture document, 5-10 min demo video.

## Architecture decisions already made
- **Pipeline orchestration:** Inngest, event-chained. Each stage emits an event
  that triggers the next stage. This is deliberate — it's durable (retries on
  failure), and it mirrors what Akshay already built in TicketAssistant, so no
  new mental model needed.
  - `candidate/uploaded` → resume download+parse
  - `candidate/resume-processed` → JD scoring
  - `candidate/ai-evaluated` → GitHub analysis
  - `candidate/github-analyzed` → ranking + test-link email
  - `candidate/test-result-received` → final scoring + interview scheduling
- **LLM:** Groq (llama-3.3-70b-versatile) primary, Gemini 1.5 Flash fallback if
  Groq call throws. Every scoring call is prompted to return a `rationale` field
  alongside the numeric score — this is the "explainable AI scoring" bonus point,
  and it's essentially free since we're already calling the LLM.
- **GitHub analysis:** repo-level, not profile-level. For each of a candidate's
  top 5 non-forked repos: commit frequency/recency (last 30 commits) and README
  quality (length as substance proxy). These numeric signals + repo metadata get
  handed to the LLM to produce a 0-10 score + rationale + concerns.
- **Scoring formula** (weights in `.env`, tune as needed):
  - Preliminary score (before test) = jdScore*0.4*10 + githubScore*0.3*10 + cgpaNorm*0.1*10
  - Final score (after test) = preliminary*(1-0.2) + testAvg*0.2
  - JD threshold to get sent a test: `jdScore >= 6` (out of 10)
  - Test threshold to get an interview: `testAvg >= 60` (out of 100)
  - These thresholds are guesses — tune them once you see real data, and say so
    explicitly in the architecture doc (shows engineering judgment).
- **Calendar/Meet:** Google OAuth2 with a one-time consent flow (`/api/auth/google`)
  that yields a refresh_token, stored in `.env`, reused for all future calls (no
  repeat user interaction). `conferenceDataVersion: 1` in the `calendar.events.insert`
  call is what actually generates the Meet link — easy to forget, is the #1
  thing that silently fails if omitted.
- **Email:** Nodemailer + Gmail App Password (per assignment: "candidates must
  use their own email service"). Interview invites doubly rely on Calendar's own
  `sendUpdates: "all"` which emails the Google Calendar invite, plus a separate
  custom email via Nodemailer for a nicer message.

## What's built (as of last session)
Full backend scaffold exists at `server/`:
- `src/models/Candidate.js`, `JobDescription.js` — Mongoose schemas
- `src/services/llmService.js` — Groq/Gemini resume parsing, JD scoring, GitHub scoring
- `src/services/githubService.js` — repo-level GitHub analysis
- `src/services/emailService.js` — Nodemailer test-link + interview-invite emails
- `src/services/calendarService.js` — Calendar/Meet scheduling
- `src/routes/upload.js` — candidate CSV upload, JD text upload, test-results CSV upload
- `src/routes/candidates.js` — list/get candidates for dashboard
- `src/routes/auth.js` — one-time Google OAuth consent flow
- `src/inngest/functions.js` — the 5-stage pipeline described above
- `src/index.js` — wires it all together, serves Inngest at `/api/inngest`
- `.env.example` — every credential needed, with comments

**None of this has been run/tested yet** — it's a first-pass scaffold written to spec,
not verified against a real CSV or real API responses. Treat function signatures
and field names as right-but-unverified.

## What's NOT built yet (priority order)
1. **Frontend** — nothing exists yet. Needs: CSV upload forms (candidates, test
   results), JD text input, candidate dashboard table (name, scores, rationale,
   status, rank). Minimal React + fetch calls against the Express API is enough;
   don't over-invest in styling given the time crunch.
2. **Testing against real data** — no dataset has been provided/tested yet by
   myNachiketa. Get the sample CSV, run it through `/api/upload/candidates`, and
   fix whatever breaks (probably: CSV column name mismatches, PDF parsing edge
   cases for non-standard resume formats, GitHub API rate limits without a token).
3. **Deployment** — Railway/Vercel for backend, needs MongoDB Atlas (free tier),
   real Groq/Gemini/GitHub/Google OAuth credentials filled into env vars on the
   host. Inngest needs either the Inngest Cloud dashboard connected or to run in
   `inngest dev` mode locally (won't work for a public hosted demo — must use
   Inngest Cloud for the hosted version, get free API keys at inngest.com).
4. **Google OAuth one-time setup** — needs a Google Cloud Console project with
   Calendar API enabled, an OAuth2 Client ID (Web application type), redirect
   URI matching `GOOGLE_REDIRECT_URI` in `.env`. This has to be done once by hand
   in a browser (visit `/api/auth/google`, consent, copy the refresh_token shown
   at the callback page into `.env`). This is the single most likely thing to
   eat unexpected time — do it FIRST, before frontend polish.
5. **ARCHITECTURE.md deliverable** — a polished write-up. Much of it can be
   lifted directly from this HANDOFF file's "Architecture decisions" section.
6. **Demo video** — record last, once everything works end-to-end.

## How to run locally
```bash
cd server
npm install
cp .env.example .env   # fill in real credentials
npm run dev             # starts Express on :4000

# In a separate terminal, for local Inngest dev server (not needed once on Inngest Cloud):
npx inngest-cli dev
```
Then hit `/api/auth/google` in a browser once to get the Calendar refresh token.

## Known risks / things likely to break
- `pdf-parse` chokes on scanned/image-based resumes (no OCR fallback built) —
  acceptable to note as a limitation in the architecture doc given time budget.
- GitHub API rate limits: 60/hr unauthenticated, 5000/hr with a token — a
  `GITHUB_TOKEN` in `.env` is not optional, it will fail without one at any
  real volume.
- Inngest local dev server won't be reachable once deployed unless using
  Inngest Cloud — don't leave this for the last hour.
- CSV column names in the real dataset may not exactly match assumptions in
  `upload.js` (e.g. "GitHub Profile" vs "GitHub"). Adjust parsing once the real
  sample CSV arrives.

## If you're a new agent continuing this
- Don't re-architect from scratch — the design above is deliberate and time-boxed.
- Prioritize: (1) Google OAuth setup, (2) test with real sample data, (3) minimal
  frontend, (4) deploy, (5) docs + video. In that order.
- Update this file's "What's built" / "What's NOT built" sections as you go, so
  the next handoff (if needed) stays accurate.