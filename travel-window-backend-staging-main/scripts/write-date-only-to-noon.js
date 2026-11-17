'use strict';
/**
 * DATE-ONLY MIGRATION — THE WRITE. Live-capable.
 *
 * Moves every date-only value to 12:00:00.000 UTC on the same calendar day, so it reads as the
 * day the user typed from UTC-11 through UTC+11. See utils/date-only.js for why noon and not
 * midnight. migrate-date-only-to-noon.js is the DRY RUN and stays copy-only forever; this is the
 * only script that writes, and it is built on the live-counter.js pattern:
 *
 *   --db is REQUIRED, has no default, and is checked against the database the URI actually
 *   reached AFTER connecting. A mismatch exits 2 before anything is read, let alone written.
 *
 * WRITE SURFACE — deliberately small enough to grep:
 *   every write in this file is an `updateMany` issued by runUpdate() at ONE call site.
 *   There is no bulkWrite, no updateOne, no replaceOne, no insert, no delete, no save, no drop.
 *
 * IDEMPOTENT. Each field is matched by `$expr` on "is this value not already noon of its own
 * day", and the pipeline re-applies `$cond` on the same predicate, so a second run matches
 * nothing and modifies nothing. That is the GATE 3 check: run it twice, the second run must
 * report modified = 0 everywhere.
 *
 * Why an aggregation-pipeline update and not arrayFilters: arrayFilters can select which array
 * elements to touch, but the value it sets must be a constant. Every value here is DERIVED from
 * the element's own stored date, which only a pipeline can compute server-side. `$map` with
 * `$mergeObjects` rewrites exactly the one sub-field and carries every other field of the element
 * through untouched -- a tighter guarantee than arrayFilters would give, not a looser one.
 *
 * Prints matched and modified per field. Counts and field names only: no PNRs, no passenger
 * data, no amounts.
 *
 *   node scripts/write-date-only-to-noon.js --db travel_window_staging_copy --confirm
 *   node scripts/write-date-only-to-noon.js --db travel_window_staging --confirm
 */
require('dotenv').config();
if (process.env.SCRIPT_DNS) require('dns').setServers(process.env.SCRIPT_DNS.split(','));

const mongoose = require('mongoose');

const arg = (name) => {
  const i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : null;
};
const flag = (name) => process.argv.includes('--' + name);

const DB = arg('db');
const URI = arg('uri') || process.env.MONGODB_URI;
const CONFIRM = flag('confirm');

if (!DB) {
  console.error('Refusing to run: --db <name> is required. There is no default.');
  process.exit(2);
}
if (!URI) { console.error('Refusing to run: no --uri and no MONGODB_URI.'); process.exit(2); }
if (!CONFIRM) {
  console.error('Refusing to run: --confirm is required. This script WRITES.');
  console.error('Run scripts/live-counter.js --db ' + DB + ' first and read the figures.');
  process.exit(2);
}

/** Noon UTC on the same calendar day as `expr`, as an aggregation expression. */
const noon = (expr) => ({
  $dateFromParts: {
    year: { $year: { date: expr, timezone: 'UTC' } },
    month: { $month: { date: expr, timezone: 'UTC' } },
    day: { $dayOfMonth: { date: expr, timezone: 'UTC' } },
    hour: 12, minute: 0, second: 0, millisecond: 0,
    timezone: 'UTC'
  }
});

/**
 * $dateFromParts refuses a year outside 1..9999 -- "'year' must evaluate to an integer in the
 * range 1 to 9999". The staging copy stores twelve typo'd years above that (22026, 272026,
 * 20274 ...; see the implausible-date sweep), and without this guard the whole updateMany aborts
 * on them and NOTHING migrates. The rehearsal failed exactly that way before this was added.
 *
 * Such a value is left alone deliberately. This migration applies the noon convention; it does
 * not repair typed data, and which of those rows is really 2026 is the client's call, not a
 * script's. They are reported separately by live-counter.js as out-of-range.
 *
 * The guard is the SECOND clause so the $ne below -- which evaluates noon() -- is never reached
 * for one: aggregation $and short-circuits. The same bound is repeated in each updateMany's
 * query filter, so such a document is not even matched.
 */
