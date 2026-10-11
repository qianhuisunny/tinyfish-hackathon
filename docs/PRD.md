# Founder Outreach — Product Requirements

Approved direction, 2026-10-11. Single-user MVP; approximately one hour of implementation, with asynchronous research allowed to finish later. Implementation happens in a cloud Work task, not a local development checkout. Cloud development does not imply production hosting or an always-running service.

## Product and visual reference
Help an aspiring founder validate a startup idea by finding appropriate companies, identifying the people who own the problem, and preparing contextual outreach.
Use `design/approved-prototype.html` as the approved English visual and interaction reference. Preserve its layout, palette, grouped brief, one ICP workspace, tables, detail panels, and exact headline:
**Got a startup idea? Validate by talking to people first**

Demo product: https://product-gym-demo.qianhuisun.chatgpt.site/#the-gym
Product Gym proposes hands-on product practice grounded in a codebase, with behavioral insights, for customers and internal teams. It is a concept, not proof of shipped codebase integration or training automation. Retell is an example in that demo, not a default prospect or partner.

## Onboarding
1. Separate landing page accepts a product URL.
2. Read the product, show analysis progress, then generate an editable summary and three question groups using a fixed form schema. If reading fails, allow the user to paste a description; show the failure honestly.
3. Show one group at a time, several questions together. Users may switch groups without losing input. No one-question-at-a-time chat.
   - Ideal customers: company types, stages, release cadence required/preferred/any, free-text size/location/exclusions.
   - Outreach goal: interviews, problem validation, trial, design partner, sales demo, relationship, or custom; desired next step; optional tone and language.
   - People: role chips and/or responsibility description.
4. Generate suggestions from the product, label them as suggestions, and let users change them before one final confirmation. Surface parsed free-text restrictions before confirmation. English UI and default message language.
5. ICP and people criteria can each be free text only. Any stage is exclusive with specific stages; choices within a field are OR, constraints across fields are AND. Preferred release speed is a ranking preference, required speed is a membership constraint.
6. Persist draft inputs; only confirmed context starts discovery. Product introduction, message style and notes can later change, but confirmed ICP criteria remain read-only.

## Company discovery and confirmation
An application-level discovery agent plans queries across selected segments, runs multiple searches/pages, verifies candidates and deduplicates by normalized domain. Do not limit company discovery to three. Show all verified results produced by the plan, reasons, sources, completed queries and coverage gaps. Comprehensive means the planned coverage, not a claim to exhaust the web.
The only company-list mutation is removal; no row editor or individual approval. Persist suppression so later discoveries cannot restore removed domains.
A global confirmation marks retained new companies confirmed. Only then research contacts. For the demo, freeze the top three retained company IDs at that moment (or all if fewer). Later event reordering cannot change that research scope.
Research all publicly discoverable, verifiable people in the selected roles/responsibilities at those companies, including equivalent titles. No one-person-per-company limit. Deduplicate by profile URL or company/name, cite current role evidence, and record coverage gaps. Other companies say “Not researched,” not “No contacts.”

## One ICP workspace
Exactly one primary tab, ICP. Airtable-like table, one company per row:
company/product; why it fits; latest matching event; event date; priority reason; contacts/research; outreach status; sources.
“Match criteria” opens a complete read-only panel from confirmed context: company type, stage, release cadence, original custom text, combination rules.
“Latest matching event” has a relative last-successful-check time (“Checked 2h ago”) and an info control listing the configured launch, changelog, relevant-hire and funding criteria, selected roles, lookback and frequency. The check time is distinct from event occurrence. A successful no-change check updates it; a failed check does not; before first success show “Not checked yet.”
Right-click or the accessible row overflow button opens Drill Through → Contacts. This stays in ICP with a company-scoped breadcrumb. Returning restores table scroll, ordering and selection.
Click a contact for company/person context, role/source evidence, manual notes, editable draft, copy action, communication history, mark contacted and record reply. No automatic sending. Capture immutable sentText when marking sent; editing a later draft must not rewrite it. Never invent a prior conversation.

