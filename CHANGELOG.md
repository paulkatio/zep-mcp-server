# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org).

## 0.1.0 — Initial release

ZEP MCP Server for **HR & time-tracking** — stdio MCP server for the ZEP REST API.

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
  resource id, verb and changed field *names* (never values).
- Body schemas sourced from the ZEP OpenAPI v7.4.0 spec and the live documentation.
- App logger (pino, stderr, token redaction), strict Zod input validation, and
  destructive-tool annotations.

### Notes

- **Distribution strategy:** self-hosted via Git clone — **no npm package**. The build runs
  locally at the consumer (`npm install && npm run build`); see [`docs/DEPLOY-MCPHUB.md`](./docs/DEPLOY-MCPHUB.md).
- Verified against ZEP v7.8.74. The finance, project-management, ticket, CRM and
  master-data modules are **out of scope** for v0.1.0; their ~51 endpoints are
  documented in [`schemas/zep-inventory.json`](./schemas/zep-inventory.json).
