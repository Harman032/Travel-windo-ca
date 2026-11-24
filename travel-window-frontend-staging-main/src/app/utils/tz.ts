/**
 * The business timezone. Every date the UI shows and every "today" it defaults to is read in this
 * zone, never in the viewer's browser zone — staff outside Canada must see the same calendar day
 * as staff in Toronto. Mirrors travel-window-backend-staging-main/utils/tz.js.
 */
export const TZ = 'America/Toronto';

/**
 * Canadian date format for the new supplier statement. `en-CA` with a timeZone and no other
 * options yields exactly `YYYY-MM-DD`, which is also the format <input type="date"> wants.
 * Other screens keep their existing dd-MM-yyyy display.
 */
export const dayInTz = (d: Date | string | number = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d));

/** Today's calendar day in Toronto, as 'YYYY-MM-DD'. Use for <input type="date"> max/min/default. */
export const todayInTz = (): string => dayInTz(new Date());

/**
 * 'YYYY-MM-DD' for a value that may already be a date-only string, a Date, or an ISO timestamp.
 * Returns '' for anything unparseable so a form control gets a blank rather than "Invalid Date".
 *
 * Exact midnight in a stated offset means its LITERAL date part, not the Toronto day of that
 * instant. Mirrors parseDateInput in travel-window-backend-staging-main/utils/date-only.js, which
 * has had this rule since the date-only hotfix; this function did not, and the two disagreed.
 *
 * It matters for the payment dates stored at 00:00Z before that hotfix. 2026-04-03T00:00:00Z is
 * 20:00 on 2 April in Toronto, so the plain Toronto day of it is 2026-04-02 -- a day earlier than
 * the day the agent typed. Measured against the staging copy: a booking whose payment is stored at
 * 2026-04-03T00:00:00Z loaded into the edit form showing 2026-04-02, and saving it wrote
 * 2026-04-02T12:00:00Z, making the wrong day permanent. The backend heals a real 00:00Z instant to
 * noon on the right day, but never got the chance, because the form had already moved it.
 *
 * A timestamp that is NOT exact midnight in a stated offset is a real instant and keeps the
 * Toronto-day reading: that is the correct answer for dateOfSubmission and for anything else
 * recorded as a moment rather than as a calendar day.
 */
const OFFSET_MIDNIGHT =
  /^(\d{4}-\d{2}-\d{2})[T ]00:00(?::00(?:\.0{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

export const toDateInputValue = (v: unknown): string => {
  if (v == null || v === '') return '';
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const off = OFFSET_MIDNIGHT.exec(s);
    if (off) return off[1];
  }
  const d = new Date(v as any);
  if (isNaN(d.getTime())) return '';
  // A Date object that lands on exact UTC midnight: same rule, read off its UTC date part.
  if (d.getTime() % 86400000 === 0) return d.toISOString().slice(0, 10);
  return dayInTz(d);
};

/** Timestamp with the zone named, for a report's "generated at" line. */
export const timestampInTz = (d: Date | string = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'long' }).format(new Date(d));

/** True when the date-only day `day` ('YYYY-MM-DD') is before today in Toronto. */
export const isPastDay = (day: Date | string): boolean => toDateInputValue(day) < todayInTz();
