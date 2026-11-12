'use strict';
// Every report and list date filter must draw the same Toronto day boundaries no matter what
// timezone the server process runs in. The assertions below must pass identically under every
// server zone.
//
//   node tests/timezone.test.js --tz UTC
//   node tests/timezone.test.js --tz Asia/Kolkata
//   node tests/timezone.test.js --tz America/Los_Angeles
//
// `npm run test:timezone` runs all three. The zone is applied by assigning process.env.TZ here,
// before anything else loads, rather than with a `TZ=... node` prefix: on Windows, Git Bash
// mangles an env-var prefix whose value contains a slash, so `TZ=Asia/Kolkata node ...` silently
// does nothing and the run would appear to pass for a zone it never used.
const tzArg = process.argv.indexOf('--tz');
if (tzArg !== -1 && process.argv[tzArg + 1]) process.env.TZ = process.argv[tzArg + 1];

const assert = require('assert');
const mongoose = require('mongoose');
const { startReports } = require('./report-harness');
const { buildRange, dayInTz, startOfDayTz, endOfDayTz, startOfTodayTz, inRange, TZ } = require('../utils/tz');

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };
const serverTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Refuse to report a pass for a zone that was not actually applied: a run that silently fell back
// to the OS zone would otherwise look like evidence for a zone it never exercised.
const requested = process.env.TZ;
console.log(`timezone tests — business TZ = ${TZ}`);
console.log(`  requested server TZ : ${requested || '(none, using OS zone)'}`);
console.log(`  actual server TZ    : ${serverTz}`);
if (requested && requested !== serverTz) {
  // Allow only an alias of the same zone (e.g. Asia/Kolkata resolving to Asia/Calcutta).
  const sameInstant = (z) => new Intl.DateTimeFormat('en-US', {
    timeZone: z, hourCycle: 'h23', dateStyle: undefined, timeStyle: undefined, hour: 'numeric', minute: 'numeric'
  }).format(new Date('2026-09-07T03:27:00Z'));
  if (sameInstant(requested) !== sameInstant(serverTz)) {
    console.error(`\nFAILED: TZ=${requested} was not applied (process is in ${serverTz}). This run proves nothing about ${requested}.`);
    process.exit(3);
  }
  console.log(`  (${serverTz} is this platform's alias for ${requested})`);
}

// ── buildRange boundaries ───────────────────────────────────────────────
console.log('\nbuildRange');

t('a September range starts at 04:00Z (EDT) and ends at 03:59:59.999Z the next month', () => {
  const r = buildRange('2026-09-01', '2026-09-30');
  assert.strictEqual(r.$gte.toISOString(), '2026-09-01T04:00:00.000Z');
  assert.strictEqual(r.$lte.toISOString(), '2026-10-01T03:59:59.999Z');
});

t('a January range uses EST, 05:00Z', () => {
  const r = buildRange('2026-01-01', '2026-01-31');
  assert.strictEqual(r.$gte.toISOString(), '2026-01-01T05:00:00.000Z');
  assert.strictEqual(r.$lte.toISOString(), '2026-02-01T04:59:59.999Z');
});

t('the spring-forward day is 23 hours long', () => {
  // 2026-03-08: Toronto jumps 02:00 -> 03:00 EST->EDT
  const r = buildRange('2026-03-08', '2026-03-08');
  assert.strictEqual(r.$gte.toISOString(), '2026-03-08T05:00:00.000Z');
  assert.strictEqual(r.$lte.toISOString(), '2026-03-09T03:59:59.999Z');
  const hours = (r.$lte - r.$gte + 1) / 3600000;
  assert.strictEqual(hours, 23);
});

t('the fall-back day is 25 hours long', () => {
  // 2026-11-01: Toronto falls back 02:00 -> 01:00 EDT->EST
  const r = buildRange('2026-11-01', '2026-11-01');
  assert.strictEqual(r.$gte.toISOString(), '2026-11-01T04:00:00.000Z');
  assert.strictEqual(r.$lte.toISOString(), '2026-11-02T04:59:59.999Z');
  const hours = (r.$lte - r.$gte + 1) / 3600000;
  assert.strictEqual(hours, 25);
});

