'use strict';
/**
 * Move legacy date-only values to the noon-UTC convention (see utils/date-only.js).
 *
 * Why: date-only fields are meant to be stored at 12:00 UTC so they read as the same calendar day
 * in every timezone. Rows written before that convention — and every payment date, because the
 * frontend converted the date input to a Date before sending it — sit at 00:00 UTC instead, and so
 * read one day EARLY in Toronto.
 *
 * DRY RUN ONLY. There is deliberately no write path in this file. It reports what would change,
 * per field, with counts and sample PNRs. Writing is a separate, approved step that needs a fresh
 * mongodump first.
 *
 * Refuses to run against anything but the copy database. Never connects to live.
 *
 *   node scripts/migrate-date-only-to-noon.js
 *   node scripts/migrate-date-only-to-noon.js --samples 10
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const { isNoonUtc, toNoonUtc } = require('../utils/date-only');
const { dayInTz, TZ } = require('../utils/tz');

const ALLOWED_DB = 'travel_window_staging_copy';
const SAMPLES = (() => {
  const i = process.argv.indexOf('--samples');
  return i !== -1 ? Math.max(1, parseInt(process.argv[i + 1], 10) || 5) : 5;
})();

const dbNameOf = (uri) => {
  const m = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(uri || '');
  return m ? decodeURIComponent(m[1]) : '';
};

// Every date-only field, with how to reach each value on a booking.
// `path` is for the eventual update statement; `get` yields { value, label } pairs for counting.
const FIELDS = [
  { path: 'travelDate', get: b => [{ value: b.travelDate }] },
  { path: 'returnDate', get: b => [{ value: b.returnDate }] },
  {
    path: 'multipleSectors[].travelDate',
    get: b => (b.multipleSectors || []).map((s, i) => ({ value: s && s.travelDate, label: `[${i}]` }))
  },
  {
    path: 'payments[].paymentDate',
    get: b => (b.payments || []).map((p, i) => ({ value: p && p.paymentDate, label: `[${i}]` }))
  },
  { path: 'cancellation.upfrontCollection.collectionDate', get: b => [{ value: b.cancellation && b.cancellation.upfrontCollection && b.cancellation.upfrontCollection.collectionDate }] },
  { path: 'cancellation.refundReceivedFromSupplier.date', get: b => [{ value: b.cancellation && b.cancellation.refundReceivedFromSupplier && b.cancellation.refundReceivedFromSupplier.date }] },
  { path: 'cancellation.refundPaidToClient.date', get: b => [{ value: b.cancellation && b.cancellation.refundPaidToClient && b.cancellation.refundPaidToClient.date }] }
];

(async () => {
  const uri = process.env.MONGODB_URI;
  const db = dbNameOf(uri);
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(2);
  }
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
  console.log('DRY RUN — date-only fields to noon UTC');
  console.log(`database : ${mongoose.connection.name}`);
  console.log(`display  : ${TZ}`);
  console.log('No write path exists in this script. Nothing will be modified.');
  console.log('='.repeat(78));

  const bookings = await Booking.collection.find({}, {
    projection: {
      pnr: 1, travelDate: 1, returnDate: 1, multipleSectors: 1, payments: 1, 'cancellation.upfrontCollection.collectionDate': 1,
      'cancellation.refundReceivedFromSupplier.date': 1, 'cancellation.refundPaidToClient.date': 1
    }
  }).toArray();
  console.log(`\nbookings scanned: ${bookings.length}\n`);

  let grandTotal = 0, grandWould = 0;

  for (const field of FIELDS) {
    let present = 0, alreadyNoon = 0, wouldChange = 0, unparseable = 0;
    const byStoredTime = {};
    const samples = [];
    const affectedPnrs = new Set();

    for (const b of bookings) {
      for (const { value, label } of field.get(b)) {
        if (value === undefined || value === null) continue;
        present++;
        const d = new Date(value);
        if (isNaN(d.getTime())) { unparseable++; continue; }
        const hhmm = d.toISOString().slice(11, 16);
        byStoredTime[hhmm] = (byStoredTime[hhmm] || 0) + 1;
        if (isNoonUtc(d)) { alreadyNoon++; continue; }
        wouldChange++;
        affectedPnrs.add(b.pnr);
        if (samples.length < SAMPLES) {
          const after = toNoonUtc(d);
          samples.push({
            pnr: b.pnr + (label || ''),
            storedUtc: d.toISOString(),
            readsAsInToronto: dayInTz(d),
            wouldBecome: after.toISOString(),
            thenReadsAs: dayInTz(after)
          });
        }
      }
    }

    grandTotal += present;
    grandWould += wouldChange;

    console.log('-'.repeat(78));
    console.log(field.path);
    console.log(`  values present      : ${present}`);
    console.log(`  already at noon UTC : ${alreadyNoon}`);
    console.log(`  WOULD CHANGE        : ${wouldChange}  (bookings affected: ${affectedPnrs.size})`);
    if (unparseable) console.log(`  unparseable (skipped): ${unparseable}`);
    const times = Object.entries(byStoredTime).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`  stored UTC times    : ${times.map(([t, n]) => `${t}×${n}`).join(', ') || '(none)'}`);
    for (const s of samples) {
      console.log(`    ${s.pnr}: ${s.storedUtc} reads ${s.readsAsInToronto} -> ${s.wouldBecome} reads ${s.thenReadsAs}`);
    }
  }

  console.log('='.repeat(78));
  console.log(`TOTAL: ${grandWould} of ${grandTotal} date-only values would move to noon UTC.`);
  console.log('');
  console.log('The calendar day is taken from the value\'s stored UTC day, which is the day the');
  console.log('user originally typed: a 00:00Z value keeps its date and only its time of day moves.');
  console.log('toNoonUtc is idempotent, so a second run would change nothing.');
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
