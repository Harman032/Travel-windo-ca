'use strict';
// PART 1 hotfix: every date-only field lands on noon UTC of the RIGHT calendar day, whatever
// shape the input arrives in, through every write route and every role.
//
// Live evidence that made this necessary (2026-11-23T07:50Z): payments[].paymentDate pending on
// 3 of 2,935 live rows, created 2026-11-17 18:33-18:38 Toronto -- hours after the push, by one
// user on a stale tab. The old frontend posted a Date object, so HttpClient serialised it with
// toISOString(), and the old parseDateInput passed a full ISO instant straight through.
//
//   node tests/date-only-hotfix.test.js --tz UTC
const tzArg = process.argv.indexOf('--tz');
if (tzArg !== -1 && process.argv[tzArg + 1]) process.env.TZ = process.argv[tzArg + 1];

const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const {
  parseDateInput, validateDateOnly, validateDateOnlyFields, validatePaymentRows,
  MIN_YEAR, MAX_YEAR
} = require('../utils/date-only');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };
const t = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };

const SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
const oid = () => new mongoose.Types.ObjectId();
const serverTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log(`date-only hotfix tests — server TZ = ${serverTz}`);

// The four shapes the client specified, plus the instant that proves the Toronto-day rule.
const NOV17 = '2026-11-17T12:00:00.000Z';
const SHAPES = [
  ['bare date-only', '2026-11-17'],
  ['ISO with Z', '2026-11-17T00:00:00Z'],
  ['ISO with +00:00', '2026-11-17T00:00:00.000+00:00'],
  ['ISO with +05:30', '2026-11-17T00:00:00+05:30'],
  ['Date at UTC midnight', new Date('2026-11-17T00:00:00Z')]
];

// ---------------------------------------------------------------- unit: the normaliser --------

console.log('\nparseDateInput — the five input shapes');

for (const [label, input] of SHAPES) {
  t(`${label} -> 2026-11-17T12:00Z`, () => {
    assert.strictEqual(parseDateInput(input).toISOString(), NOV17);
  });
}

t('an existing noon value is unchanged', () => {
  assert.strictEqual(parseDateInput(new Date(NOV17)).toISOString(), NOV17);
  assert.strictEqual(parseDateInput(NOV17).toISOString(), NOV17);
});

t('a real instant takes TORONTO\'s calendar day, not UTC\'s', () => {
  // 2026-11-18T00:30Z is 2026-11-17 19:30 in Toronto (EST, UTC-5). The UTC day would be the 18th
  // -- a day late, and invisible afterwards because noon on the 18th looks perfectly well formed.
  assert.strictEqual(parseDateInput('2026-11-18T00:30:00Z').toISOString(), NOV17);
  assert.strictEqual(parseDateInput(new Date('2026-11-18T00:30:00Z')).toISOString(), NOV17);
});

t('the same instant on the other side of the boundary stays on its own day', () => {
  // 18:30Z on the 17th is 13:30 Toronto, same day in both zones. A control for the test above.
  assert.strictEqual(parseDateInput('2026-11-17T18:30:00Z').toISOString(), NOV17);
});

t('a midnight with no offset at all is still resolved, not dropped', () => {
  // No stated offset means the server's zone decides the instant, so the resulting day depends on
  // where this runs -- which is exactly why nothing in the app sends this shape. It must still
  // land on noon of SOME day rather than storing a raw midnight.
  const d = parseDateInput('2026-11-17T00:00:00');
  assert.strictEqual(d.getUTCHours(), 12);
  assert.strictEqual(d.getUTCMinutes(), 0);
});

t('missing and unparseable input returns null, so a caller can reject', () => {
  for (const v of [undefined, null, '', 'not a date', new Date('nope')]) {
    assert.strictEqual(parseDateInput(v), null, String(v));
  }
});

console.log('\nvalidateDateOnly — the year guard');

t(`year ${MIN_YEAR}-${MAX_YEAR} accepted at both ends`, () => {
  assert.strictEqual(validateDateOnly(`${MIN_YEAR}-01-01`, 'travelDate'), null);
  assert.strictEqual(validateDateOnly(`${MAX_YEAR}-12-31`, 'travelDate'), null);
});