t('a one-day range is a whole day, not an instant', () => {
  const r = buildRange('2026-09-07', '2026-09-07');
  assert.ok(inRange(new Date('2026-09-07T04:00:00Z'), r), 'start of day');
  assert.ok(inRange(new Date('2026-09-08T03:59:59.999Z'), r), 'end of day');
  assert.ok(!inRange(new Date('2026-09-07T03:59:59.999Z'), r), 'one ms before');
  assert.ok(!inRange(new Date('2026-09-08T04:00:00Z'), r), 'one ms after');
});

t('no dates gives null (no filter)', () => {
  assert.strictEqual(buildRange(undefined, undefined), null);
  assert.strictEqual(buildRange('', ''), null);
  assert.ok(inRange(new Date(), null), 'a null range matches everything');
});

t('an open-ended range filters only the end that was given', () => {
  const from = buildRange('2026-09-01', undefined);
  assert.ok(from.$lte === undefined);
  assert.ok(inRange(new Date('2030-01-01T00:00:00Z'), from));
  assert.ok(!inRange(new Date('2026-08-31T12:00:00Z'), from));
  const to = buildRange(undefined, '2026-09-30');
  assert.ok(to.$gte === undefined);
  assert.ok(inRange(new Date('2000-01-01T00:00:00Z'), to));
});

// ── the booking a few minutes before midnight Toronto ───────────────────
console.log('\nthe 23:27 Toronto booking');

// 2026-09-06 23:27 Toronto (EDT, UTC-4) is 2026-09-07 03:27 UTC: a different calendar day in UTC.
const LATE = new Date('2026-09-07T03:27:00Z');

t('its Toronto day is the 6th, not the 7th', () => {
  assert.strictEqual(dayInTz(LATE), '2026-09-06');
  assert.strictEqual(LATE.toISOString().slice(0, 10), '2026-09-07', 'UTC disagrees, which is the bug');
});

t('it falls inside a range ending on the 6th', () => {
  assert.ok(inRange(LATE, buildRange('2026-09-01', '2026-09-06')));
});

t('it falls outside a range starting on the 7th', () => {
  assert.ok(!inRange(LATE, buildRange('2026-09-07', '2026-09-30')));
});

t('startOfDayTz / endOfDayTz bracket it on the 6th', () => {
  assert.strictEqual(startOfDayTz(LATE).toISOString(), '2026-09-06T04:00:00.000Z');
  assert.strictEqual(endOfDayTz(LATE).toISOString(), '2026-09-07T03:59:59.999Z');
});

t('startOfTodayTz is midnight Toronto, and is in the past', () => {
  const s = startOfTodayTz();
  assert.strictEqual(dayInTz(s), dayInTz(new Date()));
  assert.ok(s <= new Date());
  assert.ok(new Date() - s < 25 * 3600000);
});

// ── the real report routes ──────────────────────────────────────────────
console.log('\nreport routes over the real router');

const oid = () => new mongoose.Types.ObjectId();
const AGENT = oid();

// Three bookings straddling the Toronto/UTC month boundary.
const bookings = [
  {
    // 23:27 on Sep 6 Toronto -> Sep 7 in UTC. Belongs to September in both, but to the 6th in Toronto.
    _id: oid(), pnr: 'LATE06', paxName: 'X', status: 'Ticketed', dateOfSubmission: LATE,
    travelDate: new Date('2026-10-01T12:00:00Z'), salePrice: 1000, ourCost: 900,
    supplierCharges: 10, supplierBookingCharge: 10, totalSalePrice: 1000, totalPaidAmount: 1000,
    balanceAmount: 0, submittedBy: AGENT, submittedByName: 'Agent One', adminVerified: true,
    payments: [{ paidAmount: 1000, paymentMode: 'Cash', paymentDate: new Date('2026-09-06T12:00:00Z') }]
  },
  {
    // 20:30 on Aug 31 Toronto -> Sep 1 in UTC. August in Toronto, September in UTC.
    _id: oid(), pnr: 'AUG31', paxName: 'Y', status: 'Ticketed', dateOfSubmission: new Date('2026-09-01T00:30:00Z'),
    travelDate: new Date('2026-10-01T12:00:00Z'), salePrice: 500, ourCost: 400,
    supplierCharges: 0, supplierBookingCharge: 0, totalSalePrice: 500, totalPaidAmount: 500,
    balanceAmount: 0, submittedBy: AGENT, submittedByName: 'Agent One', adminVerified: true, payments: []
  },
  {
    // 22:00 on Sep 30 Toronto -> Oct 1 in UTC. September in Toronto, October in UTC.
    // This is the booking the old server-local filters dropped.
    _id: oid(), pnr: 'SEP30', paxName: 'Z', status: 'Ticketed', dateOfSubmission: new Date('2026-10-01T02:00:00Z'),
    travelDate: new Date('2026-10-05T12:00:00Z'), salePrice: 700, ourCost: 600,
    supplierCharges: 0, supplierBookingCharge: 0, totalSalePrice: 700, totalPaidAmount: 700,
    balanceAmount: 0, submittedBy: AGENT, submittedByName: 'Agent One', adminVerified: true, payments: []
  }
];

