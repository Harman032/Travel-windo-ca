'use strict';
// Run: node tests/payment-modes.test.js
// Bookings holding legacy payment modes (Cheque, Bank Transfer) must stay savable through every route,
// SkyLight (offered in the new-booking form) must be accepted, and unknown values must still be rejected.
// Real routes, in-memory bookings, saves replaced by validation-only (no database).
const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');

const oid = () => new mongoose.Types.ObjectId();
const admin = { _id: oid(), role: 'ADMIN', isActive: true, name: 'Admin' };
const store = new Map();

function raw(overrides = {}) {
  return Object.assign({
    _id: oid(), pnr: 'T' + Math.random().toString(36).slice(2, 7).toUpperCase(), paxName: 'PAX', contactNumber: '1',
    sectorType: 'One Way', travelDate: new Date('2030-06-01T12:00:00Z'), from: 'A', to: 'B',
    submittedBy: oid(), submittedByName: 'Creator', status: 'Pending Verification',
    salePrice: 100, ourCost: 50, totalSalePrice: 100, totalPaidAmount: 100, balanceAmount: 0, billingStatus: 'Fully Paid',
    payments: [{ paidAmount: 100, paymentMode: 'Cash', paymentDate: new Date('2026-01-01T00:00:00Z'), referenceNo: '' }]
  }, overrides);
}
const withMode = mode => raw({ payments: [{ paidAmount: 100, paymentMode: mode, paymentDate: new Date('2026-01-01T00:00:00Z'), referenceNo: '' }] });

// Document stand-ins: findById returns a hydrated doc (as loaded from Mongo), findOne finds nothing.
const thenable = v => { const c = { populate: () => c, select: () => c, then: (r, j) => Promise.resolve(v).then(r, j) }; return c; };
Booking.findById = id => thenable(store.has(String(id)) ? Booking.hydrate(store.get(String(id))) : {});
Booking.findOne = () => thenable(null);
mongoose.Model.prototype.save = function () { return this.validate().then(() => this); }; // same validation as save(), no write
User.findById = () => ({ select: () => Promise.resolve(admin) });

let passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { console.error(`FAIL: ${name}\n  ${e.message}`); process.exitCode = 1; }
}

(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.id = 'test'; next(); });
  app.use('/api/bookings', require('../routes/bookings'));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/bookings`;
  const token = jwt.sign({ userId: String(admin._id), role: 'ADMIN' }, process.env.JWT_SECRET || 'your_jwt_secret_key_here');

  const call = async (method, p, body) => {
    const origErr = console.error;
    console.error = () => {};
    try {
      const res = await fetch(`${base}${p}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      return res.status;
    } finally { console.error = origErr; }
  };
  const seed = r => { store.set(String(r._id), r); return r._id; };

  const routes = {
    'edit (PUT /:id, payments sent back unchanged)': (id, b) => call('PUT', `/${id}`, { payments: b.payments }),
    'edit (PUT /:id, no payments in body)': id => call('PUT', `/${id}`, { note: 'x' }),
    'date change': id => call('POST', `/${id}/date-change`, { remarks: 'r', newSalePrice: 0, changeTravelDate: true, newTravelDate: '2031-01-01' }),
    'flight change': id => call('POST', `/${id}/flight-change`, { remarks: 'r', newSalePrice: 0 }),
    'flight change with a new payment': id => call('POST', `/${id}/flight-change`, { remarks: 'r', newSalePrice: 0, payments: [{ paidAmount: 1, paymentMode: 'Cash', paymentDate: '2026-02-01', referenceNo: '' }] }),
    'seat book': id => call('POST', `/${id}/seat-book`, { remarks: 'r' }),
    'cancel': id => call('POST', `/${id}/cancel`, { remarks: 'r', paymentModeWas: 'Cash', cancellationMode: 'charges', airlineCancellationCharges: 0 }),
    'verify-account': id => call('POST', `/${id}/verify-account`, {})
  };

  for (const mode of ['Cheque', 'Bank Transfer']) {
    for (const [name, run] of Object.entries(routes)) {
      await check(`${mode} payment: ${name} saves`, async () => {
        const b = withMode(mode);
        assert.strictEqual(await run(seed(b), b), 200);
      });
    }
  }

  await check('cancel with paymentModeWas = Cheque saves', async () => {
    const id = seed(raw());
    assert.strictEqual(await call('POST', `/${id}/cancel`, { remarks: 'r', paymentModeWas: 'Cheque', cancellationMode: 'charges', airlineCancellationCharges: 0 }), 200);
  });
  await check('editing a cancelled booking whose stored paymentModeWas is Cheque saves (recalculation path)', async () => {
    const id = seed(raw({ status: 'Cancelled', cancellation: { isCancelled: true, paymentModeWas: 'Cheque', cancellationMode: 'charges', airlineCancellationCharges: 0 } }));
    assert.strictEqual(await call('PUT', `/${id}`, { note: 'x' }), 200);
  });
  await check('creating a booking with a SkyLight payment succeeds', async () => {
    const status = await call('POST', '/', {
      paxName: 'p', contactNumber: '1', pnr: 'SKY001', sectorType: 'One Way', travelDate: '2030-06-01', from: 'a', to: 'b',
      salePrice: 100, ourCost: 50, paymentType: 'Full',
      payments: [{ paidAmount: 100, paymentMode: 'SkyLight', paymentDate: '2026-02-01', referenceNo: '' }]
    });
    assert.strictEqual(status, 201);
  });

  // unknown values are still rejected
  await check('a truly invalid payment mode ("Bitcoin") is still rejected', async () => {
    const id = seed(raw());
    assert.strictEqual(await call('PUT', `/${id}`, { payments: [{ paidAmount: 1, paymentMode: 'Bitcoin', paymentDate: '2026-02-01', referenceNo: '' }] }), 500);
  });
  await check('a truly invalid paymentModeWas ("Bitcoin") is still rejected', async () => {
    const id = seed(raw());
    assert.strictEqual(await call('POST', `/${id}/cancel`, { remarks: 'r', paymentModeWas: 'Bitcoin', cancellationMode: 'charges', airlineCancellationCharges: 0 }), 500);
  });
  await check('schema: Bitcoin fails validation for payments and for paymentModeWas', () => {
    const d = new Booking(raw({ payments: [{ paidAmount: 1, paymentMode: 'Bitcoin', paymentDate: new Date() }], cancellation: { paymentModeWas: 'Bitcoin' } }));
    const errs = Object.keys(d.validateSync().errors);
    assert.ok(errs.includes('payments.0.paymentMode') && errs.includes('cancellation.paymentModeWas'), errs.join());
  });

  // the two enums cannot drift
  await check('payments and paymentModeWas enums are the same list', () => {
    const pay = Booking.schema.path('payments').schema.path('paymentMode').enumValues;
    const was = Booking.schema.path('cancellation.paymentModeWas').enumValues;
    assert.deepStrictEqual(pay, was);
    assert.deepStrictEqual(pay, Booking.PAYMENT_MODES);
  });
  await check('every mode offered by the UI dropdowns is accepted by the schema', () => {
    const ui = ['Cash', 'Machine Charge', 'E-Transfer', 'Kotak Bank', 'SkyLight', 'Travobirds', 'Credit Card', 'UPI', 'Kotak Bank UPI'];
    for (const m of ui) assert.ok(Booking.PAYMENT_MODES.includes(m), m);
  });

  server.close();
  console.log(`\n${passed} checks passed${process.exitCode ? ', SOME FAILED' : ''}`);
})();
