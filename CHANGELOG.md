# Changelog

## 0.2.0

### Minor Changes

- de307db: Initial release — ZEP MCP Server for HR & time-tracking.

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

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org) and uses
[Changesets](https://github.com/changesets/changesets) for releases.

## 0.1.0 — Initial release

ZEP MCP Server for **HR & time-tracking** — stdio MCP server for the ZEP REST API,
runnable via `npx`.

### Added

- **24 tools** (18 read + 6 write) across five HR/time resources:
  - Employees: list, get, absences, employment periods (+detail), regular working
    times (+detail), transponders, create, update (GET-merge-PUT), create/update
    employment period.
  - Attendances (project times): list, get, create.
  - Absences: list, get, create (with a "no API edit/delete afterwards" warning).
  - Departments: list, get, children, department employees.
  - Devices/terminals: list, get.
- **4 master-data resources**: `zep://master-data/{activities,categories,price-groups,absence-reasons}`.
- **Identifier-aware schemas**: employees by `username`, all other resources by numeric id.
- **HTTP client**: undici, `p-limit` concurrency, retry with exponential backoff,
  60 s cooldown + concurrency-drop on HTTP 429.
- **`ZepApiError` with module-gate detection** — endpoints whose ZEP module is not
  licensed return a clear "feature not enabled" message instead of crashing.
- **Audit logger** (separate stream) for every PUT/PATCH/DELETE — records tool,
  resource id, verb and changed field _names_ (never values).
- Body schemas sourced from the ZEP OpenAPI v7.4.0 spec and the live documentation.
- App logger (pino, stderr, token redaction), strict Zod input validation, and
  destructive-tool annotations.

### Notes

- Verified against ZEP v7.8.74. The finance, project-management, ticket, CRM and
  master-data modules are **out of scope** for v0.1.0; their ~51 endpoints are
  documented in [`schemas/zep-inventory.json`](./schemas/zep-inventory.json).
