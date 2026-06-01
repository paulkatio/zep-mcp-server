/**
 * LLM-UX polish layer: curated re-exports of the body schemas, plus DACH
 * defaults. Tools import their body schemas from here (manual.ts has priority
 * over generated schemas, per BLUEPRINT §7).
 */

/** DACH default currency for finance bodies (applied in Phase 3 finance tools). */
export const DEFAULT_CURRENCY = 'EUR';

export {
  CreateAttendanceBody,
  CreateAbsenceBody,
  CreateEmployeeBody,
  UpdateEmployeeBody,
  CreateEmploymentPeriodBody,
  UpdateEmploymentPeriodBody,
} from './manual.js';
