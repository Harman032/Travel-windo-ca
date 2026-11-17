'use strict';
/**
 * VERIFIED-FLAG BACKFILL — THE WRITE. Live-capable.
 *
 * The CRM carries two pairs of verification flags for historical reasons:
 *
 *   verifiedByAccount / verifiedByAdmin   drive the booking-detail lock and the list filter
 *   accountVerified   / adminVerified     are what every report reads
 *
 * POST /verify-admin and /verify-account set only the first pair, while the edit path sets both,
 * so 204 bookings in the copy are verified by the lock and unverified to the reports. This
 * reconciles them in both directions. backfill-verified-flags.js is the DRY RUN and stays
 * copy-only forever; this is the only script that writes.
 *
 *   --db is REQUIRED, has no default, and is checked against the database the URI actually
 *   reached AFTER connecting. A mismatch exits 2.
 *
 * WRITE SURFACE — every write in this file is an `updateMany` issued by runUpdate() at ONE call
 * site. No bulkWrite, no updateOne, no replaceOne, no insert, no delete, no save, no drop.
 *
 * IDEMPOTENT by construction: each filter requires the target flag to be NOT already true, so a
 * second run matches nothing. Only the four boolean flags are ever written -- no dates, no
 * amounts, no status.
 *
 * Prints matched and modified per direction. Counts only: no PNRs, no passenger data.
 *
 *   node scripts/write-verified-flags.js --db travel_window_staging_copy --confirm
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

if (!DB) { console.error('Refusing to run: --db <name> is required. There is no default.'); process.exit(2); }
if (!URI) { console.error('Refusing to run: no --uri and no MONGODB_URI.'); process.exit(2); }
if (!CONFIRM) {
  console.error('Refusing to run: --confirm is required. This script WRITES.');
  process.exit(2);
}

// Both directions, exactly as the dry run enumerates them.
const DIRECTIONS = [
  { label: 'adminVerified     <- verifiedByAdmin',   set: 'adminVerified',     from: 'verifiedByAdmin' },
  { label: 'accountVerified   <- verifiedByAccount', set: 'accountVerified',   from: 'verifiedByAccount' },
  { label: 'verifiedByAdmin   <- adminVerified',     set: 'verifiedByAdmin',   from: 'adminVerified' },
  { label: 'verifiedByAccount <- accountVerified',   set: 'verifiedByAccount', from: 'accountVerified' }
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
  console.log('VERIFIED-FLAG BACKFILL — WRITING');
  console.log(`database : ${actual}`);
  console.log(`ran at   : ${new Date().toISOString()}`);
  console.log('='.repeat(78));

  let totalMatched = 0, totalModified = 0;

  // A booking can be matched by more than one direction (verified by BOTH admin and account),
  // so the sum of the four counts overstates how many bookings were touched. Collect the ids
  // before writing, so the figure is the number of distinct bookings this run changes.
  const touched = new Set();

  // THE ONLY WRITE CALL SITE IN THIS FILE.
  const runUpdate = async (label, filter, update) => {
    const res = await col.updateMany(filter, update);
    totalMatched += res.matchedCount;
    totalModified += res.modifiedCount;
    console.log(`${String(label).padEnd(44)} matched ${String(res.matchedCount).padStart(6)}   modified ${String(res.modifiedCount).padStart(6)}`);
    return res;
  };

  for (const d of DIRECTIONS) {
    const willChange = await col.find({ [d.from]: true, [d.set]: { $ne: true } },
      { projection: { _id: 1 } }).toArray();
    for (const r of willChange) touched.add(String(r._id));
    await runUpdate(
      d.label,
      // `$ne: true` also covers the field being absent, which is how most legacy rows store it.
      { [d.from]: true, [d.set]: { $ne: true } },
      { $set: { [d.set]: true } }
    );
  }

  console.log('-'.repeat(78));
  console.log(`${'TOTAL'.padEnd(44)} matched ${String(totalMatched).padStart(6)}   modified ${String(totalModified).padStart(6)}`);
  console.log(`${'DISTINCT BOOKINGS TOUCHED'.padEnd(44)} ${String(touched.size).padStart(21)}`);

  // Prove the two populations now agree, from the data rather than from the counts above.
  const live = { status: { $ne: 'Cancelled' } };
  const lockSays = await col.countDocuments({ ...live, $or: [
    { adminVerified: true }, { verifiedByAdmin: true },
    { accountVerified: true }, { verifiedByAccount: true }
  ] });
  const reportSays = await col.countDocuments({ ...live, $or: [
    { adminVerified: true }, { accountVerified: true }
  ] });
  console.log('='.repeat(78));
  console.log(`verified per the booking lock : ${lockSays}`);
  console.log(`verified per the reports      : ${reportSays}`);
  console.log(lockSays === reportSays
    ? 'AGREE — this is what GATE 7 requires.'
    : `MISMATCH of ${lockSays - reportSays}. GATE 7 FAILS. Investigate before going further.`);
  console.log('='.repeat(78));

  await mongoose.disconnect();
  process.exit(lockSays === reportSays ? 0 : 1);
})().catch(async e => {
  console.error(e && e.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
