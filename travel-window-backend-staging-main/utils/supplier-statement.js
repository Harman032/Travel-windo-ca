'use strict';

const { inRange } = require('./tz');

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
  // ourCost ALREADY INCLUDES every date/flight change add-on: routes/bookings.js:891 and :985 do
  // booking.ourCost = booking.ourCost + ourCostAddon while also pushing ourCostAddon into the
  // change array. The add-ons are billed again below as their own lines, dated on the change, so
  // the fare line has to use the BASE cost or the same money is charged twice. The rest of the
  // codebase already does this: routes/bookings.js:1177 and :1457 strip the same two sums before
  // calling the cancellation engine.
  const addonTotal = r2(['dateChanges', 'flightChanges'].reduce((s2, f2) =>
    s2 + (b[f2] || []).reduce((s3, c) => s3 + (Number(c && c.ourCostAddon) || 0), 0), 0));
  const baseOurCost = r2(r2(b.ourCost) - addonTotal);

  const net = r2(baseOurCost - r2(b.paymentFromCard));

  // Emitted even when it is 0.00, so a card-paid booking still appears on the statement.
  lines.push({
    ...common,
    kind: 'fare',
    date: issueDate,
    vendor: vendorLabel(b, net),
    fare: net
  });

  /**
   * The cancellation credit, worked out before the fee lines because whether the fees are already
   * inside it decides whether they are billed separately.
   *
   * A supplier can only return money they actually hold. supplierWillReturn is derived from the
   * whole `ourCost`, so on a card-paid booking it counts the fare the card paid straight to the
   * airline; the airline refunds the card, not us. So on a card-paid booking the credit is capped
   * at what the supplier was actually paid.
   *
   * The cap applies ONLY when paymentFromCard is non-zero, which leaves every non-card cancelled
   * booking bit-for-bit unchanged — supplierWillReturn can exceed ourCost in scenarios 3 and 5,
   * and capping there would silently alter them.
   */
  const rawWillReturn = cancelled ? r2(b.cancellation.supplierWillReturn) : 0;
  const cardPaid = r2(b.paymentFromCard) !== 0;

  // A credit can never be negative. supplierWillReturn goes below zero in the engine whenever
  // the airline charge exceeds the base cost (utils/cancellation-engine.js:97 among others),
  // and booking AEFSGR in the staging copy stores -20. Without this floor the line below pushes
  // `fare: -credit`, i.e. a POSITIVE 20.00 on a line labelled "Cancelled" — billing the supplier
  // on a row the reader is told is a refund.
  const willReturn = Math.max(0, rawWillReturn);

  /**
   * The ceiling is everything the supplier was paid, which is NOT the fare line's `net`.
   *
   * `net` has the change add-ons stripped out of it, because they are billed back on their own
   * dated lines below. But the supplier was still PAID those add-ons — that is the whole reason
   * they are billed. Capping at `net` therefore understates what the supplier holds by
   * `addonTotal`, which chops a credit they genuinely owe, and then flips `creditWasCapped` true,
   * which un-suppresses the fee lines and emits the derived cancellation charge on top. Three
   * effects, all over-billing.
   *
   * Worked case: ourCost 1150 (base 1000 + a 150 add-on), paymentFromCard 900, cancelled,
   * supplierWillReturn 140, totalSupplierTook 10. Capping at `net` (100) gives
   * 100 fare + 150 add-on - 100 credit + 10 un-suppressed fees = 160.00. Capping at what the
   * supplier holds (250) leaves the credit uncapped: 100 + 150 - 140 = 110.00, which is right.
   *
   * No booking in the staging copy is cancelled AND card-paid AND carries an add-on (0 of 26),
   * so this is a latent defect, not a present loss.
   */
  const heldBySupplier = r2(r2(b.ourCost) - r2(b.paymentFromCard));

  const credit = cancelled
    ? r2(cardPaid ? Math.min(willReturn, Math.max(0, heldBySupplier)) : willReturn)
    : 0;

  // "Capped" has to mean "this credit did not absorb the fees", not merely "the cap changed the
  // number". A cancellation whose credit is 0 absorbed nothing, so its fees must still be billed
  // — otherwise a fully non-refundable fare (scenario 4A with acc = baseOurCost - totalSupplierTook
  // gives supplierWillReturn exactly 0) silently drops everything the supplier kept, which is the
  // same loss that BEBGWI and B4MGRT showed. 10 cancelled bookings in the copy have
  // supplierWillReturn 0 today; none of them has fees yet, so this is a latent hole, not a
  // current loss.
  const creditWasCapped = cancelled && (credit !== rawWillReturn || credit === 0);

  /**
   * Supplier service charges, one line each.
   *
   * Suppressed on a cancelled booking only when the cancellation credit already contains them:
   * totalSupplierTook is bookingCharge + updationCharge + autoSupplierCancellationCharge, and in
   * the cancellation scenarios that apply to a cancelled booking paid through the supplier,
   * supplierWillReturn is net of it, so billing the fees again would double-count.
   *
   * But when the card cap has cut that credit down, nothing is inside it any more, and
   * suppressing the fees silently drops money the supplier definitely keeps. On the staging copy
   * that lost 25.00 on BEBGWI and 5.00 on B4MGRT: both are cancelled, card-paid in full, net
   * 0.00, and the whole booking came out as a single 0.00 line. So a capped credit un-suppresses
   * the fees.
   */
  /**
   * KNOWN ISSUE — the suppression rule is not right for every cancellation scenario.
   *
   * Suppression assumes supplierWillReturn is net of totalSupplierTook. Checking every branch
   * of utils/cancellation-engine.js, that is true in only two of them:
   *
   *   branch                              supplierWillReturn            net of TST?
   *   machine charge     (engine:80,86)   baseOurCost - (AD + autoSCC)   NO
   *   1A/1B              (engine:97,103)  baseOurCost - (AD + autoSCC)   NO
   *   2A/2B              (engine:114,120) paidAmount  - (AD + autoSCC)   NO
   *   3A/3B              (engine:131,138) baseSalePrice - AD             NO
   *   4A/4B              (engine:150,156) baseOurCost - TST - AD         YES
   *   5A/5B              (engine:167,174) paidAmount - AD / ara          NO
   *   fallback isPP&&isCO(engine:186,192) baseOurCost - AD - TST         YES
   *
   * So in the NO branches what the supplier kept is not inside the credit, and suppressing the
   * fees understates it. How much is at stake depends on the branch, and this is finer than it
   * first looks:
   *
   *   1A/1B, 2A/2B, machine charge  subtract `autoSupplierCancCharge` explicitly, so only
   *                                 bookingCharge + updationCharge is at stake
   *   3A (engine:131)               baseSalePrice - acc, where `acc` is the AIRLINE charge,
   *                                 not the auto supplier charge
   *   3B (engine:138), 5B (:174)    reduce to `ara` alone, subtracting nothing
   *   5A (engine:167)               paidAmount - acc, the airline charge again
   *
   * So in branches 3 and 5 the WHOLE of totalSupplierTook is at stake, auto cancellation charge
   * included — not just the two fee fields.
   *
   * Exposure on the staging copy is still 10.00, across CVJZK9 and BPJD4Z, because
   * `cancellation.autoSupplierCancellationCharge` is 0 on all 26 cancelled bookings (it is not
   * in the schema, so it is dropped on every save). The moment it is added to the schema the
   * exposure grows beyond those two fields.
   *
   * It is left as-is deliberately. Fixing it changes non-card cancellations, and the scenario
   * family cannot be recovered from stored data: cancellation.cancellationMode only distinguishes
   * charges from refundAmount, and the fallback branch — one of the two CORRECT ones — stores
   * scenario "1A"/"1B", making it indistinguishable from true scenario 1, which is a broken one.
   * Legacy rows have no cancellationMode at all (see models/Booking.js).
   *
   * Until it is fixed, a cancelled line on the statement should be read as provisional.
   *
   * Said on screen, and ONLY on screen: a banner above the statement table, inside `.no-print`,
   * in reports.component.ts. It is not printed by design — the caveat is about OUR inability to
   * recover the scenario from OUR own stored data, and putting it on a document the supplier
   * receives would invite a dispute over every cancelled line, including the correct ones.
   *
   * The banner is unconditional and names no count. Narrowing it to the affected bookings would
   * need `cancellationMode` in this route's projection (it is not there) and a flag in the
   * payload; if that is ever wanted, both have to change together.
   */
  const feesAlreadyInCredit = cancelled && r2(b.cancellation.totalSupplierTook) !== 0 && !creditWasCapped;
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

  // Cost side of each post-booking change, on the date the change was made. These are the same
  // sums stripped from the fare line above, re-billed on their own dates.
  //
  // seatBookChanges is deliberately NOT here: it has no ourCostAddon field (models/Booking.js),
  // because routes/bookings.js:1085 overwrites booking.ourCost outright instead of adding to it.
  // Iterating it was dead code, and including it would have double-billed if the field were ever
  // added without revisiting the fare line.
  for (const field of ['dateChanges', 'flightChanges']) {
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
    const cancelledAt = b.cancellation.cancelledAt || issueDate;

    if (credit !== 0) {
      lines.push({
        ...common, kind: 'cancelCredit',
        date: cancelledAt,
        vendor: 'Cancelled', fare: -credit
      });
    }

    /**
     * The supplier's own cancellation charge, when the card cap has removed the credit that would
     * otherwise have carried it.
     *
     * There is no stored field for it — cancellation.supplierCancellationCharge is 0 on all 26
     * cancelled bookings in the copy — so it is derived the same way recalculateCancellationValues
     * derives it: supplierCharges minus the booking and updation charges. With the fee lines above
     * this makes a capped booking total exactly totalSupplierTook, which is what the supplier kept.
     *
     * Only emitted when the credit was capped. On an uncapped cancellation the charge is already
     * inside supplierWillReturn and adding it would double-count.
     */
    if (creditWasCapped) {
      const supplierCancelCharge = r2(Math.max(0,
        r2(b.supplierCharges) - r2(b.supplierBookingCharge) - r2(b.supplierUpdationCharge)));
      if (supplierCancelCharge !== 0) {
        lines.push({
          ...common, kind: 'fee', feeType: 'cancellation',
          date: cancelledAt,
          vendor: SVC_FEE_LABEL, fare: supplierCancelCharge
        });
      }
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
    // STANDING CONSTRAINT: `note` is internal commercial data -- real rows read
    // "ISSUED WITH 1% COMM" and "PAWAN SIR REF". It must never reach the statement, which is a
    // document we hand the supplier. It used to ride here as `remarks`; that column is gone and
    // the field is gone with it, so the note is not even on the wire. Do not reintroduce it, and
    // do not use it as a source for any other supplier-facing output.
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
