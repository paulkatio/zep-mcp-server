import { z } from 'zod';
import { DATE_REGEX, TIME_REGEX } from './common.js';

/**
 * Hand-maintained request-body schemas for endpoints not covered by the
 * downloadable OpenAPI spec.
 *
 * Phase 2 models ONLY the live-verified HR/Time bodies as real schemas (fields
 * derived from the live GET shapes). The required/optional split still needs
 * verification against the ZEP create/update docs — see TODO markers. All other
 * bodies are permissive `z.record(z.unknown())` placeholders, to be modelled in
 * Phase 3 from the live documentation.
 */

// ── HR / Time (live-verified resources) ──────────────────────────────────────

// TODO(phase3): verify required fields + project/activity linkage for project-time bookings.
export const CreateAttendanceBody = z
  .object({
    employee_id: z.string().min(1).describe('Mitarbeiter-Username, für den gebucht wird.'),
    date: z.string().regex(DATE_REGEX).describe('Datum, YYYY-MM-DD.'),
    from: z.string().regex(TIME_REGEX).describe('Startzeit, HH:MM.'),
    to: z.string().regex(TIME_REGEX).describe('Endzeit, HH:MM.'),
    note: z.string().optional(),
    department_id: z.number().int().positive().optional(),
  })
  .strict();

// TODO(phase3): verify against /absences create doc (type codes, half-day handling).
export const CreateAbsenceBody = z
  .object({
    employee_id: z.string().min(1).describe('Mitarbeiter-Username.'),
    absence_reason_id: z
      .string()
      .min(1)
      .describe('Fehlgrund-Code, z.B. "KR" (siehe zep://master-data/absence-reasons).'),
    start_date: z.string().regex(DATE_REGEX),
    end_date: z.string().regex(DATE_REGEX),
    type: z.number().int().optional().describe('Abwesenheits-Typ (numerisch).'),
    hours: z.number().nonnegative().optional(),
    from: z.string().regex(TIME_REGEX).optional(),
    to: z.string().regex(TIME_REGEX).optional(),
    note: z.string().optional(),
    timezone: z.string().optional(),
  })
  .strict();

// TODO(phase3): confirm full writable field allow-list against /employees create doc.
export const CreateEmployeeBody = z
  .object({
    username: z.string().min(1).max(64).describe('Eindeutiger Username (z.B. "max.mustermann").'),
    firstname: z.string().min(1),
    lastname: z.string().min(1),
    email: z.string().email().optional(),
    personal_number: z.string().optional(),
    abbreviation: z.string().optional(),
    department_id: z.number().int().positive().optional(),
    salutation_id: z.string().optional(),
    title: z.string().optional(),
    street: z.string().optional(),
    zip: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    price_group: z.string().optional(),
    language: z.string().optional(),
  })
  .strict();

/** PUT update is a partial patch (server merges via GET-merge-PUT). */
export const UpdateEmployeeBody = CreateEmployeeBody.partial().strict();

// TODO(phase3): verify entitlement field semantics against /employment-periods doc.
export const CreateEmploymentPeriodBody = z
  .object({
    start_date: z.string().regex(DATE_REGEX),
    end_date: z.string().regex(DATE_REGEX).nullable().optional(),
    note: z.string().nullable().optional(),
    beginning_of_year: z.string().nullable().optional(),
    annual_leave_entitlement: z.number().nonnegative().optional(),
    period_holiday_entitlement: z.number().nonnegative().optional(),
    is_holiday_per_year: z.boolean().optional(),
    day_absent_in_hours: z.number().nonnegative().optional(),
  })
  .strict();

export const UpdateEmploymentPeriodBody = CreateEmploymentPeriodBody.partial().strict();

// ── Phase 3 placeholders (model from live doc; permissive for now) ───────────
// TODO(phase3): replace each with a real .strict() schema from the ZEP docs.
export const CreateProjectBody = z.record(z.unknown());
export const UpdateProjectBody = z.record(z.unknown());
export const CreateProjectTaskBody = z.record(z.unknown());
export const CreateTicketBody = z.record(z.unknown());
export const UpdateTicketBody = z.record(z.unknown());
export const CreateSubtaskBody = z.record(z.unknown());
export const UpdateSubtaskBody = z.record(z.unknown());
export const CreateCustomerBody = z.record(z.unknown());
export const UpdateCustomerBody = z.record(z.unknown());
export const CreateReceiptBody = z.record(z.unknown());
export const UpdateReceiptBody = z.record(z.unknown());
