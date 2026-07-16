# Architecture Document

## Overview
An event-driven candidate screening pipeline. Each stage of the hiring workflow
is a discrete Inngest function triggered by an event emitted from the previous
stage, giving the system durable, retry-safe automation without a hand-rolled
job queue.

## Pipeline
```
CSV upload → candidate/uploaded
  → [download + parse resume PDF, LLM structured extraction]
  → candidate/resume-processed
  → [LLM scores candidate against JD, 0-10 + rationale]
  → candidate/ai-evaluated
  → [GitHub repo-level analysis: commit recency, README quality → LLM score]
  → candidate/github-analyzed
  → [weighted ranking, email test link if above threshold]
  → (recruiter uploads test results CSV)
  → candidate/test-result-received
  → [blend test score into final ranking, schedule interview if above threshold]
  → Google Calendar event created with Meet link, invite emailed
```

## AI evaluation approach
Two LLM-driven evaluations, each producing a numeric score *and* a rationale:

1. **JD relevance** — the candidate's resume-derived profile (skills, projects,
   experience summary) plus CGPA/research/best-AI-project fields are compared
   against the job description text. The model is prompted to cite specific
   evidence (matched requirements, gaps) rather than emit a bare number, which
   is what makes the score explainable rather than a black box.

2. **GitHub technical depth** — rather than scoring by follower count or star
   count (vanity metrics), the system pulls repo-level signals: which repos are
   forked vs. original, commit recency/frequency over the last 30 commits per
   repo, and README substance (length as a rough proxy for documentation
   effort). These structured signals are handed to the LLM, which reasons about
   technical depth the way a senior engineer skimming a portfolio would.

Both scores feed a transparent weighted formula (see `.env` for tunable
weights) rather than a second opaque LLM call for the final ranking — this
keeps the ranking auditable: a recruiter can see exactly why candidate A ranked
above candidate B.

## Why Inngest for orchestration
- Each pipeline stage is independently retryable — if a GitHub API call fails
  transiently, only that step retries, not the whole candidate's pipeline.
- Stages are decoupled: adding a new post-processing step (e.g. a plagiarism
  check on test results) means adding one new function listening for an
  existing event, not touching existing code.
- Matches patterns already proven in production on a related MERN + Groq +
  Inngest project (TicketAssistant), keeping engineering risk low under a tight
  timeline.

## Scalability considerations
- Each Inngest function processes one candidate per invocation — horizontally
  scales trivially since candidates are processed independently, no shared
  mutable state.
- GitHub API calls are the main external rate-limit constraint (5000/hr
  authenticated); at high volume this would need per-candidate queuing/backoff,
  which Inngest's built-in concurrency controls can throttle.
- MongoDB indexes on `email` (unique) and `finalScore` keep lookups and ranked
  dashboard queries fast as the candidate pool grows.

## Known limitations (explicit trade-offs given the assignment's time box)
- No OCR fallback for scanned/image-based resume PDFs.
- Scoring thresholds (JD >= 6/10, test >= 60/100) are initial estimates, not
  tuned against real historical hiring outcomes.
- Interview slot selection is a fixed next-day 11 AM placeholder rather than a
  real free/busy calendar lookup across multiple interviewers.