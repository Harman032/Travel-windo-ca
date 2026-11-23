'use strict';

const { dayInTz } = require('./tz');

/**
 * Date-only fields — travelDate, returnDate, multipleSectors[].travelDate, payments[].paymentDate,
 * the cancellation refund/collection dates and (from PART 2) issueDate — are stored at **12:00 UTC**
 * on purpose. Noon UTC reads as the same calendar day from UTC-11 through to UTC+11, so a date the
 * user typed cannot be read back as the day before or after. (00:00 UTC does not have that
 * property: in Toronto it is the previous day's 19:00 or 20:00, which is why all 2,398 legacy
 * payment dates read one day early here.)
 *
 * It is not literally every zone — real offsets run to UTC+14, where noon UTC is already the next
 * day — but Toronto is UTC-4/-5, so noon lands at 07:00/08:00 local and is always on the right day.
 *
 * Timestamps — dateOfSubmission, changedAt, cancelledAt, the verification dates,
 * cancellation.refundProcessedDate, createdAt/updatedAt — are instants and are stored as the
 * instant. They must never pass through here. Only their *display* is zoned; see utils/tz.js.
 */
const NOON_UTC = 12;

/** Bare date-only: '2026-11-17'. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Midnight carrying its own explicit offset: '2026-11-17T00:00:00Z',
 * '2026-11-17T00:00:00.000+00:00', '2026-11-17T00:00+05:30'.
 *
 * This is what a date-only value looks like after a round trip through a Date object and
 * toISOString() — which is exactly how the old frontend posted payment dates (4c206eb
 * booking-detail.component.ts:1627 did `new Date(p.paymentDate)`, and HttpClient's JSON.stringify
 * then called toISOString()). The *literal date part* is the day the user typed, whatever the
 * offset says, so that is the day to keep.
 */
