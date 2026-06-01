# ZEP MCP Server — Architektur-Blueprint (v0.2.3)

## 1. Projekt-Metadaten

| Feld | Wert |
| --- | --- |
| npm-Package | `@{org}/zep-mcp-server` |
| Version (initial) | `0.1.0` |
| Lizenz | MIT |
| MCP-Namespace | `io.github.{org}/zep-mcp-server` |
| ZEP-API-Version (Ziel) | v7.8.74 (Live-Stand Jan 2026) |
| OpenAPI-Spec-Stand | v7.4.0 vom Mai 2025 — **deckt nur 34 von ~85 Endpunkten ab** (siehe Sektion 7) |
| Repository | `https://github.com/{org}/zep-mcp-server` |
| Ziel-Hosts | Claude Desktop, Claude Code, Cursor, VS Code Copilot, Continue.dev, ChatGPT, alle MCP-konformen Clients ohne Anpassung |
| Standard-Aufruf | `npx -y @{org}/zep-mcp-server` |
| Transport v0.1 | stdio only |
| Sprache | TypeScript (ESM, Node ≥ 20) |
| README-Sprachen | Deutsch + Englisch ab Tag 1 |

## 2. Repository-Struktur

```
zep-mcp-server/
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint + Test + Build + Bundle-Size + mcp-scan + Semgrep
│       ├── release.yml             # changesets-Release auf main
│       ├── npm-publish.yml         # npm publish auf Tag v*
│       └── mcp-registry.yml        # MCP-Registry-Publish, manueller Trigger
├── schemas/
│   ├── zep-openapi-v7.4.0.yaml     # Snapshot (deckt nur ~34 Endpunkte ab)
│   └── COVERAGE.md                 # Welche Endpunkte aus Spec generiert, welche manuell
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── config.ts
│   ├── client/
│   │   ├── http.ts                 # Bearer, Retry, Timeout, p-limit
│   │   ├── errors.ts
│   │   └── pagination.ts
│   ├── tools/
│   │   ├── projects.ts             # priorisiert nach Personal-Workflow-Naehe
│   │   ├── attendances.ts          # Kern-Workflow Zeiterfassung
│   │   ├── planning.ts
│   │   ├── tickets.ts
│   │   ├── employees.ts            # 17 Tools, Personal-Schwerpunkt
│   │   ├── departments.ts
│   │   ├── absences.ts
│   │   ├── customers.ts
│   │   ├── offers.ts
│   │   ├── invoices.ts
│   │   ├── invoice-items.ts
│   │   ├── articles.ts
│   │   ├── receipts.ts
│   │   ├── locations.ts
│   │   ├── devices.ts
│   │   ├── folders.ts
│   │   └── raw.ts                  # zep_raw_get + zep_raw_write
│   ├── resources/
│   │   └── master-data.ts          # activities, categories, price-groups, absence-reasons
│   ├── schemas/
│   │   ├── generated/              # via openapi-zod-client (nur ~34 Endpunkte)
│   │   │   ├── zod-schemas.ts
│   │   │   └── types.ts
│   │   ├── manual.ts               # Hand-gepflegte Zod-Schemas fuer ~50 nicht-in-Spec Endpunkte
│   │   ├── identifiers.ts          # Dedizierte Identifier-Typen (siehe Sektion 7)
│   │   ├── refinements.ts          # LLM-UX-Polish: Descriptions im When/How/What-Format
│   │   ├── common.ts               # Pagination, AutoPaginate, IdFilter, DateRange
│   │   └── annotations.ts          # Tool-Annotations-Konstanten
│   └── lib/
│       ├── logger.ts
│       ├── audit.ts
│       ├── retry.ts
│       └── merge.ts                # GET-merge-PUT-Helper
├── scripts/
│   ├── sync-spec.ts                # Laedt OpenAPI-YAML manuell
│   └── generate-zod.ts             # openapi-zod-client Wrapper
├── tests/
│   ├── unit/tools/
│   ├── unit/resources/
│   ├── integration/live.test.ts
│   └── fixtures/zep-responses/
├── .env.example
├── .gitignore
├── .npmignore
├── .nvmrc
├── eslint.config.js
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tsup.config.ts                  # --minify, single-file, externals: keine (zod inlined)
├── vitest.config.ts
├── server.json
├── LICENSE
├── README.md
├── README.en.md
└── BLUEPRINT.md
```

## 3. Tech-Stack & Dependencies

| Package | Version | Zweck | Pflicht |
| --- | --- | --- | --- |
| `@modelcontextprotocol/sdk` | `^1.29.0` | MCP-Server-Framework, Tool/Resource-Registrierung, stdio-Transport | Pflicht |
| `zod` | `^3.25.0` oder `^4.0.0` | Input-Validierung, Tool-Schemas | Pflicht |
| `undici` | `^7.x` | HTTP-Client mit Timeouts/Dispatchers | Pflicht |
| `p-limit` | `^6.x` | Concurrency-Semaphore für ZEP-Requests | Pflicht |
| `pino` | `^9.x` | Strukturiertes Logging (app + audit Logger) | Pflicht |
| `dotenv` | `^17.x` | `.env`-Laden in Development | Optional |
| `typescript` | `^5.6.x` | Compiler | Pflicht (dev) |
| `tsx` | `^4.x` | Lokaler Dev-Start ohne Build | Pflicht (dev) |
| `tsup` | `^8.x` | Bundling: `--minify`, Single-File-Output, Zod inlined | Pflicht (dev) |
| `openapi-zod-client` | aktuell | Generiert Zod-Schemas aus OpenAPI-YAML (Teilmenge) | Pflicht (dev) |
| `vitest` | `^3.x` | Unit + Integration Tests | Pflicht (dev) |
| `msw` | `^2.x` | HTTP-Mocks in Tests | Pflicht (dev) |
| `@changesets/cli` | `^2.x` | Versionierung, Changelog, Release | Pflicht (dev) |
| `eslint` + `@typescript-eslint/*` | aktuell | Linting | Pflicht (dev) |

Security-Tools sind **keine npm-Packages**: `mcp-scan` (Invariant Labs, inzwischen migriert zu `snyk-agent-scan`) und `semgrep` sind Python-Tools und laufen als separate CI-Steps via `uvx`/`pipx` bzw. GitHub-Action (siehe Sektion 14), nicht als `devDependencies`.

Versionsangaben sind Floors — Lockfile committen. Bundle-Ziel: < 500 KB nach `tsup --minify`.

## 4. Konfiguration & Secrets

