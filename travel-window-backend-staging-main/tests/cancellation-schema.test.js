'use strict';
// cancellationMode, airlineRefundAmount and airlineDeducted were written by the cancel route but
// absent from the schema, so Mongoose dropped them on every save. These tests pin down that they
// now persist, and that recalculation behaviour for OLD bookings (which have no cancellationMode)
// is unchanged.
//
//   node tests/cancellation-schema.test.js

const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
const oid = () => new mongoose.Types.ObjectId();

const FIELDS = ['cancellationMode', 'airlineRefundAmount', 'airlineDeducted'];

function newBooking(over = {}) {
  return new Booking(Object.assign({
    pnr: 'CANC01', paxName: 'X', contactNumber: '+1 5550000', sectorType: 'One Way',
    travelDate: new Date('2026-10-01T12:00:00Z'), from: 'YYZ', to: 'DEL',
    submittedBy: oid(), submittedByName: 'Agent One',
    status: 'Ticketed', salePrice: 1000, ourCost: 800,
    supplierBookingCharge: 25, supplierUpdationCharge: 0, supplierCharges: 25,
    totalPaidAmount: 1000, billingStatus: 'Fully Paid',
    payments: [{ paidAmount: 1000, paymentMode: 'Cash', paymentDate: new Date('2026-09-01T12:00:00Z') }]
  }, over));
}

console.log('the schema holds the three fields');

{
  const b = newBooking();
  for (const f of FIELDS) {
    assert.ok(Booking.schema.path(`cancellation.${f}`),
      `cancellation.${f} must be a declared schema path, or Mongoose drops it on save`);
  }
  ok('all three are declared schema paths');
}

{
  const b = newBooking();
  b.cancellation = {
    isCancelled: true, cancellationMode: 'charges',
    airlineCancellationCharges: 150, airlineRefundAmount: 0, airlineDeducted: 150
  };
  const out = b.toObject().cancellation;
  assert.strictEqual(out.cancellationMode, 'charges');
  assert.strictEqual(out.airlineDeducted, 150);
  ok('a charges-mode cancellation survives the document round-trip');
}

{
  const b = newBooking();
  b.cancellation = {
    isCancelled: true, cancellationMode: 'refundAmount',
    airlineCancellationCharges: 0, airlineRefundAmount: 650, airlineDeducted: 150
  };
  const out = b.toObject().cancellation;
  assert.strictEqual(out.cancellationMode, 'refundAmount');
  assert.strictEqual(out.airlineRefundAmount, 650);
  ok('a refundAmount-mode cancellation survives the document round-trip');
}

{
  const b = newBooking();
  b.cancellation = { isCancelled: true, cancellationMode: 'nonsense' };
  const err = b.validateSync();
  assert.ok(err && err.errors['cancellation.cancellationMode'],
    'cancellationMode must reject a value outside the enum');
  ok('cancellationMode rejects anything but charges / refundAmount');
}

{
  const b = newBooking();
  b.cancellation = { isCancelled: true };
  assert.strictEqual(b.validateSync(), undefined, 'a cancellation with no mode is still valid');
  assert.strictEqual(b.cancellation.cancellationMode, undefined,
    'no default: a legacy booking must not acquire a mode it never had');
  ok('cancellationMode has no default, so legacy rows keep reading as before');
}

