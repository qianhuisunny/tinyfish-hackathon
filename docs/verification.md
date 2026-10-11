# Verification — 2026-10-11

## Automated checks

25 behavioral tests passed with `npm test`; syntax checks passed with `npm run check`. Tests use controlled external responses and real local persistence/HTTP. They do not prove a successful live run by themselves.

A fresh independent code review found six Important issues: shared-page contact collapse, handled-event resurrection, partial Fetch loss, private contact-source forwarding, non-atomic scheduling, and domain-alias suppression. Each was reproduced in a failing regression test, fixed, and verified in the passing suite.

## Live run (in progress)

The real TinyFish Search and Fetch adapters succeeded. Product Gym URL reading returned `target_http_error`; onboarding succeeded using the user's supplied concept description. This is an explicit fallback, not a successful product-page fetch.

PostHog was verified through a real Agent browser run and an independently fetched exact quote. The app retained its unknown funding stage and its fit/source evidence. Contact research returned eight people, including James Hawkins and Tim Glaser (co-founders) and six customer-success staff. Dynamic profile pages required a separate Agent browser verification; these are labeled Agent browser, not Fetch-verified quotes. The contact job is partial because other team pages and product-marketing roles could not be verified. An editable draft was generated, then reviewed and saved through the UI. No message was sent. See [browser cross-check](evidence/manual-cross-check.md) for a model-excerpt defect and the independent profile check. Event monitoring is still running; its final status will be captured in the live-run artifact.

## Implementation decisions

- User explicitly changed execution from cloud to local after the cloud Work task failed to execute.
- Native Node ESM and runtime validation replace the planned TypeScript/Express stack.
- TinyFish browser research supplies grounded extraction; drafts use editable English templates, avoiding a separate LLM credential.
- Weekly schedules use seven-day intervals with explicit due timestamps, rather than Monday wall-clock cron.
- Conservative company/category/day event identity prevents paraphrase/syndication from reviving handled triggers, at the cost of grouping distinct same-day events.
- Dynamic contact verification uses a second browser Agent pass when Fetch cannot read the rendered profile. It is a model observation, labeled explicitly, and still requires human review.
- Two different jobs may run concurrently. The one-target demo can confirm verified matches while broader discovery continues; later matches remain unconfirmed.

Not claimed: production hosting, exhaustive market/contact coverage, automatic sending, general-purpose stylistic generation, or an always-on scheduler.

Deferred minor limitation: source publication metadata is not consistently available. The application stores event occurrence dates separately and does not treat crawl time as an event date.
