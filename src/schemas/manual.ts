import { z } from 'zod';
import { DATE_REGEX, TIME_REGEX } from './common.js';

/**
 * Hand-maintained request-body schemas for the HR/Time write endpoints.
 *
 * Sources (Phase 3): the official OpenAPI spec `schemas/zep-openapi-v7.4.0.yaml`
 * covers POST /attendances and POST /employees; POST /absences comes from the
 * live doc (developer.zep.de/.../absences/create); the employment-period bodies
 * are derived from the live GET response shape (no public create-doc page).
 * Fields ZEP does not clearly document are intentionally omitted (allow-list).
 */

// ── POST /attendances ─────────────────────────────────────────────────────────
// NOTE: project_id/project_task_id/activity_id are REQUIRED by ZEP — booking a
// project time needs the Projektverwaltung module. On a tenant without that
// module (e.g. HR-only), this tool cannot be used.
export const CreateAttendanceBody = z
  .object({
    employee_id: z.string().min(1).describe('Mitarbeiter-Username, für den gebucht wird (z.B. "max.mustermann").'),
    date: z.string().regex(DATE_REGEX).describe('Datum der Projektzeit, YYYY-MM-DD.'),
    from: z.string().regex(TIME_REGEX).describe('Startzeit, HH:MM oder HH:MM:SS.'),
    to: z.string().regex(TIME_REGEX).describe('Endzeit, HH:MM(:SS) — muss nach "from" liegen.'),
    project_id: z.number().int().positive().describe('ID des Projekts (erfordert Projektverwaltungs-Modul).'),
    project_task_id: z.number().int().positive().describe('ID des Projektvorgangs.'),
    activity_id: z.string().min(1).describe('ID der Tätigkeit (siehe zep://master-data/activities).'),
    duration: z.number().nonnegative().optional().describe('Gesamtdauer in Stunden (optional, sonst aus from/to).'),
    billable: z.boolean().optional().describe('Abrechenbar?'),
    is_travel: z.boolean().optional().describe('Zählt als Reisezeit?'),
    locked: z.boolean().optional().describe('Eintrag gesperrt?'),
  })
  // Travel-detail fields (start/destination/vehicle_id/km/passengers/
  // direction_of_travel) are documented but omitted from the LLM surface.
  .strict();

// ── POST /absences ────────────────────────────────────────────────────────────
// Required per live doc: employee_id, absence_reason_id, from, to (both dates).
// absence_reason_id: the doc says integer, but the live API uses string codes
// (e.g. "KR") — modelled as string to match the live tenant.
export const CreateAbsenceBody = z
  .object({
    employee_id: z.string().min(1).describe('Mitarbeiter-Username.'),
    absence_reason_id: z
      .string()
      .min(1)
      .describe('Fehlgrund-Code, z.B. "KR" (siehe zep://master-data/absence-reasons).'),
    from: z.string().regex(DATE_REGEX).describe('Erster Abwesenheitstag, YYYY-MM-DD.'),
    to: z.string().regex(DATE_REGEX).describe('Letzter Abwesenheitstag, YYYY-MM-DD (>= from).'),
    days: z.number().nonnegative().optional().describe('Gesamttage (optional, wird sonst berechnet).'),
    half_day_from: z.boolean().optional().describe('Erster Tag halber Tag? (Default false)'),
    half_day_to: z.boolean().optional().describe('Letzter Tag halber Tag? (Default false)'),
    comment: z.string().optional().describe('Notiz zur Abwesenheit.'),
    approval_status: z
      .enum(['pending', 'approved', 'rejected'])
      .optional()
      .describe('Genehmigungsstatus (Default pending).'),
  })
  // approved_by/approved_at are documented but server-managed → omitted.
  .strict();

// ── POST /employees ───────────────────────────────────────────────────────────
// Required per spec: username, firstname, lastname, email, password, price_group.
export const CreateEmployeeBody = z
  .object({
    username: z.string().min(5).max(255).describe('Eindeutiger Username, 5–255 Zeichen (z.B. "max.mustermann").'),
    firstname: z.string().min(1).describe('Vorname.'),
    lastname: z.string().min(1).describe('Nachname.'),
    email: z.string().email().describe('Eindeutige E-Mail-Adresse.'),
    password: z.string().min(8).max(48).describe('Passwort, 8–48 Zeichen. Wird nie geloggt.'),
    price_group: z.string().min(1).describe('Name der Preisgruppe.'),
    personal_number: z.string().optional().describe('Personalnummer (eindeutig).'),
    birthdate: z.string().regex(DATE_REGEX).optional().describe('Geburtsdatum, YYYY-MM-DD.'),
    department_id: z.number().int().positive().optional().describe('Abteilungs-ID.'),
    rights: z
      .enum(['0', '1', '2', '3', '4'])
      .optional()
      .describe('Rechte: 0=User, 1=Admin, 2=Controller, 3=User+Zusatzrechte, 4=Projekt-Controller.'),
    employment: z
      .enum(['0', '1', '2'])
      .optional()
      .describe('Anstellung: 0=Mitarbeiter, 1=Freelancer, 2=Freelancer mit Gutschrift.'),
    phone: z.string().optional(),
    mobile: z.string().optional(),
    fax: z.string().optional(),
    private_phone: z.string().optional(),
    street: z.string().optional(),
    zip: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    abbreviation: z.string().optional().describe('Kürzel.'),
    salutation: z.string().optional().describe('Anrede, z.B. "Herr"/"Frau".'),
    title: z.string().optional().describe('Titel.'),
    iban: z.string().optional(),
    bic: z.string().optional(),
    currency: z.string().optional(),
    vat: z.string().optional().describe('USt-Satz.'),
    approval_date: z.string().regex(DATE_REGEX).optional(),
  })
  // Integration/legacy fields (oauthUsername, account_no, bank_name, bank_code,
  // personio_id, cost_bearer, tax_id, creditor_number, categories,
  // dynamicAttributes) are omitted from the LLM surface.
  .strict();

/** PUT update = partial patch via GET-merge-PUT. No username (path) / password change. */
export const UpdateEmployeeBody = CreateEmployeeBody.omit({ username: true, password: true }).partial().strict();

// ── POST/PUT /employees/{username}/employment-periods ─────────────────────────
// No public create-doc page; fields taken from the live GET response shape.
// `start_date` treated as required; the rest optional (best-effort inference).
export const CreateEmploymentPeriodBody = z
  .object({
    start_date: z.string().regex(DATE_REGEX).describe('Beginn des Beschäftigungszeitraums, YYYY-MM-DD.'),
    end_date: z.string().regex(DATE_REGEX).nullable().optional().describe('Ende, YYYY-MM-DD (null = unbefristet).'),
    note: z.string().nullable().optional(),
    beginning_of_year: z.string().nullable().optional().describe('Jahresbeginn-Stichtag.'),
    annual_leave_entitlement: z.number().nonnegative().optional().describe('Jahres-Urlaubsanspruch in Tagen.'),
    period_holiday_entitlement: z.number().nonnegative().optional().describe('Urlaubsanspruch für den Zeitraum.'),
    is_holiday_per_year: z.boolean().optional(),
    day_absent_in_hours: z.number().nonnegative().optional().describe('Stunden pro Abwesenheitstag.'),
  })
  .strict();

export const UpdateEmploymentPeriodBody = CreateEmploymentPeriodBody.partial().strict();
