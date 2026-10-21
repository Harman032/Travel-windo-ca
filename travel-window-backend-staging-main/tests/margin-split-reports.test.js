'use strict';
// Run: node tests/margin-split-reports.test.js
// Modification margin splits must be reported on the date the change was made.
const assert = require('assert');
const mongoose = require('mongoose');
const { startReports } = require('./report-harness');
const { getSplitSummary, buildRange } = require('../utils/margin-split');

const oid = () => new mongoose.Types.ObjectId();
const A = { _id: oid(), name: 'NANDANI' };   // creator
const B = { _id: oid(), name: 'Deepak' };    // modifier
const C = { _id: oid(), name: 'Third' };

const change = (when, orig, mod, modifier) => ({
  changedAt: new Date(when),
  salePriceAddon: orig + mod,
  ourCostAddon: 0,
  marginSplit: { originalUserAmount: orig, modifierUserAmount: mod, modifierId: mod > 0 ? modifier._id : null, modifierName: mod > 0 ? modifier.name : '' }
});

function booking(overrides) {
  return Object.assign({
    _id: oid(), pnr: 'AWTHSX', paxName: 'PAX', status: 'Pending Verification',
    dateOfSubmission: new Date('2026-04-13T10:00:00Z'),
    travelDate: new Date('2026-10-01T12:00:00Z'), returnDate: new Date('2026-11-11T12:00:00Z'),
    submittedBy: A, submittedByName: A.name, assignedTo: A._id,
    salePrice: 1235, ourCost: 0, supplierCharges: 0, supplierBookingCharge: 0, totalSalePrice: 1235,
    dateChanges: [change('2026-09-12T18:00:00Z', 523, 523, B)], flightChanges: [], seatBookChanges: []
  }, overrides);
}

const SEPT12 = { dateFrom: '2026-09-12', dateTo: '2026-09-12' };
const APRIL13 = { dateFrom: '2026-04-13', dateTo: '2026-04-13' };
const sum = (rows, key = 'margin') => Math.round(rows.reduce((s, r) => s + r[key], 0) * 100) / 100;
const rowFor = (res, name, mod) => res.bookings.find(r => r.submittedByName === name && !!r.isModifierRow === mod);
const agent = (res, name) => (res.find(a => a.agentName === name) || { totalMargin: 0 }).totalMargin;

let passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { console.error(`FAIL: ${name}\n  ${e.message}`); process.exitCode = 1; }
}