const yearOk = (expr) => ({
  $and: [
    { $gte: [{ $year: { date: expr, timezone: 'UTC' } }, 1] },
    { $lte: [{ $year: { date: expr, timezone: 'UTC' } }, 9999] }
  ]
});

/** True when `expr` is a usable date that is not already noon of its own day. */
const needsChange = (expr) => ({
  $and: [
    { $eq: [{ $type: expr }, 'date'] },
    yearOk(expr),
    { $ne: [expr, noon(expr)] }
  ]
});

/** Leave anything that is not a stale date exactly as it is. */
const noonIfStale = (expr) => ({ $cond: [needsChange(expr), noon(expr), expr] });

// The seven date-only fields, in the dry run's order. Scalars are set by path; arrays are
// rebuilt with $map + $mergeObjects so only the named sub-field can change.
const SCALARS = [
  'travelDate',
  'returnDate',
  'cancellation.upfrontCollection.collectionDate',
  'cancellation.refundReceivedFromSupplier.date',
  'cancellation.refundPaidToClient.date'
];
const ARRAYS = [
  { array: 'payments', key: 'paymentDate' },
  { array: 'multipleSectors', key: 'travelDate' }
];

(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 20000 });
  const actual = mongoose.connection.name;
  if (actual !== DB) {
    console.error(`Refusing to run: --db said "${DB}" but the URI connected to "${actual}".`);
    await mongoose.disconnect();
    process.exit(2);
  }
  const col = mongoose.connection.db.collection('bookings');

  console.log('='.repeat(78));
  console.log('DATE-ONLY MIGRATION — WRITING');
  console.log(`database : ${actual}`);
  console.log(`ran at   : ${new Date().toISOString()}`);
  console.log('='.repeat(78));

  let totalMatched = 0, totalModified = 0;

  // THE ONLY WRITE CALL SITE IN THIS FILE.
  const runUpdate = async (label, filter, pipeline) => {
    const res = await col.updateMany(filter, pipeline);
    totalMatched += res.matchedCount;
    totalModified += res.modifiedCount;
    console.log(`${String(label).padEnd(48)} matched ${String(res.matchedCount).padStart(6)}   modified ${String(res.modifiedCount).padStart(6)}`);
    return res;
  };

  for (const path of SCALARS) {
    await runUpdate(
      path,
      { $expr: needsChange('$' + path) },
      [{ $set: { [path]: noonIfStale('$' + path) } }]
    );
  }

  for (const { array, key } of ARRAYS) {
    const el = '$$el.' + key;
    await runUpdate(
      `${array}[].${key}`,
      { $expr: { $anyElementTrue: { $map: {
        input: { $ifNull: ['$' + array, []] }, as: 'el', in: needsChange(el)
      } } } },
      [{ $set: { [array]: { $map: {
        input: { $ifNull: ['$' + array, []] }, as: 'el',
        // $mergeObjects keeps every other field of the element exactly as stored.
        in: { $mergeObjects: ['$$el', { [key]: noonIfStale(el) }] }
      } } } }]
    );
  }

  console.log('-'.repeat(78));
  console.log(`${'TOTAL'.padEnd(48)} matched ${String(totalMatched).padStart(6)}   modified ${String(totalModified).padStart(6)}`);
  console.log('='.repeat(78));
  console.log(totalModified === 0
    ? 'Nothing changed. On a second run that is the expected result (idempotent).'
    : 'Now re-run scripts/live-counter.js --db ' + DB + ' — TOTAL PENDING must be 0.');

  await mongoose.disconnect();
  process.exit(0);
})().catch(async e => {
  console.error(e && e.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
