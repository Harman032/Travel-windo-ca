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
const { buildStatement, bookingLines, buildItinerary, vendorLabel, CARD_FEE_CEILING, r2 } = require('../utils/supplier-statement');
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
  // ourCost 1150 because the route adds the add-on into it; 1000 + 150 is the real state.
  const lines = bookingLines(booking({ ourCost: 1150, dateChanges: [{ ourCostAddon: 150, changedAt }] }));
  const addon = lines.find(l => l.kind === 'addon');
  assert.strictEqual(addon.fare, 150);
  assert.strictEqual(addon.date, changedAt, 'dated on the change, not the booking');
  ok('a change add-on is its own line on the date the change was made');
}

{
  // THE FIXTURE MATTERS. routes/bookings.js:891 does booking.ourCost = ourCost + ourCostAddon,
  // so a booking that cost 1000 and then took a 150 add-on has ourCost 1150 AND a 150 add-on row.
  // A fixture with ourCost 1000 plus a 150 add-on is a state the app cannot produce, and testing
  // against it hid a double-count: the fare line billed the add-on inside ourCost and the add-on
  // loop billed it again.
  const changedAt = new Date('2026-09-20T18:00:00Z');
  const lines = bookingLines(booking({ ourCost: 1150, dateChanges: [{ ourCostAddon: 150, changedAt }] }));
  assert.strictEqual(lines.find(l => l.kind === 'fare').fare, 1000,
    'the fare line must bill the BASE cost, not ourCost');
  assert.strictEqual(lines.find(l => l.kind === 'addon').fare, 150);
  assert.strictEqual(r2(lines.reduce((s2, l) => s2 + l.fare, 0)), 1150,
    'the booking total must equal ourCost, not ourCost + the add-on again');
  ok('a changed booking totals ourCost once, not ourCost plus the add-on again');
}

{
  // Two add-ons on a card-paid booking.
  const lines = bookingLines(booking({
    ourCost: 1300, paymentFromCard: 1000, cardType: 'Company Card',
    dateChanges: [{ ourCostAddon: 150, changedAt: new Date('2026-09-20T18:00:00Z') }],
    flightChanges: [{ ourCostAddon: 150, changedAt: new Date('2026-09-22T18:00:00Z') }]
  }));
  assert.strictEqual(lines.find(l => l.kind === 'fare').fare, 0, '1300 - 300 add-ons - 1000 card');
  assert.strictEqual(r2(lines.reduce((s2, l) => s2 + l.fare, 0)), 300);
  ok('two add-ons on a card-paid booking: base nets to 0.00, total is the 300 of add-ons');
}

