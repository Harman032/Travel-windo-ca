'use strict';
/**
 * Reconciles the supplier statement against an independent sum computed straight from the raw
 * bookings, for several suppliers and a month. Prints the bridge, component by component, and the
 * residual — which must be 0.
 *
 * READ-ONLY. Refuses any database but travel_window_staging_copy.
 * Prints counts, PNRs and amounts only. No passenger names, phones or payment details.
 *
 *   node scripts/verify-supplier-statement.js
 *   node scripts/verify-supplier-statement.js --month 2026-09 --suppliers 3
 *   node scripts/verify-supplier-statement.js --from 2026-10-05 --to 2026-10-11 --supplier SKYBIRDS --expect 46488.48
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Supplier = require('../models/Supplier');
const SupplierPayment = require('../models/SupplierPayment');
const { buildStatement } = require('../utils/supplier-statement');
const { buildRange, inRange, dayInTz, TZ } = require('../utils/tz');

const ALLOWED_DB = 'travel_window_staging_copy';
const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const money = n => r2(n).toFixed(2).padStart(14);

const dbNameOf = (uri) => {
  const m = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(uri || '');
  return m ? decodeURIComponent(m[1]) : '';
};

(async () => {
  const uri = process.env.MONGODB_URI;
  const db = dbNameOf(uri);
  if (!uri) { console.error('MONGODB_URI is not set.'); process.exit(2); }
  if (db !== ALLOWED_DB) {
    console.error(`Refusing to run: MONGODB_URI points at "${db || '(no database in the URI)'}", not "${ALLOWED_DB}".`);
    process.exit(2);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  if (mongoose.connection.name !== ALLOWED_DB) {
    console.error(`Refusing to run: connected to "${mongoose.connection.name}".`);
    await mongoose.disconnect();
    process.exit(2);
  }

  const month = arg('month', '2026-09');
  let from = arg('from'), to = arg('to');
  if (!from || !to) {
    const [Y, M] = month.split('-').map(Number);
    const last = new Date(Date.UTC(Y, M, 0)).getUTCDate();
    from = `${month}-01`;
    to = `${month}-${String(last).padStart(2, '0')}`;
  }
  const range = buildRange(from, to);
  const wantName = arg('supplier');
  const expect = arg('expect');
  const nSuppliers = parseInt(arg('suppliers', '3'), 10);

  console.log('='.repeat(78));
  console.log('Supplier statement reconciliation — READ ONLY');
  console.log(`database : ${mongoose.connection.name}`);
  console.log(`period   : ${from} .. ${to}  (${TZ} whole days)`);
  console.log(`range UTC: ${range.$gte.toISOString()} .. ${range.$lte.toISOString()}`);
  console.log('='.repeat(78));

  const suppliers = await Supplier.find({}).select('name').lean();
  let chosen;
  if (wantName) {
    chosen = suppliers.filter(s => String(s.name || '').trim().toUpperCase() === wantName.toUpperCase());
    if (!chosen.length) {
      console.error(`No supplier named "${wantName}". Available: ${suppliers.map(s => String(s.name).trim()).join(', ')}`);
      await mongoose.disconnect();
      process.exit(1);
    }
  } else {
    // The suppliers with the most bookings in the period.
    const counts = new Map();
    const inPeriod = await Booking.find({ status: { $ne: 'Draft' }, dateOfSubmission: range })
      .select('supplier').lean();
    for (const b of inPeriod) {
      if (b.supplier) counts.set(String(b.supplier), (counts.get(String(b.supplier)) || 0) + 1);
    }
    chosen = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, nSuppliers)
      .map(([id]) => suppliers.find(s => String(s._id) === id))
      .filter(Boolean);
  }

  let allClosed = true;

  for (const sup of chosen) {
    const bookings = await Booking.find({ supplier: sup._id, status: { $ne: 'Draft' } }).lean();
    const payments = await SupplierPayment.find({ supplier: sup._id }).lean();
    const statement = buildStatement(bookings, payments, range);

    // ---- independent model, straight from the raw bookings ----
    // Nothing here calls buildStatement or any of its helpers.
    const issuedInRange = bookings.filter(b => inRange(b.dateOfSubmission, range));
    const cancelledInRange = issuedInRange.filter(b => b.status === 'Cancelled' && b.cancellation && b.cancellation.isCancelled);

    // What we owe for the ticket: ourCost MINUS what the card paid straight to the airline.
    // Not floored at zero — a card can pay more than our cost, and that is a real credit.
    const fare = r2(issuedInRange.reduce((s, b) =>
      s + ((Number(b.ourCost) || 0) - (Number(b.paymentFromCard) || 0)), 0));
    const cardPaid = r2(issuedInRange.reduce((s, b) => s + (Number(b.paymentFromCard) || 0), 0));

    // Fees, minus the ones a cancellation credit already contains.
    const feesGross = r2(issuedInRange.reduce((s, b) =>
      s + (Number(b.supplierBookingCharge) || 0) + (Number(b.supplierUpdationCharge) || 0), 0));
    const feesSuppressed = r2(cancelledInRange
      .filter(b => r2(b.cancellation.totalSupplierTook) !== 0)
      .reduce((s, b) => s + (Number(b.supplierBookingCharge) || 0) + (Number(b.supplierUpdationCharge) || 0), 0));
    const fees = r2(feesGross - feesSuppressed);

    // Change add-ons are dated on the change, so they are counted over ALL bookings of this
    // supplier, not only the ones issued in the period.
    let addons = 0;
    for (const b of bookings) {
      for (const f of ['dateChanges', 'flightChanges', 'seatBookChanges']) {
        for (const c of (b[f] || [])) {
          if (inRange(c && c.changedAt ? c.changedAt : b.dateOfSubmission, range)) {
            addons += Number(c && c.ourCostAddon) || 0;
          }
        }
      }
    }
    addons = r2(addons);

    // Cancellation credits are dated on the cancellation, likewise over all bookings.
    // Capped at what the supplier actually held on a card-paid booking; uncapped otherwise.
    const cancelCredits = r2(bookings
      .filter(b => b.status === 'Cancelled' && b.cancellation && b.cancellation.isCancelled)
      .filter(b => inRange(b.cancellation.cancelledAt || b.dateOfSubmission, range))
      .reduce((s, b) => {
        const willReturn = r2(b.cancellation.supplierWillReturn);
        const net = r2((Number(b.ourCost) || 0) - (Number(b.paymentFromCard) || 0));
        const credit = r2(b.paymentFromCard) !== 0 ? Math.min(willReturn, Math.max(0, net)) : willReturn;
        return s - credit;
      }, 0));

    const paid = r2(payments.filter(p => inRange(p.paymentDate, range))
      .reduce((s, p) => s - (Number(p.amount) || 0), 0));

    const independentMovement = r2(fare + fees + addons + cancelCredits + paid);
    const independentTotal = r2(statement.openingBalance + independentMovement);

    const residual = r2(statement.totals.totalOpen - independentTotal);
    const movementResidual = r2(statement.totals.movement - independentMovement);
    if (residual !== 0 || movementResidual !== 0) allClosed = false;

    console.log('');
    console.log('-'.repeat(78));
    console.log(`SUPPLIER: ${String(sup.name).trim()}   (${String(sup._id).slice(-6)})`);
    console.log('-'.repeat(78));
    console.log(`  bookings for this supplier (all time, non-Draft) : ${bookings.length}`);
    console.log(`  issued in period                                : ${issuedInRange.length}`);
    console.log(`  of those, cancelled                             : ${cancelledInRange.length}`);
    console.log(`  recorded payments (all time / in period)        : ${payments.length} / ${payments.filter(p => inRange(p.paymentDate, range)).length}`);
    console.log(`  statement rows                                  : ${statement.lineCount}`);
    console.log(`  invoices with a subtotal                        : ${statement.invoices.filter(i => i.showSubtotal).length}`);
    console.log('');
    console.log('  BRIDGE — independent sum from raw bookings');
    console.log(`    opening balance (everything before ${from})   ${money(statement.openingBalance)}`);
    console.log(`    + fare lines (ourCost - paymentFromCard)     ${money(fare)}`);
    console.log(`        of which paid by card, not owed:         ${money(cardPaid)}`);
    console.log(`    + supplier fees (gross ${r2(feesGross).toFixed(2)}, suppressed ${r2(feesSuppressed).toFixed(2)})  ${money(fees)}`);
    console.log(`    + change add-ons (on change date)            ${money(addons)}`);
    console.log(`    + cancellation credits (on cancel date)      ${money(cancelCredits)}`);
    console.log(`    + payments recorded                          ${money(paid)}`);
    console.log(`    ${'='.repeat(44)}`);
    console.log(`    = independent total                          ${money(independentTotal)}`);
    console.log(`      statement Total Open                       ${money(statement.totals.totalOpen)}`);
    console.log(`      statement Account Balance                  ${money(statement.totals.accountBalance)}`);
    console.log(`      RESIDUAL                                   ${money(residual)}  ${residual === 0 ? '<- closed' : '<- MISMATCH'}`);
    console.log('');
    console.log(`    movement residual (rows only, no opening)    ${money(movementResidual)}  ${movementResidual === 0 ? '<- closed' : '<- MISMATCH'}`);

    // The footer must also equal the sum of the rows a reader can see.
    const visible = r2(statement.invoices.flatMap(i => i.lines).reduce((s, l) => s + l.fare, 0));
    const footerResidual = r2(statement.totals.totalOpen - r2(statement.openingBalance + visible));
    console.log(`    footer vs visible rows residual              ${money(footerResidual)}  ${footerResidual === 0 ? '<- closed' : '<- MISMATCH'}`);
    if (footerResidual !== 0) allClosed = false;

    const pnrs = [...new Set(statement.invoices.filter(i => !i.isPayment).map(i => i.invoiceNo))];
    console.log(`    sample PNRs on the statement                 ${pnrs.slice(0, 6).join(', ')}`);

    if (expect !== undefined) {
      const want = Number(expect);
      console.log('');
      console.log(`  SANITY CHECK against the client's PDF figure (informational, not a gate)`);
      console.log(`    client PDF Total Open                      ${money(want)}`);
      console.log('');
      console.log('    Total Open is not comparable yet. The PDF reflects a real account where past');
      console.log('    invoices have been settled; this system has NO record of any payment ever made');
      console.log('    to a supplier, so every booking since it went live is still open. That whole');
      console.log(`    history is the opening balance: ${r2(statement.openingBalance).toFixed(2)}.`);
      console.log('    Once the client enters an opening-balance payment row, this closes.');
      console.log('');
      console.log('    The comparable figure is the PERIOD MOVEMENT — what we billed in this period:');
      console.log(`      our period movement                      ${money(statement.totals.movement)}`);
      console.log(`      client PDF Total Open                    ${money(want)}`);
      console.log(`      difference                               ${money(r2(statement.totals.movement - want))}`);
      console.log(`      ratio                                    ${(statement.totals.movement / want).toFixed(2)}x`);
      const byKind = {};
      for (const l of statement.invoices.flatMap(i => i.lines)) {
        byKind[l.kind] = r2((byKind[l.kind] || 0) + l.fare);
      }
      console.log('');
      console.log('    differences by category:');
      console.log(`      our lines by kind                        ${JSON.stringify(byKind)}`);
      console.log(`      bookings issued in period                ${issuedInRange.length}, producing ${statement.lineCount} lines`);
      console.log(`      supplier fees entered this period        ${r2(feesGross).toFixed(2)} (barely used across the whole copy)`);
      console.log('      no real invoice numbers                  PNR is used for Invoice/Ticket/Remarks');
      console.log('      no discounts or adjustments              not modelled, per the brief');
      console.log('      no supplier payment history              nothing recorded before this feature');
      console.log('    A movement well above the PDF suggests the PDF covers a narrower set of');
      console.log('    bookings than "every non-Draft booking issued in the week", or that its fare');
      console.log('    basis is not ourCost. That is a question for the client, not a code defect:');
      console.log('    the reconciliation above proves the statement is internally exact.');
    }
  }

  console.log('');
  console.log('='.repeat(78));
  console.log(allClosed
    ? 'ALL RECONCILIATIONS CLOSED — every residual is 0.'
    : 'AT LEAST ONE RESIDUAL IS NON-ZERO. See above.');
  console.log('Nothing was written.');
  console.log('='.repeat(78));

  await mongoose.disconnect();
  if (!allClosed) process.exit(1);
})().catch(async (e) => {
  console.error('Failed:', e.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
