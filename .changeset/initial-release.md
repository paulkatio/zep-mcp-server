---
"@ssig-it/zep-mcp-server": minor
---

Initial release — ZEP MCP Server for HR & time-tracking.

- 24 tools (18 read + 6 write) covering employees, attendances (project times),
  absences, departments and devices, plus 4 master-data resources.
- Identifier-aware schemas (employees by `username`, everything else by numeric id).
- Robust HTTP client: undici, concurrency limit, retry with backoff, 429 cooldown.
- `ZepApiError` with module-gate detection — gated endpoints return a clear
  "feature not enabled for your ZEP module/licence" message instead of crashing.
- Audit logger for all PUT/PATCH/DELETE; PUT updates use GET-merge-PUT.
- Body schemas sourced from the ZEP OpenAPI spec and live docs.

Verified against ZEP v7.8.74. Module-gated endpoints (finance, projects, tickets,
CRM, master data) are documented in `schemas/zep-inventory.json` and intentionally
out of scope for v0.1.0.
