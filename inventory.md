# ZEP Endpoint Inventory

- **Tenant:** `zepssigit`
- **Base URL:** `https://www.zep-online.de/zepssigit/next/api/v1`
- **Probed:** 2026-06-01T10:14:29.372Z
- **Total endpoints:** 69

## Summary

| Marker | Count |
| --- | --- |
| OK_JSON | 18 |
| OK_PARTIAL | 0 |
| HTML_FALLBACK | 0 |
| NOT_FOUND | 51 |
| AUTH | 0 |
| METHOD_NA | 0 |
| OTHER | 0 |

> Markers: `OK_JSON` 2xx+json+expected shape · `OK_PARTIAL` 2xx+json+other shape · `HTML_FALLBACK` 2xx text/html (tenant/path missing) · `NOT_FOUND` 404 JSON (route not registered for this tenant, or record absent — see note column) · `AUTH` 401/403 · `METHOD_NA` 405 · `OTHER` rest.

## Resolved identifiers

| Var | Value | Source |
| --- | --- | --- |
| projectId | `42` | default |
| taskId | `1` | default |
| attendanceId | `97` | harvested |
| ticketId | `1` | default |
| subtaskId | `1` | default |
| username | `d.hofweber` | harvested |
| employmentPeriodId | `14` | harvested |
| internalRateId | `1` | default |
| regularWorkingTimeId | `12` | harvested |
| mealId | `1` | default |
| departmentId | `1` | harvested |
| absenceId | `21` | harvested |
| customerNumber | `K-0001` | default |
| offerId | `1` | default |
| invoiceId | `1` | default |
| invoiceItemId | `1` | default |
| articleId | `1` | default |
| receiptId | `1` | default |
| amountId | `1` | default |
| locationId | `1` | default |
| locationListId | `1` | default |
| dynamicAttributeId | `1` | default |
| folderId | `1` | default |
| deviceId | `12` | harvested |

## Endpoints

