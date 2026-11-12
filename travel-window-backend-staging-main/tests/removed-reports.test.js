'use strict';
// Supplier-wise and the old Payment to Supplier report are gone. Their routes must 404, and the
// renamed route must answer on its new path and only on its new path.
//
//   node tests/removed-reports.test.js

const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

(async () => {
  Booking.find = () => {
    const chain = {
      populate: () => chain, lean: () => chain, select: () => chain,
      sort: () => chain, skip: () => chain, limit: () => chain,
      then: (res, rej) => Promise.resolve([]).then(res, rej)
    };
    return chain;
  };
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'ADMIN', isActive: true, name: 'Admin' };
  User.findById = () => ({ select: () => Promise.resolve(admin) });
  const token = jwt.sign({ userId: String(admin._id), role: 'ADMIN' }, SECRET);

  const app = express();
  app.use('/api/reports', require('../routes/reports'));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/reports`;
  const status = async (path) => (await fetch(`${base}/${path}?dateFrom=2026-09-01&dateTo=2026-09-30`, {
    headers: { Authorization: `Bearer ${token}` }
  })).status;

  console.log('deleted routes');
  assert.strictEqual(await status('supplier-wise'), 404, 'supplier-wise must be gone');
  ok('GET /reports/supplier-wise returns 404');
  assert.strictEqual(await status('payment-to-supplier'), 404, 'the old singular route must be gone');
  ok('GET /reports/payment-to-supplier returns 404');
  assert.strictEqual(await status('unverified-payments'), 404, 'the old name must be gone');
  ok('GET /reports/unverified-payments returns 404 (renamed)');

  console.log('\nsurviving routes');
  for (const p of ['date-wise', 'employee-wise', 'pending-verification',
                   'outstanding-balance', 'agent-margin', 'agent-booking-list',
                   'agent-margin-report', 'financial-summary', 'verified-payments']) {
    assert.strictEqual(await status(p), 200, `${p} must still answer`);
  }
  ok('the other nine reports are untouched');

  // payment-to-suppliers is mounted but is a per-supplier statement: without a supplier it must
  // 400, which is a different thing from the 404 of a deleted route. Its own behaviour is covered
  // in tests/supplier-statement.test.js.
  assert.strictEqual(await status('payment-to-suppliers'), 400,
    'payment-to-suppliers is mounted (400 for a missing supplier), not deleted (404)');
  ok('payment-to-suppliers answers on its new path');

  server.close();
  console.log(`\n${passed} assertions passed`);
})().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
