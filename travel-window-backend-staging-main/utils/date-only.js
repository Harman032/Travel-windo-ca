'use strict';

/**
 * Date-only fields — travelDate, returnDate, payment dates, collection and refund dates — are
 * stored at **12:00 UTC** on purpose. Noon UTC reads as the same calendar day from UTC-11 right
 * through to UTC+11, so a date the user typed cannot be read back as the day before or after.
 * (00:00 UTC does not have that property: in Toronto it is the previous day's 19:00 or 20:00,
 * which is why all 2,398 legacy payment dates read one day early here.)
 *
 * It is not literally every zone — real offsets run to UTC+14, where noon UTC is already the next
 * day — but Toronto is UTC-4/-5, so noon lands at 07:00/08:00 local and is always on the right day.
 *
 * Timestamps — dateOfSubmission, changedAt, cancelledAt, verification dates — are instants and
 * are stored as the instant. Only their *display* is zoned; see utils/tz.js.
 */
const NOON_UTC = 12;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a date input into a Date, keeping a date-only value on its own calendar day.
 * Returns null for anything missing or unparseable, so a caller can fall back.
 *
 * A caller must pass the bare 'YYYY-MM-DD' string for a date-only field. Converting it to a Date
 * first — `new Date('2026-09-07')` — yields UTC midnight and loses the chance to apply the noon
 * convention here; that is exactly how all 2,398 stored payment dates ended up at 00:00Z.
 */
const parseDateInput = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  const m = DATE_ONLY.exec(s);
  if (m) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), NOON_UTC, 0, 0));
  }
  const dt = new Date(value);
  return isNaN(dt.getTime()) ? null : dt;
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

/** Normalize payments so paidAmount is a number and paymentDate is a valid Date (avoids blank save). */
const normalizePayments = (payments) => {
  if (!Array.isArray(payments)) return [];
  return payments.map(p => {
    const paidAmount = typeof p.paidAmount === 'number' ? p.paidAmount : parseFloat(p.paidAmount) || 0;
    const paymentDate = (p.paymentDate ? parseDateInput(p.paymentDate) : null) || new Date();
    return {
      paidAmount,
      paymentMode: p.paymentMode || 'Cash',
      paymentDate,
      referenceNo: p.referenceNo || ''
    };
  });
};

module.exports = { NOON_UTC, parseDateInput, isNoonUtc, toNoonUtc, normalizePayments };
