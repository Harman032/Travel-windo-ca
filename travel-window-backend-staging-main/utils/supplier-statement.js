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
const DISCOUNT_LABEL = 'Discount/Adjustments';

/**
 * A card-paid booking whose net is at or below this is a service charge, not a fare, so its line
 * is labelled "Svc fee". Derived from the data, not guessed: across the SKYBIRDS week every
 * card-paid service net is between 5.00 and 25.00, while the one card-paid booking that is a real
 * fare nets 7,644.48. Three orders of magnitude separate the two groups, so the exact threshold
 * does not matter — it only has to sit in the gap.
 *
 * This is a LABEL ONLY. It never changes a line's amount or any total.
 */
const CARD_FEE_CEILING = 100;

/**
 * What goes in the Vendor column.
 *
 * For a booking paid directly on a card, the supplier was not paid the fare — the card paid the
 * airline — so what remains is a service charge or an adjustment, and the airline's name would be
 * misleading. The sign tells which: a negative net means the card paid more than our cost, which
 * the supplier's own statement shows as Discount/Adjustments.
 */
function vendorLabel(booking, net) {
  const cardPaid = r2(booking.paymentFromCard) !== 0;
  const airline = String(booking.airline || '').trim();
  if (!cardPaid) return airline;
  if (net < 0) return DISCOUNT_LABEL;
  if (net > 0 && net <= CARD_FEE_CEILING) return SVC_FEE_LABEL;
  return airline;
}

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

  // 80 PNRs in the staging copy carry leading or trailing whitespace. Trim for display only;
  // the stored value is left alone.
  const pnr = String(b.pnr || '').trim();
  const common = {
    bookingId: String(b._id),
    invoiceNo: pnr,            // there is no invoice entity; the client chose the PNR
    remarks: pnr,
    ticketNo: pnr,             // there is no ticket-number field on the schema
    passenger: b.paxName,
    startDate: b.travelDate,
    itinerary: buildItinerary(b)
  };

  /**
   * What we owe the supplier for the ticket.
   *
   * NOT `ourCost`. When a booking is paid directly on a card, the card pays the airline and the
   * supplier never receives the fare — they bill us only their service charge. `ourCost` still
   * records the whole fare, so using it overstates the debt by the card amount: across one
   * SKYBIRDS week that was 61,341.88 of a 98,728.70 total. The same relationship is already
   * encoded in getCRDR() in routes/reports.js, as paymentFromCard - (ourCost + supplierCharges).
   *
   * Deliberately NOT floored at zero. A card can pay more than our cost, and the resulting
   * negative is a real credit: booking 242Z6X nets -85.88, which is exactly what the supplier's
   * own statement shows as a Discount/Adjustments line.
   */
  const net = r2(r2(b.ourCost) - r2(b.paymentFromCard));

  // Emitted even when it is 0.00, so a card-paid booking still appears on the statement.
  lines.push({
    ...common,
    kind: 'fare',
    date: issueDate,
    vendor: vendorLabel(b, net),
    fare: net
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
    /**
     * A supplier can only return money they actually hold.
     *
     * supplierWillReturn is derived from the whole `ourCost`, so on a card-paid booking it counts
     * the fare the card paid straight to the airline. Crediting it in full would invent a refund
     * from a supplier who never received that money — the airline refunds the card. On the five
     * cancelled card bookings in the staging copy it would have produced credits of 861 to 1,582
     * against a net exposure of 0.00 or 5.00.
     *
     * So on a card-paid booking the credit is capped at what the supplier was actually paid.
     * The cap is applied ONLY when paymentFromCard is non-zero, which leaves all 21 non-card
     * cancelled bookings in the copy bit-for-bit unchanged — supplierWillReturn can exceed
     * ourCost in scenarios 3 and 5, and capping there would silently alter them.
     */
    const willReturn = r2(b.cancellation.supplierWillReturn);
    const cardPaid = r2(b.paymentFromCard) !== 0;
    const credit = cardPaid ? Math.min(willReturn, Math.max(0, net)) : willReturn;
    if (credit !== 0) {
      lines.push({
        ...common, kind: 'cancelCredit',
        date: b.cancellation.cancelledAt || issueDate,
        vendor: 'Cancelled', fare: -r2(credit)
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

module.exports = { buildStatement, bookingLines, paymentLine, buildItinerary, vendorLabel,
  SVC_FEE_LABEL, DISCOUNT_LABEL, CARD_FEE_CEILING, r2 };