| Env-Variable | Typ | Default | Pflicht | Beschreibung |
| --- | --- | --- | --- | --- |
| `ZEP_API_TOKEN` | string | — | ja | Bearer Token aus ZEP-Modul „ZEP-Schnittstellen". Nur im `Authorization`-Header, nie geloggt, nie ans LLM exponiert. |
| `ZEP_TENANT` | string | — | ja | Mandantenname (Pfadsegment), z.B. `ssig-it`. |
| `ZEP_BASE_URL` | string (URL) | `https://www.zep-online.de/${ZEP_TENANT}/next/api/v1` | nein | Override für Sandbox/Self-Hosting. |
| `ZEP_REQUEST_TIMEOUT_MS` | number | `30000` | nein | HTTP-Timeout pro Request. |
| `ZEP_MAX_RETRIES` | number | `3` | nein | Retries bei 5xx/429 mit exponential backoff. |
| `ZEP_CONCURRENCY_LIMIT` | number | `5` | nein | Max. parallele Requests gegen ZEP. Bei 429 temporär auf 1. |
| `LOG_LEVEL` | `trace`/`debug`/`info`/`warn`/`error` | `info` | nein | pino-Level für App-Logger. |
| `AUDIT_LOG_PATH` | string | — (Stream) | nein | Optionaler File-Pfad für Audit-Logger. Ohne: Audit auf stderr mit Marker-Field. |

Konfiguration wird in `src/config.ts` mit Zod geparst, Token-Wert beim Logging redacted. Pflichtfelder fehlend → Server startet nicht (clear error message auf stderr).

## 5. Architektur-Diagramm

```
┌─────────────────────────┐
│  MCP Client             │
│  (Claude Desktop,       │
│   Cursor, Claude Code,  │
│   VS Code, ChatGPT, …)  │
└──────────┬──────────────┘
           │ JSON-RPC 2.0 ueber stdio
           ▼
┌───────────────────────────────────────┐
│  McpServer (src/server.ts)            │
│  ─ 92 Tools, flat registriert         │
│  ─ Master-Data via 4 Resources        │
│  ─ Input-Validierung via Zod .strict()│
└───────────────────┬───────────────────┘
                    │ typisierte Calls
                    ▼
┌───────────────────────────────────────┐
│  ZEP API Client (src/client/http.ts)  │
│  ─ Bearer-Header-Injection            │
│  ─ p-limit (default 5, bei 429: 1)    │
│  ─ Retry, Timeout, Error-Mapping      │
│  ─ Pagination-Helper                  │
└───────────────────┬───────────────────┘
                    │ HTTPS
                    ▼
┌───────────────────────────────────────┐
│  ZEP REST API                         │
│  https://www.zep-online.de/           │
│       ${ZEP_TENANT}/next/api/v1/      │
└───────────────────────────────────────┘
```

Streamable-HTTP-Transport ist als v0.2-Feature geplant und nicht Teil des v0.1-Scope.

## 6. Tool-Katalog

**Designprinzip:** Flat registry, alle Tools direkt sichtbar in `tools/list`. Keine Discovery-Indirektionen, keine Visibility-Tiers. Moderne Claude-Modelle handhaben 80–100 Tools zuverlässig; vergleichbare produktive MSP-Server (Autotask 98, Datto RMM 55, IT-Glue 56) laufen ebenfalls mit flat registry.

**Token-Realität (transparent dokumentiert):** Tool-Definitionen kosten ~250–710 Tokens pro Tool im Kontextfenster. Aktueller Stand: **92 Tools (66 Read + 20 Write + 6 Delete)** plus 4 Resources. Bei mittlerem Schätzwert (500 Tokens/Tool) sind das ~46.000 Tokens Schema-Bloat vor dem ersten User-Prompt — bei Sonnet 4's 200k-Window etwa 23 %. **Discovery gegen Live-Tenant (siehe `discover-zep-endpoints.mjs`) hat alle 69 GET-Endpunkte als 200 OK bestätigt — keine Reduktion durch nicht-existente Pfade möglich.** Mitigation ohne Hidden-Layer:

- Tool-Descriptions strikt im **When/How/What-Format** (siehe Sektion 9.1) — 1–2 Sätze, keine API-Doku-Prosa
- `.describe()` auf Input-Feldern nur dort wo nicht trivial
- 4 Master-Data-Lookups als Resources statt Tools (Sektion 6.4) — spart 4 Tool-Slots

**Personal-Schwerpunkt:** Pauls Hauptanwendungsfall ist Zeiterfassung + Mitarbeiter-Workflows. Die 25 Personal-Tools (`employees`, `departments`, `absences`, `absence-reasons`) kriegen **vor allen anderen** kuratierte When/How/What-Descriptions. Finance/Master-Data-Tools dürfen v0.1 mit generischen Descriptions ausliefern und werden in v0.2 nachgezogen.

**Naming-Konvention:** `zep_<verb>_<resource>[_<sub>]`. Verben: `list`, `get`, `create`, `update`, `delete`, `upload`. Snake_case.

**Path-Parameter — kritisch, weicht von API-Standard ab:**

- `employees` nutzt **`{username}`** (String, z.B. `max.mustermann`), nicht numerische ID.
- `customers` nutzt **`{customer_number}`** (String, z.B. `K-12345`), nicht numerische ID. Hinweis: Customers haben zusätzlich eine interne `id` (Integer) in Response-Bodies, aber Path-Operationen verwenden `customer_number`.
- Sub-Resource-Parameter sind **snake_case**: `{task_id}`, `{subtask_id}`, `{amount_id}`.
- Employee-Sub-Resources nutzen `{id}` als Sub-Param: `/employees/{username}/employment-periods/{id}`, `/employees/{username}/internal-rates/{id}`, `/employees/{username}/regular-working-times/{id}`, `/employees/{username}/meals/{id}`.
- Numerische `{id}` weiterhin für: `projects`, `tickets`, `receipts`, `absences`, `departments`, `devices`, `offers`, `invoices`, `invoice-items`, `articles`, `locations`, `location-lists`, `dynamic-attributes`, `folders`.

**Universelle Listing-Parameter** (für `zep_list_*` mit Filter-Support, gemäß `/filter`-Doku: projects, attendances, employees, customers, absences, receipts, tickets, invoice-items): `limit?` (1–100), `page?`, `auto_paginate?` (default false), `max_items?` (default 100, max 500).

### 6.1 Read-only Tools (GET)

