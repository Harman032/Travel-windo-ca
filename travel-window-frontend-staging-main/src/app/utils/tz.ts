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
 */
export const toDateInputValue = (v: unknown): string => {
  if (v == null || v === '') return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '' : dayInTz(d);
};

/** Timestamp with the zone named, for a report's "generated at" line. */
export const timestampInTz = (d: Date | string = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'long' }).format(new Date(d));

/** True when the date-only day `day` ('YYYY-MM-DD') is before today in Toronto. */
export const isPastDay = (day: Date | string): boolean => toDateInputValue(day) < todayInTz();
