'use strict';
// Run: node tests/report-pagination.test.js
// Reports C, D and E must compute totals over ALL matching bookings, and page rows in a stable order.
const assert = require('assert');
const mongoose = require('mongoose');
const { startReports } = require('./report-harness');

const oid = () => new mongoose.Types.ObjectId();
const A = { _id: oid(), name: 'AgentA' };
const B = { _id: oid(), name: 'AgentB' };
const N = 120; // more than the old default page of 50
const SAME_DAY = new Date('2026-05-10T15:00:00Z'); // identical dates force the _id tiebreaker

function makeBooking(i, withChange) {
  return {
    _id: oid(), pnr: 'P' + String(i).padStart(4, '0'), paxName: 'PAX', status: 'Pending Verification',
    dateOfSubmission: SAME_DAY, travelDate: new Date('2026-06-01T12:00:00Z'), returnDate: null,
    submittedBy: A, submittedByName: A.name, assignedTo: A._id,
    salePrice: 100, ourCost: 40, supplierCharges: 0, supplierBookingCharge: 0, totalSalePrice: 100,
    dateChanges: withChange ? [{ changedAt: new Date('2026-05-20T15:00:00Z'), marginSplit: { originalUserAmount: 5, modifierUserAmount: 5, modifierId: B._id, modifierName: B.name } }] : [],
    flightChanges: [], seatBookChanges: []
  };
}

let passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { console.error(`FAIL: ${name}\n  ${e.message}`); process.exitCode = 1; }
}
const round2 = n => Math.round(n * 100) / 100;
const RANGE = { dateFrom: '2026-05-01', dateTo: '2026-06-30' };

async function pagesOf(api, endpoint, limit) {
  const first = await api.get(endpoint, { ...RANGE, page: 1, limit });
  const pages = [first];
  for (let p = 2; p <= first.totalPages; p++) pages.push(await api.get(endpoint, { ...RANGE, page: p, limit }));
  return pages;
}

(async () => {
  const bookings = Array.from({ length: N }, (_, i) => makeBooking(i, i % 4 === 0)); // 30 have a modifier
  const api = await startReports('../routes/reports', bookings);
  const expectedTotal = N * 60; // each booking nets 60 across creator + modifier shares

  await check('C: default call (no limit/page) counts every booking, not 50', async () => {
    const r = await api.get('agent-margin', RANGE);
    const a = r.find(x => x.agentName === 'AgentA');
    assert.strictEqual(a.totalBookings, N);
    assert.strictEqual(round2(r.reduce((s, x) => s + x.totalMargin, 0)), expectedTotal);
  });

  await check('E: default call returns every row and totals over all of them', async () => {
    const r = await api.get('agent-margin-report', RANGE);
    assert.strictEqual(r.bookings.length, N + 30); // creator rows + modifier rows
    assert.strictEqual(r.total, N + 30);
    assert.strictEqual(round2(r.totalMargin), expectedTotal);
  });

  await check('D: default call returns every row, with total and totalMargin', async () => {
    const r = await api.get('agent-booking-list', RANGE);
    assert.strictEqual(r.bookings.length, N + 30);
    assert.strictEqual(r.total, N + 30);
    assert.strictEqual(round2(r.totalMargin), expectedTotal);
  });

  for (const endpoint of ['agent-margin-report', 'agent-booking-list']) {
    await check(`${endpoint}: paging by 50 gives no duplicate or missing rows, same order as the full list`, async () => {
      const full = await api.get(endpoint, RANGE);
      const pages = await pagesOf(api, endpoint, 50);
      assert.strictEqual(pages.length, Math.ceil((N + 30) / 50));
      const ids = pages.flatMap(p => p.bookings.map(r => String(r._id)));
      assert.strictEqual(new Set(ids).size, ids.length, 'duplicate rows across pages');
      assert.deepStrictEqual(ids, full.bookings.map(r => String(r._id)));
    });
    await check(`${endpoint}: totals are the same on every page and cover all rows`, async () => {
      const pages = await pagesOf(api, endpoint, 50);
      for (const p of pages) {
        assert.strictEqual(p.total, N + 30);
        assert.strictEqual(round2(p.totalMargin), expectedTotal);
        assert.strictEqual(p.limit, 50);
      }
    });
    await check(`${endpoint}: page past the end is empty but keeps the totals`, async () => {
      const r = await api.get(endpoint, { ...RANGE, page: 99, limit: 50 });
      assert.strictEqual(r.bookings.length, 0);
      assert.strictEqual(r.total, N + 30);
    });
    await check(`${endpoint}: junk limit falls back to the default page size`, async () => {
      const r = await api.get(endpoint, { ...RANGE, page: 1, limit: 'foo' });
      assert.strictEqual(r.bookings.length, 50);
    });
  }

  await check('E: employee filter totals only that employee\'s rows', async () => {
    const r = await api.get('agent-margin-report', { ...RANGE, employee: String(B._id) });
    assert.strictEqual(r.total, 30);
    assert.strictEqual(round2(r.totalMargin), 30 * 5);
  });

  api.close();
  console.log(`\n${passed} checks passed${process.exitCode ? ', SOME FAILED' : ''}`);
})();