| Tool | Endpunkt | Zweck | Path-Param-Typ |
| --- | --- | --- | --- |
| `zep_list_projects` | `/projects` | Projekte | — (Listing) |
| `zep_get_project` | `/projects/{id}` | Projekt-Details | `id`: integer |
| `zep_list_project_activities` | `/projects/{id}/activities` | Aktivitäten | `id`: integer |
| `zep_list_project_employees` | `/projects/{id}/employees` | Projektmitarbeiter | `id`: integer |
| `zep_list_project_tasks` | `/projects/{id}/tasks` | Projektvorgänge | `id`: integer |
| `zep_get_project_task` | `/projects/{id}/tasks/{task_id}` | Vorgang-Details | `id`+`task_id`: integer |
| `zep_list_project_price_tables` | `/projects/{id}/price-tables` | Projekt-Preistabellen | `id`: integer |
| `zep_list_project_locations` | `/projects/{id}/locations` | Projekt-Standorte | `id`: integer |
| `zep_list_attendances` | `/attendances` | Projektzeiten | — |
| `zep_get_attendance` | `/attendances/{id}` | Einzel-Projektzeit | `id`: integer |
| `zep_list_planning` | `/planning` | Planungseinträge | |
| `zep_list_tickets` | `/tickets` | Tickets | — |
| `zep_get_ticket` | `/tickets/{id}` | Ticket-Details | `id`: integer |
| `zep_list_subtasks` | `/tickets/{id}/subtasks` | Teilaufgaben | `id`: integer |
| `zep_get_subtask` | `/tickets/{id}/subtasks/{subtask_id}` | Teilaufgabe-Detail | `id`+`subtask_id`: integer |
| `zep_list_employees` | `/employees` | Mitarbeiter | — |
| `zep_get_employee` | `/employees/{username}` | Mitarbeiter-Details | **`username`: string** |
| `zep_list_employee_absences` | `/employees/{username}/absences` | Abwesenheiten eines MA | `username`: string |
| `zep_list_employee_employment_periods` | `/employees/{username}/employment-periods` | Beschäftigungszeiträume | `username`: string |
| `zep_get_employee_employment_period` | `/employees/{username}/employment-periods/{id}` | Detail | `username`: string, `id`: integer |
| `zep_list_employee_internal_rates` | `/employees/{username}/internal-rates` | Stundensätze | `username`: string |
| `zep_get_employee_internal_rate` | `/employees/{username}/internal-rates/{id}` | Detail | `username`: string, `id`: integer |
| `zep_list_employee_regular_working_times` | `/employees/{username}/regular-working-times` | Regelarbeitszeiten | `username`: string |
| `zep_get_employee_regular_working_time` | `/employees/{username}/regular-working-times/{id}` | Detail | `username`: string, `id`: integer |
| `zep_list_employee_meals` | `/employees/{username}/meals` | Mahlzeiten | `username`: string |
| `zep_get_employee_meal` | `/employees/{username}/meals/{id}` | Detail | |
| `zep_list_employee_projects` | `/employees/{username}/projects` | Projekte eines MA | `username`: string |
| `zep_list_employee_transponders` | `/employees/{username}/transponders` | Transponder | `username`: string |
| `zep_list_departments` | `/departments` | Abteilungen | — |
| `zep_get_department` | `/departments/{id}` | Detail | `id`: integer |
| `zep_list_department_children` | `/departments/{id}/children` | Unterabteilungen | `id`: integer |
| `zep_list_department_employees` | `/departments/{id}/employees` | Abteilungsmitarbeiter | `id`: integer |
| `zep_list_absences` | `/absences` | Abwesenheiten | — |
| `zep_get_absence` | `/absences/{id}` | Detail | `id`: integer |
| `zep_list_customers` | `/customers` | Kunden | — |
| `zep_get_customer` | `/customers/{customer_number}` | Detail | **`customer_number`: string** |
| `zep_list_customer_contacts` | `/customers/{customer_number}/contacts` | Ansprechpartner | `customer_number`: string |
| `zep_list_customer_price_tables` | `/customers/{customer_number}/price-tables` | Kunden-Preistabellen | `customer_number`: string |
| `zep_list_offers` | `/offers` | Angebote | — |
| `zep_get_offer` | `/offers/{id}` | Detail | `id`: integer |
| `zep_list_offer_items` | `/offers/{id}/items` | Angebotspositionen | |
| `zep_list_invoices` | `/invoices` | Rechnungen | — |
| `zep_get_invoice` | `/invoices/{id}` | Detail | `id`: integer |
| `zep_list_invoice_attachments` | `/invoices/{id}/attachments` | Anhänge | |
| `zep_list_invoice_items_for_invoice` | `/invoices/{id}/items` | Positionen einer Rechnung | |
| `zep_list_invoice_items` | `/invoice-items` | Rechnungspositionen (global) | — |
| `zep_get_invoice_item` | `/invoice-items/{id}` | Detail | |
| `zep_list_articles` | `/articles` | Artikel | — |
| `zep_get_article` | `/articles/{id}` | Detail | |
| `zep_list_receipts` | `/receipts` | Belege | — |
| `zep_get_receipt` | `/receipts/{id}` | Detail | `id`: integer |
| `zep_list_receipt_amounts` | `/receipts/{id}/amounts` | Beträge | `id`: integer |
| `zep_get_receipt_amount` | `/receipts/{id}/amounts/{amount_id}` | Detail | `id`+`amount_id`: integer |
| `zep_list_receipt_attachments` | `/receipts/{id}/attachments` | Anhänge | `id`: integer |
| `zep_list_locations` | `/locations` | Standorte | — |
| `zep_get_location` | `/locations/{id}` | Detail | |
| `zep_list_location_lists` | `/location-lists` | Standortlisten | — |
| `zep_get_location_list` | `/location-lists/{id}` | Detail | |
| `zep_list_location_list_locations` | `/location-lists/{id}/locations` | Standorte einer Liste | |
| `zep_list_dynamic_attributes` | `/dynamic-attributes` | Dyn. Attribute | — |
| `zep_get_dynamic_attribute` | `/dynamic-attributes/{id}` | Detail | |
| `zep_list_folders` | `/folders` | Ordner | — |
| `zep_list_folder_documents` | `/folders/{id}/documents` | Dokumente | |
| `zep_list_devices` | `/devices` | Terminals | — |
| `zep_get_device` | `/devices/{id}` | Detail | `id`: integer |
| `zep_raw_get` | beliebig | Read-only-Escape-Hatch | `path`, `query?`, `headers?` |

`activities`, `categories`, `price-groups`, `absence-reasons` sind als MCP Resources modelliert (Sektion 6.4).

