'use strict';

const CHANGE_FIELDS = ['dateChanges', 'flightChanges', 'seatBookChanges'];

// Day boundaries live in utils/tz.js, which every date filter in the app now shares.
// Re-exported here so the report routes that already import buildRange need no change.
const { TZ, buildRange, inRange } = require('./tz');

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

module.exports = { buildRange, inRange, changeRangeConditions, getSplitSummary };