(async () => {
  const api = await startReports('../routes/reports', bookings);
  const SEPT = { dateFrom: '2026-09-01', dateTo: '2026-09-30' };
  const pnrs = rows => rows.map(r => r.pnr).sort();

  const r = async (path, params) => api.get(path, params);

  const dateWise = await r('date-wise', SEPT);
  assert.deepStrictEqual(pnrs(dateWise.bookings), ['LATE06', 'SEP30'],
    'date-wise: Toronto September is LATE06 + SEP30; AUG31 is August in Toronto');
  assert.strictEqual(dateWise.summary.totalBookings, 2);
  assert.strictEqual(dateWise.summary.totalSalePrice, 1700);
  console.log('  ok  date-wise returns the Toronto September, including the 22:00 Sep 30 booking');
  passed++;

  const empWise = await r('employee-wise', SEPT);
  assert.deepStrictEqual(pnrs(empWise.groups[0].bookings), ['LATE06', 'SEP30']);
  console.log('  ok  employee-wise uses Toronto days');
  passed++;

  const fin = await r('financial-summary', SEPT);
  assert.deepStrictEqual(pnrs(fin.bookings), ['LATE06', 'SEP30']);
  assert.strictEqual(fin.summary.totalSale, 1700);
  console.log('  ok  financial-summary uses Toronto days');
  passed++;

  const ver = await r('verified-payments', { ...SEPT, verificationType: 'original' });
  assert.deepStrictEqual(pnrs(ver.bookings), ['LATE06', 'SEP30']);
  console.log('  ok  verified-payments uses Toronto days');
  passed++;

  const unverSide = await r('verified-payments', { ...SEPT, verificationType: 'unverified' });
  assert.deepStrictEqual(pnrs(unverSide.bookings), [],
    'all three are adminVerified, so the unverified side of the same population is empty');
  console.log('  ok  the unverified side of verified-payments uses the same Toronto days');
  passed++;

  // payment-to-suppliers is a per-supplier statement, not a date-range list, so its Toronto day
  // boundaries are asserted in tests/supplier-statement.test.js instead.

  const margin = await r('agent-margin', SEPT);
  assert.strictEqual(margin.length, 1);
  assert.strictEqual(margin[0].totalBookings, 2, 'agent-margin already used Toronto days and still does');
  console.log('  ok  agent-margin unchanged by the move to utils/tz');
  passed++;

  // August in Toronto picks up the booking UTC calls September.
  const aug = await r('date-wise', { dateFrom: '2026-08-01', dateTo: '2026-08-31' });
  assert.deepStrictEqual(pnrs(aug.bookings), ['AUG31'],
    'the 20:30 Aug 31 Toronto booking belongs to August, not September');
  console.log('  ok  the 20:30 Aug 31 Toronto booking lands in August');
  passed++;

  // Every booking lands in exactly one month.
  const octo = await r('date-wise', { dateFrom: '2026-10-01', dateTo: '2026-10-31' });
  assert.deepStrictEqual(pnrs(octo.bookings), [], 'nothing leaks into October');
  console.log('  ok  no booking is double-counted or lost across month boundaries');
  passed++;

  api.close();
  console.log(`\n${passed} assertions passed under TZ=${process.env.TZ || serverTz}`);
})().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