### 6.2 Write Tools (POST / PATCH / PUT)

| Tool | Endpunkt | Verb | Destruktiv | Besonderheit |
| --- | --- | --- | --- | --- |
| `zep_create_attendance` | `/attendances` | POST | nein | — |
| `zep_create_absence` | `/absences` | POST | nein | **Description-Hinweis: Absences haben kein UPDATE und kein DELETE via API — Änderungen müssen in der ZEP-UI erfolgen.** |
| `zep_create_project` | `/projects` | POST | nein | — |
| `zep_create_project_task` | `/projects/{id}/tasks` | POST | nein | — |
| `zep_update_project` | `/projects/{id}` | PATCH | ja | Partial-Update |
| `zep_create_ticket` | `/tickets` | POST | nein | — |
| `zep_update_ticket` | `/tickets/{id}` | PATCH | ja | Partial-Update |
| `zep_upload_ticket_attachment` | `/tickets/{id}/attachments` | POST | nein | Multipart-Format |
| `zep_create_subtask` | `/tickets/{id}/subtasks` | POST | nein | — |
| `zep_update_subtask` | `/tickets/{id}/subtasks/{subtask_id}` | PATCH | ja | Partial-Update |
| `zep_create_customer` | `/customers` | POST | nein | Body: `customer_number` ist Pflichtfeld (max 32 Zeichen) |
| `zep_update_customer` | `/customers/{customer_number}` | PATCH | ja | Partial-Update. Body kann `customer_number` ändern (muss eindeutig bleiben). |
| `zep_create_employee` | `/employees` | POST | nein | — |
| `zep_update_employee` | `/employees/{username}` | PUT | ja | **GET-merge-PUT intern** (Sektion 9.2) |
| `zep_create_employment_period` | `/employees/{username}/employment-periods` | POST | nein | — |
| `zep_update_employment_period` | `/employees/{username}/employment-periods/{id}` | PUT | ja | **GET-merge-PUT intern** |
| `zep_create_receipt` | `/receipts` | POST | nein | — |
| `zep_update_receipt` | `/receipts/{id}` | PATCH | ja | Partial-Update |
| `zep_upload_receipt_attachment` | `/receipts/{id}/attachments` | PUT | nein | PUT-Body-Format |
| `zep_raw_write` | beliebig | POST/PATCH/PUT/DELETE | ja (permanent) | `method`, `path`, `body?`, `query?`, `headers?` |

### 6.3 Delete Tools

Alle DELETE-Tools `destructiveHint: true` + zwei-Faktor-Bestätigung. `confirm_id` muss exakt der Identifier-Wert (Integer-ID oder String-Identifier) entsprechen. Für `customer` und `project` zusätzlich `confirm_name`-String, der vor DELETE gegen Live-Daten verifiziert wird.

| Tool | Endpunkt | Confirm-Pattern |
| --- | --- | --- |
| `zep_delete_project` | `/projects/{id}` | `id` (integer) + `confirm_id` (integer, === id) + `confirm_name` (string) |
| `zep_delete_customer` | `/customers/{customer_number}` | `customer_number` (string) + `confirm_customer_number` (string, === customer_number) + `confirm_name` (string) |
| `zep_delete_ticket` | `/tickets/{id}` | `id` + `confirm_id` |
| `zep_delete_subtask` | `/tickets/{id}/subtasks/{subtask_id}` | `id` + `subtask_id` + `confirm_subtask_id` |
| `zep_delete_receipt` | `/receipts/{id}` | `id` + `confirm_id` |
| `zep_delete_receipt_attachment` | `/receipts/{id}/attachments/{attachment_id}` | `id` + `attachment_id` + `confirm_attachment_id` |

**Verifiziert gegen Live-Doku:** DELETE existiert für `projects`, `customers`, `tickets`, `subtasks`, `receipts`, `receipt_attachments`. Kein DELETE für `employees`, `absences`, `offers`, `invoices`, `attendances`.

### 6.4 Resources (MCP Resources-Primitive)

Statische Lookup-Tabellen als MCP Resources statt Tools. URI-Schema: `zep://master-data/{type}`, MIME: `application/json`.

| Resource-URI | ZEP-Endpunkt | Inhalt |
| --- | --- | --- |
| `zep://master-data/activities` | `/activities` | Tätigkeiten (global) |
| `zep://master-data/categories` | `/categories` | Kategorien |
| `zep://master-data/price-groups` | `/price-groups` | Preisgruppen |
| `zep://master-data/absence-reasons` | `/absence-reasons` | Fehlgründe |

`server.registerResource()`-Registrierung. Resource-Read paginiert intern bis Vollständigkeit (Hard-Cap 500). Cache-Hint: `lastModified` aus Response, falls vorhanden.

`departments` und `locations` bleiben Tools (Subresources + potenziell groß).

## 7. Schema-Strategie — partial OpenAPI + manual Zod

**Realitäts-Check:** Die downloadbare OpenAPI-Spec ist `version: 7.4.0` (Mai 2025) und deckt nur **34 von ~85 Live-Endpunkten** ab — ausschließlich GET-Operations plus 2 POST (`/attendances`, `/employees`). Alle PATCH/PUT/DELETE und alle nach Mai 2025 hinzugekommenen Endpunkte (Finanzen: offers/invoices/invoice-items/articles, Stammdaten: locations/location-lists/dynamic-attributes/folders, plus mehrere employee/project Sub-Resources) **fehlen komplett**.

Daher ist die Strategie:

1. **OpenAPI als partial source** — Snapshot `schemas/zep-openapi-v7.4.0.yaml` ins Repo committet. `pnpm generate-zod` erzeugt via `openapi-zod-client` Zod-Schemas für die ~34 abgedeckten Endpunkte nach `src/schemas/generated/`.
2. **Manuelle Zod-Schemas** für die ~50 nicht-in-Spec Endpunkte in `src/schemas/manual.ts`. Quelle: jeweilige Live-Doku-Detail-Seite (z.B. `https://developer.zep.de/de/rest-documentation/customers/update`). Diese Seiten listen Body-Felder mit Typen und Validierungen vollständig.
3. **`schemas/COVERAGE.md`** dokumentiert pro Endpunkt: Spec-generiert oder manuell. Bei jedem `pnpm sync-spec` wird die Liste aktualisiert.
4. **`pnpm sync-spec` manuell, nicht in CI** — wenn ZEP irgendwann die volle Spec online stellt, ist das ein dedizierter Update-Commit, kein versteckter CI-Pull.
5. **Konflikt-Strategie bei Spec-Update:** `src/schemas/generated/` ist Build-Output (read-only, gitignored bis Stabilisierung). `src/schemas/manual.ts` hat **Vorrang** bei doppelt definierten Schemas — Re-Exports in `refinements.ts` importieren aus `manual.ts` first, `generated/` second. `pnpm sync-spec` führt zusätzlich einen Diff durch: bei Endpunkten, die jetzt in `generated/` auftauchen und in `manual.ts` ebenfalls existieren, wird eine Warning ausgegeben (`schemas/COVERAGE.md` als Tracking-Quelle) — der Maintainer entscheidet manuell, ob `manual.ts`-Einträge entfernt werden können.

