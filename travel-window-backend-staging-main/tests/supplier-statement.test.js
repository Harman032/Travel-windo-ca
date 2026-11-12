'use strict';
// The supplier statement. Every line carries a signed fare, so the footer is one sum over the
// rows and cannot drift from them. These tests pin down the line rules, the itinerary format,
// the cancelled-booking double-count rule, and that Total Open closes exactly.
//
//   node tests/supplier-statement.test.js --tz UTC
const tzArg = process.argv.indexOf('--tz');
if (tzArg !== -1 && process.argv[tzArg + 1]) process.env.TZ = process.argv[tzArg + 1];

const assert = require('assert');
const mongoose = require('mongoose');
const { buildStatement, bookingLines, buildItinerary, r2 } = require('../utils/supplier-statement');
const { buildRange } = require('../utils/tz');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };
const oid = () => new mongoose.Types.ObjectId();

const SEPT = buildRange('2026-09-01', '2026-09-30');

const booking = (over = {}) => Object.assign({
  _id: oid(), pnr: 'AAA111', paxName: 'PASSENGER ONE',
  dateOfSubmission: new Date('2026-09-10T16:00:00Z'),
  travelDate: new Date('2026-10-05T12:00:00Z'),
  from: 'yyz', to: 'del', sectorType: 'One Way', multipleSectors: [],
  airline: 'AC', status: 'Ticketed',
  ourCost: 1000, supplierBookingCharge: 0, supplierUpdationCharge: 0,
  dateChanges: [], flightChanges: [], seatBookChanges: [], cancellation: null
}, over);

console.log('itinerary');

assert.strictEqual(buildItinerary(booking({ sectorType: 'One Way', from: 'del', to: 'yyz' })), 'DELYYZ');
ok('one way is from+to, uppercase, no separator');

assert.strictEqual(buildItinerary(booking({ sectorType: 'Round Trip', from: 'yyz', to: 'del' })), 'YYZDELYYZ');
ok('round trip is from+to+from');

assert.strictEqual(buildItinerary(booking({ sectorType: 'Round Trip', from: 'del', to: 'yyz' })), 'DELYYZDEL');
ok('round trip the other way round matches the client statement sample');

assert.strictEqual(buildItinerary(booking({
  sectorType: 'Multiple', from: 'yyz', to: 'bom',
  multipleSectors: [{ from: 'del', to: 'bom' }, { from: 'bom', to: 'maa' }]
})), 'DELBOMBOMMAAYYZBOM');
ok('multiple concatenates each sector in order, then the booking from+to');

console.log('\nline rules');

{
  const lines = bookingLines(booking());
  assert.strictEqual(lines.length, 1);
  assert.strictEqual(lines[0].kind, 'fare');
  assert.strictEqual(lines[0].fare, 1000);
  ok('a plain booking is one fare line of ourCost');
  assert.strictEqual(lines[0].invoiceNo, 'AAA111');
  assert.strictEqual(lines[0].remarks, 'AAA111');
  assert.strictEqual(lines[0].ticketNo, 'AAA111');
  ok('invoice no, remarks and ticket no are all the PNR, as the client chose');
  assert.strictEqual(lines[0].vendor, 'AC');
  ok('vendor is the stored airline value, as-is');
}

{
  const lines = bookingLines(booking({ supplierBookingCharge: 25, supplierUpdationCharge: 10 }));
  const fees = lines.filter(l => l.kind === 'fee');
  assert.strictEqual(fees.length, 2, 'one line per fee');
  assert.deepStrictEqual(fees.map(f => f.fare), [25, 10]);
  assert.ok(fees.every(f => f.vendor === 'Svc fee'), 'the label goes in the Vendor column');
  ok('each supplier fee is its own line, labelled Svc fee in the Vendor column');
}

{
  const lines = bookingLines(booking({ supplierBookingCharge: 0, supplierUpdationCharge: 0 }));
  assert.strictEqual(lines.filter(l => l.kind === 'fee').length, 0);
  ok('a zero fee produces no line');
}

