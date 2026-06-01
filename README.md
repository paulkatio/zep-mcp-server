# ZEP MCP Server — HR & Zeiterfassung

<!-- mcp-name: io.github.SSIG-IT/zep-mcp-server -->

> 🇬🇧 [English version](./README.en.md)

MCP-Server für die [ZEP](https://www.zep.de) REST-API (Ziel-Stand v7.8.74), fokussiert auf
**HR- und Zeiterfassungs-Workflows**: Mitarbeiter, Projektzeiten/Anwesenheiten, Abwesenheiten,
Abteilungen und Terminals. Läuft per `npx` in jedem MCP-Client (Claude Desktop, Claude Code,
Cursor, VS Code u.a.) über stdio.

## Was dieser Server kann

**24 Tools (18 lesend + 6 schreibend) + 4 Resources**, fokussiert auf die HR-/Time-Tracking-Module von ZEP:

- **Mitarbeiter** – auflisten, Details, Beschäftigungszeiträume, Regelarbeitszeiten, Transponder, anlegen/ändern
- **Projektzeiten** (Attendances) – auflisten, Details, buchen
- **Abwesenheiten** – auflisten, Details, eintragen (Urlaub/Krankheit)
- **Abteilungen** – auflisten, Details, Unterabteilungen, Abteilungsmitarbeiter
- **Terminals** (Geräte) – auflisten, Details
- **Stammdaten** als Resources – Tätigkeiten, Kategorien, Preisgruppen, Fehlgründe

## Was dieser Server (noch) NICHT kann

Bewusst **nicht** enthalten sind die Module **Finanzen** (Angebote, Rechnungen, Artikel, Belege),
**Projektverwaltung**, **Tickets**, **CRM/Kunden** und **Stammdaten** (Standorte, Ordner, dynamische
Attribute). Diese ~51 Endpunkte existieren in der ZEP-API, sind aber per Lizenz/Modul aktivierbar und
auf dem Referenz-Mandanten nicht freigeschaltet (siehe [`schemas/zep-inventory.json`](./schemas/zep-inventory.json)).
Bedarf? **Issues und PRs sind willkommen.**

## Voraussetzungen

- ZEP-Modul **„ZEP-Schnittstellen"** aktiv (dort wird der API-Token erzeugt)
- ein **Bearer-Token** aus diesem Modul
- **Node.js ≥ 20**

## Installation & Konfiguration

Kein Build nötig — der Server wird per `npx` gestartet. `ZEP_TENANT` ist das Pfadsegment deiner
ZEP-Login-URL (`https://www.zep-online.de/<TENANT>/…`), im Beispiel `zepssigit`.

### Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zep": {
      "command": "npx",
      "args": ["-y", "@ssig-it/zep-mcp-server"],
      "env": { "ZEP_API_TOKEN": "dein-bearer-token", "ZEP_TENANT": "zepssigit" }
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json` (oder `.cursor/mcp.json` im Projekt):

```json
{
  "mcpServers": {
    "zep": {
      "command": "npx",
      "args": ["-y", "@ssig-it/zep-mcp-server"],
      "env": { "ZEP_API_TOKEN": "dein-bearer-token", "ZEP_TENANT": "zepssigit" }
    }
  }
}
```

### Claude Code

```bash
claude mcp add zep --env ZEP_API_TOKEN=dein-bearer-token --env ZEP_TENANT=zepssigit -- npx -y @ssig-it/zep-mcp-server
```

## Tool-Übersicht

### Lesend (18)

| Tool | Zweck |
| --- | --- |
| `zep_list_employees` | Mitarbeiter auflisten (Filter: personal_number) |
| `zep_get_employee` | Mitarbeiter-Details per `username` |
| `zep_list_employee_absences` | Abwesenheiten eines Mitarbeiters |
| `zep_list_employee_employment_periods` | Beschäftigungszeiträume |
| `zep_get_employee_employment_period` | Beschäftigungszeitraum-Detail |
| `zep_list_employee_regular_working_times` | Regelarbeitszeiten |
| `zep_get_employee_regular_working_time` | Regelarbeitszeit-Detail |
| `zep_list_employee_transponders` | Transponder eines Mitarbeiters |
| `zep_list_attendances` | Projektzeiten (Filter: employee_id, start_date, end_date) |
| `zep_get_attendance` | Projektzeit-Detail |
| `zep_list_absences` | Abwesenheiten (Filter: employee_id, start_date, end_date) |
| `zep_get_absence` | Abwesenheits-Detail |
| `zep_list_departments` | Abteilungen |
| `zep_get_department` | Abteilungs-Detail |
| `zep_list_department_children` | Unterabteilungen |
| `zep_list_department_employees` | Mitarbeiter einer Abteilung |
| `zep_list_devices` | Terminals |
| `zep_get_device` | Terminal-Detail |

### Schreibend (6)

| Tool | Zweck | Hinweis |
| --- | --- | --- |
| `zep_create_employee` | Mitarbeiter anlegen | |
| `zep_update_employee` | Mitarbeiter ändern | `destructiveHint`, GET-merge-PUT |
| `zep_create_employment_period` | Beschäftigungszeitraum anlegen | |
| `zep_update_employment_period` | Beschäftigungszeitraum ändern | `destructiveHint`, GET-merge-PUT |
| `zep_create_attendance` | Projektzeit buchen | erfordert Projektverwaltungs-Modul (project_id/task_id/activity_id) |
| `zep_create_absence` | Abwesenheit eintragen | per API nicht mehr änderbar/löschbar |

### Resources (4)

`zep://master-data/activities`, `zep://master-data/categories`, `zep://master-data/price-groups`,
`zep://master-data/absence-reasons` (MIME `application/json`).

## Identifier-Konventionen ⚠️

> **Mitarbeiter werden per `username` referenziert** (String, z.B. `max.mustermann`) — **NICHT** per
> numerischer ID. Falscher Identifier-Typ → 404 beim ersten Versuch.
>
> Alle anderen Ressourcen (Abwesenheiten, Abteilungen, Terminals, Beschäftigungszeiträume,
> Regelarbeitszeiten) nutzen **numerische IDs**.

## Environment Variables

| Variable | Pflicht | Default | Bedeutung |
| --- | --- | --- | --- |
| `ZEP_API_TOKEN` | ja | — | Bearer-Token aus „ZEP-Schnittstellen". Nie geloggt. |
| `ZEP_TENANT` | ja | — | Mandant = Pfadsegment der Login-URL, z.B. `zepssigit`. |
| `ZEP_BASE_URL` | nein | `https://www.zep-online.de/${ZEP_TENANT}/next/api/v1` | Override (Sandbox/Self-Hosting). |
| `ZEP_REQUEST_TIMEOUT_MS` | nein | `30000` | HTTP-Timeout pro Request. |
| `ZEP_MAX_RETRIES` | nein | `3` | Retries bei 5xx/429. |
| `ZEP_CONCURRENCY_LIMIT` | nein | `5` | Max. parallele Requests (bei 429 temporär 1). |
| `LOG_LEVEL` | nein | `info` | `trace`/`debug`/`info`/`warn`/`error` (auf stderr). |
| `AUDIT_LOG_PATH` | nein | stderr | Datei-Pfad für den Audit-Log (PUT/PATCH/DELETE). |

## Beispiele

- „Zeig mir meine Anwesenheit/Projektzeiten diese Woche."
- „Wann hat **max.mustermann** Urlaub eingetragen?"
- „Buch mir 8 Stunden für gestern auf Projekt X." *(braucht das Projektverwaltungs-Modul)*
- „Welche Mitarbeiter sind heute nicht da?"
- „Liste alle Abteilungen mit ihrer Mitarbeiterzahl."

## Sicherheit

- Token nur aus der Env, nie in Schemas/Outputs/Logs (App-Logger redacted `authorization`/`token`).
- Schreib-Tools sind als `destructiveHint`/non-destructive annotiert; Updates laufen über GET-merge-PUT.
- **Audit-Log** für alle PUT/PATCH/DELETE (Tool, resource_id, Verb, geänderte Feld-*Namen* — keine Werte)
  auf stderr (`stream: "audit"`) oder Datei (`AUDIT_LOG_PATH`).
- HTTPS-only, Timeout 30 s, Rate-Limit-Respekt (429 → 60 s Backoff, Concurrency 1).

## Troubleshooting

- **401** – Token fehlt/abgelaufen oder Modul „ZEP-Schnittstellen" nicht aktiv.
- **404 beim ersten Versuch** – meist falscher Identifier-Typ: `employees` brauchen den `username`,
  nicht die numerische ID. Auch: falscher `ZEP_TENANT` (HTML-„Page not found 404").
- **„Dieser Endpunkt ist für dein ZEP-Modul/Lizenz nicht aktiviert"** – Module-Gate: das Feature
  (z.B. internal-rates, oder die Stammdaten-Resources) ist für deinen Mandanten nicht freigeschaltet.
- **Audit-Log** landet auf stderr (Marker `stream: "audit"`) bzw. unter `AUDIT_LOG_PATH`.

## Roadmap

Weitere ZEP-Module (Finanzen, Projekte, Tickets, CRM, Stammdaten) sind möglich, sobald jemand sie
nutzt und PRs einreicht. Die 51 noch nicht implementierten Endpunkte sind in
[`schemas/zep-inventory.json`](./schemas/zep-inventory.json) dokumentiert.

## Contributing

Architektur-Details in [`BLUEPRINT.md`](./BLUEPRINT.md). Schema-Quelle:
[`schemas/zep-openapi-v7.4.0.yaml`](./schemas/zep-openapi-v7.4.0.yaml) (deckt nur einen Teil ab; HR-Bodies
sind in `src/schemas/manual.ts` gepflegt). PRs bitte mit Tests (`npm test`) und Changeset.

## Lizenz

MIT © 2026 SSIG-IT GmbH — siehe [LICENSE](./LICENSE).

## Disclaimer

Inoffizieller Community-Server. Keine Affiliation mit der provista GmbH.
