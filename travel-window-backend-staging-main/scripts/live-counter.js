'use strict';
/**
 * LIVE READ-ONLY COUNTER — for the deploy window.
 *
 * Gates 2, 3, 6, 8 and 9 of the deploy plan all turn on one question: how many stored values
 * still need migrating? This answers it, and nothing else.
 *
 * Why this exists as its own file. The committed migration and backfill scripts refuse any
 * database but travel_window_staging_copy, and that guard is NOT lifted for the window — it
 * stays as it is, forever. This script is the one thing allowed to look at live, and the way it
 * is kept safe is that **it contains no write path at all**: no updateOne, updateMany, bulkWrite,
 * save, insert, delete or drop appears anywhere in it, and the connection is opened against a
 * collection handle that is only ever read with find(). Grep it before you run it.
 *
 * The database name is a REQUIRED explicit argument. It is not read from MONGODB_URI's path and
 * there is no default, so you cannot run this against the wrong database by forgetting a flag or
 * by having the wrong .env loaded. If the name you pass does not match the database the URI
 * actually connects to, it refuses.
 *
 *   node scripts/live-counter.js --db travel_window_staging --uri "mongodb+srv://..."
 *   node scripts/live-counter.js --db travel_window_staging_copy        # uses MONGODB_URI
 *
 * Flags:
 *   --db <name>     REQUIRED. The database you intend to read. Checked after connecting.
 *   --uri <uri>     Optional. Defaults to MONGODB_URI from .env.
 *   --json          Machine-readable one-line summary, for pasting into the window log.
 *   --samples <n>   Sample PNRs per field (default 5, max 20). Counts and PNRs only.
 *
 * Prints counts, PNRs and field names. No passenger names, no phone numbers, no amounts.
 *
 * EXPECTED AT EACH GATE
 *   GATE 2  before the migration write : non-zero, and close to the copy's figures
 *   GATE 3  after  the migration write : date-only pending must be 0
 *   GATE 6  after  the push            : still 0 (catches saves through the old UI in the gap)
 *   GATE 8  T+4h                       : still 0 (catches stale tabs)
 *   GATE 9  next morning               : still 0
 *   verified-flag mismatch is reported too, for the backfill counter at T+115m.
 */
require('dotenv').config();
// This machine's Node resolver points at 127.0.0.1, where nothing is listening, so an Atlas SRV
// lookup fails. Opt in with SCRIPT_DNS=192.168.29.1,8.8.8.8 rather than hard-coding it.
if (process.env.SCRIPT_DNS) require('dns').setServers(process.env.SCRIPT_DNS.split(','));

const mongoose = require('mongoose');
const { isNoonUtc } = require('../utils/date-only');

const arg = (name) => {
  const i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : null;
};
const flag = (name) => process.argv.includes('--' + name);

const DB = arg('db');
const URI = arg('uri') || process.env.MONGODB_URI;
const JSON_OUT = flag('json');
const SAMPLES = Math.min(20, Math.max(0, parseInt(arg('samples') || '5', 10) || 0));

if (!DB) {
  console.error('Refusing to run: --db <name> is required.');
  console.error('  node scripts/live-counter.js --db travel_window_staging');
  console.error('There is deliberately no default: naming the database is how you confirm which');
  console.error('one you meant.');
  process.exit(2);
}
if (!URI) {
  console.error('Refusing to run: no --uri and no MONGODB_URI.');
  process.exit(2);
}

// The seven date-only fields the migration touches, in the migration's own order.
const FIELDS = [
  { path: 'travelDate', get: b => [{ v: b.travelDate }] },
  { path: 'returnDate', get: b => [{ v: b.returnDate }] },
  { path: 'multipleSectors[].travelDate',
    get: b => (b.multipleSectors || []).map((s, i) => ({ v: s && s.travelDate, at: `[${i}]` })) },
  { path: 'payments[].paymentDate',
    get: b => (b.payments || []).map((p, i) => ({ v: p && p.paymentDate, at: `[${i}]` })) },
  { path: 'cancellation.upfrontCollection.collectionDate',
    get: b => [{ v: b.cancellation && b.cancellation.upfrontCollection && b.cancellation.upfrontCollection.collectionDate }] },
  { path: 'cancellation.refundReceivedFromSupplier.date',
    get: b => [{ v: b.cancellation && b.cancellation.refundReceivedFromSupplier && b.cancellation.refundReceivedFromSupplier.date }] },
  { path: 'cancellation.refundPaidToClient.date',
    get: b => [{ v: b.cancellation && b.cancellation.refundPaidToClient && b.cancellation.refundPaidToClient.date }] }
];