{
  const changedAt = new Date('2026-09-20T18:00:00Z');
  const lines = bookingLines(booking({ dateChanges: [{ ourCostAddon: 150, changedAt }] }));
  const addon = lines.find(l => l.kind === 'addon');
  assert.strictEqual(addon.fare, 150);
  assert.strictEqual(addon.date, changedAt, 'dated on the change, not the booking');
  ok('a change add-on is its own line on the date the change was made');
}

console.log('\ncancelled bookings');

{
  // totalSupplierTook non-zero: the fees are already inside the credit, so billing them again
  // would double-count. This is the rule the brief asked to be commented and tested.
  const lines = bookingLines(booking({
    status: 'Cancelled', supplierBookingCharge: 25, supplierUpdationCharge: 10,
    cancellation: {
      isCancelled: true, totalSupplierTook: 35, supplierWillReturn: 800,
      cancelledAt: new Date('2026-09-25T15:00:00Z')
    }
  }));
  assert.strictEqual(lines.filter(l => l.kind === 'fee').length, 0,
    'fees must be suppressed when totalSupplierTook already contains them');
  ok('fee lines are suppressed when the cancellation credit already contains them');

  const credit = lines.find(l => l.kind === 'cancelCredit');
  assert.strictEqual(credit.fare, -800, 'a credit is negative');
  assert.strictEqual(credit.vendor, 'Cancelled');
  ok('the cancellation credit is -supplierWillReturn, marked Cancelled');

  // Net of the booking: ourCost - supplierWillReturn = what the supplier actually kept.
  const net = r2(lines.reduce((s, l) => s + l.fare, 0));
  assert.strictEqual(net, 200, '1000 fare - 800 returned = 200 kept');
  ok('fare plus credit nets to what the supplier kept, with no double count');
}

