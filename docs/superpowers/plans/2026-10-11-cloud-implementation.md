# Founder Outreach Cloud Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Tasks use checkbox steps for tracking.

**Goal:** Replace the approved mock workflow with a runnable, evidence-backed TinyFish customer-discovery app in the cloud.
**Architecture:** Preserve the approved HTML UI, move its mock state behind a small Node.js/TypeScript backend, and add a persisted job runner. Three TinyFish HTTP adapters supply evidence; a configurable LLM produces the brief, query plans, assessments and drafts. A single JSON store preserves context and schedules.
**Tech Stack:** Node.js 22+, TypeScript, Express, schema validation, native fetch, node:test or Vitest; existing HTML/CSS/JavaScript frontend. Pin installed versions in a lockfile.
**Spec:** docs/PRD.md. Visual reference: design/approved-prototype.html. API contract notes: docs/TINYFISH.md.

## Global constraints
- Cloud execution only; no local development checkout or paid hosting setup.
- Single-user MVP, approximately one hour of implementation; asynchronous external research may take longer.
- All product UI and generated demo copy in English.
- Keep the exact approved headline and one ICP main tab.
- Company search has no three-company cap; contacts are limited to the frozen top three confirmed companies, with no one-contact cap.
- No learningContext, automatic outreach sending, simulated live evidence or secrets in browser code.
- Preserve the full context model, event semantics and acceptance rules in docs/PRD.md.

## Review focus
- Provider partial failure must retain successful records and explicit coverage gaps (Tasks 1–3).
- Unknown or stale event dates, duplicate reporting and handled triggers must not boost rank (Task 4).
- Domain aliases and deleted companies must not return in weekly discovery (Task 3).
- Concurrent writes, double confirmation and restart must not duplicate jobs or lose user notes (Tasks 1, 3, 4).
- User/website text containing HTML or instructions must remain data, and private URL targets must be rejected (Tasks 1, 2, 5).

## File boundaries
- public/index.html, public/app.js, public/styles.css: approved UI with API-backed state.
- src/server.ts: routes and startup.
- src/types.ts, src/schemas.ts: domain records, input validation and model output schemas.
- src/store.ts: serialized atomic JSON transactions.
- src/providers/tinyfish.ts, src/providers/llm.ts: external HTTP adapters.
- src/jobs.ts: durable job records and polling recovery.
- src/onboarding.ts, src/discovery.ts, src/contacts.ts, src/events.ts, src/outreach.ts: workflow logic.
- src/scheduler.ts: persisted weekly/daily schedules with one catch-up.
- tests/: workflow and provider contract tests.
- README.md, .env.example, .gitignore, docs/verification.md: run instructions and evidence.

## Task 1 — Runtime, persistence and provider boundaries (about 10 minutes)
**Interfaces:** Store.read(): Promise<State>; Store.transact(update: (state: State) => void): Promise<State>. TinyFish.search(input): Promise<SearchResponse>; fetchPages(urls, options): Promise<FetchResponse>; startAgent(input): Promise<{runId}>; getAgent(runId): Promise<AgentRun>; cancelAgent(runId): Promise<AgentRun>. Llm.generate<T>(schema, input): Promise<T>.
- [ ] Write tests: failed transaction preserves the old file; parallel note updates both survive; private/non-HTTP URL rejected; Fetch HTTP-200 errors[] retained; 429 bounded retry; terminal failed Agent is not a success.
- [ ] Verify failure before implementing the corresponding behavior.
- [ ] Implement the store, schemas and adapters using docs/TINYFISH.md. Bound retries and request duration, never print credentials. Validate LLM output rather than trusting JSON text.
- [ ] Run tests and TypeScript checks. Commit the foundation.