const OFFSET_MIDNIGHT =
  /^(\d{4})-(\d{2})-(\d{2})[T ]00:00(?::00(?:\.0{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

/** Year bounds for NEW date-only input. Legacy rows are never re-checked; see validateDateOnly. */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/** Noon UTC on a given calendar day. */
const noonOn = (y, m, d) => new Date(Date.UTC(y, m - 1, d, NOON_UTC, 0, 0, 0));

/** Noon UTC on the calendar day a 'YYYY-MM-DD' string names. */
const noonOnDay = (ymd) => {
  const parts = ymd.split('-').map(Number);
  return noonOn(parts[0], parts[1], parts[2]);
};

/**
 * Parse a date input for a DATE-ONLY field, landing on noon UTC of the right calendar day.
 * Returns null for anything missing or unparseable, so a caller can reject or fall back.
 *
 *   '2026-11-17'                    -> 2026-11-17T12:00:00Z   (literal date)
 *   '2026-11-17T00:00:00Z'          -> 2026-11-17T12:00:00Z   (literal date, explicit offset)
 *   '2026-11-17T00:00:00.000+00:00' -> 2026-11-17T12:00:00Z   (literal date, explicit offset)
 *   '2026-11-17T00:00:00+05:30'     -> 2026-11-17T12:00:00Z   (literal date, explicit offset)
 *   Date at exactly 00:00:00.000Z   -> that UTC day at noon   (a serialised date-only value)
 *   2026-11-18T00:30:00Z            -> 2026-11-17T12:00:00Z   (a real instant: Toronto's day)
 *
 * The split matters. An exact midnight in a stated offset is a date-only value that has been
 * through a serialiser, so its literal date *is* the typed day. Any other time is a genuine
 * instant, and the day it belongs to is the day the person was living in when it was stamped —
 * Toronto's, not UTC's. Taking the UTC day of a real instant is wrong for the five hours between
 * 19:00 Toronto and midnight UTC, and wrong invisibly: the result looks like a well-formed noon
 * date that no counter will ever flag.
 *
 * ponytail: a genuine instant landing on exactly 00:00:00.000Z is attributed to the UTC day
 * (19:00/20:00 the previous evening in Toronto) rather than Toronto's. One instant in 86.4
 * million; distinguishing it would need a second stored field saying which kind of value arrived.
 */
const parseDateInput = (value) => {
  if (value === undefined || value === null || value === '') return null;

  if (!(value instanceof Date)) {
    const s = String(value).trim();
    const bare = DATE_ONLY.exec(s);
    if (bare) return noonOn(Number(bare[1]), Number(bare[2]), Number(bare[3]));
    const off = OFFSET_MIDNIGHT.exec(s);
    if (off) return noonOn(Number(off[1]), Number(off[2]), Number(off[3]));
  }

  const dt = value instanceof Date ? value : new Date(value);
  if (isNaN(dt.getTime())) return null;

  // Exactly 00:00:00.000Z — a date-only value that arrived as a Date. Keep its UTC day.
  if (dt.getTime() % 86400000 === 0) {
    return noonOn(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  // A real instant. The calendar day it belongs to is Toronto's.
  return noonOnDay(dayInTz(dt));
};

/**
 * Route-layer guard for NEW date-only input: a year outside MIN_YEAR..MAX_YEAR is a typo, not a
 * date. 1927 and 22026 are both already stored on live (14 such values as of 2026-11-23), and
 * 22026 is the value that aborted the whole migration updateMany during the deploy rehearsal.
 *
 * Deliberately NOT a schema validator. Mongoose re-validates every loaded path on save, so a
 * schema rule would block every edit, cancellation and verification on a booking that already
 * carries a bad year — the same trap as the Cheque payment-mode enum. Legacy rows keep saving;
 * only a value being written now is checked.
 *
 * Returns null when acceptable, or a message naming the field.
 */
const validateDateOnly = (value, label) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseDateInput(value);
  if (!parsed) return `${label} is not a valid date`;
  const y = parsed.getUTCFullYear();
  if (y < MIN_YEAR || y > MAX_YEAR) {
    return `${label} year ${y} is outside ${MIN_YEAR}-${MAX_YEAR}`;
  }
  return null;
};

/**
 * Check several date-only inputs at once. Mirrors validateFinancialFields' shape so a route can
 * guard every date it is about to write in one call.
 * Returns null when all are acceptable, or the first message.
 */
const validateDateOnlyFields = (entries) => {
  for (const [label, value] of Object.entries(entries)) {
    const bad = validateDateOnly(value, label);
    if (bad) return bad;
  }
  return null;
};

/** True when a stored date-only value follows the noon-UTC convention. */
const isNoonUtc = (date) => !!date && new Date(date).getUTCHours() === NOON_UTC
  && new Date(date).getUTCMinutes() === 0 && new Date(date).getUTCSeconds() === 0;

/** Same calendar day, moved to noon UTC. Used by the date-only migration. */
const toNoonUtc = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), NOON_UTC, 0, 0));
};

/**
 * Normalize payments so paidAmount is a number and paymentDate lands on noon UTC.
 *
 * For callers that have already validated through utils/payment-rows.js validatePaymentRows,
 * which is where the row rules (a new or changed row needs a date; a new or changed E-Transfer
 * needs its bank details) now live -- bank accounts have no business in a file about dates.
 * This no longer invents a date.
 */
const normalizePayments = (payments) => {
  if (!Array.isArray(payments)) return [];
  return payments.map(p => ({
    paidAmount: typeof p.paidAmount === 'number' ? p.paidAmount : parseFloat(p.paidAmount) || 0,
    paymentMode: p.paymentMode || 'Cash',
    paymentDate: parseDateInput(p.paymentDate),
    referenceNo: p.referenceNo || ''
  }));
};

module.exports = {
  NOON_UTC, MIN_YEAR, MAX_YEAR,
  parseDateInput, validateDateOnly, validateDateOnlyFields, isNoonUtc, toNoonUtc,
  normalizePayments
};