**`src/schemas/identifiers.ts`** — dedizierte Identifier-Schemas statt generischem `ResourceIdInput`:

- `EmployeeUsername`: `z.string().min(1).max(64).describe('Mitarbeiter-Username (z.B. "max.mustermann"). NICHT die numerische interne ID.')`
- `CustomerNumber`: `z.string().min(1).max(32).describe('Kundennummer (z.B. "K-12345"). NICHT die numerische interne ID. ZEP-Endpunkte erlauben dass die Kundennummer geaendert wird, dann gilt die neue.')`
- `ProjectId`, `TicketId`, `ReceiptId`, `AbsenceId`, `DepartmentId`, `DeviceId`, `OfferId`, `InvoiceId`, `ArticleId`, `LocationId`: `z.number().int().positive()` mit dedizierter Description je Ressource
- `TaskId`, `SubtaskId`, `AmountId`, `EmploymentPeriodId`, `InternalRateId`, `RegularWorkingTimeId`, `MealId`: numerische sub-resource IDs

Jedes Tool importiert die passenden Identifier-Schemas — das LLM sieht in `tools/list` direkt die korrekte Semantik statt eines generischen union-Typs.

**Common-Schemas in `src/schemas/common.ts`:**

- `PaginationInput`: `{ limit?, page? }`
- `AutoPaginateInput`: `{ auto_paginate?, max_items? }`
- `IdFilterInput`: `{ id?: number[] }` — serialisiert zu `id[]=`
- `DateRangeInput`: `{ start_date?, end_date? }` mit `YYYY-MM-DD`-Regex

**`src/schemas/refinements.ts`** ist die LLM-UX-Polish-Layer:

- Field-Allowlists für Create/Update-Tools (interne ZEP-Felder ausblenden)
- Defaults (`currency: 'EUR'` für Receipts/Invoices/Customers im DACH-Kontext)
- DACH-Felder als Top-Level dokumentiert: `vat` (MwSt-Satz, 0–100), `tax_number`, `iban`, `bic`, `payment_target` (Tage), `payment_target_discount` — **nicht** in `dynamic_attributes`
- Re-Exports mit kuratierten Namen
- Tool-Descriptions im When/How/What-Format (Sektion 9.1)

Alle Schemas mit `.strict()`.

## 8. HTTP-Client-Layer

```typescript
// src/client/http.ts (gekuerzt)
import { request } from 'undici';
import pLimit from 'p-limit';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { mapZepError } from './errors.js';

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
let limiter = pLimit(config.ZEP_CONCURRENCY_LIMIT);
let rateLimitedUntil = 0;

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
interface ZepRequest { method: Method; path: string; query?: Record<string, unknown>; body?: unknown; headers?: Record<string, string>; }

function serializeQuery(q: Record<string, unknown> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach(i => params.append(`${k}[]`, String(i)));
    else params.append(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function zepRequest<T>(req: ZepRequest): Promise<T> {
  return limiter(async () => {
    const wait = rateLimitedUntil - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    const url = `${config.ZEP_BASE_URL}${req.path}${serializeQuery(req.query)}`;
    const headers = { 'Authorization': `Bearer ${config.ZEP_API_TOKEN}`, 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': `zep-mcp-server/${PACKAGE_VERSION}`, ...req.headers };
    for (let attempt = 1; attempt <= config.ZEP_MAX_RETRIES + 1; attempt++) {
      try {
        const res = await request(url, { method: req.method, headers, body: req.body ? JSON.stringify(req.body) : undefined, headersTimeout: config.ZEP_REQUEST_TIMEOUT_MS, bodyTimeout: config.ZEP_REQUEST_TIMEOUT_MS });
        if (res.statusCode >= 200 && res.statusCode < 300) return await res.body.json() as T;
        if (res.statusCode === 429) { rateLimitedUntil = Date.now() + 60_000; limiter = pLimit(1); setTimeout(() => { limiter = pLimit(config.ZEP_CONCURRENCY_LIMIT); }, 60_000); }
        if (RETRYABLE.has(res.statusCode) && attempt <= config.ZEP_MAX_RETRIES) { const backoff = res.statusCode === 429 ? 60_000 : Math.min(1000 * 2 ** (attempt - 1), 8000); logger.warn({ status: res.statusCode, attempt, backoff }, 'zep_retry'); await new Promise(r => setTimeout(r, backoff)); continue; }
        throw await mapZepError(res);
      } catch (err) {
        if (attempt > config.ZEP_MAX_RETRIES) throw err;
        logger.warn({ err: err instanceof Error ? err.message : String(err), attempt }, 'zep_transport_error');
        await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 8000)));
      }
    }
    throw new Error('Retry budget exhausted');
  });
}
```

Bei 429 wird `rateLimitedUntil` auf 60 s in die Zukunft gesetzt und `p-limit` temporär auf 1 reduziert. Fehler werden in `ZepApiError` mit `{ status, code, message, requestId }` gewrappt und als MCP `isError: true` zurückgegeben — nie als Exception.

## 9. Tool-Implementierungs-Pattern

### 9.1 Tool-Description im When/How/What-Format

Tool-Descriptions sind LLM-Instructions, keine API-Docs. Template:

```
[1 Satz: When to use]
[1-2 Saetze: How parameters work, inkl. Identifier-Semantik bei username/customer_number]
[1 Satz: What you get back]
```

Gutes Beispiel:

```
Listet ZEP-Mitarbeiter. Filter: department_id (numerisch), is_active (boolean) [VERIFIZIEREN gegen Live-Doku].
Paginiert mit limit/page. Mit auto_paginate=true werden alle Seiten geladen (Hard-Cap 500).
Returns: Array mit username, firstname, lastname, department, status.
```

Schlechtes Beispiel (zu generisch, Anti-Pattern):

```
Listet Mitarbeiter aus ZEP, optional gefiltert. Paginiert.
```

