'use strict';

const { parseDateInput, validateDateOnly } = require('./date-only');
const { RECEIVING_ACCOUNTS } = require('./receiving-accounts');

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
 * E-Transfer is the single mode for e-transfers, cheques and bank transfers. Cheque and
 * Bank Transfer remain in PAYMENT_MODES as legacy values and are offered by no dropdown, so they
 * can only arrive on a row that is already stored -- which is exactly the row this function lets
 * through untouched.
 *
 * Returns { error } or { payments }.
 */
const validatePaymentRows = (incoming, existing = []) => {
  if (!Array.isArray(incoming)) return { payments: [] };

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

/**
 * Does this row count as "Not recorded" for the bank filter?
 *
 * True for an E-Transfer with no receivingAccount, and for every legacy Cheque and Bank Transfer
 * row. Written as "no receivingAccount" rather than as a list of modes, so there is no mode list
 * to keep in step: a Cash row has no receiving account either, and the filter is only ever applied
 * to the set of rows the screen is already showing.
 */
const isUnrecordedAccount = (p) => !str(p && p.receivingAccount);

module.exports = { paymentKey, validatePaymentRows, isUnrecordedAccount, RECEIVING_ACCOUNTS };