// Mounts the real bookings router with findById/save stubbed. No database, but the route code,
// the engine call and the save path all run for real.
async function startBookings(doc, role = 'ADMIN') {
  const user = { _id: oid(), role, isActive: true, name: role };
  User.findById = () => ({ select: () => Promise.resolve(user) });
  const saved = [];
  doc.save = async function () {
    const err = this.validateSync();
    if (err) throw err;
    saved.push(JSON.parse(JSON.stringify(this.toObject())));
    return this;
  };
  const chain = { populate: () => chain, then: (res, rej) => Promise.resolve(doc).then(res, rej) };
  Booking.findById = () => chain;

  const app = express();
  app.use(express.json());
  app.use('/api/bookings', require('../routes/bookings'));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const token = jwt.sign({ userId: String(user._id), role }, SECRET);
  const base = `http://127.0.0.1:${server.address().port}/api/bookings`;
  return {
    post: async (path, body = {}) => {
      const res = await fetch(`${base}/${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    saved,
    close: () => server.close()
  };
}

(async () => {
  console.log('\nPOST /bookings/:id/cancel persists them');

  {
    const doc = newBooking();
    const api = await startBookings(doc);
    const res = await api.post(`${doc._id}/cancel`, {
      paymentModeWas: 'Cash', cancellationMode: 'charges',
      airlineCancellationCharges: 150, newMargin: 0, remarks: 'test'
    });
    assert.strictEqual(res.status, 200, `cancel responded ${res.status}`);
    const c = api.saved[api.saved.length - 1].cancellation;
    assert.strictEqual(c.cancellationMode, 'charges', 'mode reached the saved document');
    ok('a charges-mode cancellation stores cancellationMode');
    assert.strictEqual(c.airlineRefundAmount, 0);
    assert.strictEqual(typeof c.airlineDeducted, 'number');
    ok('airlineRefundAmount and airlineDeducted reach the saved document');
    api.close();
  }

  {
    const doc = newBooking();
    const api = await startBookings(doc);
    const res = await api.post(`${doc._id}/cancel`, {
      paymentModeWas: 'Cash', cancellationMode: 'refundAmount',
      airlineRefundAmount: 650, newMargin: 0, remarks: 'test'
    });
    assert.strictEqual(res.status, 200);
    const c = api.saved[api.saved.length - 1].cancellation;
    assert.strictEqual(c.cancellationMode, 'refundAmount');
    assert.strictEqual(c.airlineRefundAmount, 650, 'the refund the airline gave is now recorded');
    ok('a refundAmount-mode cancellation stores the refund amount it was given');
    api.close();
  }

  console.log('\nrecalculation reproduces the original decision instead of inventing one');

  {
    // Cancel in charges mode, then recalculate. Before this commit the mode was lost, so the
    // recalculation fell into refundAmount mode with a refund of 0 — a different scenario family.
    const doc = newBooking();
    const api = await startBookings(doc);
    await api.post(`${doc._id}/cancel`, {
      paymentModeWas: 'Cash', cancellationMode: 'charges',
      airlineCancellationCharges: 150, newMargin: 0, remarks: 'test'
    });
    const afterCancel = { ...api.saved[api.saved.length - 1].cancellation };

    const res = await api.post(`${doc._id}/recalculate-cancellation`);
    assert.strictEqual(res.status, 200, `recalculate responded ${res.status}`);
    const afterRecalc = api.saved[api.saved.length - 1].cancellation;

    for (const k of ['currentMargin', 'totalCharges', 'supplierWillReturn', 'refundCommittedToClient', 'totalSupplierTook']) {
      assert.strictEqual(afterRecalc[k], afterCancel[k],
        `${k} changed on recalculation: ${afterCancel[k]} -> ${afterRecalc[k]}`);
    }
    ok('recalculating a charges-mode cancellation is now a no-op, not a rewrite');
    assert.strictEqual(afterRecalc.cancellationMode, 'charges', 'mode survives recalculation too');
    ok('cancellationMode survives recalculation');
    api.close();
  }

  console.log('\nOLD bookings: recalculation behaviour is unchanged');

  {
    // A pre-fix stored cancellation: no cancellationMode, no airlineRefundAmount. This is the
    // shape of all 26 cancelled bookings in the staging copy. Recalculation must behave exactly
    // as it does today — refundAmount mode with a refund of 0 — because changing it would rewrite
    // figures that were correct when they were stored.
    const doc = newBooking({ status: 'Cancelled' });
    doc.cancellation = {
      isCancelled: true, paymentModeWas: 'Cash',
      airlineCancellationCharges: 0, oldMargin: 175, newMargin: 0, currentMargin: 175,
      totalSupplierTook: 25, totalCharges: 200, supplierWillReturn: 775,
      refundCommittedToClient: 800, totalAmountPaid: 1000
    };
    assert.strictEqual(doc.cancellation.cancellationMode, undefined,
      'a legacy row has no mode, and must not be given one');

    const api = await startBookings(doc);
    const res = await api.post(`${doc._id}/recalculate-cancellation`);
    assert.strictEqual(res.status, 200);
    const after = api.saved[api.saved.length - 1].cancellation;

    // The engine ran in refundAmount mode with ara = 0, exactly as before this commit.
    const { calculateCancellationScenario } = require('../utils/cancellation-engine');
    const expected = calculateCancellationScenario({
      baseSalePrice: 1000, baseOurCost: 800, paidAmount: 1000,
      supplierBookingCharge: 25, supplierUpdationCharge: 0, autoSupplierCancellationCharge: 0,
      isChargesMode: false, airlineCancellationCharges: 0, airlineRefundAmount: 0,
      newMarginInput: 0, isPartialPaid: false, isClientCard: false, isCompanyCard: false,
      isMachineCharge: false
    });
    assert.strictEqual(after.currentMargin, expected.currentMargin);
    assert.strictEqual(after.supplierWillReturn, expected.supplierWillReturn);
    assert.strictEqual(after.totalCharges, expected.totalCharges);
    ok('a legacy cancellation still recalculates in refundAmount mode with refund 0, as before');
    assert.strictEqual(after.cancellationMode, undefined,
      'recalculation must not invent a mode for a legacy row');
    ok('recalculation does not invent a cancellationMode for a legacy row');
    api.close();
  }

  console.log(`\n${passed} assertions passed`);
  console.log('\nNo recalculation was run against any stored booking.');
})().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