{
  // seatBookChanges has no ourCostAddon field (routes/bookings.js:1085 overwrites ourCost
  // outright), so it must not be iterated - doing so would double-bill if the field appeared.
  const lines = bookingLines(booking({
    ourCost: 500,
    seatBookChanges: [{ ourCostAddon: 99, changedAt: new Date('2026-09-20T18:00:00Z') }]
  }));
  assert.strictEqual(lines.filter(l => l.kind === 'addon').length, 0);
  assert.strictEqual(r2(lines.reduce((s2, l) => s2 + l.fare, 0)), 500);
  ok('seatBookChanges is not treated as an add-on source');
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

console.log('\nfare basis: what we owe is ourCost MINUS paymentFromCard');

{
  const lines = bookingLines(booking({ ourCost: 2412.42, paymentFromCard: 2407.42, cardType: 'Company Card' }));
  const fare = lines.find(l => l.kind === 'fare');
  assert.strictEqual(fare.fare, 5,
    'the card paid the airline; only the service charge is owed to the supplier');
  ok('a card-paid booking owes ourCost - paymentFromCard, not ourCost');
  assert.strictEqual(fare.vendor, 'Svc fee');
  ok('a small positive card-paid net is labelled Svc fee, not the airline');
}

{
  // 242Z6X in the staging copy: the card paid 2350.00 against a cost of 2264.12.
  const lines = bookingLines(booking({ ourCost: 2264.12, paymentFromCard: 2350, cardType: 'Client Card' }));
  const fare = lines.find(l => l.kind === 'fare');
  assert.strictEqual(fare.fare, -85.88,
    'NOT floored at zero: a card can pay more than our cost, and that is a real credit');
  ok('a negative net is kept as a credit, matching the PDF exactly (-85.88)');
  assert.strictEqual(fare.vendor, 'Discount/Adjustments');
  ok('a negative card-paid net is labelled Discount/Adjustments');
}

{
  // ABJOLI: a genuine fare on a client card, three orders of magnitude above any service net.
  const lines = bookingLines(booking({ ourCost: 26904.48, paymentFromCard: 19260, cardType: 'Client Card', airline: 'EK' }));
  const fare = lines.find(l => l.kind === 'fare');
  assert.strictEqual(fare.fare, 7644.48);
  assert.strictEqual(fare.vendor, 'EK', 'above the ceiling it is a fare, so the airline is right');
  ok('a large card-paid net keeps the airline label');
}

{
  assert.strictEqual(vendorLabel({ paymentFromCard: 0, airline: 'AC' }, 1000), 'AC');
  assert.strictEqual(vendorLabel({ paymentFromCard: 0, airline: 'AC' }, -50), 'AC',
    'a NON-card booking keeps the airline whatever the sign');
  ok('the label rule only applies to card-paid bookings');

  assert.strictEqual(vendorLabel({ paymentFromCard: 100, airline: 'AC' }, CARD_FEE_CEILING), 'Svc fee');
  assert.strictEqual(vendorLabel({ paymentFromCard: 100, airline: 'AC' }, CARD_FEE_CEILING + 0.01), 'AC');
  ok('the ceiling is inclusive, and above it the airline returns');

  assert.strictEqual(vendorLabel({ paymentFromCard: 100, airline: 'AC' }, 0), 'AC',
    'a zero net is neither a fee nor a discount');
  ok('a zero card-paid net falls through to the airline');
}

{
  const lines = bookingLines(booking({ ourCost: 1857.52, paymentFromCard: 1857.52, cardType: 'Company Card' }));
  assert.strictEqual(lines.find(l => l.kind === 'fare').fare, 0);
  assert.strictEqual(lines.filter(l => l.kind === 'fare').length, 1,
    'a 0.00 line is still emitted so the PNR appears on the statement');
  ok('a fully card-paid booking shows a 0.00 line rather than vanishing');
}

{
  const lines = bookingLines(booking({ pnr: '  BL3WQY /2GOQXJ ', ourCost: 100 }));
  assert.strictEqual(lines[0].invoiceNo, 'BL3WQY /2GOQXJ');
  assert.strictEqual(lines[0].ticketNo, 'BL3WQY /2GOQXJ');
  ok('the PNR is trimmed for display (80 stored PNRs carry stray whitespace)');
}

{
  // The fee fields are separate from ourCost, so they are still additive on a card-paid booking.
  const lines = bookingLines(booking({ ourCost: 1000, paymentFromCard: 995, supplierBookingCharge: 20 }));
  assert.strictEqual(r2(lines.reduce((s, l) => s + l.fare, 0)), 25);
  ok('supplier fees stay additive on a card-paid booking: 5 net + 20 fee');
}

console.log('\ncancelled AND card-paid: a supplier cannot return money they never held');

{
  // BEBGWI in the copy: card paid the lot, supplier kept a 25.00 fee, engine says they would
  // return 1582.52 — which is the airline's money, refunded to the card, not to us.
  const lines = bookingLines(booking({
    status: 'Cancelled', ourCost: 1857.52, paymentFromCard: 1857.52, cardType: 'Company Card',
    cancellation: { isCancelled: true, totalSupplierTook: 25, supplierWillReturn: 1582.52,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  assert.strictEqual(lines.filter(l => l.kind === 'cancelCredit').length, 0,
    'net is 0, so there is nothing for the supplier to give back');
  assert.strictEqual(r2(lines.reduce((s, l) => s + l.fare, 0)), 0);
  ok('Company Card, net 0: no invented 1,582.52 credit, booking nets 0.00');
}

{
  // CNOOMG shape: the supplier held 5.00 and kept none of it.
  const lines = bookingLines(booking({
    status: 'Cancelled', ourCost: 1933.42, paymentFromCard: 1928.42, cardType: 'Company Card',
    cancellation: { isCancelled: true, totalSupplierTook: 0, supplierWillReturn: 1480,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  const credit = lines.find(l => l.kind === 'cancelCredit');
  assert.strictEqual(credit.fare, -5, 'capped at the 5.00 the supplier actually held');
  assert.strictEqual(r2(lines.reduce((s, l) => s + l.fare, 0)), 0);
  ok('Company Card, net 5.00: the credit is capped at 5.00, booking nets 0.00');
}

{
  // BEBGWI exactly. The credit cap removed the credit, so suppressing the fees as well left the
  // whole booking as a single 0.00 line and silently dropped the 25.00 the supplier kept.
  const lines = bookingLines(booking({
    status: 'Cancelled', ourCost: 1857.52, paymentFromCard: 1857.52, cardType: 'Company Card',
    supplierBookingCharge: 5, supplierUpdationCharge: 0, supplierCharges: 25,
    cancellation: { isCancelled: true, totalSupplierTook: 25, supplierWillReturn: 1582.52,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  assert.strictEqual(r2(lines.reduce((s, l) => s + l.fare, 0)), 25,
    'the booking must total totalSupplierTook: the supplier keeps the fee');
  ok('BEBGWI: capped credit no longer swallows the 25.00 the supplier kept');
  assert.deepStrictEqual(lines.map(l => l.fare), [0, 5, 20]);
  ok('BEBGWI lines are 0.00 fare + 5.00 booking charge + 20.00 cancellation charge');
  assert.strictEqual(lines.filter(l => l.kind === 'cancelCredit').length, 0);
  ok('BEBGWI has no credit line, because the supplier holds nothing to return');
}

{
  // B4MGRT: same shape, but supplierCharges equals the booking charge, so no derived
  // cancellation charge exists and only the 5.00 is billed.
  const lines = bookingLines(booking({
    status: 'Cancelled', ourCost: 1220.32, paymentFromCard: 1220.32, cardType: 'Company Card',
    supplierBookingCharge: 5, supplierUpdationCharge: 0, supplierCharges: 5,
    cancellation: { isCancelled: true, totalSupplierTook: 5, supplierWillReturn: 901.32,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  assert.strictEqual(r2(lines.reduce((s, l) => s + l.fare, 0)), 5);
  assert.deepStrictEqual(lines.map(l => l.fare), [0, 5]);
  ok('B4MGRT: totals 5.00, with no phantom cancellation-charge line');
}

{
  // The derived cancellation charge is supplierCharges - bookingCharge - updationCharge, and that
  // subtraction can go negative: 75 bookings in the staging copy have supplierCharges LESS than
  // the sum of the two fee fields (65 of them have supplierCharges 0 against a booking charge of
  // 5). None of those 75 is cancelled today, so the clamp never fires on current data — but it
  // would the moment one of them is cancelled, and a negative "Svc fee" line would hand the
  // supplier money on their own statement.
  const lines = bookingLines(booking({
    status: 'Cancelled', ourCost: 1000, paymentFromCard: 1000, cardType: 'Company Card',
    supplierBookingCharge: 5, supplierUpdationCharge: 0, supplierCharges: 0,
    cancellation: { isCancelled: true, totalSupplierTook: 5, supplierWillReturn: 800,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  const derived = lines.filter(l => l.feeType === 'cancellation');
  assert.strictEqual(derived.length, 0,
    'supplierCharges 0 - bookingCharge 5 = -5, which must be clamped away, not emitted');
  ok('a derived cancellation charge below zero produces no line at all');
  assert.deepStrictEqual(lines.map(l => l.fare), [0, 5]);
  ok('only the real booking charge is billed: 0.00 fare + 5.00');
}

{
  // The same clamp, with the shortfall spread across both fee fields.
  const lines = bookingLines(booking({
    status: 'Cancelled', ourCost: 500, paymentFromCard: 500, cardType: 'Client Card',
    supplierBookingCharge: 5, supplierUpdationCharge: 40, supplierCharges: 20,
    cancellation: { isCancelled: true, totalSupplierTook: 45, supplierWillReturn: 300,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  assert.ok(lines.every(l => l.kind !== 'fee' || l.fare > 0), 'no fee line may be negative');
  ok('20 - 5 - 40 = -25 is clamped away, and no fee line is negative');
}

{
  // The invariant itself, over every shape above: a fee line is never negative.
  const shapes = [
    { supplierCharges: 0, supplierBookingCharge: 5, supplierUpdationCharge: 0 },
    { supplierCharges: 20, supplierBookingCharge: 5, supplierUpdationCharge: 40 },
    { supplierCharges: 25, supplierBookingCharge: 5, supplierUpdationCharge: 0 },
    { supplierCharges: 0, supplierBookingCharge: 0, supplierUpdationCharge: 0 }
  ];
  for (const s of shapes) {
    for (const card of [0, 500, 1000]) {
      const lines = bookingLines(booking({
        status: 'Cancelled', ourCost: 1000, paymentFromCard: card,
        cardType: card ? 'Company Card' : '', ...s,
        cancellation: { isCancelled: true, totalSupplierTook: r2(s.supplierCharges),
                        supplierWillReturn: 300, cancelledAt: new Date('2026-09-25T15:00:00Z') }
      }));
      const bad = lines.filter(l => l.kind === 'fee' && l.fare < 0);
      assert.strictEqual(bad.length, 0,
        `negative fee line for ${JSON.stringify(s)} card=${card}: ${JSON.stringify(bad)}`);
    }
  }
  ok('across 12 fee/card combinations, no fee line is ever negative');
}

{
  // An UNCAPPED cancellation must keep suppressing, or the fees would be double-counted:
  // supplierWillReturn is already net of totalSupplierTook there.
  const lines = bookingLines(booking({
    status: 'Cancelled', ourCost: 1000, paymentFromCard: 0,
    supplierBookingCharge: 25, supplierUpdationCharge: 10, supplierCharges: 35,
    cancellation: { isCancelled: true, totalSupplierTook: 35, supplierWillReturn: 800,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  assert.strictEqual(lines.filter(l => l.kind === 'fee').length, 0,
    'nothing was capped, so the fees are still inside the credit');
  assert.strictEqual(r2(lines.reduce((s, l) => s + l.fare, 0)), 200);
  ok('an uncapped cancellation still suppresses its fees, unchanged');
}

{
  // Client Card, same rule. Does not occur among the copy's cancelled bookings, so synthetic.
  const lines = bookingLines(booking({
    status: 'Cancelled', ourCost: 3000, paymentFromCard: 2900, cardType: 'Client Card',
    cancellation: { isCancelled: true, totalSupplierTook: 0, supplierWillReturn: 2500,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  assert.strictEqual(lines.find(l => l.kind === 'cancelCredit').fare, -100);
  ok('Client Card behaves identically: the cap is the money, not the card brand');
}

{
  // The other direction: the card overpaid, so the net is a credit and there is nothing to cap.
  const lines = bookingLines(booking({
    status: 'Cancelled', ourCost: 1000, paymentFromCard: 1200, cardType: 'Client Card',
    cancellation: { isCancelled: true, totalSupplierTook: 0, supplierWillReturn: 800,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  assert.strictEqual(lines.filter(l => l.kind === 'cancelCredit').length, 0,
    'max(0, net) is 0, so no credit line');
  assert.strictEqual(r2(lines.reduce((s, l) => s + l.fare, 0)), -200,
    'the booking is a net credit of 200, from the overpayment alone');
  ok('Client Card with a negative net: no credit line, the booking is already a credit');
}

{
  // The cap must NOT touch a non-card cancellation, including the scenarios where
  // supplierWillReturn legitimately exceeds ourCost.
  const lines = bookingLines(booking({
    status: 'Cancelled', ourCost: 800, paymentFromCard: 0,
    cancellation: { isCancelled: true, totalSupplierTook: 0, supplierWillReturn: 950,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  assert.strictEqual(lines.find(l => l.kind === 'cancelCredit').fare, -950,
    'uncapped: scenarios 3 and 5 can return more than ourCost, and that must not change');
  ok('a non-card cancellation is never capped, so existing behaviour is untouched');
}

{
  // The cap is "what the supplier HOLDS", not the fare line. The fare line has the change
  // add-ons stripped out (they are billed back on their own dated lines), but the supplier was
  // still paid them. Capping at the stripped figure chops a credit they genuinely owe AND
  // un-suppresses the fees on top. No such booking exists in the copy yet; this is the guard.
  const changedAt = new Date('2026-09-20T18:00:00Z');
  const lines = bookingLines(booking({
    status: 'Cancelled', ourCost: 1150, paymentFromCard: 900, cardType: 'Company Card',
    supplierCharges: 10, supplierBookingCharge: 5, supplierUpdationCharge: 5,
    dateChanges: [{ ourCostAddon: 150, changedAt }],
    cancellation: { isCancelled: true, totalSupplierTook: 10, supplierWillReturn: 140,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  // Held = 1150 - 900 = 250, which is above 140, so nothing is capped.
  assert.strictEqual(lines.find(l => l.kind === 'cancelCredit').fare, -140,
    'the add-ons are money the supplier holds, so the 140 credit survives in full');
  assert.strictEqual(lines.filter(l => l.kind === 'fee').length, 0,
    'nothing was capped, so totalSupplierTook still absorbs the fees');
  assert.strictEqual(r2(lines.reduce((s, l) => s + l.fare, 0)), 110,
    '100 fare + 150 add-on - 140 credit = 110.00 (capping at the fare line gave 160.00)');
  ok('a cancelled, card-paid booking with a change add-on is capped on what the supplier holds');
}

{
  // Same booking fully card-paid against the BASE cost: held is 150, the add-on alone.
  const changedAt = new Date('2026-09-20T18:00:00Z');
  const lines = bookingLines(booking({
    status: 'Cancelled', ourCost: 1150, paymentFromCard: 1000, cardType: 'Company Card',
    supplierCharges: 10, supplierBookingCharge: 5, supplierUpdationCharge: 5,
    dateChanges: [{ ourCostAddon: 150, changedAt }],
    cancellation: { isCancelled: true, totalSupplierTook: 10, supplierWillReturn: 140,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  assert.strictEqual(lines.find(l => l.kind === 'cancelCredit').fare, -140,
    'held = 1150 - 1000 = 150, still above the 140 the supplier returns');
  assert.strictEqual(r2(lines.reduce((s, l) => s + l.fare, 0)), 10,
    '0 fare + 150 add-on - 140 credit = 10.00, exactly totalSupplierTook');
  ok('the fare line reading 0.00 does not mean the supplier holds nothing');
}

{
  // The cap still bites when it should: no add-on, so held equals the fare line.
  const lines = bookingLines(booking({
    status: 'Cancelled', ourCost: 1000, paymentFromCard: 1000, cardType: 'Company Card',
    supplierCharges: 25, supplierBookingCharge: 5, supplierUpdationCharge: 0,
    cancellation: { isCancelled: true, totalSupplierTook: 25, supplierWillReturn: 1582.52,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  assert.strictEqual(lines.filter(l => l.kind === 'cancelCredit').length, 0,
    'held is 0, so there is no credit to give');
  assert.strictEqual(r2(lines.reduce((s, l) => s + l.fare, 0)), 25,
    'the capped credit un-suppresses the 5 fee and the derived 20 charge: 25.00');
  ok('with no add-on the cap is unchanged, so BEBGWI-shaped bookings still behave');
}

console.log('\nsupplierWillReturn at or below zero');

{
  // AEFSGR in the staging copy stores supplierWillReturn -20 on a non-card booking. Non-card is
  // never capped, so the credit used to be -20 and the line pushed `fare: -credit` = +20 on a row
  // labelled "Cancelled": a charge presented to the reader as a refund.
  const lines2 = bookingLines(booking({
    status: 'Cancelled', ourCost: 500, paymentFromCard: 0,
    cancellation: { isCancelled: true, totalSupplierTook: 0, supplierWillReturn: -20,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  assert.strictEqual(lines2.filter(l => l.kind === 'cancelCredit').length, 0,
    'a negative supplierWillReturn must not become a positive line labelled Cancelled');
  ok('AEFSGR shape: a negative supplierWillReturn produces no credit line');
  assert.ok(lines2.every(l => !(l.kind === 'cancelCredit' && l.fare > 0)));
  ok('no cancelCredit line is ever positive');
}

{
  // Scenario 4A with a fully non-refundable fare: supplierWillReturn is exactly 0 while the
  // supplier still kept totalSupplierTook. The credit absorbed nothing, so the fees must be billed.
  const lines2 = bookingLines(booking({
    status: 'Cancelled', ourCost: 1000, paymentFromCard: 0,
    supplierBookingCharge: 25, supplierUpdationCharge: 10, supplierCharges: 35,
    cancellation: { isCancelled: true, totalSupplierTook: 35, supplierWillReturn: 0,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  assert.strictEqual(r2(lines2.reduce((s2, l) => s2 + l.fare, 0)), 1035,
    'fare 1000 + 25 + 10: a zero credit must not suppress the fees');
  ok('a zero supplierWillReturn still bills the fees the supplier kept');
}

{
  // The uncapped case is still untouched: a real credit absorbs the fees.
  const lines2 = bookingLines(booking({
    status: 'Cancelled', ourCost: 1000, paymentFromCard: 0,
    supplierBookingCharge: 25, supplierUpdationCharge: 10, supplierCharges: 35,
    cancellation: { isCancelled: true, totalSupplierTook: 35, supplierWillReturn: 800,
                    cancelledAt: new Date('2026-09-25T15:00:00Z') }
  }));
  assert.strictEqual(lines2.filter(l => l.kind === 'fee').length, 0);
  assert.strictEqual(r2(lines2.reduce((s2, l) => s2 + l.fare, 0)), 200);
  ok('a genuine credit still absorbs the fees, unchanged');
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

  // ---- the route end to end, through a projection-honouring find ----
  //
  // The route's .select() must list every field buildStatement reads. When paymentFromCard and
  // supplierCharges were missing, Mongoose returned undefined, the fare basis silently reverted to
  // ourCost and the cancellation-credit cap never fired — in other words both money fixes were
  // dead in production while every unit test still passed, because the old harness ignored
  // .select() entirely. These assertions go through the real route and the real projection.
  console.log('\nthe route reads every field the statement needs');
  {
    const { startReports } = require('./report-harness');
    const SUPID = oid();
    const Supplier2 = require('../models/Supplier');
    const SupplierPayment2 = require('../models/SupplierPayment');
    Supplier2.findById = () => {
      const c = { select: () => c, lean: () => c, then: (res, rej) => Promise.resolve({ _id: SUPID, name: 'PROJ TEST' }).then(res, rej) };
      return c;
    };
    SupplierPayment2.find = () => {
      const c = { lean: () => c, then: (res, rej) => Promise.resolve([]).then(res, rej) };
      return c;
    };

    const rows = [
      // card-paid: the fare basis and the Svc fee label both depend on paymentFromCard
      {
        _id: oid(), pnr: 'CARDED', paxName: 'X', status: 'Ticketed', supplier: SUPID,
        dateOfSubmission: new Date('2026-09-10T16:00:00Z'), travelDate: new Date('2026-10-01T12:00:00Z'),
        from: 'YYZ', to: 'DEL', sectorType: 'One Way', airline: 'AC',
        ourCost: 2412.42, paymentFromCard: 2407.42, supplierCharges: 0,
        supplierBookingCharge: 0, supplierUpdationCharge: 0,
        dateChanges: [], flightChanges: [], seatBookChanges: [], cancellation: null
      },
      // cancelled + card-paid: the cap and the derived charge depend on supplierCharges
      {
        _id: oid(), pnr: 'CANCRD', paxName: 'Y', status: 'Cancelled', supplier: SUPID,
        dateOfSubmission: new Date('2026-09-12T16:00:00Z'), travelDate: new Date('2026-10-01T12:00:00Z'),
        from: 'YYZ', to: 'DEL', sectorType: 'One Way', airline: 'CX',
        ourCost: 1857.52, paymentFromCard: 1857.52, supplierCharges: 25,
        supplierBookingCharge: 5, supplierUpdationCharge: 0,
        dateChanges: [], flightChanges: [], seatBookChanges: [],
        cancellation: { isCancelled: true, totalSupplierTook: 25, supplierWillReturn: 1582.52,
                        cancelledAt: new Date('2026-09-25T15:00:00Z') }
      }
    ];
    const api2 = await startReports('../routes/reports', rows);
    const body = await api2.get('payment-to-suppliers',
      { supplier: String(SUPID), dateFrom: '2026-09-01', dateTo: '2026-09-30' });

    const byPnr = Object.fromEntries(body.invoices.map(i => [i.invoiceNo, i]));

    assert.strictEqual(byPnr.CARDED.subtotal, 5,
      'fare basis through the route: 2412.42 - 2407.42 = 5.00, not 2412.42');
    ok('the route applies the card-paid fare basis (would be 2,412.42 with the old projection)');

    assert.strictEqual(byPnr.CARDED.lines[0].vendor, 'Svc fee',
      'the label depends on paymentFromCard reaching buildStatement');
    ok('the route applies the Svc fee label');

    assert.strictEqual(byPnr.CANCRD.subtotal, 25,
      'the capped cancellation must still bill the 25.00 the supplier kept');
    ok('the route applies the credit cap AND the fee un-suppression');

    assert.ok(byPnr.CANCRD.lines.some(l => l.fare === 20),
      'the derived cancellation charge needs supplierCharges in the projection');
    ok('the route derives the 20.00 cancellation charge from supplierCharges');

    assert.strictEqual(body.totals.totalOpen, 30, '5.00 + 25.00');
    ok('the route total is 30.00, proving both fields survive the projection');

    api2.close();
  }
  console.log(`\n${passed} assertions passed under TZ=${process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone}`);
})().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
