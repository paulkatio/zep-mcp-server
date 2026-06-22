import { paginateAll, HARD_CAP } from '../client/pagination.js';

/**
 * ZEP filters `/absences` by CONTAINMENT, not overlap: a query window
 * [start_date, end_date] returns only rows that fit entirely inside it
 * (`row.start_date >= start_date AND row.end_date <= end_date`). So a query on a
 * single day, or any window narrower than the absence, drops a multi-day absence
 * even though it overlaps. Verified live (2026-06, tenant zepssigit) against a
 * 5-day vacation (id 726, 2026-06-22..26): window [06-22,06-26] returned it,
 * but [06-23,06-26] (start clipped), [06-22,06-25] (end clipped) and the inner
 * day [06-23,06-23] each returned **0 rows**.
 *
 * To get true overlap we widen BOTH bounds by {@link OVERLAP_SLACK_DAYS} — back
 * on the lower side, forward on the upper side — so any row overlapping the real
 * window is fully contained in the widened one and comes back, then we filter
 * client-side against the real window. Caveat: an absence that extends more than
 * the slack beyond either edge of the window is still missed; large result sets
 * are surfaced via `truncated`.
 */
export const OVERLAP_SLACK_DAYS = 366;

const dayOf = (v: unknown): string => String(v ?? '').slice(0, 10); // ISO datetime/date → YYYY-MM-DD

/** Add `n` calendar days to a YYYY-MM-DD string (UTC), returning YYYY-MM-DD. */
export function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** True if a row's [start_date, end_date] span intersects the (optionally open) window. */
export function overlapsWindow(row: { start_date: unknown; end_date: unknown }, from?: string, to?: string): boolean {
  const start = dayOf(row.start_date);
  const end = dayOf(row.end_date) || start; // tolerate missing end_date → single-day
  if (to !== undefined && start > to) return false; // begins after the window
  if (from !== undefined && end < from) return false; // ends before the window
  return true;
}

export interface AbsenceWindow {
  employee_id?: string;
  from?: string;
  to?: string;
  maxItems?: number;
}

export interface AbsenceWindowResult<T> {
  items: T[];
  /** Raw rows fetched from ZEP before the client-side overlap filter. */
  scanned: number;
  /** True if the raw fetch hit the cap — overlapping rows may be missing. */
  truncated: boolean;
}

/**
 * Fetch all absences that overlap the window [from, to] (either bound optional →
 * open-ended on that side). Widens the ZEP query to defeat ZEP's start-date-only
 * filter, then keeps only true overlaps. When neither bound is given it is a
 * plain paginated fetch with no overlap filtering.
 */
export async function fetchAbsencesOverlapping<T extends { start_date: unknown; end_date: unknown }>(
  opts: AbsenceWindow,
): Promise<AbsenceWindowResult<T>> {
  const cap = opts.maxItems ?? HARD_CAP;
  const query: Record<string, unknown> = {};
  if (opts.employee_id) query.employee_id = opts.employee_id;
  // Widen both bounds: ZEP requires the row to be fully contained in the window.
  if (opts.from !== undefined) query.start_date = addDaysISO(opts.from, -OVERLAP_SLACK_DAYS);
  if (opts.to !== undefined) query.end_date = addDaysISO(opts.to, OVERLAP_SLACK_DAYS);

  const raw = await paginateAll<T>({ path: '/absences', query, maxItems: cap });
  const items =
    opts.from === undefined && opts.to === undefined
      ? raw
      : raw.filter((r) => overlapsWindow(r, opts.from, opts.to));
  return { items, scanned: raw.length, truncated: raw.length >= cap };
}
