'use strict';
// Verification is one fact stored in two flag pairs. These tests pin down that both pairs are
// always written together, and that the Verified Payments report can show the not-yet-verified
// side so one screen owns the whole workflow.
//
//   node tests/verification.test.js

const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { startReports } = require('./report-harness');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
const oid = () => new mongoose.Types.ObjectId();

function newBooking(over = {}) {
  return new Booking(Object.assign({
    pnr: 'TEST01', paxName: 'X', contactNumber: '+1 5550000', sectorType: 'One Way',
    travelDate: new Date('2026-10-01T12:00:00Z'), from: 'YYZ', to: 'DEL',
    submittedBy: oid(), submittedByName: 'Agent One',
    status: 'Pending Verification', salePrice: 1000, ourCost: 900
  }, over));
}

// Mounts the real bookings router with findById/save stubbed: no database, but the route code,
// its authorize() guard and its save() path all run for real.
async function startBookings(doc, role) {
  const user = { _id: oid(), role, isActive: true, name: role };
  User.findById = () => ({ select: () => Promise.resolve(user) });

  const saved = [];
  doc.save = async function () { saved.push(this.toObject()); return this; };
  const chain = { populate: () => chain, then: (res, rej) => Promise.resolve(doc).then(res, rej) };
  Booking.findById = () => chain;

  const app = express();
  app.use(express.json());
  app.use('/api/bookings', require('../routes/bookings'));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const token = jwt.sign({ userId: String(user._id), role }, SECRET);
  const base = `http://127.0.0.1:${server.address().port}/api/bookings`;
  return {
    post: async (path) => {
      const res = await fetch(`${base}/${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}'
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    saved,
    close: () => server.close()
  };
}

(async () => {
  console.log('POST /bookings/:id/verify-admin');
  {
    const doc = newBooking();
    const api = await startBookings(doc, 'ADMIN');
    const res = await api.post(`${doc._id}/verify-admin`);
    assert.strictEqual(res.status, 200, 'route responded 200');

    assert.strictEqual(doc.verifiedByAdmin, true, 'verifiedByAdmin (booking lock)');
    ok('sets verifiedByAdmin, which the booking-detail lock reads');
    assert.strictEqual(doc.adminVerified, true, 'adminVerified (reports)');
    ok('ALSO sets adminVerified, which every report reads');
    assert.ok(doc.verifiedByAdminDate instanceof Date, 'date stamped');
    ok('stamps verifiedByAdminDate and verifiedByAdminUser');
    assert.strictEqual(doc.status, 'Admin Verified');
    ok('moves status to Admin Verified');
    assert.strictEqual(api.saved.length, 1, 'saved exactly once');
    ok('saves once');
    api.close();
  }

  console.log('\nPOST /bookings/:id/verify-account');
  {
    const doc = newBooking();
    const api = await startBookings(doc, 'ACCOUNT');
    const res = await api.post(`${doc._id}/verify-account`);
    assert.strictEqual(res.status, 200);

    assert.strictEqual(doc.verifiedByAccount, true);
    ok('sets verifiedByAccount, which the booking lock and list filter read');
    assert.strictEqual(doc.accountVerified, true);
    ok('ALSO sets accountVerified, which every report reads');
    assert.strictEqual(doc.status, 'Account Verified');
    ok('moves status to Account Verified');
    api.close();
  }

  console.log('\nthe two views of "verified" now agree');
  {
    const doc = newBooking();
    const api = await startBookings(doc, 'ADMIN');
    await api.post(`${doc._id}/verify-admin`);
    // The exact expressions the two halves of the app use.
    const bookingLockSaysVerified = !!(doc.adminVerified || doc.verifiedByAdmin);
    const reportSaysVerified = !!(doc.adminVerified || doc.accountVerified);
    assert.strictEqual(bookingLockSaysVerified, reportSaysVerified);
    ok('booking-lock test and report test give the same answer for the same booking');
    api.close();
  }

  console.log('\nGET /reports/verified-payments — both sides of the population');
  {
    const AGENT = oid();
    const base = {
      paxName: 'X', travelDate: new Date('2026-10-01T12:00:00Z'), salePrice: 1000, ourCost: 900,
      supplierCharges: 0, totalSalePrice: 1000, totalPaidAmount: 1000, balanceAmount: 0,
      submittedBy: AGENT, submittedByName: 'Agent One', payments: [],
      dateOfSubmission: new Date('2026-09-15T16:00:00Z')
    };
    const bookings = [
      { ...base, _id: oid(), pnr: 'ADMINV', status: 'Ticketed', adminVerified: true },
      { ...base, _id: oid(), pnr: 'ACCTV', status: 'Ticketed', accountVerified: true },
      { ...base, _id: oid(), pnr: 'NEITHER', status: 'Ticketed' },
      // The 204-booking shape: locked as verified, but the report flag was never set.
      { ...base, _id: oid(), pnr: 'DRIFTED', status: 'Admin Verified', verifiedByAdmin: true },
      { ...base, _id: oid(), pnr: 'CANCV', status: 'Cancelled', cancellationVerified: true },
      { ...base, _id: oid(), pnr: 'CANCNV', status: 'Cancelled' }
    ];
    const api = await startReports('../routes/reports', bookings);
    const SEPT = { dateFrom: '2026-09-01', dateTo: '2026-09-30' };
    const pnrs = r => r.bookings.map(b => b.pnr).sort();

    assert.deepStrictEqual(pnrs(await api.get('verified-payments', { ...SEPT, verificationType: 'original' })),
      ['ACCTV', 'ADMINV']);
    ok("verificationType=original lists the verified originals");

    assert.deepStrictEqual(pnrs(await api.get('verified-payments', { ...SEPT, verificationType: 'cancellation' })),
      ['CANCV']);
    ok('verificationType=cancellation lists the verified cancellations');

    assert.deepStrictEqual(pnrs(await api.get('verified-payments', { ...SEPT, verificationType: 'unverified' })),
      ['DRIFTED', 'NEITHER']);
    ok('verificationType=unverified lists what still needs verifying');

    assert.deepStrictEqual(pnrs(await api.get('verified-payments', { ...SEPT, verificationType: 'unverified-cancellation' })),
      ['CANCNV']);
    ok('verificationType=unverified-cancellation lists unverified cancellations');

    // The two sides must partition the non-cancelled population with no overlap and no gap.
    const ver = pnrs(await api.get('verified-payments', { ...SEPT, verificationType: 'original' }));
    const unver = pnrs(await api.get('verified-payments', { ...SEPT, verificationType: 'unverified' }));
    assert.deepStrictEqual([...ver, ...unver].sort(), ['ACCTV', 'ADMINV', 'DRIFTED', 'NEITHER']);
    assert.strictEqual(ver.filter(p => unver.includes(p)).length, 0, 'no overlap');
    ok('verified and unverified partition the non-cancelled population exactly');

    // DRIFTED is the bug the backfill fixes: locked, but the report calls it unverified.
    assert.ok(unver.includes('DRIFTED'),
      'a booking with only verifiedByAdmin still reads as unverified until the backfill runs');
    ok('a drifted booking shows up as unverified, as it does in production today');

    api.close();
  }

  console.log(`\n${passed} assertions passed`);
})().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
