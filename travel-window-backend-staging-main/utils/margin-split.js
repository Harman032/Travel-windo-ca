'use strict';

const CHANGE_FIELDS = ['dateChanges', 'flightChanges', 'seatBookChanges'];

// Business timezone the report dates are read in. Dates are stored in UTC and shown in each
// viewer's browser timezone, so report day boundaries need one fixed zone to agree with the client.
const REPORT_TZ = process.env.REPORT_TIMEZONE || 'America/Toronto';

// Milliseconds the zone is ahead of UTC at the given instant.
function tzOffsetMs(utcMs, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric'
    }).formatToParts(new Date(utcMs)).map(x => [x.type, Number(x.value)])
  );
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
}

// UTC instant of a wall-clock time in `tz` (iterates once to settle DST edges).
function zonedToUtc(y, m, d, h, mi, s, ms, tz) {
  const wall = Date.UTC(y, m - 1, d, h, mi, s, ms);
  let utc = wall - tzOffsetMs(wall, tz);
  utc = wall - tzOffsetMs(utc, tz);
  return new Date(utc);
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

// { $gte, $lte } for a report's dateFrom/dateTo, or null when no range was given.
// Date-only values (YYYY-MM-DD) span the whole day in the business timezone; anything else
// falls back to the previous behaviour. dateTo is inclusive of the whole day.
function buildRange(dateFrom, dateTo, tz = REPORT_TZ) {
  if (!dateFrom && !dateTo) return null;
  const range = {};
  if (dateFrom) {
    const m = DATE_ONLY.exec(String(dateFrom).trim());
    range.$gte = m ? zonedToUtc(+m[1], +m[2], +m[3], 0, 0, 0, 0, tz) : new Date(dateFrom);
  }
  if (dateTo) {
    const m = DATE_ONLY.exec(String(dateTo).trim());
    range.$lte = m ? zonedToUtc(+m[1], +m[2], +m[3], 23, 59, 59, 999, tz) : new Date(new Date(dateTo).setHours(23, 59, 59, 999));
  }
  return range;
}

function inRange(date, range) {
  if (!range) return true;
  if (!date) return false;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  if (range.$gte && t < range.$gte.getTime()) return false;
  if (range.$lte && t > range.$lte.getTime()) return false;
  return true;
}

// Mongo conditions matching a booking that has any modification inside the range.
function changeRangeConditions(range) {
  return CHANGE_FIELDS.map(f => ({ [`${f}.changedAt`]: range }));
}

/**
 * Splits a booking's modification margin by the date each change was made.
 * Every change's net margin (originalUserAmount + modifierUserAmount) belongs
 * to the change date, not the booking date:
 *   netAll          total net margin of all changes -> subtract from the booking-date margin
 *   creatorInRange  creator's share of changes inside the range
 *   modifiers       per-modifier share of changes inside the range
 *   hasInRange      true when an in-range change carries a non-zero split
 * With no range everything is in range, so booking margin - netAll + creatorInRange
 * equals the old "booking margin - sum of modifier shares". Changes without a
 * stored split (legacy) contribute 0 and stay in the booking margin untouched.
 */
function getSplitSummary(booking, range) {
  const summary = { netAll: 0, creatorInRange: 0, modifiers: {}, hasInRange: false };
  const changes = CHANGE_FIELDS.flatMap(f => booking[f] || []);

  for (const change of changes) {
    const ms = change && change.marginSplit;
    if (!ms) continue;
    const orig = Number(ms.originalUserAmount) || 0;
    const mod = Number(ms.modifierUserAmount) || 0;
    summary.netAll += orig + mod;

    if (!inRange(change.changedAt || booking.dateOfSubmission, range)) continue;
    if (orig === 0 && mod === 0) continue;

    summary.hasInRange = true;
    summary.creatorInRange += orig;
    if (ms.modifierId && mod > 0) {
      const id = ms.modifierId.toString();
      if (!summary.modifiers[id]) summary.modifiers[id] = { amount: 0, name: ms.modifierName };
      summary.modifiers[id].amount += mod;
    }
  }
  return summary;
}

module.exports = { buildRange, inRange, changeRangeConditions, getSplitSummary, REPORT_TZ };