**Personal-Schwerpunkt:** Die 25 Personal-Tools (`zep_*_employee*`, `zep_*_department*`, `zep_*_absence*`, `absence-reasons`-Resource) bekommen vor Release dieses Format mit konkreten Filter-Listen aus der Live-Doku. Finance/Master-Data-Tools dürfen v0.1 mit Minimal-Descriptions ausliefern und werden in v0.2 nachgezogen.

### 9.2 Standard-Pattern (Read und Create)

```typescript
// src/tools/employees.ts
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { zepRequest } from '../client/http.js';
import { paginateAll } from '../client/pagination.js';
import { PaginationInput, AutoPaginateInput } from '../schemas/common.js';
import { EmployeeUsername } from '../schemas/identifiers.js';
import { logger } from '../lib/logger.js';

const GetEmployeeInput = z.object({
  username: EmployeeUsername,
}).strict();

export function registerEmployeeTools(server: McpServer) {
  server.registerTool('zep_get_employee', {
    title: 'Mitarbeiter-Details abrufen',
    description: 'Holt einen Mitarbeiter per Username. Param username ist ein String (z.B. "max.mustermann"), NICHT die numerische interne ID. Returns: Mitarbeiter-Objekt mit username, firstname, lastname, email, department, status, hire_date.',
    inputSchema: GetEmployeeInput.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ username }) => {
    try {
      const data = await zepRequest<{ data: unknown; info: unknown }>({ method: 'GET', path: `/employees/${encodeURIComponent(username)}` });
      return { structuredContent: data as Record<string, unknown>, content: [{ type: 'text', text: `Mitarbeiter ${username} geladen.` }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      logger.error({ err: msg, tool: 'zep_get_employee', username }, 'tool_error');
      return { isError: true, content: [{ type: 'text', text: `ZEP-API-Fehler: ${msg}` }] };
    }
  });
}
```

Alle Tools liefern konsistent `structuredContent` + Summary-Text. URL-Parameter werden mit `encodeURIComponent` escaped — relevant für `username` mit Punkten oder `customer_number` mit Sonderzeichen.

### 9.3 PUT-Pattern mit GET-merge-PUT

```typescript
// src/lib/merge.ts
export async function getMergePut<TResource extends Record<string, unknown>>(opts: {
  getPath: string; putPath: string; partial: Partial<TResource>;
}): Promise<TResource> {
  const current = await zepRequest<{ data: TResource }>({ method: 'GET', path: opts.getPath });
  const merged = { ...current.data, ...opts.partial };
  return zepRequest<TResource>({ method: 'PUT', path: opts.putPath, body: merged });
}

// in src/tools/employees.ts
server.registerTool('zep_update_employee', {
  title: 'Mitarbeiter aktualisieren',
  description: 'Aktualisiert einen Mitarbeiter per Username. Param username ist String. Akzeptiert Partial-Updates: nur die im Input gesetzten Felder werden geaendert (intern: GET aktuell, merge mit Input, PUT zurueck). Returns: aktualisiertes Mitarbeiter-Objekt.',
  inputSchema: UpdateEmployeeInput.shape, // mit EmployeeUsername + Allowlist
  annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: true },
}, async ({ username, ...partial }) => {
  audit.info({ tool: 'zep_update_employee', resource_id: username, fields: Object.keys(partial) }, 'destructive_call');
  try {
    const path = `/employees/${encodeURIComponent(username)}`;
    const result = await getMergePut({ getPath: path, putPath: path, partial });
    return { structuredContent: result, content: [{ type: 'text', text: `Mitarbeiter ${username} aktualisiert.` }] };
  } catch (err) { /* ... */ }
});
```

### 9.4 DELETE-Pattern mit confirm_id + confirm_name

```typescript
import { CustomerNumber } from '../schemas/identifiers.js';

const DeleteCustomerInput = z.object({
  customer_number: CustomerNumber,
  confirm_customer_number: CustomerNumber,
  confirm_name: z.string().min(1),
}).strict().refine(v => v.confirm_customer_number === v.customer_number, {
  message: 'confirm_customer_number muss exakt customer_number entsprechen',
});

server.registerTool('zep_delete_customer', {
  title: 'Kunde loeschen',
  description: 'Loescht einen Kunden permanent. Erfordert customer_number, confirm_customer_number (=== customer_number) und confirm_name (muss dem aktuellen Kundennamen exakt entsprechen, wird vor DELETE gegen Live-Daten verifiziert). Returns: { deleted: true, customer_number }.',
  inputSchema: DeleteCustomerInput.shape,
  annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: true },
}, async ({ customer_number, confirm_name }) => {
  const path = `/customers/${encodeURIComponent(customer_number)}`;
  const current = await zepRequest<{ data: { name: string } }>({ method: 'GET', path });
  if (current.data.name !== confirm_name) {
    return { isError: true, content: [{ type: 'text', text: `confirm_name "${confirm_name}" stimmt nicht mit aktuellem Kundennamen "${current.data.name}" ueberein. DELETE abgebrochen.` }] };
  }
  audit.info({ tool: 'zep_delete_customer', resource_id: customer_number, name: confirm_name }, 'destructive_call');
  await zepRequest<void>({ method: 'DELETE', path });
  return { structuredContent: { deleted: true, customer_number }, content: [{ type: 'text', text: `Kunde ${customer_number} (${confirm_name}) geloescht.` }] };
});
```

## 10. Transport-Setup

v0.1 unterstützt **ausschließlich stdio**. `StdioServerTransport` aus `@modelcontextprotocol/sdk/server/stdio.js`. Logging zwingend auf stderr.

Streamable HTTP ist v0.2-Feature: dediziertes Container-Image (`ghcr.io/{org}/zep-mcp-server`) mit Host-Header-Validierung und Reverse-Proxy-Empfehlung.

## 11. Logging & Observability

Zwei separate `pino`-Instanzen:

**App-Logger** (`src/lib/logger.ts`): stderr, Redaction für `authorization`/`token`/`apiKey`, Level via `LOG_LEVEL`, strukturierte Felder (`tool`, `status`, `attempt`, `latency_ms`, `request_id` [VERIFIZIEREN]). PII-Mitigation: Namen/E-Mails nur bei `debug` und gehashed.

**Audit-Logger** (`src/lib/audit.ts`): eigener Stream, `AUDIT_LOG_PATH`-File oder stderr mit `stream: 'audit'`-Marker. Ausschließlich DELETE/PUT/PATCH. Felder: `tool`, `resource_id`, `verb`, `actor: 'mcp'`, `timestamp`, `fields` (Keys, keine Werte). Level fix `info`.

