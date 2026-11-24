'use strict';

const { parseDateInput, validateDateOnly } = require('./date-only');
const { RECEIVING_ACCOUNTS, BANK_DEPOSIT_MODES, LEGACY_DEPOSIT_MODES } = require('./receiving-accounts');

// Appended to the rules a browser tab loaded BEFORE this release cannot satisfy: it has no bank
// or sender field to fill and no issue-date window to respect, so it will keep posting the same
// rejected body until it reloads. Every frontend error handler shows this text verbatim (they all
// read err.error?.message first), so this is the only place the instruction can reach the person
// looking at the screen.
const RELOAD_HINT = ' Please reload the page (Ctrl+Shift+R).';

/**
 * Route-layer validation for a booking's payments[] array.
 *
 * Everything here is deliberately NOT in the Mongoose schema. Mongoose re-validates every loaded
 * path on save, so a `required` field or an enum makes a stored row that predates the rule block
 * every later edit, date change, cancellation and verification on its booking. That is the Cheque
 * incident: a payment-mode enum tightened without a data migration took out 440 bookings. ~500
 * rows still carry Cheque or Bank Transfer and must keep saving forever.
 *
 * The rule is therefore: a row that is NEW or CHANGED must satisfy the current requirements; a row
 * that is unchanged passes through whatever it contains.
 */

/**
 * Identity key for matching an incoming row against a stored one. Amount, mode and reference.
 *
 * Matched on content rather than on _id because every frontend path rebuilds the array from form
 * state and sends no _id (new-booking.component.ts, booking-detail.component.ts for the date- and
 * flight-change forms).
 */
const paymentKey = (p) => [
  Number(p && p.paidAmount) || 0,
  (p && p.paymentMode) || '',
  ((p && p.referenceNo) || '').toString().trim()
].join('|');

const sameInstant = (a, b) => {
  const x = a ? parseDateInput(a) : null;
  const y = b ? parseDateInput(b) : null;
  if (!x && !y) return true;
  if (!x || !y) return false;
  return x.getTime() === y.getTime();
};

const str = (v) => (v === undefined || v === null ? '' : String(v).trim());

/**
 * Validate incoming payment rows against what is already stored, and normalise them.
 *
 * DATES. A row with no usable date is rejected, but only when it is new or changed. This used to
 * invent one (`|| new Date()`), stamping the current instant onto a date-only field: on Vercel a
 * row saved at 19:30 Toronto became 00:30Z the next day. A 400 beats a payment dated by accident.
 * An unchanged row carries its stored date forward, normalised, so re-saving a booking heals a
 * legacy 00:00Z value to noon.
 *
 * E-TRANSFER. A new or changed E-Transfer row must name the receiving account and the sender.
 * "Changed" means amount, mode or date: those are the fields that make it a different payment.
 * Editing only the sender name on an existing row is not a change for this purpose, and the row
 * already carries both fields anyway.
 *
 * LEGACY MODES. E-Transfer is the single mode for e-transfers, cheques and bank transfers.
 * Cheque and Bank Transfer stay in PAYMENT_MODES because ~500 stored rows carry them, and no
 * dropdown offers either -- but "no dropdown offers it" is not the same as "it cannot arrive".
 * A hand-crafted request can post a BRAND NEW row with paymentMode 'Cheque', which passes the
 * schema enum, skips the E-Transfer bank-detail requirement, and lands in the "Not recorded"
 * bucket: exactly the gap this requirement exists to close.
 *
 * So a legacy mode is rejected when the request cannot be editing an existing row -- that is,
 * when there are no stored rows to match against at all. That covers create and both
 * append-only change routes, where every incoming row is new by construction.
 *
 * It is NOT rejected on an edit of a booking that has stored payments, because a row whose
 * amount or date changed looks identical to a brand-new row: no client sends subdocument _ids,
 * so "edited legacy Cheque row" and "newly crafted Cheque row" are the same bytes. Rejecting
 * there would make an amount correction on a legacy Cheque payment impossible rather than
 * merely awkward -- the form shows the bank fields only for E-Transfer, so there would be no way
 * to satisfy it -- and legacy rows must keep saving. The residual gap needs an authenticated
 * staff member to craft a request, and produces a row indistinguishable from the legacy data
 * already there.
 *
 * Returns { error }, or { payments, unchangedAll }. `unchangedAll` is true when every incoming
 * row matched a stored one and the counts are equal -- that is, the array came back exactly as it
 * went out. A caller can then skip reassigning booking.payments entirely, which matters because
 * the incoming rows are plain objects: assigning them mints NEW subdocument _ids, so Mongoose
 * sees the array as modified on every edit even when nothing about the payments changed. That
 * made it impossible to tell a payments edit from a payments round-trip.
 */