## Recurring discovery and events
Two persisted schedules share a single-process worker:
- Weekly company discovery reuses confirmed criteria, appends only new matches, labels them new and requires confirmation before contact research.
- Daily monitoring checks existing confirmed companies, default 30-day lookback, for product launches, material workflow/feature changes in changelogs, hires matching target responsibilities and public funding.
Persist timezone (America/Los_Angeles default), due/last-run times, in-flight job IDs and results. Tick while the application process runs; do not overlap jobs. After restart, recover pending work and catch up once per overdue schedule. Display downtime/delay honestly. No always-on hosting promise.

ICP membership is independent of events. Verify event dates, deduplicate by stable event identity, and rank eligible events by relevance, occurrence time, then original fitRank. One strongest eligible event per company; duplicate reporting adds no weight. Unknown dates do not boost rank. Expired, dismissed, snoozed or contacted triggers cannot keep a company permanently elevated. Snoozed events are reevaluated on expiry. Keep manual statuses on refresh; preserve selected company IDs while sorting. Removing a company excludes it and its contacts/events from future tasks without deleting history.

## Context records
One versioned JSON document, stable IDs, ISO timestamps, unknown facts null, atomic serialized writes on the cloud app filesystem (or durable mounted volume when deployed). No vector DB.
- workspace: productUrl, productName, productDescription, productStage, contextConfirmedAt, criteriaVersion, onboardingDraft, listConfirmedAt, confirmedCompanyIds, demoContactCompanyIds.
- icpCriteria: companyTypes[], fundingStages[], shippingPreference, customText; surfaced parsed restrictions.
- outreachGoal: purpose, customText, callToAction; messageStyle: tone, language.
- targetPeople: roles[], responsibilityDescription.
- weeklyDiscovery: enabled, weekday, localTime, timeZone, nextRunAt, lastRunAt.
- eventMonitoring: enabled, intervalHours, eventTypes, relevanceCriteria, lookbackDays, nextRunAt, lastRunAt, lastSuccessfulCheckAt, lastError.
- companies: id, name, domain, criteriaVersion, fitReason, fitRank, productSummary, painHypothesis, notes, listStatus(new/confirmed/deleted), discoveredAt, deletedAt, sources.
- people: id, companyId, name, title, responsibility, contactUrl, notes, sources.
- searchRuns: id, type, criteriaVersion, companyIds, startedAt, completedAt, status, queriesCompleted, coverageGaps, newCompanyIds, providerRunIds.
- events: id, companyId, personId, type, summary, occurredAt, detectedAt, relevanceReason, matchesCriteria, priority, dedupeKey, status(new/snoozed/dismissed/contacted), snoozedUntil, sources.
- outreach: id, companyId, personId, eventId, draft, status(draft/sent/replied), sentText, sentAt, replySummary, nextStep.
sources = [{url, excerpt, checkedAt}]. Hypotheses must be labeled. Notes are user-owned. **Do not add learningContext or track a target company’s current documentation, training or onboarding methods as a structured field.**

## Delivery and boundaries
A runnable app with root setup instructions, an environment template, meaningful tests and a real-run verification report. Keep explicitly labeled sample mode separate from live mode. Never replace failed calls with invented live results.
No auto-send, CRM integration, login product, vector DB, separate Events tab, complex multi-agent framework or unrequested paid hosting.
Keys stay server-side; no credentials, user data or runtime JSON committed. Reject non-public/private target URLs, validate inputs and model output, treat fetched pages as data rather than instructions, retain partial results and handle rate/quota failures honestly.
Launch video, post and challenge archive are outside this initial one-hour implementation. The earlier challenge needs three primitives used meaningfully: Search, Fetch and Agent. Do not manufacture redundant calls to satisfy the count.
