'use strict';
/**
 * Reconcile the two verification flag pairs.
 *
 * Why: one fact — "this booking has been verified" — is stored twice.
 *   verifiedByAccount / verifiedByAdmin   drive the booking-detail lock and the booking-list filter
 *   accountVerified   / adminVerified     are what every report reads
 *
 * PUT /bookings/:id sets both pairs. POST /bookings/:id/verify-account and /verify-admin used to
 * set only the verifiedBy* pair (fixed in the same commit as this script), and the booking-lock
 * check reads `adminVerified || verifiedByAdmin` while the reports read only `adminVerified`. The
 * result is bookings that are locked as verified yet still listed as unverified by the reports.
 *
 * This reports what a backfill would change:
 *   adminVerified   = adminVerified   || verifiedByAdmin
 *   accountVerified = accountVerified || verifiedByAccount
 * and the reverse direction, in case any row has the report flag without the lock flag.
 *
 * DRY RUN ONLY. There is deliberately no write path in this file. It refuses any database but
 * travel_window_staging_copy and never connects to live.
 *
 *   node scripts/backfill-verified-flags.js
 *   node scripts/backfill-verified-flags.js --samples 10
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');

const ALLOWED_DB = 'travel_window_staging_copy';
const SAMPLES = (() => {
  const i = process.argv.indexOf('--samples');
  return i !== -1 ? Math.max(1, parseInt(process.argv[i + 1], 10) || 5) : 5;
})();

const dbNameOf = (uri) => {
  const m = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(uri || '');
  return m ? decodeURIComponent(m[1]) : '';
};

const tally = (rows, key) => rows.reduce((m, b) => { const k = b[key] || '(none)'; m[k] = (m[k] || 0) + 1; return m; }, {});

(async () => {
  const uri = process.env.MONGODB_URI;
  const db = dbNameOf(uri);
  if (!uri) { console.error('MONGODB_URI is not set.'); process.exit(2); }
  if (db !== ALLOWED_DB) {
    console.error(`Refusing to run: MONGODB_URI points at "${db || '(no database in the URI)'}", not "${ALLOWED_DB}".`);
    console.error('This script is dry-run only and must never touch live data.');
    process.exit(2);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  if (mongoose.connection.name !== ALLOWED_DB) {
    console.error(`Refusing to run: connected to "${mongoose.connection.name}".`);
    await mongoose.disconnect();
    process.exit(2);
  }

  console.log('='.repeat(78));
  console.log('DRY RUN — reconcile verification flag pairs');
  console.log(`database : ${mongoose.connection.name}`);
  console.log('No write path exists in this script. Nothing will be modified.');
  console.log('='.repeat(78));

  const all = await Booking.collection.find({}, {
    projection: {
      pnr: 1, status: 1, adminVerified: 1, accountVerified: 1,
      verifiedByAdmin: 1, verifiedByAccount: 1,
      verifiedByAdminDate: 1, verifiedByAccountDate: 1,
      cancellationVerified: 1
    }
  }).toArray();
  const nonCancelled = all.filter(b => b.status !== 'Cancelled');

  console.log(`\nbookings: ${all.length} total, ${nonCancelled.length} non-cancelled\n`);

  // Current disagreement, as each side of the app sees it.
  const lockSaysVerified = nonCancelled.filter(b => b.adminVerified || b.verifiedByAdmin || b.accountVerified || b.verifiedByAccount);
  const reportSaysVerified = nonCancelled.filter(b => b.adminVerified || b.accountVerified);
  console.log('current state (non-cancelled)');
  console.log(`  verified per the booking lock   (adminVerified||verifiedByAdmin||accountVerified||verifiedByAccount): ${lockSaysVerified.length}`);
  console.log(`  verified per the reports        (adminVerified||accountVerified)                                   : ${reportSaysVerified.length}`);
  console.log(`  DISAGREEMENT                                                                                       : ${lockSaysVerified.length - reportSaysVerified.length}`);

  const directions = [
    {
      name: 'adminVerified   <- verifiedByAdmin',
      field: 'adminVerified',
      rows: all.filter(b => b.verifiedByAdmin === true && b.adminVerified !== true)
    },
    {
      name: 'accountVerified <- verifiedByAccount',
      field: 'accountVerified',
      rows: all.filter(b => b.verifiedByAccount === true && b.accountVerified !== true)
    },
    {
      name: 'verifiedByAdmin   <- adminVerified   (reverse)',
      field: 'verifiedByAdmin',
      rows: all.filter(b => b.adminVerified === true && b.verifiedByAdmin !== true)
    },
    {
      name: 'verifiedByAccount <- accountVerified (reverse)',
      field: 'verifiedByAccount',
      rows: all.filter(b => b.accountVerified === true && b.verifiedByAccount !== true)
    }
  ];

  const affected = new Set();
  for (const d of directions) {
    console.log('-'.repeat(78));
    console.log(`${d.name}  ->  would set ${d.field} = true on ${d.rows.length} booking(s)`);
    if (d.rows.length) {
      console.log(`  by status   : ${JSON.stringify(tally(d.rows, 'status'))}`);
      console.log(`  sample PNRs : ${d.rows.slice(0, SAMPLES).map(b => b.pnr).join(', ')}`);
      d.rows.forEach(b => affected.add(String(b._id)));
    }
  }

  console.log('='.repeat(78));
  console.log(`bookings that would be touched at all: ${affected.size}`);

  // What the reports would show afterwards.
  const afterReportVerified = nonCancelled.filter(b =>
    b.adminVerified || b.accountVerified || b.verifiedByAdmin || b.verifiedByAccount).length;
  console.log('');
  console.log('after the backfill (non-cancelled)');
  console.log(`  verified per the reports: ${reportSaysVerified.length} -> ${afterReportVerified}`);
  console.log(`  the two views agree     : ${afterReportVerified === lockSaysVerified.length ? 'YES' : 'NO'}`);

  console.log('');
  console.log('cancellation verification is a separate flag and is NOT touched:');
  console.log(`  cancelled bookings: ${all.filter(b => b.status === 'Cancelled').length}, of which cancellationVerified: ${all.filter(b => b.cancellationVerified).length}`);

  console.log('');
  console.log('The two POST verify routes now set both pairs, so no new rows can drift. This');
  console.log('backfill only cleans up rows written before that fix.');
  console.log('');
  console.log('NOT RUN. To apply this on live, a separate approved script is needed, after a fresh');
  console.log('mongodump and with the client\'s sign-off.');
  console.log('='.repeat(78));

  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('Failed:', e.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
