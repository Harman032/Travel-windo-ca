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

  // ---------------------------------------------------------------------------------------------
  // Reports that carried .skip().limit() with a default limit of 50 while the UI sends no paging
  // parameters at all, so each reduced its summary over the page it had just truncated itself to
  // and labelled the result as the range. N is 120 here, well past that default, and every
  // expected value is summed independently from the fixture rather than read back from the route.
  // ---------------------------------------------------------------------------------------------
  const listDocs = Array.from({ length: N }, (_, i) => ({
    _id: oid(), pnr: 'L' + String(i).padStart(4, '0'), paxName: 'PAX',
    status: i % 10 === 0 ? 'Unticketed' : 'Pending Verification',
    dateOfSubmission: SAME_DAY, travelDate: new Date('2026-06-01T12:00:00Z'), returnDate: null,
    submittedBy: i % 2 ? B : A, submittedByName: (i % 2 ? B : A).name,
    salePrice: 100 + i, ourCost: 40, supplierCharges: 1, paymentFromCard: 0,
    totalSalePrice: 100 + i, totalPaidAmount: 10 + i, balanceAmount: 90,
    payments: [], dateChanges: [], flightChanges: [], seatBookChanges: []
  }));
  const sum = (f, docs = listDocs) => round2(docs.reduce((t, b) => t + f(b), 0));
  const listApi = await startReports('../routes/reports', listDocs);

  await check('date-wise: no paging params returns every row and totals the range', async () => {
    const r = await listApi.get('date-wise', RANGE);
    assert.strictEqual(r.bookings.length, N, `got ${r.bookings.length} rows`);
    assert.strictEqual(r.summary.totalBookings, N);
    assert.strictEqual(round2(r.summary.totalSalePrice), sum(b => b.totalSalePrice));
    assert.strictEqual(round2(r.summary.totalPaidAmount), sum(b => b.totalPaidAmount));
    assert.strictEqual(round2(r.summary.totalBalance), sum(b => b.balanceAmount));
  });

  await check('date-wise: an explicit page still pages, over the same stable order', async () => {
    const full = await listApi.get('date-wise', RANGE);
    const ids = [];
    for (let page = 1; page <= Math.ceil(N / 50); page++) {
      const r = await listApi.get('date-wise', { ...RANGE, page, limit: 50 });
      ids.push(...r.bookings.map(b => String(b._id)));
    }
    assert.strictEqual(new Set(ids).size, N, 'duplicate or missing rows across pages');
    assert.deepStrictEqual(ids, full.bookings.map(b => String(b._id)), 'page order differs from the full list');
  });

  await check('financial-summary: rows AND totals cover the whole range', async () => {
    const r = await listApi.get('financial-summary', RANGE);
    assert.strictEqual(r.bookings.length, N, `got ${r.bookings.length} rows, tiles said ${r.summary.totalBookings}`);
    assert.strictEqual(r.summary.totalBookings, N);
    assert.strictEqual(round2(r.summary.totalSale), sum(b => b.salePrice));
    assert.strictEqual(round2(r.summary.totalPaid), sum(b => b.totalPaidAmount));
    assert.strictEqual(round2(r.summary.totalMargin), sum(b => b.salePrice - b.ourCost - b.supplierCharges));
    assert.strictEqual(round2(r.summary.totalSupplierCharges), sum(b => b.supplierCharges));
  });

  await check('financial-summary: paging it explicitly gives no duplicates and keeps the totals', async () => {
    const ids = [];
    for (let page = 1; page <= Math.ceil(N / 50); page++) {
      const r = await listApi.get('financial-summary', { ...RANGE, page, limit: 50 });
      assert.strictEqual(r.summary.totalBookings, N, 'the tiles are range totals on every page');
      assert.strictEqual(round2(r.summary.totalSale), sum(b => b.salePrice));
      ids.push(...r.bookings.map(b => String(b._id)));
    }
    assert.strictEqual(new Set(ids).size, N, 'duplicate or missing rows across pages');
  });

  listApi.close();

  console.log(`\n${passed} checks passed${process.exitCode ? ', SOME FAILED' : ''}`);
})();