const validatePaymentRows = (incoming, existing = []) => {
  if (!Array.isArray(incoming)) return { payments: [], unchangedAll: true };

  // Nothing stored to match against means every incoming row is new by construction, which is
  // what lets the legacy-mode check below be safe.
  const noStoredRows = !(existing || []).length;

  const pool = new Map();
  for (const p of (existing || [])) {
    const k = paymentKey(p);
    if (!pool.has(k)) pool.set(k, []);
    pool.get(k).push(p);
  }

  const out = [];
  let matchedCount = 0;
  for (let i = 0; i < incoming.length; i++) {
    const p = incoming[i] || {};
    const paidAmount = typeof p.paidAmount === 'number' ? p.paidAmount : parseFloat(p.paidAmount) || 0;
    const paymentMode = p.paymentMode || 'Cash';
    const referenceNo = p.referenceNo || '';

    // A stored row with the same amount, mode and reference, not already claimed by an earlier
    // incoming row. Two identical rows therefore consume two stored rows, and a third is new.
    const candidates = pool.get(paymentKey(p)) || [];
    const candidate = candidates.length ? candidates[0] : null;
    const dateUnchanged = candidate ? sameInstant(p.paymentDate, candidate.paymentDate) : false;
    // No incoming date at all also counts as unchanged: the row is being passed back untouched.
    const unchanged = !!candidate && (!p.paymentDate || dateUnchanged);

    if (unchanged) { candidates.shift(); matchedCount += 1; }

    let paymentDate = parseDateInput(p.paymentDate);
    if (!paymentDate) {
      if (!unchanged) {
        return { error: `payments[${i}].paymentDate is required (YYYY-MM-DD)` };
      }
      paymentDate = candidate.paymentDate ? parseDateInput(candidate.paymentDate) : null;
    } else {
      const bad = validateDateOnly(p.paymentDate, `payments[${i}].paymentDate`);
      if (bad) return { error: bad };
      if (!unchanged) candidates.shift();
    }

    // Carry the bank details from the incoming row when given, otherwise from the stored one, so
    // a client that does not round-trip them cannot blank them.
    const receivingAccount = p.receivingAccount !== undefined
      ? str(p.receivingAccount)
      : str(candidate && candidate.receivingAccount);
    const senderName = p.senderName !== undefined
      ? str(p.senderName)
      : str(candidate && candidate.senderName);

    // A legacy deposit mode on a row that cannot be an edit of a stored one. See the note above.
    if (!unchanged && noStoredRows && LEGACY_DEPOSIT_MODES.includes(paymentMode)) {
      return { error: `payments[${i}].paymentMode "${paymentMode}" is a legacy value and cannot be used for a new payment: use E-Transfer, which covers cheques and bank transfers${RELOAD_HINT}` };
    }

    if (!unchanged && paymentMode === 'E-Transfer') {
      if (!receivingAccount) {
        return { error: `payments[${i}].receivingAccount is required for an E-Transfer (${RECEIVING_ACCOUNTS.join(' or ')})${RELOAD_HINT}` };
      }
      if (!RECEIVING_ACCOUNTS.includes(receivingAccount)) {
        return { error: `payments[${i}].receivingAccount "${receivingAccount}" is not one of ${RECEIVING_ACCOUNTS.join(', ')}${RELOAD_HINT}` };
      }
      if (!senderName) {
        return { error: `payments[${i}].senderName is required for an E-Transfer${RELOAD_HINT}` };
      }
    }

    out.push({ paidAmount, paymentMode, paymentDate, referenceNo, receivingAccount, senderName });
  }
  // `unchangedAll` means: writing `out` would store exactly what is already stored, so the caller
  // can skip the assignment entirely.
  //
  // That is a stricter test than the match-key one above, and it has to be. The match key is
  // amount + mode + reference; the comparison here is every field INCLUDING the normalised date,
  // positionally. A stored row at 00:00Z resent without a date matches its candidate, but the row
  // we would write carries noon -- a real difference, and the one that heals the legacy value.
  // Comparing only the match key would report it unchanged, skip the write, and silently remove
  // the healing that re-saving a booking is supposed to perform.
  const stored = existing || [];
  const sameDate = (a, b) => {
    const x = a ? new Date(a).getTime() : null;
    const y = b ? new Date(b).getTime() : null;
    return x === y;
  };
  const unchangedAll = matchedCount === incoming.length
    && incoming.length === stored.length
    && out.every((row, i) => {
      const was = stored[i] || {};
      return (Number(was.paidAmount) || 0) === row.paidAmount
        && ((was.paymentMode) || '') === row.paymentMode
        && str(was.referenceNo) === row.referenceNo
        && str(was.receivingAccount) === row.receivingAccount
        && str(was.senderName) === row.senderName
        && sameDate(was.paymentDate, row.paymentDate);
    });
  return { payments: out, unchangedAll };
};

/** Is this row a deposit into one of our bank accounts, and so answerable by the bank filter? */
const isBankDeposit = (p) => BANK_DEPOSIT_MODES.includes((p && p.paymentMode) || '');

/**
 * Does this row count as "Not recorded" for the bank filter?
 *
 * A BANK DEPOSIT -- E-Transfer, or legacy Cheque or Bank Transfer -- that does not name the
 * account it arrived in. Both halves matter.
 *
 * This was previously just "has no receivingAccount", which swept in every Cash, Credit Card,
 * Machine Charge, UPI, Kotak Bank, Kotak Bank UPI, Travobirds and SkyLight row: none of them is
 * a bank deposit, none could ever have an account recorded, and so none is missing anything.
 * On the copy that made "Not recorded" read 2,858 rows and 4,941,058.60 -- every payment ever
 * taken -- rather than the bank-deposit rows actually lacking an account.
 */
const isUnrecordedAccount = (p) => isBankDeposit(p) && !str(p && p.receivingAccount);

module.exports = {
  paymentKey, validatePaymentRows, isBankDeposit, isUnrecordedAccount,
  RECEIVING_ACCOUNTS, BANK_DEPOSIT_MODES, LEGACY_DEPOSIT_MODES
};