| Marker | Status | Tool | Path | Shape / note |
| --- | --- | --- | --- | --- |
| NOT_FOUND | 404 | `resource:activities` | `/activities?limit=1` | json 404 "The route zepssigit/next/api/v1/activities could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `resource:categories` | `/categories?limit=1` | json 404 "The route zepssigit/next/api/v1/categories could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `resource:price-groups` | `/price-groups?limit=1` | json 404 "The route zepssigit/next/api/v1/price-groups could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `resource:absence-reasons` | `/absence-reasons?limit=1` | json 404 "The route zepssigit/next/api/v1/absence-reasons could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_projects` | `/projects?limit=1` | json 404 "The route zepssigit/next/api/v1/projects could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_project` | `/projects/42` | json 404 "The route zepssigit/next/api/v1/projects/42 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_project_activities` | `/projects/42/activities?limit=1` | json 404 "The route zepssigit/next/api/v1/projects/42/activities could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_project_employees` | `/projects/42/employees?limit=1` | json 404 "The route zepssigit/next/api/v1/projects/42/employees could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_project_tasks` | `/projects/42/tasks?limit=1` | json 404 "The route zepssigit/next/api/v1/projects/42/tasks could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_project_task` | `/projects/42/tasks/1` | json 404 "The route zepssigit/next/api/v1/projects/42/tasks/1 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_project_price_tables` | `/projects/42/price-tables?limit=1` | json 404 "The route zepssigit/next/api/v1/projects/42/price-tables could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_project_locations` | `/projects/42/locations?limit=1` | json 404 "The route zepssigit/next/api/v1/projects/42/locations could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| OK_JSON | 200 | `zep_list_attendances` | `/attendances?limit=1` | data=array(1) links meta total=9495 |
| OK_JSON | 200 | `zep_get_attendance` | `/attendances/97` | data=object |
| NOT_FOUND | 404 | `zep_list_planning` | `/planning?limit=1` | json 404 "The route zepssigit/next/api/v1/planning could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_tickets` | `/tickets?limit=1` | json 404 "The route zepssigit/next/api/v1/tickets could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_ticket` | `/tickets/1` | json 404 "The route zepssigit/next/api/v1/tickets/1 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_subtasks` | `/tickets/1/subtasks?limit=1` | json 404 "The route zepssigit/next/api/v1/tickets/1/subtasks could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_subtask` | `/tickets/1/subtasks/1` | json 404 "The route zepssigit/next/api/v1/tickets/1/subtasks/1 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| OK_JSON | 200 | `zep_list_employees` | `/employees?limit=1` | data=array(1) links meta total=15 |
| OK_JSON | 200 | `zep_get_employee` | `/employees/d.hofweber` | data=object |
| OK_JSON | 200 | `zep_list_employee_absences` | `/employees/d.hofweber/absences?limit=1` | data=array(15) links meta total=68 |
| OK_JSON | 200 | `zep_list_employee_employment_periods` | `/employees/d.hofweber/employment-periods?limit=1` | data=array(1) links meta total=1 |
| OK_JSON | 200 | `zep_get_employee_employment_period` | `/employees/d.hofweber/employment-periods/14` | data=object |
| NOT_FOUND | 404 | `zep_list_employee_internal_rates` | `/employees/d.hofweber/internal-rates?limit=1` | json 404 "The route zepssigit/next/api/v1/employees/d.hofweber/internal-rates could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_employee_internal_rate` | `/employees/d.hofweber/internal-rates/1` | json 404 "The route zepssigit/next/api/v1/employees/d.hofweber/internal-rates/1 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| OK_JSON | 200 | `zep_list_employee_regular_working_times` | `/employees/d.hofweber/regular-working-times?limit=1` | data=array(1) links meta total=1 |
| OK_JSON | 200 | `zep_get_employee_regular_working_time` | `/employees/d.hofweber/regular-working-times/12` | data=object |
| NOT_FOUND | 404 | `zep_list_employee_meals` | `/employees/d.hofweber/meals?limit=1` | json 404 "The route zepssigit/next/api/v1/employees/d.hofweber/meals could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_employee_meal` | `/employees/d.hofweber/meals/1` | json 404 "The route zepssigit/next/api/v1/employees/d.hofweber/meals/1 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_employee_projects` | `/employees/d.hofweber/projects?limit=1` | json 404 "The route zepssigit/next/api/v1/employees/d.hofweber/projects could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| OK_JSON | 200 | `zep_list_employee_transponders` | `/employees/d.hofweber/transponders?limit=1` | data=array(0) links meta total=0 |
| OK_JSON | 200 | `zep_list_departments` | `/departments?limit=1` | data=array(3) links meta total=3 |
| OK_JSON | 200 | `zep_get_department` | `/departments/1` | data=object |
| OK_JSON | 200 | `zep_list_department_children` | `/departments/1/children?limit=1` | data=array(2) links meta total=2 |
| OK_JSON | 200 | `zep_list_department_employees` | `/departments/1/employees?limit=1` | data=array(3) links meta total=3 |
| OK_JSON | 200 | `zep_list_absences` | `/absences?limit=1` | data=array(1) links meta total=589 |
| OK_JSON | 200 | `zep_get_absence` | `/absences/21` | data=object |
| NOT_FOUND | 404 | `zep_list_customers` | `/customers?limit=1` | json 404 "The route zepssigit/next/api/v1/customers could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_customer` | `/customers/K-0001` | json 404 "The route zepssigit/next/api/v1/customers/K-0001 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_customer_contacts` | `/customers/K-0001/contacts?limit=1` | json 404 "The route zepssigit/next/api/v1/customers/K-0001/contacts could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_customer_price_tables` | `/customers/K-0001/price-tables?limit=1` | json 404 "The route zepssigit/next/api/v1/customers/K-0001/price-tables could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_offers` | `/offers?limit=1` | json 404 "The route zepssigit/next/api/v1/offers could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_offer` | `/offers/1` | json 404 "The route zepssigit/next/api/v1/offers/1 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_offer_items` | `/offers/1/items?limit=1` | json 404 "The route zepssigit/next/api/v1/offers/1/items could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_invoices` | `/invoices?limit=1` | json 404 "The route zepssigit/next/api/v1/invoices could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_invoice` | `/invoices/1` | json 404 "The route zepssigit/next/api/v1/invoices/1 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_invoice_attachments` | `/invoices/1/attachments?limit=1` | json 404 "The route zepssigit/next/api/v1/invoices/1/attachments could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_invoice_items_for_invoice` | `/invoices/1/items?limit=1` | json 404 "The route zepssigit/next/api/v1/invoices/1/items could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_invoice_items` | `/invoice-items?limit=1` | json 404 "The route zepssigit/next/api/v1/invoice-items could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_invoice_item` | `/invoice-items/1` | json 404 "The route zepssigit/next/api/v1/invoice-items/1 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_articles` | `/articles?limit=1` | json 404 "The route zepssigit/next/api/v1/articles could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_article` | `/articles/1` | json 404 "The route zepssigit/next/api/v1/articles/1 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_receipts` | `/receipts?limit=1` | json 404 "The route zepssigit/next/api/v1/receipts could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_receipt` | `/receipts/1` | json 404 "The route zepssigit/next/api/v1/receipts/1 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_receipt_amounts` | `/receipts/1/amounts?limit=1` | json 404 "The route zepssigit/next/api/v1/receipts/1/amounts could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_receipt_amount` | `/receipts/1/amounts/1` | json 404 "The route zepssigit/next/api/v1/receipts/1/amounts/1 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_receipt_attachments` | `/receipts/1/attachments?limit=1` | json 404 "The route zepssigit/next/api/v1/receipts/1/attachments could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_locations` | `/locations?limit=1` | json 404 "The route zepssigit/next/api/v1/locations could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_location` | `/locations/1` | json 404 "The route zepssigit/next/api/v1/locations/1 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_location_lists` | `/location-lists?limit=1` | json 404 "The route zepssigit/next/api/v1/location-lists could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_location_list` | `/location-lists/1` | json 404 "The route zepssigit/next/api/v1/location-lists/1 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_location_list_locations` | `/location-lists/1/locations?limit=1` | json 404 "The route zepssigit/next/api/v1/location-lists/1/locations could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_dynamic_attributes` | `/dynamic-attributes?limit=1` | json 404 "The route zepssigit/next/api/v1/dynamic-attributes could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_get_dynamic_attribute` | `/dynamic-attributes/1` | json 404 "The route zepssigit/next/api/v1/dynamic-attributes/1 could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_folders` | `/folders?limit=1` | json 404 "The route zepssigit/next/api/v1/folders could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| NOT_FOUND | 404 | `zep_list_folder_documents` | `/folders/1/documents?limit=1` | json 404 "The route zepssigit/next/api/v1/folders/1/documents could not be found." (route NOT registered (endpoint unavailable for this tenant/module)) |
| OK_JSON | 200 | `zep_list_devices` | `/devices?limit=1` | data=array(11) links meta total=11 |
| OK_JSON | 200 | `zep_get_device` | `/devices/12` | data=object |

## Write/destructive endpoints (Phase 8.2.1 probe)

Probed 2026-06-01 with a non-existent id (`999999`) so the API reveals whether the
*route* is registered without touching a real record. Full result:
[`schemas/zep-inventory-write-ops.json`](./schemas/zep-inventory-write-ops.json).

| Marker | Status | Method | Path | Note |
| --- | --- | --- | --- | --- |
| METHOD_NA | 405 | PATCH/PUT/DELETE | `/attendances/{id}` | route is **GET, HEAD only** — no update/delete |
| METHOD_NA | 405 | PATCH/PUT/DELETE | `/absences/{id}` | route is **GET, HEAD only** — no update/delete |
| MODULE_GATE | 404 | POST | `/absences/{id}/approve` | route not registered |
| MODULE_GATE | 404 | POST | `/absences/{id}/reject` | route not registered |
| MODULE_GATE | 404 | POST | `/absences/{id}/approval` | route not registered |

**Conclusion:** this tenant exposes **no** write/destructive endpoints for attendances or
absences beyond the two existing `POST` collection creates (`POST /attendances`, `POST /absences`).
Phase 8 therefore adds **no** update/delete/approve tools — only read-only **aggregate** tools
(`zep_get_team_status_today`, `zep_get_employee_attendance_summary`,
`zep_get_employee_vacation_balance`, `zep_list_pending_absences`) that compose existing GETs.
