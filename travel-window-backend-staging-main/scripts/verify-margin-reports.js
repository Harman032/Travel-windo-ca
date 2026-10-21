'use strict';
/**
 * Verifies the margin-split reports against the staging COPY database using the real
 * Mongo queries (real express router, real Booking/User models).
 *
 *   MONGODB_URI=<uri ending /travel_window_staging_copy> node scripts/verify-margin-reports.js
 *   ... --repro-c458iq     also replays a payment update on C458IQ (WRITES to the copy only)
 *
 * Safety: refuses any URI whose database is not exactly travel_window_staging_copy, re-checks
 * the connected database name, and stubs out document saves unless --repro-c458iq is given.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');

const ALLOWED_DB = 'travel_window_staging_copy';
const uri = process.env.MONGODB_URI || process.env.travel_window_MONGODB_URI;
const dbNameOf = u => ((/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(u || '') || [])[1] || '');
const args = process.argv.slice(2);
const REPRO = args.includes('--repro-c458iq');

if (!uri || decodeURIComponent(dbNameOf(uri)) !== ALLOWED_DB) {
  console.error(`Refusing to run: MONGODB_URI must point at database "${ALLOWED_DB}" (found "${uri ? dbNameOf(uri) : 'no URI'}").`);
  process.exit(2);
}

const Booking = require('../models/Booking');
const User = require('../models/User');
const { buildRange, inRange, REPORT_TZ } = require('../utils/margin-split');

const round2 = n => Math.round(n * 100) / 100;
const show = (label, v) => console.log(`${label}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
const CHANGE_FIELDS = ['dateChanges', 'flightChanges', 'seatBookChanges'];

async function step1(raw) {
  console.log('\n===== STEP 1: AWTHSX record (copy DB) =====');
  if (!raw) return console.log('AWTHSX not found');
  show('_id', String(raw._id));
  show('submittedBy', String(raw.submittedBy));
  show('dateOfSubmission(UTC)', raw.dateOfSubmission && raw.dateOfSubmission.toISOString());
  show('supplier', { id: String(raw.supplier), supplierName: JSON.stringify(raw.supplierName) });
  show('ourCost/salePrice/supplierCharges', [raw.ourCost, raw.salePrice, raw.supplierCharges]);
  for (const f of CHANGE_FIELDS) {
    (raw[f] || []).forEach((c, i) => {
      const { remarks, ...rest } = c; // free text can hold personal data
      console.log(`${f}[${i}] ` + JSON.stringify({ ...rest, changedAt: c.changedAt && c.changedAt.toISOString() }));
    });
  }
  const mods = new Set(CHANGE_FIELDS.flatMap(f => (raw[f] || []).map(c => c.marginSplit && c.marginSplit.modifierId && String(c.marginSplit.modifierId)).filter(Boolean)));
  for (const id of mods) {
    const u = await User.findById(id).select('name role').lean();
    show(`modifierId ${id} resolves to user`, u ? `${u.name} (${u.role})` : 'NOT FOUND');
  }
  const deepak = await User.find({ name: /deepak/i }).select('name role').lean();
  show('users named Deepak', deepak.map(u => `${u.name}:${u._id}`));
  const sup = raw.supplier ? await mongoose.connection.collection('suppliers').findOne({ _id: raw.supplier }) : null;
  show('supplier doc', sup && { name: JSON.stringify(sup.name), updationCharge: sup.updationCharge, bookingCharge: sup.bookingCharge });
}

async function changeStats() {
  console.log('\n===== STEP 1.3: changes with / without marginSplit (raw documents) =====');
  const all = await Booking.collection.find({}, { projection: { dateChanges: 1, flightChanges: 1, seatBookChanges: 1, status: 1 } }).toArray();
  const stats = { bookings: all.length, bookingsWithChanges: 0, changes: 0, withSplitObject: 0, nonZeroSplit: 0, withoutSplit: 0, withoutChangedAt: 0 };
  for (const b of all) {
    const cs = CHANGE_FIELDS.flatMap(f => b[f] || []);
    if (cs.length) stats.bookingsWithChanges++;
    for (const c of cs) {
      stats.changes++;
      if (!c.changedAt) stats.withoutChangedAt++;
      if (c.marginSplit) {
        stats.withSplitObject++;
        if ((c.marginSplit.originalUserAmount || 0) !== 0 || (c.marginSplit.modifierUserAmount || 0) !== 0) stats.nonZeroSplit++;
      } else stats.withoutSplit++;
    }
  }
  show('stats', stats);
  show('indexes', (await Booking.collection.indexes()).map(i => i.name));
}

async function explain(range) {
  console.log('\n===== STEP 1.3: query plan for "booked in range OR any change in range" =====');
  const { changeRangeConditions } = require('../utils/margin-split');
  const q = { status: { $ne: 'Cancelled' }, $or: [{ dateOfSubmission: range }, ...changeRangeConditions(range)] };
  const ex = await Booking.collection.find(q).explain('executionStats');
  const es = ex.executionStats;
  show('plan', { stage: ex.queryPlanner.winningPlan.stage || (ex.queryPlanner.winningPlan.inputStage || {}).stage, totalDocsExamined: es.totalDocsExamined, nReturned: es.nReturned, ms: es.executionTimeMillis });
}

function trueMargin(b) {
  return (b.salePrice || 0) - (b.ourCost || 0) - (b.supplierCharges || 0);
}

// Independent per-component check: base margin is dated at dateOfSubmission, each change's
// net split at its changedAt. Sum the components that fall inside the range.
function expectedTotal(bookings, range) {
  let total = 0;
  for (const b of bookings) {
    if (b.status === 'Cancelled') continue;
    const cs = CHANGE_FIELDS.flatMap(f => b[f] || []).filter(c => c.marginSplit);
    const net = cs.reduce((s, c) => s + (c.marginSplit.originalUserAmount || 0) + (c.marginSplit.modifierUserAmount || 0), 0);
    if (inRange(b.dateOfSubmission, range)) total += trueMargin(b) - net;
    for (const c of cs) if (inRange(c.changedAt || b.dateOfSubmission, range)) total += (c.marginSplit.originalUserAmount || 0) + (c.marginSplit.modifierUserAmount || 0);
  }
  return round2(total);
}

async function startApi() {
  const tokens = {};
  for (const role of ['ADMIN', 'ACCOUNT', 'AGENT1', 'AGENT2']) {
    const u = await User.findOne({ role, isActive: true }).select('_id').lean();
    if (u) tokens[role] = jwt.sign({ userId: String(u._id), role }, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
  }
  if (!tokens.ADMIN) throw new Error('No active ADMIN user in the copy to authenticate with');
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.id = 'verify-' + Math.random().toString(16).slice(2, 10); next(); });
  app.use('/api/reports', require('../routes/reports'));
  app.use('/api/bookings', require('../routes/bookings'));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, p, params, body, role = 'ADMIN') => {
    if (!tokens[role]) return { status: 0, body: null, error: `no active ${role} user in the copy` };
    const res = await fetch(`${base}/${p}${params ? '?' + new URLSearchParams(params) : ''}`, {
      method, headers: { Authorization: `Bearer ${tokens[role]}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { call, close: () => server.close() };
}

async function allPages(api, endpoint, params) {
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const { body } = await api.call('GET', `reports/${endpoint}`, { ...params, limit: 500, page });
    const rows = Array.isArray(body) ? body : (body && body.bookings) || [];
    out.push(...rows);
    if (rows.length === 0 || rows.length < 500) break;
  }
  return out;
}

async function step3(api, awth) {
  console.log('\n===== STEP 3: reports via real Mongo queries (timezone ' + REPORT_TZ + ') =====');
  const ranges = [
    ['12-09-2026 to 12-09-2026', { dateFrom: '2026-09-12', dateTo: '2026-09-12' }],
    ['12-04-2026 to 12-04-2026', { dateFrom: '2026-04-12', dateTo: '2026-04-12' }],
    ['no range', {}]
  ];
  const names = /nandani|deepak/i;
  for (const [label, p] of ranges) {
    console.log(`\n--- ${label} ---`);
    const c = await api.call('GET', 'reports/agent-margin', { ...p, limit: 500 });
    show(' C agents (NANDANI/Deepak)', (c.body || []).filter(a => names.test(a.agentName)).map(a => `${a.agentName}=${round2(a.totalMargin)} (bookings ${a.totalBookings})`));
    for (const [tag, ep] of [['E', 'agent-margin-report'], ['D', 'agent-booking-list']]) {
      const rows = await allPages(api, ep, p);
      show(` ${tag} rows for AWTHSX`, rows.filter(r => /AWTHSX/.test(r.pnr)).map(r => `${r.pnr} -> ${r.submittedByName} ${r.margin !== undefined ? r.margin : r.ourMargin}`));
    }
  }

  console.log('\n--- whole year 2026: Report C sum vs independent per-component sum ---');
  const year = { dateFrom: '2026-01-01', dateTo: '2026-12-31' };
  const range = buildRange(year.dateFrom, year.dateTo);
  const cAll = await api.call('GET', 'reports/agent-margin', year); // Report C is unpaginated: one call covers everything
  const reportSum = round2((cAll.body || []).reduce((s, a) => s + a.totalMargin, 0));
  const raw = await Booking.collection.find({}).toArray();
  show(' Report C sum of agent margins', reportSum);
  show(' independent expected sum   ', expectedTotal(raw, range));
  show(' MATCH', reportSum === expectedTotal(raw, range) ? 'YES' : 'NO');
  show(' bookings in year range (non-cancelled)', raw.filter(b => b.status !== 'Cancelled' && inRange(b.dateOfSubmission, range)).length);
  if (awth) show(' AWTHSX true booking margin (sale-cost-supplierCharges)', trueMargin(awth));
}

// Calls the reports the way the UI does (no limit/page => default 50) and compares with the full data.
async function truncation(api) {
  console.log('\n===== TRUNCATION CHECK: reports called as the UI does (no limit/page) =====');
  const year = { dateFrom: '2026-01-01', dateTo: '2026-12-31' };
  const range = buildRange(year.dateFrom, year.dateTo);
  const raw = await Booking.collection.find({}).toArray();
  const changesIn = b => CHANGE_FIELDS.flatMap(f => b[f] || []).some(c => c.marginSplit && ((c.marginSplit.originalUserAmount || 0) !== 0 || (c.marginSplit.modifierUserAmount || 0) !== 0) && inRange(c.changedAt || b.dateOfSubmission, range));

  const c = await api.call('GET', 'reports/agent-margin', year);
  const cRows = Array.isArray(c.body) ? c.body : [];
  const nonCancelled = raw.filter(b => b.status !== 'Cancelled');
  const cOut = { bookingsCounted: cRows.reduce((s, a) => s + a.totalBookings, 0), bookingsActuallyBookedInRange: nonCancelled.filter(b => inRange(b.dateOfSubmission, range)).length, sumReturned: round2(cRows.reduce((s, a) => s + a.totalMargin, 0)), sumExpected: expectedTotal(raw, range) };
  show('C default call', { ...cOut, MATCH: cOut.bookingsCounted === cOut.bookingsActuallyBookedInRange && cOut.sumReturned === cOut.sumExpected });

  const e = await api.call('GET', 'reports/agent-margin-report', year);
  const eRows = ((e.body && e.body.bookings) || []).filter(r => !r.isModifierRow);
  const eScope = raw.filter(b => inRange(b.dateOfSubmission, range) || changesIn(b)).length;
  const eAll = (e.body && e.body.bookings) || [];
  show('E default call', { bookingRowsReturned: eRows.length, bookingsInScope: eScope, totalRows: e.body && e.body.total, totalMargin: e.body && round2(e.body.totalMargin), MATCH: eRows.length === eScope && eAll.length === (e.body && e.body.total) });

  const d = await api.call('GET', 'reports/agent-booking-list', year);
  const dRows = ((d.body && d.body.bookings) || []).filter(r => !r.isModifierRow);
  const dScope = nonCancelled.filter(b => inRange(b.travelDate, range) || inRange(b.returnDate, range) || changesIn(b)).length;
  show('D default call', { bookingRowsReturned: dRows.length, bookingsInScope: dScope, totalRows: d.body && d.body.total, totalMargin: d.body && round2(d.body.totalMargin), MATCH: dRows.length === dScope });

  // Explicit paging must tile the full list with no duplicate or missing rows.
  for (const [tag, ep] of [['E', 'agent-margin-report'], ['D', 'agent-booking-list']]) {
    const ids = [];
    let total = 0;
    for (let page = 1; page <= 100; page++) {
      const r = await api.call('GET', `reports/${ep}`, { ...year, page, limit: 100 });
      total = r.body.total;
      ids.push(...r.body.bookings.map(x => String(x._id)));
      if (page >= r.body.totalPages) break;
    }
    show(` ${tag} paged by 100`, { rows: ids.length, total, duplicates: ids.length - new Set(ids).size, MATCH: ids.length === total && new Set(ids).size === ids.length });
  }
}

async function separateIssues(api) {
  console.log('\n===== SEPARATE ISSUE 1: C458IQ (read-only analysis) =====');
  const raw = await Booking.collection.findOne({ pnr: 'C458IQ' });
  if (!raw) console.log('C458IQ not found');
  else {
    show('status / cancelled', [raw.status, raw.cancellation && raw.cancellation.isCancelled]);
    show('cancellation.paymentModeWas', raw.cancellation && raw.cancellation.paymentModeWas);
    show('payments (count only)', (raw.payments || []).length);
    show('submittedBy/supplier', [String(raw.submittedBy), raw.supplierName]);
    const doc = Booking.hydrate(raw);
    const e1 = doc.validateSync();
    show('validateSync (as stored)', e1 ? Object.entries(e1.errors).map(([k, v]) => `${k}: ${v.message}`) : 'ok');
    if (raw.cancellation && raw.cancellation.isCancelled) {
      doc.markModified('cancellation');
      const e2 = doc.validateSync();
      show('validateSync after markModified(cancellation) [what an edit of a cancelled booking triggers]', e2 ? Object.entries(e2.errors).map(([k, v]) => `${k}: ${v.message}`) : 'ok');
    }
    if (REPRO) {
      // Mimics the edit form's save payload (new-booking.component.ts), unchanged values, once per role.
      const day = d => (d ? new Date(d).toISOString().slice(0, 10) : null);
      const payload = {
        paxName: raw.paxName, contactPerson: raw.contactPerson, contactNumber: raw.contactNumber, pnr: raw.pnr,
        sectorType: raw.sectorType, travelDate: day(raw.travelDate), from: raw.from, to: raw.to, returnDate: day(raw.returnDate),
        multipleSectors: [], note: raw.note, airline: raw.airline, supplier: raw.supplier ? String(raw.supplier) : '',
        ourCost: raw.ourCost, salePrice: raw.salePrice, supplierCharges: raw.supplierCharges || 0,
        paymentFromCard: raw.paymentFromCard || 0, cardType: raw.cardType || '', cardLast4Digits: raw.cardLast4Digits || '',
        isCardPayment: false, additionalServices: [], paymentType: raw.paymentType,
        payments: (raw.payments || []).map(p => ({ paidAmount: p.paidAmount, paymentMode: p.paymentMode, paymentDate: p.paymentDate, referenceNo: p.referenceNo || '' }))
      };
      // Plausible edits: every payment mode x full/partial amount, as AGENT2 and ADMIN.
      const modes = Booking.schema.path('payments').schema.path('paymentMode').enumValues;
      const outcomes = {};
      for (const role of ['AGENT2', 'ADMIN']) {
        for (const mode of modes) {
          for (const amount of [raw.salePrice, 500.5]) {
            const orig = console.error;
            const logs = [];
            console.error = (...a) => { logs.push(a.join(' ')); };
            let r;
            try {
              r = await api.call('PUT', `bookings/${raw._id}`, null, { ...payload, payments: [{ paidAmount: amount, paymentMode: mode, paymentDate: new Date().toISOString(), referenceNo: 'x' }] }, role);
            } finally { console.error = orig; }
            const key = `${r.status}${r.body && r.body.message ? ' ' + r.body.message : ''}`;
            outcomes[key] = (outcomes[key] || 0) + 1;
            if (r.status !== 200) console.log(`  variation ${role}/${mode}/${amount} -> ${key}; log: ${logs.join(' ').slice(0, 400)}`);
          }
        }
      }
      show('REPRO variations outcome counts', outcomes);
      for (const role of ['AGENT1', 'AGENT2', 'ACCOUNT', 'ADMIN']) {
        const lines = [];
        const orig = console.error;
        console.error = (...a) => { lines.push(a.join(' ')); };
        let r;
        try { r = await api.call('PUT', `bookings/${raw._id}`, null, payload, role); } finally { console.error = orig; }
        // Only status/message/requestId are printed; response bodies contain passenger data.
        show(`REPRO PUT as ${role}`, r.error || { status: r.status, message: r.body && r.body.message, requestId: r.body && r.body.requestId });
        lines.forEach(l => {
          try {
            const j = JSON.parse(l);
            console.log('  server log: ' + JSON.stringify({ route: j.route, errorName: j.errorName, errorMessage: j.errorMessage, stack: (j.stack || '').split('\n').slice(0, 4).join(' | ') }));
          } catch (e) { console.log('  server log: ' + l.slice(0, 300)); }
        });
      }
    }
  }

  console.log('\n===== SEPARATE ISSUE 2: ATDSVS =====');
  const a = await Booking.collection.findOne({ pnr: 'ATDSVS' });
  if (!a) console.log('ATDSVS not found');
  else {
    show('submittedBy/supplier', [String(a.submittedBy), JSON.stringify(a.supplierName)]);
    show('dates', { submitted: a.dateOfSubmission, travel: a.travelDate, ret: a.returnDate });
    show('margins', { sale: a.salePrice, cost: a.ourCost, supplierCharges: a.supplierCharges, supplierBookingCharge: a.supplierBookingCharge, status: a.status });
    show('changes', CHANGE_FIELDS.map(f => (a[f] || []).length));
    const win = { dateFrom: '2026-01-01', dateTo: '2026-12-31' };
    for (const [tag, ep] of [['D', 'agent-booking-list'], ['E', 'agent-margin-report']]) {
      const rows = await allPages(api, ep, win);
      show(` ${tag} rows for ATDSVS (2026)`, rows.filter(r => /ATDSVS/.test(r.pnr)).map(r => ({ pnr: r.pnr, by: r.submittedByName, margin: r.margin !== undefined ? r.margin : r.ourMargin })));
    }
  }
}

(async () => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  if (mongoose.connection.name !== ALLOWED_DB) {
    console.error(`Connected database is "${mongoose.connection.name}", not "${ALLOWED_DB}". Aborting.`);
    process.exit(2);
  }
  if (!REPRO) mongoose.Model.prototype.save = () => { throw new Error('writes disabled (read-only verification)'); };
  console.log(`Connected to ${mongoose.connection.name} (read-only: ${!REPRO})`);

  const awth = await Booking.collection.findOne({ pnr: 'AWTHSX' });
  await step1(awth);
  await changeStats();
  await explain(buildRange('2026-01-01', '2026-12-31'));
  const api = await startApi();
  try {
    await step3(api, awth);
    await truncation(api);
    await separateIssues(api);
  } finally {
    api.close();
    await mongoose.disconnect();
  }
})().catch(e => { console.error(e); process.exit(1); });
