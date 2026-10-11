# TinyFish Founder Outreach

**Got a startup idea? Validate by talking to people first.**

A working single-user app for founders: describe your product, confirm your ideal customers, find companies and relevant people, then prepare outreach from persistent context. Live research uses TinyFish Search, Fetch, and Agent. No messages are sent.

## Run

Requires Node.js **20.20+** and a TinyFish API key with Search, Fetch and Agent access.

```sh
npm ci
cp .env.example .env
# Add TINYFISH_API_KEY to .env using your editor. Never commit it.
npm start
```

Open **http://localhost:4317**. No separate LLM credential is required. Agent handles browser-grounded research and structured extraction. Outreach is an editable, evidence-grounded English template; it is not a general-purpose AI copywriter.

This is a loopback-only local app, not a public deployment. Run only one server per `DATA_PATH`. JSON records are stored in `data/state.json`, excluded from Git. Keep that file to preserve your work. To start another workspace, use a different `DATA_PATH` in `.env`.

## Try the actual workflow

1. Enter your product link, or click **Try the Product Gym demo**. If the website cannot be read, use the visible pasted-description fallback. The demo button pre-fills the user's supplied product description; it does not invent a successful page fetch.
2. Review the three grouped forms: **ideal customers, outreach goal, people**. Confirm once to start live discovery. Company criteria become read-only.
3. The **ICP** table fills with verified companies, fit explanations and source evidence. Expand the research activity panel for queried pages, saved Agent run IDs and coverage gaps. Browser tasks may take several minutes each.
4. Remove unsuitable companies, then **Confirm current list and find contacts**. This freezes at most the top three currently retained companies. New companies found later remain unconfirmed. There is no three-company discovery cap and no one-person contact cap.
5. Right-click a company or use its **⋯ → Drill Through → Contacts** menu. Open a person, inspect evidence, save context notes and compose/edit/copy a draft.
6. **Check events now** checks launches, material changelog changes, relevant hires and funding. Eligible dated events change priority. Check timestamps and event dates are separate. Dismiss, snooze, or mark an associated draft contacted to stop that trigger elevating the company.
7. Mark contacted only after you send outside the app. The saved sent-message snapshot is immutable. Record replies to retain history.

**One-target live verification:** With the server running and a fresh workspace, run `npm run demo` in another terminal. This uses Product Gym's supplied concept description and searches open-source product analytics companies, choosing PostHog when verified. It confirms available matches for a one-target proof while broader discovery may continue; it does not insert fake companies, contacts or events. It saves `docs/evidence/live-run.json` only after obtaining a verified contact, creating a draft, and completing the monitoring job. A partial monitoring job is reported as partial, not as complete coverage. No outreach is transmitted.

## Why these primitives

| Primitive | Actual responsibility |
|---|---|
| Search | Multi-query/paginated discovery of candidate company, professional-profile and event sources. |
| Fetch | Read product pages and verify readable source quotes; retain per-URL failures. |
| Agent | Navigate company/team/directory/release pages, following menus, profiles and pagination to assess fit and extract people/events. Save run IDs and resume them after restart. |

The app owns JSON context, two-job scheduling, canonical-domain suppression, ranking, draft templates and communication history. Browser and Vault are not required.

## Scheduling and practical limits

- Weekly discovery and daily event checks use persisted interval due times and run **only while the server is running**. After downtime, one catch-up is persisted atomically with its next due time. There is no hosted cron service.
- Discovery covers up to six criterion-based queries, two pages each, and eight source domains per run by default. Adjust `DISCOVERY_SOURCE_BUDGET` in `.env`. All verified companies found within those sources are retained; remaining coverage is explicitly reported.
- Current contact research is intentionally limited to the first three confirmed company IDs. Later discovery or event reordering does not silently change that scope.
- Research is evidence-backed, not infallible. Company and event quotes are checked with Fetch. Contacts use Fetch when readable; dynamic pages escalate to a separate Agent browser verification, labeled on the source. Unknown funding stages cannot satisfy a specific-stage criterion; hypotheses are labeled. Human review remains necessary for fit and current-role interpretation.
- The MVP conservatively groups events by company, event category and occurrence date. This prevents paraphrased/syndicated reports reviving a handled event; distinct same-category events on the same day share a status. Multiple source links are preserved.
- Tone, language preferences, notes and replies are saved as context. Initial drafts use an English template with a tone-specific greeting; apply custom style, other languages and follow-up details in the editable draft.
- The server validates public HTTP(S) targets, rejects cross-origin mutations, escapes rendered text and never returns the API key. TinyFish controls its remote browser's navigation and redirect handling. This is not designed for public multi-user hosting.

## Verify

```sh
npm test
npm run check
```

Tests cover persistence rollback/concurrency, private URLs, provider failures, removal/suppression, fixed contact scope, shared team-page contacts, event ranking/deduplication, partial monitoring, atomic schedule recovery and immutable sent messages. See [verification](docs/verification.md) for the actual live run and its limits.

[Approved design](design/approved-prototype.html) · [PRD](docs/PRD.md) · [API integration](docs/TINYFISH.md)

## Package the app

`python3 scripts/package-app.py /tmp/app.zip` produces a source archive with the README at its root. Runtime data, `.env`, dependency folders and Git history are excluded. The recipient unzips it, follows **Run**, and supplies their own TinyFish key.