t('1927 rejected (CBXCAA stores travelDate 1927-02-22 on live)', () => {
  const msg = validateDateOnly('1927-02-22', 'travelDate');
  assert.ok(msg && msg.includes('1927'), msg);
});

t('22026 rejected (the typo that aborted the migration updateMany)', () => {
  const msg = validateDateOnly('22026-11-17', 'travelDate');
  assert.ok(msg, 'must be rejected');
});

t('an absent field is not a year error', () => {
  assert.strictEqual(validateDateOnly(undefined, 'returnDate'), null);
  assert.strictEqual(validateDateOnly('', 'returnDate'), null);
});

t('validateDateOnlyFields names the first offending field', () => {
  const msg = validateDateOnlyFields({ travelDate: '2026-11-17', returnDate: '1927-01-01' });
  assert.ok(msg.startsWith('returnDate'), msg);
  assert.strictEqual(validateDateOnlyFields({ travelDate: '2026-11-17' }), null);
});

console.log('\nvalidatePaymentRows — no invented dates, no broken legacy rows');

t('a new row with no date is rejected, not stamped with now', () => {
  const r = validatePaymentRows([{ paidAmount: 200, paymentMode: 'Cash' }], []);
  assert.ok(r.error && r.error.includes('payments[0].paymentDate'), r.error);
  assert.strictEqual(r.payments, undefined);
});

t('a new row with a date is accepted and normalised', () => {
  const r = validatePaymentRows([{ paidAmount: 200, paymentMode: 'Cash', paymentDate: '2026-11-17' }], []);
  assert.strictEqual(r.error, undefined);
  assert.strictEqual(r.payments[0].paymentDate.toISOString(), NOV17);
});

t('an UNCHANGED stored row with no incoming date keeps its own date', () => {
  const stored = [{ paidAmount: 200, paymentMode: 'Cheque', referenceNo: 'R1', paymentDate: new Date(NOV17) }];
  const r = validatePaymentRows([{ paidAmount: 200, paymentMode: 'Cheque', referenceNo: 'R1' }], stored);
  assert.strictEqual(r.error, undefined, r.error);
  assert.strictEqual(r.payments[0].paymentDate.toISOString(), NOV17);
});

t('re-saving a legacy 00:00Z row HEALS it to noon', () => {
  const stored = [{ paidAmount: 200, paymentMode: 'Cash', referenceNo: '', paymentDate: new Date('2026-11-17T00:00:00Z') }];
  const r = validatePaymentRows([{ paidAmount: 200, paymentMode: 'Cash', referenceNo: '' }], stored);
  assert.strictEqual(r.payments[0].paymentDate.toISOString(), NOV17);
});

t('a stored row with NO date at all still saves when untouched', () => {
  // Expected count on the copy is 0 -- paymentDate is `required` -- but a row that predates the
  // constraint must not be what blocks an edit, a cancellation or a verification.
  const stored = [{ paidAmount: 200, paymentMode: 'Cash', referenceNo: '' }];
  const r = validatePaymentRows([{ paidAmount: 200, paymentMode: 'Cash', referenceNo: '' }], stored);
  assert.strictEqual(r.error, undefined, r.error);
  assert.strictEqual(r.payments[0].paymentDate, null);
});

t('a CHANGED row cannot borrow an unrelated stored date', () => {
  const stored = [{ paidAmount: 200, paymentMode: 'Cash', referenceNo: '', paymentDate: new Date(NOV17) }];
  // The amount changed, so this is not the same row: it must bring its own date.
  const r = validatePaymentRows([{ paidAmount: 500, paymentMode: 'Cash', referenceNo: '' }], stored);
  assert.ok(r.error && r.error.includes('payments[0]'), r.error);
});

t('two identical stored rows are consumed once each, not reused', () => {
  const stored = [
    { paidAmount: 100, paymentMode: 'Cash', referenceNo: '', paymentDate: new Date(NOV17) },
    { paidAmount: 100, paymentMode: 'Cash', referenceNo: '', paymentDate: new Date(NOV17) }
  ];
  const two = validatePaymentRows([
    { paidAmount: 100, paymentMode: 'Cash', referenceNo: '' },
    { paidAmount: 100, paymentMode: 'Cash', referenceNo: '' }
  ], stored);
  assert.strictEqual(two.error, undefined, two.error);
  const three = validatePaymentRows([
    { paidAmount: 100, paymentMode: 'Cash', referenceNo: '' },
    { paidAmount: 100, paymentMode: 'Cash', referenceNo: '' },
    { paidAmount: 100, paymentMode: 'Cash', referenceNo: '' }
  ], stored);
  assert.ok(three.error, 'the third row is new and has no date');
});