{
  // totalSupplierTook zero: the cancellation never accounted for the fees, so they must stay.
  // This is 17 of the 26 cancelled bookings in the staging copy.
  const lines = bookingLines(booking({
    status: 'Cancelled', supplierBookingCharge: 25,
    cancellation: { isCancelled: true, totalSupplierTook: 0, supplierWillReturn: 900,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  assert.strictEqual(lines.filter(l => l.kind === 'fee').length, 1,
    'the fee must stay when the cancellation figure is zero');
  ok('fee lines stay when the cancellation credit does NOT contain them');
}

{
  const lines = bookingLines(booking({
    status: 'Cancelled',
    cancellation: { isCancelled: true, totalSupplierTook: 0, supplierWillReturn: 0 }
  }));
  assert.strictEqual(lines.filter(l => l.kind === 'cancelCredit').length, 0);
  assert.strictEqual(lines.filter(l => l.kind === 'fare').length, 1,
    'the original fare line always stays on a cancelled booking');
  ok('a zero supplierWillReturn produces no credit, and the fare line stays');
}

console.log('\nTotal Open closes');

{
  const bookings = [
    booking({ pnr: 'IN001', ourCost: 1000, supplierBookingCharge: 25 }),
    booking({ pnr: 'IN002', ourCost: 500, dateOfSubmission: new Date('2026-09-28T16:00:00Z') }),
    // Before the range: becomes the opening balance, not a row.
    booking({ pnr: 'OLD01', ourCost: 300, dateOfSubmission: new Date('2026-08-15T16:00:00Z') }),
    // After the range: ignored entirely.
    booking({ pnr: 'NEW01', ourCost: 700, dateOfSubmission: new Date('2026-10-15T16:00:00Z') })
  ];
  const payments = [
    { _id: oid(), paymentDate: new Date('2026-09-15T12:00:00Z'), amount: 400, reference: 'WIRE1', note: '' },
    { _id: oid(), paymentDate: new Date('2026-08-01T12:00:00Z'), amount: 300, note: 'Opening balance' }
  ];

  const st = buildStatement(bookings, payments, SEPT);

  assert.strictEqual(st.openingBalance, 0, '300 owed before the range, 300 paid before it');
  ok('the opening balance is the net of everything before the range');

  assert.strictEqual(st.totals.debits, 1525, '1000 + 25 + 500');
  assert.strictEqual(st.totals.credits, -400);
  assert.strictEqual(st.totals.movement, 1125);
  assert.strictEqual(st.totals.totalOpen, 1125);
  assert.strictEqual(st.totals.accountBalance, st.totals.totalOpen);
  ok('Total Open = opening balance + debits + credits, and Account Balance is the same number');

  // The footer must equal the sum of the rows the user can see.
  const visible = r2(st.invoices.flatMap(i => i.lines).reduce((s, l) => s + l.fare, 0));
  assert.strictEqual(r2(st.openingBalance + visible), st.totals.totalOpen);
  ok('the footer equals the opening balance plus every visible row — residual 0');

  assert.ok(!st.invoices.some(i => i.invoiceNo === 'NEW01'), 'a later booking is not on this statement');
  assert.ok(!st.invoices.some(i => i.invoiceNo === 'OLD01'), 'an earlier booking is in the opening balance');
  ok('only in-range activity appears as rows');
}

console.log('\nsubtotals and grouping');

{
  const st = buildStatement([
    booking({ pnr: 'MULTI1', ourCost: 1000, supplierBookingCharge: 25 }),
    booking({ pnr: 'SINGLE', ourCost: 500, dateOfSubmission: new Date('2026-09-12T16:00:00Z') })
  ], [], SEPT);

  const multi = st.invoices.find(i => i.invoiceNo === 'MULTI1');
  assert.strictEqual(multi.lines.length, 2);
  assert.strictEqual(multi.showSubtotal, true);
  assert.strictEqual(multi.subtotal, 1025);
  ok('an invoice with more than one line gets a subtotal');

  const single = st.invoices.find(i => i.invoiceNo === 'SINGLE');
  assert.strictEqual(single.showSubtotal, false);
  ok('a single-line invoice gets no subtotal');
}

{
  // Lines are ordered by date, then invoice, with the fare before its own fees.
  const st = buildStatement([
    booking({ pnr: 'BBB222', ourCost: 1, dateOfSubmission: new Date('2026-09-20T16:00:00Z') }),
    booking({ pnr: 'AAA111', ourCost: 1, supplierBookingCharge: 5, dateOfSubmission: new Date('2026-09-10T16:00:00Z') })
  ], [], SEPT);
  assert.deepStrictEqual(st.invoices.map(i => i.invoiceNo), ['AAA111', 'BBB222']);
  assert.deepStrictEqual(st.invoices[0].lines.map(l => l.kind), ['fare', 'fee']);
  ok('rows are ordered by date then PNR, fare before its own fees');
}

console.log('\nToronto day boundaries');

{
  // 2026-09-30 22:00 Toronto is 2026-10-01 02:00 UTC: in September in Toronto, October in UTC.
  const st = buildStatement([
    booking({ pnr: 'LATE30', ourCost: 100, dateOfSubmission: new Date('2026-10-01T02:00:00Z') })
  ], [], SEPT);
  assert.strictEqual(st.totals.totalOpen, 100,
    'a 22:00 Sep 30 Toronto booking belongs to the September statement');
  ok('the statement uses Toronto days, so a late-evening booking lands in the right month');
}

{
  const st = buildStatement([booking({ ourCost: 100 })], [], null);
  assert.strictEqual(st.openingBalance, 0, 'no range means no opening balance');
  assert.strictEqual(st.totals.totalOpen, 100);
  ok('with no date range the whole history is the statement');
}

console.log('\nSupplierPayment record');

{
  const SupplierPayment = require('../models/SupplierPayment');
  const base = { supplier: oid(), paymentDate: new Date('2026-09-15T12:00:00Z'), amount: 100, createdBy: oid() };

  assert.strictEqual(new SupplierPayment(base).validateSync(), undefined);
  ok('a valid payment passes validation');

  for (const bad of [0, -50]) {
    const err = new SupplierPayment({ ...base, amount: bad }).validateSync();
    assert.ok(err && err.errors.amount, `amount ${bad} must be rejected`);
  }
  ok('a zero or negative amount is rejected');

  for (const field of ['supplier', 'paymentDate', 'amount', 'createdBy']) {
    const partial = { ...base };
    delete partial[field];
    const err = new SupplierPayment(partial).validateSync();
    assert.ok(err && err.errors[field], `${field} must be required`);
  }
  ok('supplier, paymentDate, amount and createdBy are all required');

  assert.strictEqual(typeof SupplierPayment.schema.path('amount').options.validate, 'object');
  assert.ok(!SupplierPayment.schema.path('reference').isRequired);
  ok('reference and note are optional');
}

console.log('\nroute guards');

(async () => {
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const Booking = require('../models/Booking');
  const Supplier = require('../models/Supplier');
  const SupplierPayment = require('../models/SupplierPayment');
  const User = require('../models/User');

  const admin = { _id: oid(), role: 'ADMIN', isActive: true, name: 'Admin' };
  User.findById = () => ({ select: () => Promise.resolve(admin) });
  const token = jwt.sign({ userId: String(admin._id), role: 'ADMIN' },
    process.env.JWT_SECRET || 'your_jwt_secret_key_here');

  const chainOf = (value) => {
    const chain = {
      populate: () => chain, lean: () => chain, select: () => chain,
      sort: () => chain, skip: () => chain, limit: () => chain,
      then: (res, rej) => Promise.resolve(value).then(res, rej)
    };
    return chain;
  };
  const SUP = oid();
  Booking.find = () => chainOf([]);
  SupplierPayment.find = () => chainOf([]);
  Supplier.findById = (id) => chainOf(String(id) === String(SUP) ? { _id: SUP, name: 'TEST SUPPLIER' } : null);

  const app = express();
  app.use('/api/reports', require('../routes/reports'));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/reports/payment-to-suppliers`;
  const get = async (qs) => {
    const res = await fetch(`${base}?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  assert.strictEqual((await get('dateFrom=2026-09-01&dateTo=2026-09-30')).status, 400);
  ok('the statement refuses to run without a supplier');

  assert.strictEqual((await get('supplier=all')).status, 400);
  ok('"all" is not a supplier: a statement is per-supplier by definition');

  assert.strictEqual((await get('supplier=not-an-id')).status, 400);
  ok('an invalid supplier id is a 400, not a 500');

  assert.strictEqual((await get(`supplier=${oid()}`)).status, 404);
  ok('an unknown supplier is a 404');

  const good = await get(`supplier=${SUP}&dateFrom=2026-09-01&dateTo=2026-09-30`);
  assert.strictEqual(good.status, 200);
  assert.strictEqual(good.body.supplierName, 'TEST SUPPLIER');
  assert.strictEqual(good.body.company.name, 'TRAVEL WINDOW INC');
  assert.ok(good.body.company.addressLine1.includes('INPUT REQUIRED'),
    'the unresolved address line must stay visible, not be guessed');
  assert.strictEqual(good.body.timezone, 'America/Toronto');
  assert.strictEqual(good.body.totals.totalOpen, good.body.totals.accountBalance);
  ok('a valid request returns the company block, the supplier name and matching totals');

  assert.ok(good.body.invoices !== undefined && good.body.lineCount === 0);
  assert.strictEqual(good.body.page, undefined, 'there must be no paging on a statement');
  assert.strictEqual(good.body.limit, undefined);
  ok('the statement is unpaginated');

  server.close();
  console.log(`\n${passed} assertions passed under TZ=${process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone}`);
})().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