## 12. Security-Checkliste

- Input-Validierung: Zod `.strict()`, keine `additionalProperties`.
- Dedizierte Identifier-Schemas mit semantischen Descriptions (kein generisches union(number, string)).
- `destructiveHint: true` für alle DELETE/UPDATE-Tools.
- DELETE-Zwei-Faktor: `confirm_id`/`confirm_customer_number` muss === Path-Param, plus `confirm_name`-Verifizierung gegen Live-Daten für `customer`, `project`.
- PUT-Tools über GET-merge-PUT-Helper.
- ZEP-API-Token nur aus Env, niemals in Schemas/Outputs/Logs.
- Rate-Limit-Respekt: bei 429 Hard-Backoff 60 s, Concurrency temporär 1.
- Concurrency-Default `p-limit(5)`.
- HTTPS-only, Timeout 30 s.
- URL-Parameter mit `encodeURIComponent` escapen (relevant für `username` mit Punkten).
- `User-Agent`-Header zur Identifizierung.
- Audit-Trail in separatem Stream.
- **`mcp-scan` in CI:** scannt Tool-Schemas auf bekannte MCP-Vulnerabilities (Prompt-Injection-Patterns, ungeschützte Secrets in Annotations, übergroße Schemas).
- **Semgrep MCP-Rules in CI:** spezifisches Ruleset für MCP-Server (z.B. `r/mcp.token-in-output`, `r/mcp.missing-strict`).
- Keine Shell-Aufrufe, kein `eval`, kein dynamisches Code-Laden.
- Dependency-Pinning + Dependabot wöchentlich.
- `.env` in `.gitignore`.

## 13. Testing-Strategie

**Unit-Tests (vitest):** Pro Tool-Datei eine Suite in `tests/unit/tools/`, HTTP via `msw` gemockt. Test-Matrix pro Tool: happy path, 404, 429-Retry mit Concurrency-Drop, 500-Retry-Erschöpfung, Input-Validierungs­fehler, strict-mode-Verstoß. Spezielle Tests: PUT-Tools (GET-merge-Verhalten, `null` nicht versehentlich gesetzt), DELETE (`confirm_*`-Mismatch → kein API-Call), Identifier-Schemas (Username mit Punkt, customer_number mit Bindestrich). Coverage-Ziel ≥ 80 %.

**Resource-Tests:** `tests/unit/resources/` — URI-Parsing, JSON-Output, Pagination bis Hard-Cap.

**Integration-Tests:** `tests/integration/live.test.ts` gegen echte ZEP-Instanz, gated über `ZEP_TEST_TOKEN`. Read-only-Tools plus idempotente Creates auf Test-Mandant. Keine DELETE automatisiert.

**Sandbox:** [OFFENE FRAGE] — ZEP-Support nach Sandbox-Verfügbarkeit fragen, sonst Test-Mandant.

**MCP Inspector:** `npx @modelcontextprotocol/inspector node dist/index.js`. Manueller Durchlauf aller Tools + Resources + Description-Review.

**Schema-Validation in CI:** JSON-Schema-Validator gegen `server.json`. Bundle-Size-Check. `mcp-scan`. Semgrep MCP-Rules.

## 14. GitHub-Setup

**`ci.yml`** (Push/PR): Node-Matrix [20, 22] → install → lint → typecheck → test → build → **Bundle-Size-Check** (> 500 KB = Fail) → **mcp-scan** → **Semgrep MCP-Rules** → Artefakt-Upload.

mcp-scan und Semgrep sind Python-Tools, eingebunden als separate Steps:

```yaml
- name: Install mcp-scan
  run: pipx install mcp-scan   # alternativ: uvx mcp-scan@latest scan ...
- name: Run mcp-scan against built server
  run: mcp-scan scan --server "node dist/index.js"
- name: Semgrep MCP rules
  uses: returntocorp/semgrep-action@v1
  with:
    config: p/mcp
```

**`release.yml`** (push main): `changesets/action`, Version-Bump-PR; Merge → Tag-Push.

**`npm-publish.yml`** (Tag `v*`): `pnpm publish --access public --provenance` mit OIDC.

**`mcp-registry.yml`** (manueller `workflow_dispatch`): `mcp-publisher` Binary → GitHub-OIDC → `server.json` validieren → publish.

**Branch-Schutz:** `main` geschützt, lineare History, Required: `ci`, `typecheck`, `test`, `bundle-size`, `mcp-scan`, `semgrep`. CODEOWNERS. Force-Push deaktiviert.

**Dependabot:** wöchentlich npm, monatlich Actions.

## 15. MCP-Registry-Publishing-Checkliste

1. `pnpm changeset` → `pnpm changeset version` → Commit + Tag.
2. `npm-publish.yml` auf Tag-Push: `@{org}/zep-mcp-server@X.Y.Z` mit Provenance.
3. `README.md`: `<!-- mcp-name: io.github.{org}/zep-mcp-server -->` direkt unter H1. README in `package.json` `files`-Array.
4. `server.json` Version aktualisieren (pre-commit-Hook).
5. Lokale Validierung: `mcp-publisher init --dry-run`.
6. Login: `mcp-publisher login github` lokal oder OIDC in CI.
7. `mcp-publisher publish server.json` → Server unter `https://registry.modelcontextprotocol.io/v0/servers/io.github.{org}/zep-mcp-server`.
8. Smoke-Test: Registry-Suche.

