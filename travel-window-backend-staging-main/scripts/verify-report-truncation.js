'use strict';
/**
 * Measures, on the staging COPY, what every report endpoint the UI calls without paging returned
 * BEFORE this change and returns AFTER it. Drives the real routers over HTTP against the real
 * database -- no re-implemented queries -- so the figures are the ones the screens showed.
 *
 *   MONGODB_URI=<uri ending /travel_window_staging_copy> node scripts/verify-report-truncation.js
 *
 * "Before" is simulated by asking the same route for page=1&limit=50, which is exactly what
 * getPaginationParams defaulted to when the request carried no paging parameters at all.
 *
 * READ-ONLY: document saves are stubbed out, and the URI must name the copy.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');

const ALLOWED_DB = 'travel_window_staging_copy';
const uri = process.env.MONGODB_URI || process.env.travel_window_MONGODB_URI;
const dbNameOf = u => ((/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(u || '') || [])[1] || '');
if (!uri || decodeURIComponent(dbNameOf(uri)) !== ALLOWED_DB) {
  console.error(`Refusing to run: MONGODB_URI must point at database "${ALLOWED_DB}" (found "${uri ? dbNameOf(uri) : 'no URI'}").`);
  process.exit(2);
}

const Booking = require('../models/Booking');
const User = require('../models/User');

const round2 = n => Math.round(n * 100) / 100;
const FROM = process.env.FROM || '2026-09-01';
const TO = process.env.TO || '2026-09-30';

(async () => {
  await mongoose.connect(uri);
  if (mongoose.connection.db.databaseName !== ALLOWED_DB) {
    console.error(`Connected database is "${mongoose.connection.db.databaseName}", refusing.`);
    process.exit(2);
  }
  // Read-only: nothing in this script writes, and this makes that structural.
  Booking.prototype.save = async function () { throw new Error('save() is disabled in this script'); };

  const admin = await User.findOne({ role: 'ADMIN', isActive: true }).lean();
  if (!admin) { console.error('No active ADMIN on the copy.'); process.exit(2); }
  const token = jwt.sign({ userId: String(admin._id), role: 'ADMIN' },
    process.env.JWT_SECRET || 'your_jwt_secret_key_here');

  const app = express();
  app.use(express.json());
  app.use('/api/reports', require('../routes/reports'));
  app.use('/api/payments', require('../routes/payments'));
  app.use('/api/supplier-payments', require('../routes/supplier-payments'));
  app.use('/api/dashboard', require('../routes/dashboard'));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const port = server.address().port;
  const get = async (p, params = {}) => {
    const res = await fetch(`http://127.0.0.1:${port}${p}?${new URLSearchParams(params)}`,
      { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json();
    if (!res.ok) throw new Error(`${p} -> ${res.status} ${JSON.stringify(body)}`);
    return body;
  };

  const range = { dateFrom: FROM, dateTo: TO };
  const paged = { ...range, page: 1, limit: 50 };
  const sum = (rows, f) => round2(rows.reduce((t, r) => t + (f(r) || 0), 0));

  console.log(`\nStaging COPY, ${FROM}..${TO} (Toronto days). "before" = page=1&limit=50, the old default.\n`);

  const lines = [];
  const report = (endpoint, before, after) => {
    lines.push({ endpoint, before, after });
    console.log(`--- ${endpoint}`);
    console.log(`    before: ${before}`);
    console.log(`    after:  ${after}`);
  };

  // ---- date-wise
  {
    const b = await get('/api/reports/date-wise', paged);
    const a = await get('/api/reports/date-wise', range);
    report('GET /api/reports/date-wise',
      `rows ${b.bookings.length}  sale ${round2(b.summary.totalSalePrice)}  paid ${round2(b.summary.totalPaidAmount)}  balance ${round2(b.summary.totalBalance)}`,
      `rows ${a.bookings.length}  sale ${round2(a.summary.totalSalePrice)}  paid ${round2(a.summary.totalPaidAmount)}  balance ${round2(a.summary.totalBalance)}`);
    // Independent check: the summary must equal a sum over the rows the route returned.
    console.log(`    check:  sale over returned rows = ${sum(a.bookings, r => r.totalSalePrice)} (summary ${round2(a.summary.totalSalePrice)})`);
  }

  // ---- employee-wise
  {
    const b = await get('/api/reports/employee-wise', paged);
    const a = await get('/api/reports/employee-wise', range);
    const tot = g => `groups ${g.groups.length}  rows ${g.groups.reduce((t, x) => t + x.bookings.length, 0)}  sale ${round2(g.groups.reduce((t, x) => t + x.totalSalePrice, 0))}`;
    report('GET /api/reports/employee-wise', tot(b), tot(a));
    const beforeNames = new Set(b.groups.map(g => g.employee));
    const missing = a.groups.map(g => g.employee).filter(n => !beforeNames.has(n));
    console.log(`    employees missing from the old page-1 report: ${missing.length ? missing.join(', ') : 'none'}`);
  }

  // ---- pending-verification (no date range; it is a queue)
  {
    const b = await get('/api/reports/pending-verification', { page: 1, limit: 50 });
    const a = await get('/api/reports/pending-verification', {});
    report('GET /api/reports/pending-verification',
      `rows ${b.bookings.length}  count ${b.count}`,
      `rows ${a.bookings.length}  count ${a.count}`);
  }

  // ---- outstanding-balance (no date range)
  {
    const b = await get('/api/reports/outstanding-balance', { page: 1, limit: 50 });
    const a = await get('/api/reports/outstanding-balance', {});
    report('GET /api/reports/outstanding-balance',
      `rows ${b.bookings.length}  totalOutstanding ${round2(b.totalOutstanding)}`,
      `rows ${a.bookings.length}  totalOutstanding ${round2(a.totalOutstanding)}`);
    console.log(`    check:  balance over returned rows = ${sum(a.bookings, r => r.balanceAmount)} (reported ${round2(a.totalOutstanding)})`);
  }

  // ---- financial-summary
  {
    const b = await get('/api/reports/financial-summary', paged);
    const a = await get('/api/reports/financial-summary', range);
    report('GET /api/reports/financial-summary',
      `rows ${b.bookings.length}  tiles: bookings ${b.summary.totalBookings} sale ${round2(b.summary.totalSale)} paid ${round2(b.summary.totalPaid)} margin ${round2(b.summary.totalMargin)}`,
      `rows ${a.bookings.length}  tiles: bookings ${a.summary.totalBookings} sale ${round2(a.summary.totalSale)} paid ${round2(a.summary.totalPaid)} margin ${round2(a.summary.totalMargin)}`);
    console.log(`    check:  sale over returned rows = ${sum(a.bookings, r => r.salePrice)} (tile ${round2(a.summary.totalSale)})`);
    // Paging the same range by 50 must return each booking exactly once.
    const ids = [];
    for (let page = 1; page <= Math.ceil(a.summary.totalBookings / 50); page++) {
      const r = await get('/api/reports/financial-summary', { ...range, page, limit: 50 });
      ids.push(...r.bookings.map(x => String(x._id)));
    }
    console.log(`    paging: ${ids.length} rows across pages, ${new Set(ids).size} distinct (expected ${a.summary.totalBookings} / ${a.summary.totalBookings})`);
  }

  // ---- already unpaginated: confirm they are unchanged by this release
  {
    const vp = await get('/api/reports/verified-payments', { ...range, verificationType: 'both' });
    console.log(`--- GET /api/reports/verified-payments (already unpaginated)`);
    console.log(`    rows ${vp.bookings.length}  sale ${round2(vp.summary.totalSalePrice)}`);
    const pay = await get('/api/payments', { startDate: FROM, endDate: TO });
    console.log(`--- GET /api/payments (already unpaginated)`);
    console.log(`    rows ${pay.payments ? pay.payments.length : (pay.rows || []).length}  total ${JSON.stringify(pay.summary || pay.total)}`);
    const sp = await get('/api/supplier-payments', range);
    console.log(`--- GET /api/supplier-payments (already unpaginated)`);
    console.log(`    rows ${sp.count}  total ${sp.total}`);
    const st = await get('/api/dashboard/stats', {});
    console.log(`--- GET /api/dashboard/stats (countDocuments, cannot truncate)`);
    console.log(`    ${JSON.stringify(st)}`);
  }

  // ---- how many bookings share a dateOfSubmission millisecond (why the _id tie-break matters)
  {
    const dup = await Booking.aggregate([
      { $group: { _id: '$dateOfSubmission', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $group: { _id: null, groups: { $sum: 1 }, docs: { $sum: '$n' } } }
    ]);
    const d = dup[0] || { groups: 0, docs: 0 };
    console.log(`\ndateOfSubmission collisions on the whole copy: ${d.groups} timestamps shared by ${d.docs} bookings`);
  }

  server.close();
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
