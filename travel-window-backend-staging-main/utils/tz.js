'use strict';

// The business timezone. Every date a user picks and every day boundary a report draws is read in
// this zone, never in the server's zone and never in UTC: the CRM is operated from Canada and a
// report for "September" must mean September in Toronto wherever the server happens to run.
// Timestamps stay stored in UTC; only the interpretation of a calendar day lives here.
const TZ = 'America/Toronto';

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

// { $gte, $lte } for a dateFrom/dateTo filter, or null when neither was given.
// Date-only values (YYYY-MM-DD) span the whole day in the business timezone; anything else is
// taken as an instant. dateTo is inclusive of its whole day.
function buildRange(dateFrom, dateTo, tz = TZ) {
  if (!dateFrom && !dateTo) return null;
  const range = {};
  if (dateFrom) {
    const m = DATE_ONLY.exec(String(dateFrom).trim());
    range.$gte = m ? zonedToUtc(+m[1], +m[2], +m[3], 0, 0, 0, 0, tz) : new Date(dateFrom);
  }
  if (dateTo) {
    const m = DATE_ONLY.exec(String(dateTo).trim());
    // Non date-only values keep the whole-day intent by walking to the end of that instant's day.
    range.$lte = m ? zonedToUtc(+m[1], +m[2], +m[3], 23, 59, 59, 999, tz) : endOfDayTz(new Date(dateTo), tz);
  }
  return range;
}

// True when `date` falls inside a range from buildRange. A null range means "no filter".
function inRange(date, range) {
  if (!range) return true;
  if (!date) return false;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  if (range.$gte && t < range.$gte.getTime()) return false;
  if (range.$lte && t > range.$lte.getTime()) return false;
  return true;
}

// 'YYYY-MM-DD' for an instant, as that instant's calendar day in `tz`.
// en-CA with a timeZone and no other options yields exactly YYYY-MM-DD.
function dayInTz(date, tz = TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(date));
}

// Midnight at the start of the instant's day in `tz`, as a UTC Date.
function startOfDayTz(date = new Date(), tz = TZ) {
  const [y, m, d] = dayInTz(date, tz).split('-').map(Number);
  return zonedToUtc(y, m, d, 0, 0, 0, 0, tz);
}

// Last millisecond of the instant's day in `tz`, as a UTC Date.
function endOfDayTz(date = new Date(), tz = TZ) {
  const [y, m, d] = dayInTz(date, tz).split('-').map(Number);
  return zonedToUtc(y, m, d, 23, 59, 59, 999, tz);
}

// Midnight at the start of today in `tz`. Use this instead of `new Date().setHours(0,0,0,0)`,
// which is midnight in the server's zone.
function startOfTodayTz(tz = TZ) {
  return startOfDayTz(new Date(), tz);
}

module.exports = { TZ, buildRange, inRange, dayInTz, startOfDayTz, endOfDayTz, startOfTodayTz, zonedToUtc };
