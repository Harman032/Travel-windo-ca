'use strict';
// Date-only fields must be stored at noon UTC so they read as the same calendar day in every
// timezone. Run in several server zones: the convention must not depend on the server's clock.
//
//   node tests/date-only.test.js --tz UTC
const tzArg = process.argv.indexOf('--tz');
if (tzArg !== -1 && process.argv[tzArg + 1]) process.env.TZ = process.argv[tzArg + 1];

const assert = require('assert');
const { parseDateInput, normalizePayments, isNoonUtc, toNoonUtc, NOON_UTC } = require('../utils/date-only');
const { dayInTz } = require('../utils/tz');

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };
const serverTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log(`date-only tests — server TZ = ${serverTz}`);

console.log('\nparseDateInput');

t('a date-only string becomes noon UTC on that same day', () => {
  const d = parseDateInput('2026-09-07');
  assert.strictEqual(d.toISOString(), '2026-09-07T12:00:00.000Z');
  assert.strictEqual(d.getUTCHours(), NOON_UTC);
});

t('noon UTC reads as the same calendar day from UTC-11 to UTC+11', () => {
  const d = parseDateInput('2026-09-07');
  for (const tz of ['UTC', 'America/Toronto', 'America/Los_Angeles', 'America/Anchorage',
                    'Pacific/Niue', 'Europe/London', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney']) {
    assert.strictEqual(dayInTz(d, tz), '2026-09-07', `${tz} must read 2026-09-07`);
  }
  // Noon UTC is NOT universal: real offsets run from UTC-12 to UTC+14, so the extreme eastern
  // zones roll over. Toronto is UTC-4/-5, so noon lands at 07:00/08:00 there and is always safe.
  assert.strictEqual(dayInTz(d, 'Pacific/Kiritimati'), '2026-09-08', 'UTC+14 rolls over, as expected');
  assert.strictEqual(dayInTz(d, 'America/Toronto'), '2026-09-07');
});

t('00:00Z would NOT survive that test — this is the bug being fixed', () => {
  const midnight = new Date('2026-09-07T00:00:00Z');
  assert.strictEqual(dayInTz(midnight, 'UTC'), '2026-09-07');
  assert.strictEqual(dayInTz(midnight, 'America/Toronto'), '2026-09-06', 'reads a day early in Toronto');
});

t('a date-only string is parsed the same whatever the server zone', () => {
  // The implementation uses Date.UTC, so this holds by construction; assert it anyway.
  assert.strictEqual(parseDateInput('2026-01-15').toISOString(), '2026-01-15T12:00:00.000Z');
  assert.strictEqual(parseDateInput('2026-07-15').toISOString(), '2026-07-15T12:00:00.000Z');
});

t('a full ISO timestamp is kept as the instant it is', () => {
  assert.strictEqual(parseDateInput('2026-09-07T03:27:00Z').toISOString(), '2026-09-07T03:27:00.000Z');
});

t('a Date passes through, an invalid Date becomes null', () => {
  const d = new Date('2026-09-07T03:27:00Z');
  assert.strictEqual(parseDateInput(d), d);
  assert.strictEqual(parseDateInput(new Date('nonsense')), null);
});

t('empty, null and undefined become null so callers can default', () => {
  assert.strictEqual(parseDateInput(''), null);
  assert.strictEqual(parseDateInput(null), null);
  assert.strictEqual(parseDateInput(undefined), null);
  assert.strictEqual(parseDateInput('not a date'), null);
});

t('whitespace around a date-only string is tolerated', () => {
  assert.strictEqual(parseDateInput('  2026-09-07 ').toISOString(), '2026-09-07T12:00:00.000Z');
});

console.log('\nnormalizePayments');

t('a payment sent as a date-only string is stored at noon UTC', () => {
  const [p] = normalizePayments([{ paidAmount: 100, paymentMode: 'Cash', paymentDate: '2026-09-07' }]);
  assert.strictEqual(p.paymentDate.toISOString(), '2026-09-07T12:00:00.000Z');
  assert.ok(isNoonUtc(p.paymentDate));
  assert.strictEqual(dayInTz(p.paymentDate, 'America/Toronto'), '2026-09-07');
});

t('paidAmount is coerced to a number and paymentMode defaults to Cash', () => {
  const [p] = normalizePayments([{ paidAmount: '250.50', paymentDate: '2026-09-07' }]);
  assert.strictEqual(p.paidAmount, 250.5);
  assert.strictEqual(p.paymentMode, 'Cash');
  assert.strictEqual(p.referenceNo, '');
});

t('a missing paymentDate falls back to now, not to an invalid Date', () => {
  const [p] = normalizePayments([{ paidAmount: 1 }]);
  assert.ok(p.paymentDate instanceof Date && !isNaN(p.paymentDate.getTime()));
});

t('an unparseable paymentDate falls back to now rather than saving Invalid Date', () => {
  const [p] = normalizePayments([{ paidAmount: 1, paymentDate: 'rubbish' }]);
  assert.ok(p.paymentDate instanceof Date && !isNaN(p.paymentDate.getTime()));
});

t('a non-array is an empty list', () => {
  assert.deepStrictEqual(normalizePayments(undefined), []);
  assert.deepStrictEqual(normalizePayments(null), []);
});

console.log('\nmigration helpers');

t('isNoonUtc recognises the convention and rejects midnight', () => {
  assert.ok(isNoonUtc(new Date('2026-09-07T12:00:00Z')));
  assert.ok(!isNoonUtc(new Date('2026-09-07T00:00:00Z')));
  assert.ok(!isNoonUtc(new Date('2026-09-07T12:30:00Z')));
  assert.ok(!isNoonUtc(null));
});

t('toNoonUtc keeps the stored UTC calendar day', () => {
  // A legacy 00:00Z row: the day the user typed is the UTC day, so that day is preserved.
  assert.strictEqual(toNoonUtc(new Date('2026-09-07T00:00:00Z')).toISOString(), '2026-09-07T12:00:00.000Z');
  assert.strictEqual(toNoonUtc(new Date('2026-09-07T12:00:00Z')).toISOString(), '2026-09-07T12:00:00.000Z');
  assert.strictEqual(toNoonUtc('nonsense'), null);
});

t('toNoonUtc is idempotent', () => {
  const once = toNoonUtc(new Date('2026-09-07T00:00:00Z'));
  assert.strictEqual(toNoonUtc(once).toISOString(), once.toISOString());
});

console.log(`\n${passed} assertions passed under TZ=${process.env.TZ || serverTz}`);
