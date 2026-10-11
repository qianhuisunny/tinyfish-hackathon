# TinyFish Founder Outreach

**Got a startup idea? Validate by talking to people first**

A founder customer-discovery app: start from a product URL, confirm a generated brief, discover matching companies, research the relevant people, and draft outreach using persistent context.

## Current status
This repository contains the approved interactive design and cloud implementation handoff. The live backend has not been implemented or verified yet.

- [Product requirements](docs/PRD.md)
- [TinyFish integration](docs/TINYFISH.md)
- [Implementation plan](docs/superpowers/plans/2026-10-11-cloud-implementation.md)
- [Approved English prototype](design/approved-prototype.html)

The prototype is a self-contained HTML file. Open it in a browser to review the agreed flow. Its companies, contacts, events and API activity are simulated; it does not send messages or run scheduled tasks.

The cloud implementation will use TinyFish Search for discovery, Fetch for evidence, and Agent for interactive site navigation. API keys must be supplied as server-side cloud environment secrets. No credentials are included.

## Scope
One ICP workspace, company rows, event-driven priority, read-only match-criteria details, contact Drill Through, context and draft panels. Comprehensive company search; demo contact research fixed to the top three confirmed companies. No automated message sending.