(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 20000 });

  // The name you passed must be the database the URI actually reached. This is the whole guard:
  // it cannot be satisfied by a default or by a stale .env.
  const actual = mongoose.connection.name;
  if (actual !== DB) {
    console.error(`Refusing to run: --db said "${DB}" but the URI connected to "${actual}".`);
    await mongoose.disconnect();
    process.exit(2);
  }

  const col = mongoose.connection.db.collection('bookings');

  const docs = await col.find({}, {
    projection: {
      pnr: 1, status: 1,
      travelDate: 1, returnDate: 1, multipleSectors: 1, payments: 1,
      'cancellation.upfrontCollection.collectionDate': 1,
      'cancellation.refundReceivedFromSupplier.date': 1,
      'cancellation.refundPaidToClient.date': 1,
      adminVerified: 1, accountVerified: 1, verifiedByAdmin: 1, verifiedByAccount: 1
    }
  }).toArray();

  const rows = [];
  let pendingTotal = 0;

  for (const f of FIELDS) {
    let present = 0, alreadyNoon = 0, pending = 0, unparseable = 0;
    const pnrs = [];
    for (const b of docs) {
      for (const { v } of f.get(b)) {
        if (v === undefined || v === null || v === '') continue;
        present++;
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) { unparseable++; continue; }
        if (isNoonUtc(d)) { alreadyNoon++; continue; }
        pending++;
        if (pnrs.length < SAMPLES) pnrs.push(String(b.pnr || '?').trim());
      }
    }
    pendingTotal += pending;
    rows.push({ field: f.path, present, alreadyNoon, pending, unparseable, pnrs });
  }

  // The verified-flag mismatch, for the backfill counter. Same criteria as the backfill script.
  const live = docs.filter(b => b.status !== 'Cancelled');
  const lockSays = live.filter(b => b.adminVerified || b.verifiedByAdmin || b.accountVerified || b.verifiedByAccount).length;
  const reportSays = live.filter(b => b.adminVerified || b.accountVerified).length;
  const verifiedMismatch = lockSays - reportSays;

  if (JSON_OUT) {
    console.log(JSON.stringify({
      ranAt: new Date().toISOString(), database: actual, bookings: docs.length,
      dateOnlyPending: pendingTotal, verifiedMismatch,
      byField: rows.map(({ field, present, alreadyNoon, pending, unparseable }) =>
        ({ field, present, alreadyNoon, pending, unparseable }))
    }));
  } else {
    const pad = s => String(s).padEnd(46);
    const n = v => String(v).padStart(9);
    console.log('='.repeat(84));
    console.log('LIVE COUNTER — READ ONLY, NOTHING IS WRITTEN');
    console.log(`database : ${actual}`);
    console.log(`ran at   : ${new Date().toISOString()}`);
    console.log(`bookings : ${docs.length}`);
    console.log('='.repeat(84));
    console.log(`\n${pad('date-only field')}${n('present')}${n('at noon')}${n('PENDING')}${n('bad')}`);
    console.log('-'.repeat(84));
    for (const r of rows) {
      console.log(`${pad(r.field)}${n(r.present)}${n(r.alreadyNoon)}${n(r.pending)}${n(r.unparseable)}`);
      if (r.pnrs.length) console.log(`    sample PNRs: ${r.pnrs.join(', ')}`);
    }
    console.log('-'.repeat(84));
    console.log(`${pad('TOTAL PENDING')}${' '.repeat(18)}${n(pendingTotal)}`);
    console.log(`\nverified-flag mismatch (lock says ${lockSays}, reports say ${reportSays}) : ${verifiedMismatch}`);
    console.log('\n' + (pendingTotal === 0
      ? 'TOTAL PENDING is 0 — this is what GATES 3, 6, 8 and 9 require.'
      : `TOTAL PENDING is ${pendingTotal}. Expected before the migration write (GATE 2); a FAILURE at gates 3, 6, 8 and 9.`));
    console.log('='.repeat(84));
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch(async e => {
  console.error(e && e.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