t('a new row with a bad year is rejected by the same call', () => {
  const r = validatePaymentRows([{ paidAmount: 1, paymentMode: 'Cash', paymentDate: '1927-02-22' }], []);
  assert.ok(r.error && r.error.includes('1927'), r.error);
});

// ---------------------------------------------------------------- routes, every role ----------

const ROLES = ['AGENT1', 'AGENT2', 'ACCOUNT', 'ADMIN'];

function newBooking(over = {}) {
  return new Booking(Object.assign({
    pnr: 'TEST01', paxName: 'X', contactNumber: '+1 5550000', sectorType: 'One Way',
    travelDate: new Date('2026-10-01T12:00:00Z'), from: 'YYZ', to: 'DEL',
    submittedBy: oid(), submittedByName: 'Agent One',
    status: 'Pending Verification', salePrice: 1000, ourCost: 900
  }, over));
}

// Mounts the real bookings router with findById/save/create stubbed: no database, but the route
// code, its authorize() guard, its validators and its save() path all run for real.
async function startBookings(doc, role) {
  const user = { _id: oid(), role, isActive: true, name: role };
  User.findById = () => ({ select: () => Promise.resolve(user) });
  User.findOne = () => ({ select: () => Promise.resolve(user) });

  const saved = [];
  if (doc) {
    doc.save = async function () { saved.push(this.toObject()); return this; };
    const chain = { populate: () => chain, then: (res, rej) => Promise.resolve(doc).then(res, rej) };
    Booking.findById = () => chain;
  }
  // POST / does `new Booking({...})` then `.save()`, so the stub has to be on the prototype.
  const created = [];
  Booking.prototype.save = async function () {
    if (doc && this === doc) { saved.push(this.toObject()); return this; }
    created.push(this);
    return this;
  };
  // POST / awaits findOne directly for the PNR-uniqueness check, so this has to be thenable AND
  // chainable for any other caller.
  const noneChain = {
    sort: () => noneChain, lean: async () => null, select: () => noneChain,
    then: (res, rej) => Promise.resolve(null).then(res, rej)
  };
  Booking.findOne = () => noneChain;
  Booking.countDocuments = async () => 0;

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.id = 'test'; next(); });
  app.use('/api/bookings', require('../routes/bookings'));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const token = jwt.sign({ userId: String(user._id), role }, SECRET);
  const base = `http://127.0.0.1:${server.address().port}/api/bookings`;
  const call = async (method, path, body) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return {
    put: (p, b) => call('PUT', p, b),
    post: (p, b) => call('POST', p, b),
    saved, created,
    close: () => server.close()
  };
}

const paymentRow = (paymentDate) => ({ paidAmount: 200, paymentMode: 'Cash', paymentDate, referenceNo: '' });

