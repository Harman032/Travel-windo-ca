'use strict';
/**
 * READ-ONLY date-health scan of every booking: which stored date fields are missing, null, or
 * unparseable. The new timezone helpers (utils/tz.js) format through Intl, which THROWS a
 * RangeError on an Invalid Date where the old `new Date(x).setHours(0,0,0,0)` quietly produced
 * NaN and compared false. A throw on a legacy row is a 500 in production, so this counts them.
 *
 * Refuses any database but travel_window_staging_copy. Prints counts and PNRs only.
 *
 *   node scripts/scan-date-health.js
 */
require('dotenv').config();
// This machine's Node resolver points at 127.0.0.1, where nothing is listening, so an Atlas
// SRV lookup fails. Opt in with SCRIPT_DNS=192.168.29.1,8.8.8.8 rather than hard-coding it.
if (process.env.SCRIPT_DNS) require('dns').setServers(process.env.SCRIPT_DNS.split(','));
const mongoose = require('mongoose');

const ALLOWED_DB = 'travel_window_staging_copy';

// Every stored date the new code reads ON A BOOKING. Supplier payments live in their own
// collection and are scanned separately, below -- see the note there for why that one matters
// most.
const SCALAR = [
  'dateOfSubmission',
  'issueDate',
  'travelDate',
  'returnDate',
  'cancellation.cancelledAt',
  'cancellation.cancellationDate',
  // cancellation.refundDate was scanned here and is NOT on the schema -- it reported 0 forever
  // while the three cancellation dates that do exist went unscanned. These two are date-only
  // (a user types them on the refund-status form). cancellation.refundProcessedDate is NOT
  // listed: the route stamps it with new Date() at the moment of processing, so it is a
  // timestamp, like cancelledAt.
  'cancellation.refundReceivedFromSupplier.date',
  'cancellation.refundPaidToClient.date',
  'cancellation.upfrontCollection.collectionDate',
];
const ARRAY = [
  ['payments[].paymentDate', 'payments', 'paymentDate'],
  ['multipleSectors[].travelDate', 'multipleSectors', 'travelDate'],
  ['multipleSectors[].returnDate', 'multipleSectors', 'returnDate'],
  ['dateChanges[].changedAt', 'dateChanges', 'changedAt'],
  ['flightChanges[].changedAt', 'flightChanges', 'changedAt'],
  ['seatBookChanges[].changedAt', 'seatBookChanges', 'changedAt'],
];

const dig = (o, path) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);

// Does the new code survive this value? dayInTz() is the first thing startOfDayTz() calls.
function throwsInIntl(v) {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date(v)); return false; }
  catch (_) { return true; }
}

