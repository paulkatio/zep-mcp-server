# ZEP MCP Server — HR & Time-Tracking

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/paulkatio/zep-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/paulkatio/zep-mcp-server/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue.svg)](https://modelcontextprotocol.io)

> 🇩🇪 [Deutsche Version](./README.md)

MCP server for the [ZEP](https://www.zep.de) REST API (target v7.8.74), focused on **HR and
time-tracking workflows**: employees, project times/attendances, absences, departments and terminals.
Runs as a local stdio server in any MCP client (Claude Desktop, Claude Code, Cursor, VS Code, …)
or self-hosted via a MetaMCP instance such as MCPHub.

> **Distribution:** self-hosted via Git clone — **no npm package**. The build runs locally at the
> consumer (`npm install && npm run build`). See [Installation](#installation--configuration) and the
> [MCPHub deployment guide](./docs/DEPLOY-MCPHUB.md).

## Why this server

The ZEP REST API covers the whole product (~85 endpoints). Day to day with an LLM you rarely
need all of it — you need focused, safe tools for **HR and time-tracking**: check attendance,
look up vacation, find an employee, report on departments. That's what this server provides:
24 curated tools with clear When/How/What descriptions, identifier safety (username vs. numeric
id), an audit log for writes, and clean module-gate behaviour for unlicensed areas. (28 tools total.)

## Contents

- [What this server does](#what-this-server-does)
- [What this server does NOT do (yet)](#what-this-server-does-not-do-yet)
- [Requirements](#requirements)
- [Installation & Configuration](#installation--configuration)
- [Distribution & Hosting](#distribution--hosting)
- [Tool overview](#tool-overview)
- [Identifier conventions](#identifier-conventions-️)
- [Environment variables](#environment-variables)
- [Examples](#examples)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Tested with](#tested-with)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

## What this server does

**28 tools (22 read + 6 write) + 4 resources**, focused on ZEP's HR/time-tracking modules:

- **Employees** – list, details, employment periods, regular working times, transponders, create/update
- **Attendances** (project times) – list, details, book
- **Absences** – list, details, create (vacation/sick leave)
- **Departments** – list, details, children, department employees
- **Terminals** (devices) – list, details
- **Insights** (aggregated, read-only) – team status today, attendance summary, vacation balance, pending requests
- **Master data** as resources – activities, categories, price groups, absence reasons

## What this server does NOT do (yet)

Deliberately **excluded**: the **Finance** (offers, invoices, articles, receipts), **Project
management**, **Tickets**, **CRM/customers** and **master-data** (locations, folders, dynamic
attributes) modules. These ~51 endpoints exist in the ZEP API but are gated by licence/module and are
not enabled on the reference tenant (see [`schemas/zep-inventory.json`](./schemas/zep-inventory.json)).
Need them? **Issues and PRs welcome.**

## Requirements

- ZEP module **"ZEP-Schnittstellen"** enabled (this is where the API token is generated)
- a **Bearer token** from that module
- **Node.js ≥ 20**

## Installation & Configuration

This server is **not distributed via npm** — clone and build it locally:

```bash
git clone https://github.com/paulkatio/zep-mcp-server.git
cd zep-mcp-server
npm install
npm run build      # produces dist/index.js
```

`ZEP_TENANT` is the path segment of your ZEP login URL (`https://www.zep-online.de/<TENANT>/…`);
in the example, `zepssigit`. Point your MCP client at the **absolute path** to `dist/index.js`:

### Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zep": {
      "command": "node",
      "args": ["/absolute/path/to/zep-mcp-server/dist/index.js"],
      "env": { "ZEP_API_TOKEN": "your-bearer-token", "ZEP_TENANT": "zepssigit" }
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json` (or `.cursor/mcp.json` in the project) — same structure:

```json
{
  "mcpServers": {
    "zep": {
      "command": "node",
      "args": ["/absolute/path/to/zep-mcp-server/dist/index.js"],
      "env": { "ZEP_API_TOKEN": "your-bearer-token", "ZEP_TENANT": "zepssigit" }
    }
  }
}
```

### Claude Code

```bash
claude mcp add zep \
  --env ZEP_API_TOKEN=your-bearer-token --env ZEP_TENANT=zepssigit \
  -- node /absolute/path/to/zep-mcp-server/dist/index.js
```

## Distribution & Hosting

This server is **not on npm**. It runs self-hosted via Git — directly via `npx` from GitHub, or
cloned/built locally. Recommended setups:

- **npx from GitHub** (no manual clone) — builds itself on install (`prepare` script).
  Claude Desktop config:
  ```json
  {
    "mcpServers": {
      "zep": {
        "command": "npx",
        "args": ["-y", "github:paulkatio/zep-mcp-server"],
        "env": { "ZEP_API_TOKEN": "your-bearer-token", "ZEP_TENANT": "zepssigit" }
      }
    }
  }
  ```
- **Cloned locally** in Claude Desktop / Cursor / Claude Code (see [Installation](#installation--configuration)).
- **Self-hosted MCPHub** (a MetaMCP instance, e.g. `mcp.ssig-it.com`) — central for multiple clients:
  **[docs/DEPLOY-MCPHUB.md](./docs/DEPLOY-MCPHUB.md)**.

Updates (local clone): `git pull && npm ci && npm run build`, then restart the server in the client/hub.

## Tool overview

### Read (18)

| Tool | Purpose |
| --- | --- |
| `zep_list_employees` | List employees (filter: personal_number) |
| `zep_get_employee` | Employee details by `username` |
| `zep_list_employee_absences` | An employee's absences |
| `zep_list_employee_employment_periods` | Employment periods |
| `zep_get_employee_employment_period` | Employment period detail |
| `zep_list_employee_regular_working_times` | Regular working times |
| `zep_get_employee_regular_working_time` | Regular working time detail |
| `zep_list_employee_transponders` | An employee's transponders |
| `zep_list_attendances` | Project times (filter: employee_id, start_date, end_date) |
| `zep_get_attendance` | Project time detail |
| `zep_list_absences` | Absences (filter: employee_id, start_date, end_date) |
| `zep_get_absence` | Absence detail |
| `zep_list_departments` | Departments |
| `zep_get_department` | Department detail |
| `zep_list_department_children` | Sub-departments |
| `zep_list_department_employees` | A department's employees |
| `zep_list_devices` | Terminals |
| `zep_get_device` | Terminal detail |

### Write (6)

| Tool | Purpose | Note |
| --- | --- | --- |
| `zep_create_employee` | Create employee | |
| `zep_update_employee` | Update employee | `destructiveHint`, GET-merge-PUT |
| `zep_create_employment_period` | Create employment period | |
| `zep_update_employment_period` | Update employment period | `destructiveHint`, GET-merge-PUT |
| `zep_create_attendance` | Book a project time | requires the project-management module (project_id/task_id/activity_id) |
| `zep_create_absence` | Create an absence | cannot be changed/deleted via API afterwards |

### Aggregate / insights (4, read-only)

Synthetic tools — they compose the GETs above client-side and own **no endpoint**. They set a
`truncated` flag when the 500-item scan cap is reached.

| Tool | Purpose |
| --- | --- |
| `zep_get_team_status_today` | Who is in/out today? Roster → present / absent / no_record (optional department_id) |
| `zep_get_employee_attendance_summary` | Project-time hours per day over a range (username, start_date, end_date) |
| `zep_get_employee_vacation_balance` | Vacation balance: entitlement vs. taken/pending (username, year); counts each leave once |
| `zep_list_pending_absences` | Not-yet-approved absences (approved !== true; optional employee_id/date filter) |

### Resources (4)

`zep://master-data/activities`, `zep://master-data/categories`, `zep://master-data/price-groups`,
`zep://master-data/absence-reasons` (MIME `application/json`).

## Identifier conventions ⚠️

> **Employees are addressed by `username`** (string, e.g. `max.mustermann`) — **NOT** by numeric ID.
> Wrong identifier type → 404 on the first attempt.
>
> All other resources (absences, departments, terminals, employment periods, regular working times)
> use **numeric IDs**.

## Environment variables

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `ZEP_API_TOKEN` | yes | — | Bearer token from "ZEP-Schnittstellen". Never logged. |
| `ZEP_TENANT` | yes | — | Tenant = path segment of the login URL, e.g. `zepssigit`. |
| `ZEP_BASE_URL` | no | `https://www.zep-online.de/${ZEP_TENANT}/next/api/v1` | Override (sandbox/self-hosting). |
| `ZEP_REQUEST_TIMEOUT_MS` | no | `30000` | HTTP timeout per request. |
| `ZEP_MAX_RETRIES` | no | `3` | Retries on 5xx/429. |
| `ZEP_CONCURRENCY_LIMIT` | no | `5` | Max parallel requests (temporarily 1 on 429). |
| `LOG_LEVEL` | no | `info` | `trace`/`debug`/`info`/`warn`/`error` (to stderr). |
| `AUDIT_LOG_PATH` | no | stderr | File path for the audit log (PUT/PATCH/DELETE). |

## Examples

- "Show my attendance/project times this week."
- "When did **max.mustermann** book vacation?"
- "Book me 8 hours for yesterday on project X." *(requires the project-management module)*
- "Which employees are off today?" *(→ `zep_get_team_status_today`)*
- "How much vacation does **max.mustermann** have left this year?" *(→ `zep_get_employee_vacation_balance`)*
- "How many hours did **jane.roe** log in May?" *(→ `zep_get_employee_attendance_summary`)*
- "Which absence requests are still pending?" *(→ `zep_list_pending_absences`)*
- "List all departments with their employee count."

## Security

- Token only from the env, never in schemas/outputs/logs (app logger redacts `authorization`/`token`).
- Write tools are annotated `destructiveHint`/non-destructive; updates use GET-merge-PUT.
- **Audit log** for every PUT/PATCH/DELETE (tool, resource_id, verb, changed field *names* — never values)
  on stderr (`stream: "audit"`) or a file (`AUDIT_LOG_PATH`).
- HTTPS-only, 30 s timeout, rate-limit respect (429 → 60 s backoff, concurrency 1).

## Troubleshooting

- **401** – token missing/expired, or the "ZEP-Schnittstellen" module is not active.
- **404 on the first try** – usually the wrong identifier type: `employees` need the `username`, not the
  numeric ID. Also: wrong `ZEP_TENANT` (HTML "Page not found 404").
- **"This endpoint is not enabled for your ZEP module/licence"** – module gate: the feature (e.g.
  internal-rates, or the master-data resources) is not enabled for your tenant.
- The **audit log** goes to stderr (marker `stream: "audit"`) or `AUDIT_LOG_PATH`.

## Tested with

Verified against **ZEP v7.8.74** on the `zepssigit` tenant: all 18 direct read tools and the 4
aggregate insight tools return real JSON (discovery + shape validation in
[`schemas/zep-inventory.json`](./schemas/zep-inventory.json) and [`inventory.md`](./inventory.md);
write-endpoint probe in [`schemas/zep-inventory-write-ops.json`](./schemas/zep-inventory-write-ops.json) —
the tenant exposes **no** update/delete/approve endpoints). Body schemas come from the ZEP OpenAPI
v7.4.0 spec and the live docs. Unit tests mock HTTP (undici MockAgent); live integration tests only
run with `ZEP_TEST_TOKEN` and never in CI.

<!-- screenshot:tba — example conversation with Claude Desktop -->

## Roadmap

More ZEP modules (finance, projects, tickets, CRM, master data) are possible once someone needs them
and submits PRs. The 51 not-yet-implemented endpoints are documented in
[`schemas/zep-inventory.json`](./schemas/zep-inventory.json).

## Contributing

Architecture details in [`BLUEPRINT.md`](./BLUEPRINT.md). Schema source:
[`schemas/zep-openapi-v7.4.0.yaml`](./schemas/zep-openapi-v7.4.0.yaml) (partial coverage; HR bodies are
maintained in `src/schemas/manual.ts`). Please send PRs with tests (`npm test`) and a `CHANGELOG.md` entry.

## License

MIT © 2026 SSIG-IT GmbH — see [LICENSE](./LICENSE).

## Disclaimer

Unofficial community server. Not affiliated with provista GmbH.