**`server.json`-Struktur:**

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.{org}/zep-mcp-server",
  "title": "ZEP MCP Server",
  "description": "MCP-Server fuer die ZEP REST-API (Zeiterfassung, Projekte, Rechnungen)",
  "version": "0.1.0",
  "websiteUrl": "https://github.com/{org}/zep-mcp-server",
  "repository": { "url": "https://github.com/{org}/zep-mcp-server", "source": "github" },
  "packages": [
    {
      "registryType": "npm",
      "registryBaseUrl": "https://registry.npmjs.org",
      "identifier": "@{org}/zep-mcp-server",
      "version": "0.1.0",
      "transport": { "type": "stdio" },
      "runtimeHint": "npx",
      "environmentVariables": [
        { "name": "ZEP_API_TOKEN", "description": "Bearer Token aus dem ZEP-Modul 'ZEP-Schnittstellen'", "isRequired": true, "isSecret": true },
        { "name": "ZEP_TENANT", "description": "Mandantenname (URL-Pfadsegment), z.B. 'ssig-it'", "isRequired": true, "isSecret": false },
        { "name": "ZEP_BASE_URL", "description": "Optionaler Override der ZEP-API-Base-URL", "isRequired": false, "isSecret": false },
        { "name": "ZEP_CONCURRENCY_LIMIT", "description": "Max. parallele Requests gegen ZEP (Default 5)", "isRequired": false, "isSecret": false, "default": "5" },
        { "name": "LOG_LEVEL", "description": "pino Log-Level fuer App-Logger", "isRequired": false, "isSecret": false, "default": "info" },
        { "name": "AUDIT_LOG_PATH", "description": "Optionaler File-Pfad fuer Audit-Logger", "isRequired": false, "isSecret": false }
      ]
    }
  ]
}
```

`description` max. 100 Zeichen. `name`-Pattern `[a-zA-Z0-9.-]+/[a-zA-Z0-9._-]+`.

## 16. README-Outline

Zweisprachig **Pflicht** ab Tag 1: `README.md` (DE) + `README.en.md` (EN, verlinkt). Pflichtsektionen identisch:

- Titel + `<!-- mcp-name: io.github.{org}/zep-mcp-server -->`.
- Kurzbeschreibung (2–3 Sätze, ZEP-API-Version).
- Voraussetzungen: ZEP-Modul „ZEP-Schnittstellen" aktiv, Bearer Token, Node ≥ 20.
- Installation & Konfiguration: Code-Blöcke für Claude Desktop, Cursor, Claude Code, jeweils `command: "npx"`, `args: ["-y", "@{org}/zep-mcp-server"]`, `env: { ZEP_API_TOKEN, ZEP_TENANT }`.
- Tool-Übersicht: Link auf `BLUEPRINT.md#6-tool-katalog` plus Liste der häufigsten Tools.
- **Wichtiger Hinweis-Block: "Identifier-Konventionen" — `employees` per `username`, `customers` per `customer_number`. Sonst kriegt das LLM 404 beim ersten Versuch.**
- Resources: URI-Schema `zep://master-data/{type}`.
- Environment Variables: Tabelle.
- Beispiele: 4–5 typische Prompts (Stunden buchen, Projekt anlegen, Tickets filtern, Rechnungen abrufen, Kunden suchen).
- Sicherheit: Token-Handling, Rate-Limits, destruktive Tools, confirm-Pattern.
- Troubleshooting: 401, 404 (falscher Identifier-Typ!), 429, Audit-Log-Lokation.
- Contributing: `BLUEPRINT.md`, `pnpm sync-spec`, Changeset.
- Lizenz: MIT.
- Disclaimer: Inoffizieller Community-Server, keine Affiliation mit provista GmbH.

## 17. Roadmap & bekannte Lücken

**Nicht in v0.1.0:**

- Streamable HTTP-Transport (v0.2)
- SOAP-API
- Webhooks/Event-Subscriptions [VERIFIZIEREN: existieren sie in ZEP?]
- Bulk-Operations
- Binär-Downloads für Attachments (v0.2)
- Client-seitiges Response-Caching
- OAuth 2.1
- Aggregierte Workflow-Tools (z.B. `zep_book_hours` mit Pre-Check) — siehe v0.2

**v0.2-Plan:**

- Streamable HTTP-Transport mit Host-Header-Validierung, Container-Image
- Anhang-Download-Tools (falls API-seitig vorhanden)
- Cursor-basierte Pagination, falls ZEP es einführt
- Optional Output-Validierung gegen Schemas (Schema-Drift-Detection)
- Finance/Master-Data-Tools auf When/How/What-Description-Standard heben
- Optional: aggregierte Workflow-Tools für die häufigsten Personal-Use-Cases (z.B. `zep_book_hours(username, project_id, date, duration_minutes, task_id?, note?)` mit interner GET-Check + POST /attendances)

**v1.0-Plan:**

- Vollständige Body-Schema-Coverage
- Caching-Layer mit TTL für Resources
- Production-Hardening HTTP-Transport (mTLS, Helm-Chart)
- Optional Elicitation für Confirm-Patterns (sobald Client-Coverage > 80 %)

## 18. Offene Fragen / Verifizierungs-Punkte

- **OpenAPI-Spec-Lücke:** Downloadbare Spec ist v7.4.0/Mai 2025 mit ~34 Endpunkten. Live-API ist v7.8.74/Jan 2026 mit ~85. Beim ZEP-Support nachfragen, ob aktuelle Spec-Datei existiert. Falls nein: manuelle Schema-Pflege in `src/schemas/manual.ts` bleibt dauerhaft notwendig. **Konkret fehlen in der Spec:** alle PATCH/PUT/DELETE, plus offers/invoices/invoice-items/articles/locations/location-lists/dynamic-attributes/folders/planning, plus mehrere employee/project Sub-Resources.
- **Path-Param-Verifikation:** ✓ erledigt via `discover-zep-endpoints.mjs` (69/69 Endpunkte 200 OK gegen SSIG-IT-Tenant, Stand Discovery-Run). Spec-Snapshot bleibt v7.4.0/Mai 2025 — die ~50 nicht-in-Spec Endpunkte existieren live, brauchen aber manuelle Zod-Schemas (`src/schemas/manual.ts`).
- **`zep_upload_ticket_attachment` Format:** Multipart/form-data oder base64-encoded JSON? [VERIFIZIEREN]
- **`X-Request-Id`-Header:** sendet ZEP einen? Ins Logging übernehmen falls vorhanden.
- **Sandbox-Umgebung:** beim ZEP-Support klären.
- **Rate-Limit-Header:** sendet ZEP `X-RateLimit-Remaining`/`Reset`? Für proaktives Backoff.
- **Cursor-basierte Pagination:** existiert sie? Aktuell nur offset-basiert (`page`).
- **PUT- vs PATCH-Semantik:** für employees/employment-periods ist GET-merge-PUT implementiert. Verifizieren, dass PUT Full-Replacement erwartet, nicht selbst Partial akzeptiert.
- **Departments-Identifier:** `{id}` integer korrekt? In OpenAPI-Spec ja. Sub-Resources `/children` und `/employees` nicht in Spec — verifizieren.
- **MCP-Schema-Version `2025-12-11`** vor Publish erneut prüfen.
- **Aggregierte Workflow-Tools (v0.2-Entscheidung):** ein `zep_book_hours` Tool spart LLM-Orchestrierung, ist aber Workflow-Lock-In. Pro/Kontra mit Personal-Workflow-Erfahrung aus v0.1 entscheiden.