## Task 2 — Product-driven onboarding (about 10 minutes)
**Interfaces:** analyzeProduct({url, pastedDescription?}): Promise<BriefDraft>; confirmBrief(draft): Promise<Workspace>.
- [ ] Test: inaccessible product permits manual text; unknown facts remain null; unsupported model output rejected; required-vs-preferred cadence distinction; Any stage exclusivity; free-text-only ICP/people; switching groups preserves draft.
- [ ] Implement Fetch product reading, LLM fixed-schema brief generation, draft saving and confirmation. Capture generated defaults as suggestions until confirmed.
- [ ] Reuse the prototype landing and three form groups. Remove fake analysis timers and fixed Product Gym-only branching from live mode.
- [ ] Verify in the browser, run tests, commit.

## Task 3 — Company and contact discovery (about 15 minutes)
**Interfaces:** discoverCompanies(workspaceId): Promise<Job>; confirmCompanies(workspaceId): Promise<{frozenCompanyIds, jobId}>; researchContacts(companyIds): Promise<Job>; removeCompany(id): Promise<void>.
- [ ] Tests: more than three verified companies are retained; domain normalization deduplicates; suppression survives rediscovery; premature contact research rejected; double confirmation is idempotent; later sorting does not change frozen IDs; multiple matching contacts per company retained; partial search coverage reported.
- [ ] Generate segment/query plans; paginate within documented limits and explicit budgets. Save queried scope and incomplete work. Use Fetch for source evidence and actual Agent navigation for interactive directories/team listings when justified.
- [ ] Verify company fit before insertion. Confirm list before contact discovery, freeze top three IDs, find all relevant verifiable people. Do not expand roles without responsibility evidence.
- [ ] Connect one ICP table, removal and Drill Through. Keep sources and role evidence visible. Test and commit.

## Task 4 — Monitoring, incremental discovery and ranking (about 10 minutes)
**Interfaces:** tick(now: Date): Promise<void>; monitorCompanies(ids): Promise<Job>; rankCompanies(state, now): Company[]; setEventStatus(id, status, snoozedUntil?): Promise<void>.
- [ ] Tests: date-unknown/expired/handled/duplicate events cannot boost; snooze expiry reevaluates; original fitRank restored; success with no events updates lastSuccessfulCheckAt; failure preserves it; restart catches up once; no overlapping schedules; weekly additions preserve notes and await confirmation.
- [ ] Persist schedules in America/Los_Angeles by default and use saved due times. Reuse discovery for weekly additions; Search/Fetch for event evidence. Keep source publication, event occurrence and check times separate.
- [ ] Wire relative check timestamps, info criteria list from configuration, event statuses and stable-ID reranking. Do not claim the worker runs while the app is stopped.
- [ ] Test and commit.

## Task 5 — Context, outreach and final proof (about 15 minutes)
**Interfaces:** draftMessage(personId): Promise<Outreach>; saveNote(entityId, text): Promise<void>; markSent(outreachId): Promise<void>; recordReply(outreachId, text): Promise<void>.
- [ ] Tests: sentText is immutable after draft edits; no history produces no invented follow-up; hypotheses labeled; pasted HTML displayed as text; secrets absent from UI responses; unrelated company contacts excluded from Drill Through.
- [ ] Draft from product/company/person/event/communication context. Add edits, copy, mark sent and replies. Match-criteria panel stays read-only and includes original custom text.
- [ ] Verify the full approved path in a browser, including error/partial states. Remove prototype-only chrome and simulation buttons from live mode; keep sample mode clearly labeled.
- [ ] Run all relevant tests, type checks and build. Run the live smoke workflow when securely provisioned credentials allow it; otherwise explicitly record the credential blocker.
- [ ] Write root run instructions, server-only secret names, worker-lifetime caveat, primitive mapping, source evidence and verification result. Commit, push, and open a draft PR if supported.

## Completion report
Report implemented behavior, exact verification commands/results, actual TinyFish primitive evidence, cloud run URL if available, repository/PR URL and remaining blockers. Do not label this app deployed or live-verified unless those actions actually occurred. Video, launch post and challenge archive remain a later task.
