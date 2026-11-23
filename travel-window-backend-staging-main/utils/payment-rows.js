'use strict';

const { parseDateInput, validateDateOnly } = require('./date-only');
const { RECEIVING_ACCOUNTS, BANK_DEPOSIT_MODES, LEGACY_DEPOSIT_MODES } = require('./receiving-accounts');

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
 * Returns { error } or { payments }.
 */
const validatePaymentRows = (incoming, existing = []) => {
  if (!Array.isArray(incoming)) return { payments: [] };

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

    if (unchanged) candidates.shift();

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
      return { error: `payments[${i}].paymentMode "${paymentMode}" is a legacy value and cannot be used for a new payment: use E-Transfer, which covers cheques and bank transfers` };
    }

    if (!unchanged && paymentMode === 'E-Transfer') {
      if (!receivingAccount) {
        return { error: `payments[${i}].receivingAccount is required for an E-Transfer (${RECEIVING_ACCOUNTS.join(' or ')})` };
      }
      if (!RECEIVING_ACCOUNTS.includes(receivingAccount)) {
        return { error: `payments[${i}].receivingAccount "${receivingAccount}" is not one of ${RECEIVING_ACCOUNTS.join(', ')}` };
      }
      if (!senderName) {
        return { error: `payments[${i}].senderName is required for an E-Transfer` };
      }
    }

    out.push({ paidAmount, paymentMode, paymentDate, referenceNo, receivingAccount, senderName });
  }
  return { payments: out };
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
