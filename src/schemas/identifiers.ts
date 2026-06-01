import { z } from 'zod';

// String identifiers — the two that LLMs most often get wrong.
export const EmployeeUsername = z
  .string()
  .min(1)
  .max(64)
  .describe(
    'Mitarbeiter-Username (z.B. "max.mustermann"). NICHT die numerische interne ID.',
  );

export const CustomerNumber = z
  .string()
  .min(1)
  .max(32)
  .describe(
    'Kundennummer (z.B. "K-12345"). NICHT die numerische interne ID. ' +
      'ZEP erlaubt, dass die Kundennummer geändert wird — dann gilt die neue.',
  );

// Numeric top-level resource IDs.
export const ProjectId = z.number().int().positive().describe('Numerische Projekt-ID.');
export const TicketId = z.number().int().positive().describe('Numerische Ticket-ID.');
export const AbsenceId = z.number().int().positive().describe('Numerische Abwesenheits-ID.');
export const ReceiptId = z.number().int().positive().describe('Numerische Beleg-ID.');
export const DepartmentId = z.number().int().positive().describe('Numerische Abteilungs-ID.');
export const DeviceId = z.number().int().positive().describe('Numerische Terminal-/Geräte-ID.');
export const OfferId = z.number().int().positive().describe('Numerische Angebots-ID.');
export const InvoiceId = z.number().int().positive().describe('Numerische Rechnungs-ID.');
export const ArticleId = z.number().int().positive().describe('Numerische Artikel-ID.');
export const LocationId = z.number().int().positive().describe('Numerische Standort-ID.');
export const LocationListId = z.number().int().positive().describe('Numerische Standortlisten-ID.');
export const DynamicAttributeId = z
  .number()
  .int()
  .positive()
  .describe('Numerische ID eines dynamischen Attributs.');
export const FolderId = z.number().int().positive().describe('Numerische Ordner-ID.');
export const InvoiceItemId = z.number().int().positive().describe('Numerische Rechnungspositions-ID.');
export const AttendanceId = z.number().int().positive().describe('Numerische Projektzeit-ID.');

// Numeric sub-resource IDs.
export const TaskId = z.number().int().positive().describe('Numerische Vorgang-ID (project task).');
export const SubtaskId = z.number().int().positive().describe('Numerische Teilaufgaben-ID.');
export const AmountId = z.number().int().positive().describe('Numerische Beleg-Betrag-ID.');
export const EmploymentPeriodId = z
  .number()
  .int()
  .positive()
  .describe('Numerische ID eines Beschäftigungszeitraums.');
export const InternalRateId = z.number().int().positive().describe('Numerische ID eines internen Stundensatzes.');
export const RegularWorkingTimeId = z
  .number()
  .int()
  .positive()
  .describe('Numerische ID einer Regelarbeitszeit.');
export const MealId = z.number().int().positive().describe('Numerische Mahlzeiten-ID.');
export const TransponderId = z.number().int().positive().describe('Numerische Transponder-ID.');