(async () => {

  // ---- PUT /:id — all four roles, all five shapes. This is where the ADMIN hole (#12) was. ----
  console.log('\nPUT /bookings/:id — payments[].paymentDate, every role x every shape');
  for (const role of ROLES) {
    for (const [label, input] of SHAPES) {
      const doc = newBooking();
      const api = await startBookings(doc, role);
      const res = await api.put(`/${doc._id}`, { payments: [paymentRow(input)] });
      assert.strictEqual(res.status, 200, `${role} / ${label}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(
        doc.payments[0].paymentDate.toISOString(), NOV17,
        `${role} / ${label} stored ${doc.payments[0].paymentDate.toISOString()}`
      );
      api.close();
    }
    ok(`PUT as ${role}: all five shapes store 2026-11-17T12:00Z`);
  }

  console.log('\nPUT /bookings/:id — the ADMIN branch specifically (Finding 1 / sweep #12)');
  {
    const doc = newBooking();
    const api = await startBookings(doc, 'ADMIN');
    // The exact payload a stale tab sends: a Date serialised by toISOString().
    await api.put(`/${doc._id}`, { payments: [paymentRow('2026-11-17T00:00:00.000Z')] });
    assert.strictEqual(doc.payments[0].paymentDate.getUTCHours(), 12,
      'ADMIN branch no longer assigns payments raw');
    ok('ADMIN PUT normalises payments instead of bypassing the normaliser');
    api.close();
  }

  console.log('\nPUT /bookings/:id — a malformed non-array payments leaves stored rows alone');
  for (const role of ROLES) {
    const doc = newBooking({
      payments: [{ paidAmount: 200, paymentMode: 'Cash', referenceNo: '', paymentDate: new Date(NOV17) }]
    });
    const api = await startBookings(doc, role);
    const res = await api.put(`/${doc._id}`, { payments: 'nonsense' });
    assert.strictEqual(res.status, 200, `${role}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(doc.payments.length, 1, `${role}: stored rows must survive`);
    assert.strictEqual(doc.payments[0].paymentDate.toISOString(), NOV17);
    api.close();
    ok(`PUT as ${role}: a non-array payments value does not wipe the stored rows`);
  }

  console.log('\nPUT /bookings/:id — travelDate and returnDate, every role x every shape');
  for (const role of ROLES) {
    for (const [label, input] of SHAPES) {
      const doc = newBooking({ returnDate: new Date('2026-10-05T12:00:00Z') });
      const api = await startBookings(doc, role);
      const res = await api.put(`/${doc._id}`, { travelDate: input, returnDate: input });
      assert.strictEqual(res.status, 200, `${role} / ${label}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(doc.travelDate.toISOString(), NOV17, `${role} / ${label} travelDate`);
      assert.strictEqual(doc.returnDate.toISOString(), NOV17, `${role} / ${label} returnDate`);
      api.close();
    }
    ok(`PUT as ${role}: travelDate and returnDate normalise on all five shapes`);
  }

  console.log('\nPUT /bookings/:id — multipleSectors[].travelDate');
  for (const role of ROLES) {
    const doc = newBooking({ sectorType: 'Multiple' });
    const api = await startBookings(doc, role);
    const res = await api.put(`/${doc._id}`, {
      multipleSectors: [{ from: 'YYZ', to: 'DEL', travelDate: '2026-11-17T00:00:00Z' }]
    });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(doc.multipleSectors[0].travelDate.toISOString(), NOV17);
    api.close();
    ok(`PUT as ${role}: multipleSectors[].travelDate normalises`);
  }

  console.log('\nPUT /bookings/:id — blank-date NEW payment is rejected with 400');
  for (const role of ROLES) {
    const doc = newBooking();
    const api = await startBookings(doc, role);
    const res = await api.put(`/${doc._id}`, { payments: [{ paidAmount: 200, paymentMode: 'Cash' }] });
    assert.strictEqual(res.status, 400, `${role}: expected 400, got ${res.status}`);
    assert.ok(/paymentDate/.test(res.body.message), res.body.message);
    assert.strictEqual(api.saved.length, 0, 'nothing saved on a rejected request');
    api.close();
    ok(`PUT as ${role}: blank-date new payment -> 400, nothing saved`);
  }

  console.log('\nPUT /bookings/:id — a legacy row left untouched still saves');
  for (const role of ROLES) {
    const doc = newBooking({
      payments: [{ paidAmount: 200, paymentMode: 'Cheque', referenceNo: 'R1', paymentDate: new Date('2026-11-17T00:00:00Z') }]
    });
    const api = await startBookings(doc, role);
    // Same row, no date sent, and a legacy payment mode that is not in any dropdown.
    const res = await api.put(`/${doc._id}`, {
      salePrice: 1100,
      payments: [{ paidAmount: 200, paymentMode: 'Cheque', referenceNo: 'R1' }]
    });
    assert.strictEqual(res.status, 200, `${role}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(doc.payments[0].paymentMode, 'Cheque', 'legacy mode survives');
    assert.strictEqual(doc.payments[0].paymentDate.toISOString(), NOV17, 'and is healed to noon');
    api.close();
    ok(`PUT as ${role}: legacy Cheque row saves, and its 00:00Z date heals to noon`);
  }

  console.log('\nPUT /bookings/:id — the year guard, every role');
  for (const role of ROLES) {
    for (const bad of ['1927-02-22', '22026-11-17']) {
      const doc = newBooking();
      const api = await startBookings(doc, role);
      const res = await api.put(`/${doc._id}`, { travelDate: bad });
      assert.strictEqual(res.status, 400, `${role} / ${bad}: got ${res.status}`);
      assert.strictEqual(api.saved.length, 0, 'nothing saved');
      api.close();
    }
    ok(`PUT as ${role}: years 1927 and 22026 rejected with 400`);
  }

  console.log('\nPUT /bookings/:id — a stored bad year does NOT block an unrelated edit');
  for (const role of ROLES) {
    const doc = newBooking({ travelDate: new Date('1927-02-22T12:00:00Z') });
    const api = await startBookings(doc, role);
    const res = await api.put(`/${doc._id}`, { salePrice: 1234 });
    assert.strictEqual(res.status, 200, `${role}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(doc.salePrice, 1234);
    api.close();
    ok(`PUT as ${role}: a legacy 1927 travelDate still saves when not being changed`);
  }

  // ---- POST / — create ----
  console.log('\nPOST /bookings — create, every role x every shape');
  const createBody = (over) => Object.assign({
    paxName: 'X', contactNumber: '+1 5550000', pnr: 'NEW01', sectorType: 'One Way',
    travelDate: '2026-11-17', from: 'YYZ', to: 'DEL',
    ourCost: 900, salePrice: 1000, paymentType: 'Full'
  }, over);

  for (const role of ROLES) {
    for (const [label, input] of SHAPES) {
      const api = await startBookings(null, role);
      const res = await api.post('/', createBody({ travelDate: input, payments: [paymentRow(input)] }));
      assert.strictEqual(res.status, 201, `${role} / ${label}: ${res.status} ${JSON.stringify(res.body)}`);
      const d = api.created[api.created.length - 1];
      assert.strictEqual(d.travelDate.toISOString(), NOV17, `${role} / ${label} travelDate`);
      assert.strictEqual(d.payments[0].paymentDate.toISOString(), NOV17, `${role} / ${label} paymentDate`);
      api.close();
    }
    ok(`POST as ${role}: travelDate and paymentDate normalise on all five shapes`);
  }

  console.log('\nPOST /bookings — blank-date payment and bad years rejected');
  for (const role of ROLES) {
    {
      const api = await startBookings(null, role);
      const res = await api.post('/', createBody({ payments: [{ paidAmount: 200, paymentMode: 'Cash' }] }));
      assert.strictEqual(res.status, 400, `${role}: got ${res.status}`);
      assert.ok(/paymentDate/.test(res.body.message), res.body.message);
      assert.strictEqual(api.created.length, 0, 'nothing created');
      api.close();
    }
    {
      const api = await startBookings(null, role);
      const res = await api.post('/', createBody({ travelDate: '22026-11-17' }));
      assert.strictEqual(res.status, 400, `${role}: got ${res.status}`);
      api.close();
    }
    ok(`POST as ${role}: blank-date payment -> 400, year 22026 -> 400`);
  }

  // ---- date-change / flight-change ----
  console.log('\nPOST /bookings/:id/date-change — every role x every shape');
  for (const role of ROLES) {
    for (const [label, input] of SHAPES) {
      const doc = newBooking({ returnDate: new Date('2026-10-05T12:00:00Z') });
      const api = await startBookings(doc, role);
      const res = await api.post(`/${doc._id}/date-change`, {
        changeTravelDate: true, newTravelDate: input,
        payments: [paymentRow(input)], remarks: 'test'
      });
      assert.strictEqual(res.status, 200, `${role} / ${label}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(doc.travelDate.toISOString(), NOV17, `${role} / ${label} travelDate`);
      const last = doc.payments[doc.payments.length - 1];
      assert.strictEqual(last.paymentDate.toISOString(), NOV17, `${role} / ${label} appended payment`);
      const ch = doc.dateChanges[doc.dateChanges.length - 1];
      assert.strictEqual(ch.newTravelDate.toISOString(), NOV17, `${role} / ${label} dateChanges entry`);
      api.close();
    }
    ok(`date-change as ${role}: travelDate, the dateChanges entry and the appended payment all normalise`);
  }

  console.log('\nPOST /bookings/:id/date-change — rejections');
  for (const role of ROLES) {
    {
      const doc = newBooking();
      const api = await startBookings(doc, role);
      const res = await api.post(`/${doc._id}/date-change`, {
        changeTravelDate: true, newTravelDate: '2026-11-17',
        payments: [{ paidAmount: 200, paymentMode: 'Cash' }], remarks: 'test'
      });
      assert.strictEqual(res.status, 400, `${role}: got ${res.status}`);
      assert.strictEqual(api.saved.length, 0, 'nothing saved');
      api.close();
    }
    {
      const doc = newBooking();
      const api = await startBookings(doc, role);
      const res = await api.post(`/${doc._id}/date-change`, {
        changeTravelDate: true, newTravelDate: '1927-02-22', remarks: 'test'
      });
      assert.strictEqual(res.status, 400, `${role}: got ${res.status}`);
      api.close();
    }
    ok(`date-change as ${role}: dateless appended payment -> 400, year 1927 -> 400`);
  }

  console.log('\nPOST /bookings/:id/flight-change — every role x every shape');
  for (const role of ROLES) {
    for (const [label, input] of SHAPES) {
      const doc = newBooking();
      const api = await startBookings(doc, role);
      const res = await api.post(`/${doc._id}/flight-change`, {
        newDetails: { airline: 'AC', from: 'YYZ', to: 'DEL', travelDate: input },
        payments: [paymentRow(input)], remarks: 'test'
      });
      assert.strictEqual(res.status, 200, `${role} / ${label}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(doc.travelDate.toISOString(), NOV17, `${role} / ${label} travelDate`);
      const last = doc.payments[doc.payments.length - 1];
      assert.strictEqual(last.paymentDate.toISOString(), NOV17, `${role} / ${label} appended payment`);
      api.close();
    }
    ok(`flight-change as ${role}: newDetails.travelDate and the appended payment normalise`);
  }

  console.log('\nPOST /bookings/:id/flight-change — rejections');
  for (const role of ROLES) {
    const doc = newBooking();
    const api = await startBookings(doc, role);
    const res = await api.post(`/${doc._id}/flight-change`, {
      newDetails: { travelDate: '22026-11-17' }, remarks: 'test'
    });
    assert.strictEqual(res.status, 400, `${role}: got ${res.status}`);
    api.close();
    ok(`flight-change as ${role}: year 22026 -> 400`);
  }

  // ---- the two cancellation date routes ----
  const cancelled = () => newBooking({
    status: 'Cancelled',
    cancellation: { isCancelled: true }
  });

  console.log('\nPUT /bookings/:id/upfront-collection — collectionDate');
  for (const role of ROLES) {
    for (const [label, input] of SHAPES) {
      const doc = cancelled();
      const api = await startBookings(doc, role);
      const res = await api.put(`/${doc._id}/upfront-collection`, {
        amountCollected: 100, collectionDate: input, paymentMode: 'Cash'
      });
      assert.strictEqual(res.status, 200, `${role} / ${label}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(
        doc.cancellation.upfrontCollection.collectionDate.toISOString(), NOV17,
        `${role} / ${label}`
      );
      api.close();
    }
    ok(`upfront-collection as ${role}: collectionDate normalises on all five shapes`);
  }

  console.log('\nPUT /bookings/:id/refund-status — the two refund dates');
  for (const role of ['ACCOUNT', 'ADMIN']) {
    for (const [label, input] of SHAPES) {
      const doc = cancelled();
      const api = await startBookings(doc, role);
      const res = await api.put(`/${doc._id}/refund-status`, {
        refundReceivedFromSupplier: { date: input },
        refundPaidToClient: { date: input }
      });
      assert.strictEqual(res.status, 200, `${role} / ${label}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(doc.cancellation.refundReceivedFromSupplier.date.toISOString(), NOV17);
      assert.strictEqual(doc.cancellation.refundPaidToClient.date.toISOString(), NOV17);
      api.close();
    }
    ok(`refund-status as ${role}: both refund dates normalise on all five shapes`);
  }

  console.log('\nPUT /bookings/:id/upfront-collection and /refund-status — year guard');
  for (const role of ['ACCOUNT', 'ADMIN']) {
    {
      const doc = cancelled();
      const api = await startBookings(doc, role);
      const res = await api.put(`/${doc._id}/upfront-collection`, { amountCollected: 1, collectionDate: '1927-02-22' });
      assert.strictEqual(res.status, 400, `${role}: got ${res.status}`);
      api.close();
    }
    {
      const doc = cancelled();
      const api = await startBookings(doc, role);
      const res = await api.put(`/${doc._id}/refund-status`, { refundPaidToClient: { date: '22026-01-01' } });
      assert.strictEqual(res.status, 400, `${role}: got ${res.status}`);
      api.close();
    }
    ok(`cancellation date routes as ${role}: bad years rejected`);
  }

  // ---- timestamps must be untouched ----
  console.log('\ntimestamps are NOT date-only and must keep their time of day');
  {
    const doc = newBooking();
    const api = await startBookings(doc, 'ADMIN');
    await api.post(`/${doc._id}/verify-admin`, {});
    const stamp = doc.verifiedByAdminDate;
    assert.ok(stamp instanceof Date);
    assert.ok(stamp.getUTCHours() !== 12 || stamp.getUTCMinutes() !== 0 || stamp.getUTCSeconds() !== 0,
      'a verification stamp must be an instant, not noon UTC');
    api.close();
    ok('verifiedByAdminDate stays an instant, not a noon date-only value');
  }
  {
    const doc = newBooking();
    const api = await startBookings(doc, 'ADMIN');
    await api.post(`/${doc._id}/date-change`, {
      changeTravelDate: true, newTravelDate: '2026-11-17', remarks: 'test'
    });
    const ch = doc.dateChanges[doc.dateChanges.length - 1];
    assert.ok(ch.changedAt instanceof Date);
    assert.ok(ch.changedAt.getUTCHours() !== 12 || ch.changedAt.getUTCMinutes() !== 0,
      'changedAt must be an instant');
    api.close();
    ok('dateChanges[].changedAt stays an instant while newTravelDate goes to noon');
  }

  // ---- supplier payments: the date that decides opening balance vs period ----
  console.log('\nPOST /api/supplier-payments — paymentDate');
  {
    const Supplier = require('../models/Supplier');
    const SupplierPayment = require('../models/SupplierPayment');
    Supplier.exists = async () => true;
    const made = [];
    SupplierPayment.create = async (payload) => { made.push(payload); return { ...payload, _id: oid() }; };
    // The route echoes the stored row back through findById().populate().
    SupplierPayment.findById = () => {
      const row = made[made.length - 1] || {};
      const chain = { populate: () => chain, then: (res, rej) => Promise.resolve(row).then(res, rej) };
      return chain;
    };

    const user = { _id: oid(), role: 'ACCOUNT', isActive: true, name: 'ACCOUNT' };
    User.findById = () => ({ select: () => Promise.resolve(user) });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.id = 'test'; next(); });
    app.use('/api/supplier-payments', require('../routes/supplier-payments'));
    const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
    const token = jwt.sign({ userId: String(user._id), role: 'ACCOUNT' }, SECRET);
    const call = async (body) => {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/supplier-payments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    };
    const base = { supplier: String(oid()), amount: 100 };

    for (const [label, input] of SHAPES) {
      made.length = 0;
      const res = await call({ ...base, paymentDate: input });
      assert.strictEqual(res.status, 201, `${label}: ${res.status} ${JSON.stringify(res.body)}`);
      assert.strictEqual(made[0].paymentDate.toISOString(), NOV17, label);
    }
    ok('all five shapes store 2026-11-17T12:00Z');

    for (const bad of ['1927-02-22', '22026-11-17']) {
      made.length = 0;
      const res = await call({ ...base, paymentDate: bad });
      assert.strictEqual(res.status, 400, `${bad}: got ${res.status}`);
      assert.ok(/paymentDate/.test(res.body.message), res.body.message);
      assert.strictEqual(made.length, 0, 'nothing created');
    }
    ok('years 1927 and 22026 rejected with 400, nothing created');

    {
      const res = await call({ ...base, paymentDate: '2026-11-18T00:30:00Z' });
      assert.strictEqual(res.status, 201, JSON.stringify(res.body));
      assert.strictEqual(made[made.length - 1].paymentDate.toISOString(), NOV17);
    }
    ok('an instant at 00:30Z is recorded on Toronto\'s day, not UTC\'s');

    server.close();
  }

  console.log(`\n${passed} assertions passed (server TZ ${serverTz})`);
  process.exit(0);
})().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
