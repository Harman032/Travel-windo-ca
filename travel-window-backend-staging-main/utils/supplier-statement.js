'use strict';

const { dayInTz, inRange } = require('./tz');

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Builds a supplier statement: what we owe one supplier, line by line, and what is still open.
 *
 * Every line carries a signed `fare`. Debits (what we owe) are positive, credits (what reduces
 * what we owe) are negative, so the whole statement is one sum and the footer cannot drift from
 * the rows:
 *
 *   Total Open = Account Balance = opening balance + sum(fare of every in-range line)
 *
 * The opening balance is the same sum over everything dated before `From`, because the client's
 * stated opening balance is itself recorded as a SupplierPayment row dated before the first
 * period. There is no second mechanism for it.
 *
 * Line kinds:
 *   fare          the ticket cost, `ourCost`, on the booking's issue date
 *   fee           a supplier service charge, its own line, Vendor column reads "Svc fee"
 *   addon         the cost side of a date/flight/seat change, on the date the change was made
 *   cancelCredit  what the supplier sends back on a cancellation, on the cancellation date
 *   payment       money we actually sent, from the SupplierPayment ledger
 */

const SVC_FEE_LABEL = 'Svc fee';

/**
 * Itinerary as concatenated airport codes, no separators, uppercase.
 *   One Way    -> from + to                     e.g. DELYYZ
 *   Round Trip -> from + to + from              e.g. YYZDELYYZ
 *   Multiple   -> each sector's from + to in order, then the booking's own from + to appended
 */
function buildItinerary(b) {
  const code = v => String(v || '').trim().toUpperCase();
  const from = code(b.from), to = code(b.to);

  if (b.sectorType === 'Multiple' && Array.isArray(b.multipleSectors) && b.multipleSectors.length) {
    const sectors = b.multipleSectors.map(s => code(s && s.from) + code(s && s.to)).join('');
    return sectors + from + to;
  }
  if (b.sectorType === 'Round Trip') return from + to + from;
  return from + to;
}

/**
 * Every statement line a single booking contributes, each with the date it belongs on.
 * `range` is used only to date the change add-ons; the caller decides which lines are in range.
 */
function bookingLines(b) {
  const lines = [];
  const issueDate = b.dateOfSubmission;
  const cancelled = b.status === 'Cancelled' && b.cancellation && b.cancellation.isCancelled;

  const common = {
    bookingId: String(b._id),
    invoiceNo: b.pnr,          // there is no invoice entity; the client chose the PNR
    remarks: b.pnr,
    ticketNo: b.pnr,           // there is no ticket-number field on the schema
    passenger: b.paxName,
    startDate: b.travelDate,
    itinerary: buildItinerary(b)
  };

  // The ticket cost. Stays on a cancelled booking: the credit below is what comes back, and the
  // two together net to what the supplier actually kept.
  lines.push({
    ...common,
    kind: 'fare',
    date: issueDate,
    vendor: String(b.airline || '').trim(),   // stored as-is; the field holds a mix of codes and names
    fare: r2(b.ourCost)
  });

  // Supplier service charges, one line each.
  //
  // Suppressed on a cancelled booking ONLY when the cancellation figure already contains them.
  // cancellation.totalSupplierTook is supplierBookingCharge + supplierUpdationCharge +
  // autoSupplierCancellationCharge, and supplierWillReturn is net of it, so when it is non-zero
  // the fees are already inside the credit and billing them again would double-count.
  // When it is zero — which is the case on 17 of the 26 cancelled bookings in the staging copy —
  // the cancellation never accounted for the fees, so the fee lines must stay.
  const feesAlreadyInCredit = cancelled && r2(b.cancellation.totalSupplierTook) !== 0;
  if (!feesAlreadyInCredit) {
    for (const [field, label] of [['supplierBookingCharge', 'booking'], ['supplierUpdationCharge', 'updation']]) {
      const amount = r2(b[field]);
      if (amount !== 0) {
        lines.push({
          ...common, kind: 'fee', feeType: label, date: issueDate,
          vendor: SVC_FEE_LABEL, fare: amount
        });
      }
    }
  }

  // Cost side of each post-booking change, on the date the change was made.
  for (const field of ['dateChanges', 'flightChanges', 'seatBookChanges']) {
    for (const c of (b[field] || [])) {
      const amount = r2(c && c.ourCostAddon);
      if (amount !== 0) {
        lines.push({
          ...common, kind: 'addon', changeType: field,
          date: (c && c.changedAt) || issueDate,
          vendor: String(b.airline || '').trim(), fare: amount
        });
      }
    }
  }

  // What the supplier returns on a cancellation, as a credit on the cancellation date.
  // Stored value only — never recalculated. The inputs the engine was given were dropped by the
  // schema until recently, so a fresh run would produce a different scenario family; the stored
  // figure was written at cancel time with the real inputs in hand.
  if (cancelled) {
    const willReturn = r2(b.cancellation.supplierWillReturn);
    if (willReturn !== 0) {
      lines.push({
        ...common, kind: 'cancelCredit',
        date: b.cancellation.cancelledAt || issueDate,
        vendor: 'Cancelled', fare: -willReturn
      });
    }
  }

  return lines;
}

