# TinyFish integration decisions
Verified against official documentation on 2026-10-11. Use server-side HTTP adapters so SDK-version differences do not become a dependency.

| Responsibility | API |
| --- | --- |
| Discover company/profile/event URLs | Search: GET https://api.search.tinyfish.ai with query and optional purpose, page, language, domain or date filters |
| Read product pages and verify evidence | Fetch: POST https://api.fetch.tinyfish.ai with urls and format |
| Navigate/filter/paginate interactive sources | Agent: POST https://agent.tinyfish.ai/v1/automation/run-async, then GET https://agent.tinyfish.ai/v1/runs/{id} |

All use X-API-Key from server-only TINYFISH_API_KEY. Search supports page 0–10. Fetch accepts at most 10 URLs per batch; inspect errors[] even on HTTP 200. Event verification uses ttl: 0 or a documented short freshness preference, not an unbounded cache. Agent accepts url, goal and output_schema; persist run_id, poll to a terminal state, and read result. Cancel through POST /v1/runs/{id}/cancel. Avoid beta-gated strict/max_steps and artifact capture unless account support is verified.

The two application “agents” (company discovery and contact research) orchestrate these adapters. TinyFish Agent is the actual browser-executed task when a source needs interaction. A plain page extraction belongs to Fetch; raw Browser and Vault are unnecessary for the MVP.

The backend LLM generates the brief, query plan, evidence-constrained assessments and drafts. Keep its provider configurable (LLM_API_KEY, LLM_MODEL, LLM_BASE_URL). TinyFish browsing is not a substitute for durable context, application scheduling or general-purpose drafting.

Daily monitoring is application-owned scheduled Search + Fetch verification; Agent can inspect interactive release/history pages when needed. Native TinyFish Monitor is a later option, not a dependency. Weekly discovery is a separate schedule. Both stop when the app process stops.

Sources:
- https://docs.tinyfish.ai/search-api/reference
- https://docs.tinyfish.ai/fetch-api/reference
- https://docs.tinyfish.ai/agent-api/reference

## Live verification
Run a real Product Gym onboarding attempt; record a real access failure if present and exercise pasted-description fallback. Find real matching companies, confirm the list, and research all relevant discoverable people at the frozen top three. Include one justified interactive source in Agent evidence. Save sanitized run IDs, URLs, timestamps, coverage gaps and primitive purpose in docs/verification.md. Do not commit API keys or private contact notes. If cloud credentials are missing, finish deterministic tests and request secure environment configuration; do not report a live success.