(async () => {
  const data = [booking({})];
  const api = await startReports('../routes/reports', data);

  // --- the AWTHSX case: booked in April, modified 12-09 ---
  await check('E: modifier credited on the change date (12-09 range)', async () => {
    const r = await api.get('agent-margin-report', { ...SEPT12, employee: String(B._id) });
    assert.strictEqual(rowFor(r, 'Deepak', true).margin, 523);
  });
  await check('E: creator credited with their share on the change date, no booking base', async () => {
    const r = await api.get('agent-margin-report', { ...SEPT12, employee: String(A._id) });
    assert.strictEqual(rowFor(r, 'NANDANI', false).margin, 523);
  });
  await check('E: booking-date range shows base margin without the add-on', async () => {
    const r = await api.get('agent-margin-report', { ...APRIL13 });
    assert.strictEqual(rowFor(r, 'NANDANI', false).margin, 189);
    assert.strictEqual(rowFor(r, 'Deepak', true), undefined);
  });
  await check('E: disjoint ranges add up to the real booking margin (no double counting)', async () => {
    const apr = await api.get('agent-margin-report', { ...APRIL13 });
    const sep = await api.get('agent-margin-report', { ...SEPT12 });
    assert.strictEqual(apr.totalMargin + sep.totalMargin, 1235);
  });
  await check('E: a range covering both matches the previous numbers (A 712, B 523)', async () => {
    const r = await api.get('agent-margin-report', { dateFrom: '2026-04-01', dateTo: '2026-09-30' });
    assert.strictEqual(rowFor(r, 'NANDANI', false).margin, 712);
    assert.strictEqual(rowFor(r, 'Deepak', true).margin, 523);
    assert.strictEqual(r.totalMargin, 1235);
  });
  await check('E: no date range matches the previous numbers', async () => {
    const r = await api.get('agent-margin-report', {});
    assert.strictEqual(rowFor(r, 'NANDANI', false).margin, 712);
    assert.strictEqual(r.totalMargin, 1235);
  });
  await check('C: 12-09 range lists both agents; credits equal the add-on margin', async () => {
    const r = await api.get('agent-margin', SEPT12);
    assert.strictEqual(agent(r, 'Deepak'), 523);
    assert.strictEqual(agent(r, 'NANDANI'), 523);
    assert.strictEqual(r.find(a => a.agentName === 'NANDANI').totalBookings, 0);
  });
  await check('C: sum over disjoint ranges equals booking margin; full range unchanged', async () => {
    const parts = await Promise.all([APRIL13, SEPT12].map(p => api.get('agent-margin', p)));
    const total = parts.reduce((s, r) => s + agent(r, 'NANDANI') + agent(r, 'Deepak'), 0);
    assert.strictEqual(total, 1235);
    const all = await api.get('agent-margin', {});
    assert.strictEqual(agent(all, 'NANDANI'), 712);
    assert.strictEqual(agent(all, 'Deepak'), 523);
  });
  await check('D: booking returned by its change date even though travel/return dates are outside the range', async () => {
    const r = await api.get('agent-booking-list', { ...SEPT12, employee: String(B._id) });
    assert.strictEqual(r.bookings.length, 1);
    assert.strictEqual(r.bookings[0].ourMargin, 523);
  });
  await check('D: travel-date range keeps the booking row and subtracts the full split', async () => {
    const r = await api.get('agent-booking-list', { dateFrom: '2026-10-01', dateTo: '2026-10-01', employee: String(A._id) });
    assert.strictEqual(r.bookings.find(x => !x.isModifierRow).ourMargin, 189);
  });

  // --- edge cases ---
  await check('creator modifies own booking: 100% to creator, no modifier row', async () => {
    const api2 = await startReports('../routes/reports', [booking({ dateChanges: [change('2026-09-12T18:00:00Z', 1046, 0, null)] })]);
    const r = await api2.get('agent-margin-report', SEPT12);
    assert.strictEqual(r.bookings.length, 1);
    assert.strictEqual(r.bookings[0].margin, 1046);
    api2.close();
  });
  await check('margin <= 0: no split, creator absorbs the negative on the change date', async () => {
    const api2 = await startReports('../routes/reports', [booking({ dateChanges: [change('2026-09-12T18:00:00Z', -50, 0, null)] })]);
    const r = await api2.get('agent-margin-report', SEPT12);
    assert.strictEqual(r.bookings[0].margin, -50);
    api2.close();
  });
  await check('multiple modifiers on one booking, in different months', async () => {
    const bk = booking({ dateChanges: [change('2026-09-12T18:00:00Z', 100, 100, B)], flightChanges: [change('2026-10-05T18:00:00Z', 50, 50, C)] });
    const api2 = await startReports('../routes/reports', [bk]);
    const sep = await api2.get('agent-margin', SEPT12);
    assert.strictEqual(agent(sep, 'Deepak'), 100);
    assert.strictEqual(agent(sep, 'Third'), 0);
    const oct = await api2.get('agent-margin', { dateFrom: '2026-10-01', dateTo: '2026-10-31' });
    assert.strictEqual(agent(oct, 'Third'), 50);
    const all = await api2.get('agent-margin', {});
    assert.strictEqual(agent(all, 'NANDANI') + agent(all, 'Deepak') + agent(all, 'Third'), 1235 + 0);
    api2.close();
  });
  await check('legacy change without a stored split stays in the booking-date margin', async () => {
    const bk = booking({ dateChanges: [{ changedAt: new Date('2026-09-12T18:00:00Z'), salePriceAddon: 1046, ourCostAddon: 0 }] });
    const api2 = await startReports('../routes/reports', [bk]);
    assert.strictEqual((await api2.get('agent-margin', SEPT12)).length, 0);
    assert.strictEqual(agent(await api2.get('agent-margin', APRIL13), 'NANDANI'), 1235);
    api2.close();
  });
  await check('cancelled booking (Report E): split rows still follow the change date; currentMargin keeps old formula', async () => {
    const bk = booking({ status: 'Cancelled', cancellation: { isCancelled: true, currentMargin: 100, newMargin: 0 } });
    const api2 = await startReports('../routes/reports', [bk]);
    const all = await api2.get('agent-margin-report', {});
    assert.strictEqual(rowFor(all, 'NANDANI', false).currentMargin, 100 - 523);
    const sep = await api2.get('agent-margin-report', { ...SEPT12, employee: String(B._id) });
    assert.strictEqual(rowFor(sep, 'Deepak', true).margin, 523);
    api2.close();
  });

  await check('getSplitSummary: with no range every split counts', () => {
    const bk = booking({ dateChanges: [change('2026-09-12T18:00:00Z', 5, 5, B), change('2026-10-01T00:00:00Z', 7, 7, B)] });
    const s = getSplitSummary(bk, null);
    assert.strictEqual(s.modifiers[String(B._id)].amount, 12);
    assert.strictEqual(s.creatorInRange, 12);
    assert.strictEqual(s.netAll, 24);
  });

  // --- business-timezone boundaries (America/Toronto) ---
  const iso = r => [r.$gte.toISOString(), r.$lte.toISOString()];
  await check('buildRange: a summer day is 04:00Z to 03:59:59.999Z next day (EDT)', () => {
    assert.deepStrictEqual(iso(buildRange('2026-09-12', '2026-09-12', 'America/Toronto')),
      ['2026-09-12T04:00:00.000Z', '2026-09-13T03:59:59.999Z']);
  });
  await check('buildRange: a winter day uses EST (05:00Z)', () => {
    assert.strictEqual(buildRange('2026-01-15', '2026-01-15', 'America/Toronto').$gte.toISOString(), '2026-01-15T05:00:00.000Z');
  });
  await check('buildRange: DST fall-back day (2026-11-01) is 25h; spring-forward (2026-03-08) is 23h', () => {
    assert.deepStrictEqual(iso(buildRange('2026-11-01', '2026-11-01', 'America/Toronto')),
      ['2026-11-01T04:00:00.000Z', '2026-11-02T04:59:59.999Z']);
    assert.deepStrictEqual(iso(buildRange('2026-03-08', '2026-03-08', 'America/Toronto')),
      ['2026-03-08T05:00:00.000Z', '2026-03-09T03:59:59.999Z']);
  });
  await check('buildRange: non date-only input keeps the old behaviour', () => {
    assert.strictEqual(buildRange('2026-09-12T10:00:00Z', null).$gte.toISOString(), '2026-09-12T10:00:00.000Z');
  });
  await check('change at 23:27 Toronto (crosses UTC midnight) belongs to 12-09, not 13-09', async () => {
    const late = booking({ dateChanges: [change('2026-09-13T03:27:00Z', 523, 523, B)] });
    const api2 = await startReports('../routes/reports', [late]);
    const on12 = await api2.get('agent-margin', SEPT12);
    assert.strictEqual(agent(on12, 'Deepak'), 523);
    assert.strictEqual(agent(on12, 'NANDANI'), 523);
    const on13 = await api2.get('agent-margin', { dateFrom: '2026-09-13', dateTo: '2026-09-13' });
    assert.strictEqual(on13.length, 0);
    const e = await api2.get('agent-margin-report', { ...SEPT12, employee: String(B._id) });
    assert.strictEqual(rowFor(e, 'Deepak', true).margin, 523);
    api2.close();
  });
  await check('AWTHSX real timestamps: booked 2026-04-12T23:49Z is 12-04 in Toronto; change 2026-09-12T17:57Z is 12-09', async () => {
    const bk = booking({ dateOfSubmission: new Date('2026-04-12T23:49:56.899Z'), dateChanges: [change('2026-09-12T17:57:00Z', 523, 523, B)] });
    const api2 = await startReports('../routes/reports', [bk]);
    assert.strictEqual(agent(await api2.get('agent-margin', { dateFrom: '2026-04-12', dateTo: '2026-04-12' }), 'NANDANI'), 189);
    assert.strictEqual((await api2.get('agent-margin', { dateFrom: '2026-04-13', dateTo: '2026-04-13' })).length, 0);
    assert.strictEqual(agent(await api2.get('agent-margin', SEPT12), 'Deepak'), 523);
    api2.close();
  });
  await check('booking at 22:00 Toronto on 12-04 (= 13-04 02:00Z) is reported on 12-04', async () => {
    const bk = booking({ dateOfSubmission: new Date('2026-04-13T02:00:00Z'), dateChanges: [] });
    const api2 = await startReports('../routes/reports', [bk]);
    assert.strictEqual((await api2.get('agent-margin', { dateFrom: '2026-04-12', dateTo: '2026-04-12' })).length, 1);
    assert.strictEqual((await api2.get('agent-margin', { dateFrom: '2026-04-13', dateTo: '2026-04-13' })).length, 0);
    api2.close();
  });

  api.close();
  console.log(`\n${passed} checks passed${process.exitCode ? ', SOME FAILED' : ''}`);
})();