/** A recorded payment to the supplier, as a credit line. */
function paymentLine(p) {
  return {
    kind: 'payment',
    date: p.paymentDate,
    invoiceNo: p.reference || '',
    remarks: p.note || 'Payment',
    ticketNo: '',
    passenger: '',
    vendor: 'Payment',
    startDate: null,
    itinerary: '',
    fare: -r2(p.amount),
    paymentId: String(p._id)
  };
}

/**
 * @param {object[]} bookings   bookings for this supplier, any date (the caller filters by supplier)
 * @param {object[]} payments   SupplierPayment rows for this supplier, any date
 * @param {object}   range      { $gte, $lte } from buildRange, or null for everything
 */
function buildStatement(bookings, payments, range) {
  const all = [
    ...bookings.flatMap(bookingLines),
    ...payments.map(paymentLine)
  ];

  // Everything dated before the range opens is the opening balance, as one number.
  const before = range && range.$gte
    ? all.filter(l => l.date && new Date(l.date) < range.$gte)
    : [];
  const openingBalance = r2(before.reduce((s, l) => s + l.fare, 0));

  const inside = all.filter(l => inRange(l.date, range));

  // Sort by date, then by PNR so a statement is stable and reproducible; fare before its own fees
  // and add-ons within the same invoice.
  const kindOrder = { fare: 0, fee: 1, addon: 2, cancelCredit: 3, payment: 4 };
  inside.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    if (da !== db) return da - db;
    const ia = String(a.invoiceNo || ''), ib = String(b.invoiceNo || '');
    if (ia !== ib) return ia.localeCompare(ib);
    return (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9);
  });

  // Group into invoices so the UI can draw a subtotal under any invoice with more than one line.
  // Payments are not part of an invoice and stand alone.
  const invoices = [];
  const byInvoice = new Map();
  for (const line of inside) {
    if (line.kind === 'payment') {
      invoices.push({ invoiceNo: line.invoiceNo, isPayment: true, lines: [line], subtotal: line.fare, showSubtotal: false });
      continue;
    }
    let group = byInvoice.get(line.invoiceNo);
    if (!group) {
      group = { invoiceNo: line.invoiceNo, isPayment: false, lines: [], subtotal: 0, showSubtotal: false };
      byInvoice.set(line.invoiceNo, group);
      invoices.push(group);
    }
    group.lines.push(line);
  }
  for (const g of invoices) {
    g.subtotal = r2(g.lines.reduce((s, l) => s + l.fare, 0));
    // The PDF shows a subtotal only under an invoice that runs to more than one line.
    g.showSubtotal = !g.isPayment && g.lines.length > 1;
  }

  const movement = r2(inside.reduce((s, l) => s + l.fare, 0));
  const totalOpen = r2(openingBalance + movement);

  return {
    openingBalance,
    invoices,
    lineCount: inside.length,
    totals: {
      debits: r2(inside.filter(l => l.fare > 0).reduce((s, l) => s + l.fare, 0)),
      credits: r2(inside.filter(l => l.fare < 0).reduce((s, l) => s + l.fare, 0)),
      movement,
      // The client's statement shows these as two labels with the same number.
      totalOpen,
      accountBalance: totalOpen
    }
  };
}

module.exports = { buildStatement, bookingLines, paymentLine, buildItinerary, SVC_FEE_LABEL, r2 };
