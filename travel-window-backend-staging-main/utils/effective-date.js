'use strict';

const { dayInTz } = require('./tz');
const { parseDateInput } = require('./date-only');

/**
 * ISSUE DATE — the day a ticket was actually issued, as distinct from dateOfSubmission, the
 * instant it was keyed into the CRM.
 *
 * The two are usually the same day, but an agent issuing a ticket on Saturday evening may not
 * enter it until Monday, and the supplier bills us for Saturday. Before this field existed, any
 * such ticket landed in the wrong week on the supplier statement and in the wrong month on the
 * margin reports whenever it crossed a period boundary.
 *
 * EFFECTIVE DATE = issueDate ?? dateOfSubmission. There is no migration and no backfill: every
 * legacy booking has no issueDate and keeps falling back to dateOfSubmission, so no figure in any
 * past month moves. That is the point of a nullable field over a populated one.
 *
 * Which reports use it, and which deliberately do not, is recorded at each call site in
 * routes/reports.js. The short version: money reports use the effective date, data-entry and
 * workflow reports stay on the entry date, because issueDate is backdatable by the agent and a
 * report about who keyed what must not be movable by the person being measured.
 */

/** How far before the entry date an issue date may be backdated, in Toronto calendar days. */
const ISSUE_DATE_MAX_BACKDATE_DAYS = 3;

const DAY_MS = 86400000;

/** Noon UTC on the calendar day a 'YYYY-MM-DD' string names. */
const noonOnDay = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
};

/**
 * The day a booking belongs to, as a Date. issueDate when set, otherwise dateOfSubmission.
 *
 * Note the asymmetry: issueDate is a date-only field stored at noon UTC, dateOfSubmission is an
 * instant. Both are safe to compare with inRange(), which works on Toronto day boundaries, and
 * safe to pass to dayInTz().
 */
const effectiveDate = (b) => (b && b.issueDate) || (b && b.dateOfSubmission) || null;

/** The effective day as 'YYYY-MM-DD' in Toronto, or '' when there is nothing to read. */
const effectiveDay = (b) => {
  const d = effectiveDate(b);
  return d ? dayInTz(d) : '';
};

/**
 * Mongo conditions matching "effective date inside this range", to be spread into an $or.
 *
 *   { $or: [...effectiveRangeConditions(range), ...changeRangeConditions(range)] }
 *
 * Two clauses rather than an $expr with $ifNull, so both stay index-eligible: the first uses the
 * issueDate index, the second the existing dateOfSubmission one. `{ issueDate: null }` matches
 * documents where the field is null AND where it is absent entirely, which is every legacy row.
 *
 * Returns [] for a null range, so a caller with no dates selected adds no constraint.
 */
const effectiveRangeConditions = (range) => (range ? [
  { issueDate: range },
  { issueDate: null, dateOfSubmission: range }
] : []);

/**
 * True when the booking was keyed in AFTER the day it was issued — the "Late entry" marker on the
 * supplier statement. Compared as Toronto calendar days, not instants: a ticket issued at 23:00
 * and entered at 00:30 the same night is one day late by the clock and zero days late by the
 * calendar, and the calendar is what the supplier bills on.
 *
 * False when there is no issueDate: a legacy booking cannot be late against a date it never had.
 */
const isLateEntry = (b) => {
  if (!b || !b.issueDate || !b.dateOfSubmission) return false;
  return dayInTz(b.dateOfSubmission) > dayInTz(b.issueDate);
};

/**
 * Validate an issue date being written now.
 *
 * The window is [entry day - ISSUE_DATE_MAX_BACKDATE_DAYS, entry day], clamped so it can never
 * extend past today. Both ends are Toronto calendar days.
 *
 * BOTH ends are anchored to the booking's own entry date, and that matters. An earlier version
 * bounded the lower end on the entry date but the upper end on *today*, which for an old booking
 * are months apart: a booking entered 2026-09-02 accepted an issue date of 2026-11-23, 82 days
 * AFTER it was keyed in. That moved the whole booking -- sale, cost and margin -- out of a closed
 * September and into November across Reports C, E and F and the supplier statement, with no "late
 * entry" marker to show for it, because isLateEntry only fires when entry comes after issue. The
 * audit trail recorded the change; no report flagged it.
 *
 * A ticket is issued and then keyed in, never the other way round, so issue day <= entry day is
 * the real constraint. "Not after today" survives as the clamp: on a new booking the entry date
 * IS today, so the two bounds coincide and nothing changes there.
 *
 * Day arithmetic runs through noon UTC, which is 07:00 or 08:00 in Toronto whatever DST is doing,
 * so "three days earlier" never lands on the wrong side of a clock change.
 *
 * `submittedAt` is the booking's dateOfSubmission — the existing one on an edit, `new Date()` on a
 * create. Returns null when acceptable, or a message.
 */
const validateIssueDate = (value, submittedAt) => {
  if (value === undefined || value === null || value === '') return null;

  const parsed = parseDateInput(value);
  if (!parsed) return 'issueDate is not a valid date';

  const issueDay = dayInTz(parsed);
  const today = dayInTz(new Date());
  if (issueDay > today) {
    return `issueDate ${issueDay} is in the future (today is ${today} in Toronto)`;
  }

  const submissionDay = dayInTz(submittedAt || new Date());
  if (issueDay > submissionDay) {
    return `issueDate ${issueDay} is after the entry date ${submissionDay}: a ticket cannot be issued after it was entered`;
  }

  const earliestDay = dayInTz(new Date(noonOnDay(submissionDay).getTime() - ISSUE_DATE_MAX_BACKDATE_DAYS * DAY_MS));
  if (issueDay < earliestDay) {
    return `issueDate ${issueDay} is more than ${ISSUE_DATE_MAX_BACKDATE_DAYS} days before the entry date ${submissionDay} (earliest is ${earliestDay})`;
  }

  return null;
};

module.exports = {
  ISSUE_DATE_MAX_BACKDATE_DAYS,
  effectiveDate, effectiveDay, effectiveRangeConditions, isLateEntry, validateIssueDate
};