(async () => {
  const uri = process.env.MONGODB_URI;
  const named = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(uri || '');
  if (!uri || !named || decodeURIComponent(named[1]) !== ALLOWED_DB) {
    console.error('Refusing to run: MONGODB_URI must point at ' + ALLOWED_DB);
    process.exit(2);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  if (mongoose.connection.name !== ALLOWED_DB) { console.error('Refusing: ' + mongoose.connection.name); await mongoose.disconnect(); process.exit(2); }
  const raw = mongoose.connection.db;

  const bookings = await raw.collection('bookings').find({}).toArray();
  console.log('='.repeat(78));
  console.log('Date-health scan - READ ONLY');
  console.log(`database : ${mongoose.connection.name}`);
  console.log(`bookings : ${bookings.length} (all statuses, Draft included)`);
  console.log('='.repeat(78));

  const tally = new Map();
  const bump = (field, bucket, pnr) => {
    if (!tally.has(field)) tally.set(field, { present: 0, missing: 0, bad: 0, pnrs: [] });
    const t = tally.get(field);
    t[bucket]++;
    if (bucket === 'bad' && t.pnrs.length < 12) t.pnrs.push(String(pnr || '?').trim());
  };

  for (const b of bookings) {
    const pnr = b.pnr;
    for (const f of SCALAR) {
      const v = dig(b, f);
      if (v === undefined || v === null || v === '') bump(f, 'missing', pnr);
      else if (Number.isNaN(new Date(v).getTime()) || throwsInIntl(v)) bump(f, 'bad', pnr);
      else bump(f, 'present', pnr);
    }
    for (const [label, arr, key] of ARRAY) {
      const rows = Array.isArray(b[arr]) ? b[arr] : [];
      for (const r of rows) {
        const v = r ? r[key] : undefined;
        if (v === undefined || v === null || v === '') bump(label, 'missing', pnr);
        else if (Number.isNaN(new Date(v).getTime()) || throwsInIntl(v)) bump(label, 'bad', pnr);
        else bump(label, 'present', pnr);
      }
    }
  }

  const pad = s => String(s).padEnd(32);
  const n = v => String(v).padStart(8);
  console.log(`\n${pad('field')}${n('present')}${n('missing')}${n('invalid')}`);
  console.log('-'.repeat(56));
  for (const f of [...SCALAR, ...ARRAY.map(a => a[0])]) {
    const t = tally.get(f) || { present: 0, missing: 0, bad: 0, pnrs: [] };
    console.log(`${pad(f)}${n(t.present)}${n(t.missing)}${n(t.bad)}`);
    if (t.pnrs.length) console.log(`  invalid PNRs: ${t.pnrs.join(', ')}`);
  }

  // The one live hazard: routes/bookings.js:853 calls startOfDayTz(booking.travelDate) on the
  // date-change path. A booking with no usable travelDate would 500 there under the new code.
  // Parseable is not the same as plausible. A typo'd year parses perfectly and sails through
  // every check above: CBXCAA stores travelDate 1927-02-22 where the supplier's own statement
  // shows 2027-02-02. Nothing in the CRM rejects it, and the statement prints it verbatim.
  const LO = 2000, HI = 2100;
  // toISOString().slice(0,10) is wrong for exactly the values this scan exists to find: an
  // out-of-band year renders in ISO extended form (+022026-04-09), and the first ten characters
  // of that are "+022026-0". Take the date part properly instead.
  const isoDay = v => { const i = new Date(v).toISOString(); return i.slice(0, i.indexOf('T')); };
  const yearInTz = v => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric' }).format(d));
  };
  console.log('\n' + '='.repeat(78));
  console.log(`Implausible dates - outside ${LO}..${HI}, Toronto year`);
  console.log('='.repeat(78));
  let odd = 0;
  for (const f of [...SCALAR, ...ARRAY.map(a => a[0])]) {
    const hits = [];
    for (const b of bookings) {
      const vals = [];
      if (f.includes('[]')) {
        const [, arr, key] = ARRAY.find(a => a[0] === f);
        for (const r of (Array.isArray(b[arr]) ? b[arr] : [])) if (r && r[key] != null) vals.push(r[key]);
      } else {
        const v = dig(b, f);
        if (v != null && v !== '') vals.push(v);
      }
      for (const v of vals) {
        const y = yearInTz(v);
        if (y !== null && (y < LO || y > HI)) {
          hits.push(`${String(b.pnr || '?').trim()} -> ${isoDay(v)}`);
        }
      }
    }
    if (hits.length) {
      odd += hits.length;
      console.log(`\n${f}: ${hits.length}`);
      for (const h of hits.slice(0, 25)) console.log(`    ${h}`);
      if (hits.length > 25) console.log(`    ... and ${hits.length - 25} more`);
    }
  }
  /**
   * supplierpayments.paymentDate is a DIFFERENT field from a booking's embedded
   * payments[].paymentDate above: that one is the customer paying us, this one is us paying the
   * supplier. It is its own collection (models/SupplierPayment.js), so scanning bookings never
   * reaches it -- and it is the date the STATEMENT itself turns on. It decides whether a payment
   * lands in the opening balance or inside the period (utils/supplier-statement.js), so a typo'd
   * year moves money between Opening Balance and Total Open on a document we hand the supplier.
   * Exactly the failure this scan exists to find.
   */
  const supPayments = await raw.collection('supplierpayments').find({}).toArray();
  let supMissing = 0, supBad = 0, supOdd = 0;
  const supOddRows = [];
  for (const p of supPayments) {
    const v = p.paymentDate;
    if (v === undefined || v === null || v === '') { supMissing++; continue; }
    if (Number.isNaN(new Date(v).getTime()) || throwsInIntl(v)) { supBad++; continue; }
    const y = yearInTz(v);
    if (y !== null && (y < LO || y > HI)) {
      supOdd++;
      supOddRows.push(`${String(p.reference || '(no reference)').trim()} -> ${isoDay(v)}`);
    }
  }
  console.log(`\nsupplierpayments.paymentDate: ${supPayments.length} record(s), `
    + `${supMissing} missing, ${supBad} invalid, ${supOdd} implausible`);
  for (const r of supOddRows.slice(0, 25)) console.log(`    ${r}`);
  odd += supOdd;

  console.log(odd ? `\nTOTAL implausible values: ${odd}` : '\nNone. Every stored date falls inside the band.');

  const atRisk = bookings.filter(b => {
    if (b.status === 'Cancelled') return false;
    const v = b.travelDate;
    return v === undefined || v === null || v === '' || Number.isNaN(new Date(v).getTime());
  });
  console.log('\n' + '-'.repeat(78));
  console.log(`bookings that would throw at routes/bookings.js:853 (date change) : ${atRisk.length}`);
  if (atRisk.length) console.log('  PNRs: ' + atRisk.slice(0, 20).map(b => String(b.pnr || '?').trim()).join(', '));
  console.log('-'.repeat(78));

  await mongoose.disconnect();
})().catch(async e => { console.error(e && e.message); try { await mongoose.disconnect(); } catch (_) {} process.exit(1); });
