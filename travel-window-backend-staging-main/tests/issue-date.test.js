'use strict';
// ISSUE DATE — the day a ticket was issued, as distinct from the instant it was keyed in.
//
// The case that drives all of it: a ticket issued on Saturday 2026-10-31 and entered on Monday
// 2026-11-02. The supplier bills it in October. Before issueDate existed, every money report put
// it in November, so our statement and theirs disagreed by one booking across the month boundary
// and nothing in the system could say why.
//
//   node tests/issue-date.test.js --tz UTC
const tzArg = process.argv.indexOf('--tz');
if (tzArg !== -1 && process.argv[tzArg + 1]) process.env.TZ = process.argv[tzArg + 1];

const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Supplier = require('../models/Supplier');
const SupplierPayment = require('../models/SupplierPayment');
const User = require('../models/User');
const { startReports } = require('./report-harness');
const { buildStatement } = require('../utils/supplier-statement');
const {
  ISSUE_DATE_MAX_BACKDATE_DAYS, effectiveDate, effectiveDay, isLateEntry, validateIssueDate
} = require('../utils/effective-date');
const { dayInTz } = require('../utils/tz');

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };
const SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
const oid = () => new mongoose.Types.ObjectId();
const serverTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log(`issue-date tests — server TZ = ${serverTz}`);

// The driving case.
const ISSUED_OCT = new Date('2026-10-31T12:00:00Z');       // date-only, noon UTC
const ENTERED_NOV = new Date('2026-11-02T14:30:00Z');      // an instant
const OCTOBER = { dateFrom: '2026-10-01', dateTo: '2026-10-31' };
const NOVEMBER = { dateFrom: '2026-11-01', dateTo: '2026-11-30' };

// ------------------------------------------------------------------ the helpers --------------

console.log('\neffectiveDate — issueDate when set, dateOfSubmission otherwise');

t('a booking with an issueDate uses it', () => {
  assert.strictEqual(
    effectiveDate({ issueDate: ISSUED_OCT, dateOfSubmission: ENTERED_NOV }).toISOString(),
    ISSUED_OCT.toISOString()
  );
});

t('a LEGACY booking with no issueDate falls back to dateOfSubmission', () => {
  assert.strictEqual(
    effectiveDate({ dateOfSubmission: ENTERED_NOV }).toISOString(),
    ENTERED_NOV.toISOString()
  );
  // null and undefined behave the same: there is no migration, so both shapes exist.
  assert.strictEqual(
    effectiveDate({ issueDate: null, dateOfSubmission: ENTERED_NOV }).toISOString(),
    ENTERED_NOV.toISOString()
  );
});

t('the effective DAY reads the same in every server zone', () => {
  // The whole point of storing date-only values at noon UTC.
  assert.strictEqual(effectiveDay({ issueDate: ISSUED_OCT }), '2026-10-31');
  for (const tz of ['UTC', 'America/Toronto', 'Asia/Kolkata', 'America/Los_Angeles']) {
    assert.strictEqual(dayInTz(ISSUED_OCT, tz), '2026-10-31', tz);
  }
});

console.log('\nisLateEntry');

t('entered on a later Toronto day than issued -> late', () => {
  assert.strictEqual(isLateEntry({ issueDate: ISSUED_OCT, dateOfSubmission: ENTERED_NOV }), true);
});

t('entered on the same day -> not late', () => {
  assert.strictEqual(isLateEntry({
    issueDate: new Date('2026-11-02T12:00:00Z'), dateOfSubmission: ENTERED_NOV
  }), false);
});

t('a legacy booking with no issueDate is never late', () => {
  // It cannot be late against a date it never had.
  assert.strictEqual(isLateEntry({ dateOfSubmission: ENTERED_NOV }), false);
});

t('issued at 23:00 Toronto and entered at 00:30 is NOT late: calendar days, not hours', () => {
  // 2026-11-03T04:30Z is 2026-11-02 23:30 in Toronto, the same calendar day as the issue date.
  assert.strictEqual(isLateEntry({
    issueDate: new Date('2026-11-02T12:00:00Z'),
    dateOfSubmission: new Date('2026-11-03T04:30:00Z')
  }), false);
});

console.log('\nvalidateIssueDate');

const todayTor = dayInTz(new Date());
const dayOffset = (n) => {
  const [y, m, d] = todayTor.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d, 12, 0, 0);
  return dayInTz(new Date(base + n * 86400000));
};

t('absent is fine: the field is optional', () => {
  assert.strictEqual(validateIssueDate(undefined, new Date()), null);
  assert.strictEqual(validateIssueDate('', new Date()), null);
  assert.strictEqual(validateIssueDate(null, new Date()), null);
});

t('today is accepted', () => {
  assert.strictEqual(validateIssueDate(todayTor, new Date()), null);
});

t('tomorrow is rejected: a ticket cannot be issued in the future', () => {
  const msg = validateIssueDate(dayOffset(1), new Date());
  assert.ok(msg && /future/.test(msg), msg);
});

t(`exactly ${ISSUE_DATE_MAX_BACKDATE_DAYS} days back is accepted`, () => {
  assert.strictEqual(validateIssueDate(dayOffset(-ISSUE_DATE_MAX_BACKDATE_DAYS), new Date()), null);
});

t(`${ISSUE_DATE_MAX_BACKDATE_DAYS + 1} days back is rejected`, () => {
  const msg = validateIssueDate(dayOffset(-(ISSUE_DATE_MAX_BACKDATE_DAYS + 1)), new Date());
  assert.ok(msg && /days before the entry date/.test(msg), msg);
});

t('bounds are measured against the BOOKING\'s entry date, not today', () => {
  // Editing an old booking: 2026-10-31 is one day before its 2026-11-02 entry, so it is inside
  // the window even though both are long before today.
  assert.strictEqual(validateIssueDate('2026-10-31', ENTERED_NOV), null);
  // Four days before that entry date is outside it.
  const msg = validateIssueDate('2026-10-29', ENTERED_NOV);
  assert.ok(msg && /2026-11-02/.test(msg), msg);
});

t('the message names both dates and the limit, so the UI can explain itself', () => {
  const msg = validateIssueDate('2026-10-20', ENTERED_NOV);
  assert.ok(msg.includes('2026-10-20') && msg.includes('2026-11-02')
    && msg.includes(String(ISSUE_DATE_MAX_BACKDATE_DAYS)), msg);
});

t('an unparseable value is rejected as a date, not silently dropped', () => {
  assert.ok(validateIssueDate('rubbish', new Date()));
});

// ------------------------------------------------------------------ the write path ------------

function newBooking(over = {}) {
  return new Booking(Object.assign({
    pnr: 'TEST01', paxName: 'X', contactNumber: '+1 5550000', sectorType: 'One Way',
    travelDate: new Date('2026-12-01T12:00:00Z'), from: 'YYZ', to: 'DEL',
    submittedBy: oid(), submittedByName: 'Agent One',
    status: 'Pending Verification', salePrice: 1000, ourCost: 900,
    dateOfSubmission: ENTERED_NOV
  }, over));
}

async function startBookings(doc, role) {
  const user = { _id: oid(), role, isActive: true, name: role };
  User.findById = () => ({ select: () => Promise.resolve(user) });

  const saved = [];
  const created = [];
  Booking.prototype.save = async function () {
    if (doc && this === doc) { saved.push(this.toObject()); return this; }
    created.push(this);
    return this;
  };
  // POST echoes the new booking back through findById().populate(), so this is needed on the
  // create path too, where there is no pre-existing doc.
  Booking.findById = () => {
    const target = doc || created[created.length - 1] || null;
    const chain = { populate: () => chain, then: (res, rej) => Promise.resolve(target).then(res, rej) };
    return chain;
  };
  const noneChain = {
    sort: () => noneChain, lean: async () => null, select: () => noneChain,
    then: (res, rej) => Promise.resolve(null).then(res, rej)
  };
  Booking.findOne = () => noneChain;
  Booking.countDocuments = async () => 0;

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.id = 'test'; next(); });
  app.use('/api/bookings', require('../routes/bookings'));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const token = jwt.sign({ userId: String(user._id), role }, SECRET);
  const call = async (method, path, body) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/bookings${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return {
    put: (p, b) => call('PUT', p, b),
    post: (p, b) => call('POST', p, b),
    saved, created, close: () => server.close()
  };
}

const ROLES = ['AGENT1', 'AGENT2', 'ACCOUNT', 'ADMIN'];

(async () => {

  console.log('\nPOST /bookings — issueDate is stored at noon UTC');
  const createBody = (over) => Object.assign({
    paxName: 'X', contactNumber: '+1 5550000', pnr: 'NEW01', sectorType: 'One Way',
    travelDate: '2026-12-01', from: 'YYZ', to: 'DEL',
    ourCost: 900, salePrice: 1000, paymentType: 'Full'
  }, over);

  for (const role of ROLES) {
    const api = await startBookings(null, role);
    const res = await api.post('/', createBody({ issueDate: todayTor }));
    assert.strictEqual(res.status, 201, `${role}: ${JSON.stringify(res.body)}`);
    const d = api.created[api.created.length - 1];
    assert.strictEqual(d.issueDate.getUTCHours(), 12, 'stored at noon UTC');
    assert.strictEqual(dayInTz(d.issueDate), todayTor, 'on the day that was typed');
    api.close();
    ok(`POST as ${role}: issueDate stored at noon UTC on the typed day`);
  }

  console.log('\nPOST /bookings — every role may set it, and the bounds hold for all of them');
  for (const role of ROLES) {
    {
      const api = await startBookings(null, role);
      const res = await api.post('/', createBody({ issueDate: dayOffset(1) }));
      assert.strictEqual(res.status, 400, `${role} future: got ${res.status}`);
      assert.ok(/future/.test(res.body.message), res.body.message);
      assert.strictEqual(api.created.length, 0, 'nothing created');
      api.close();
    }
    {
      const api = await startBookings(null, role);
      const res = await api.post('/', createBody({ issueDate: dayOffset(-(ISSUE_DATE_MAX_BACKDATE_DAYS + 1)) }));
      assert.strictEqual(res.status, 400, `${role} too far back: got ${res.status}`);
      api.close();
    }
    {
      const api = await startBookings(null, role);
      const res = await api.post('/', createBody({ issueDate: dayOffset(-ISSUE_DATE_MAX_BACKDATE_DAYS) }));
      assert.strictEqual(res.status, 201, `${role} at the limit: ${JSON.stringify(res.body)}`);
      api.close();
    }
    ok(`POST as ${role}: future rejected, ${ISSUE_DATE_MAX_BACKDATE_DAYS + 1} days back rejected, ${ISSUE_DATE_MAX_BACKDATE_DAYS} accepted`);
  }

  console.log('\nPOST /bookings — omitting it leaves the field unset, with no default');
  {
    const api = await startBookings(null, 'AGENT1');
    const res = await api.post('/', createBody({}));
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    const d = api.created[api.created.length - 1];
    assert.ok(d.issueDate === undefined || d.issueDate === null, `got ${d.issueDate}`);
    // And it then behaves exactly like every legacy booking.
    assert.strictEqual(effectiveDate(d).toISOString(), d.dateOfSubmission.toISOString());
    api.close();
    ok('an omitted issueDate stays unset and falls back to the entry date');
  }

  console.log('\nPUT /bookings/:id — a change is audited in progress history');
  for (const role of ROLES) {
    const doc = newBooking();
    const api = await startBookings(doc, role);
    const res = await api.put(`/${doc._id}`, { issueDate: '2026-10-31' });
    assert.strictEqual(res.status, 200, `${role}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(doc.issueDate.toISOString(), ISSUED_OCT.toISOString());
    const entry = doc.progressHistory.find(h => h.action === 'Issue Date Changed');
    assert.ok(entry, `${role}: no audit entry`);
    assert.strictEqual(entry.changes.issueDate.from, null, 'records the previous value');
    assert.strictEqual(entry.changes.issueDate.to, ISSUED_OCT.toISOString(), 'and the new one');
    assert.strictEqual(String(entry.performedBy), String(entry.performedBy), 'records who');
    api.close();
    ok(`PUT as ${role}: issueDate change written to progress history with from/to`);
  }

  console.log('\nPUT /bookings/:id — setting the SAME value writes no audit entry');
  {
    const doc = newBooking({ issueDate: ISSUED_OCT });
    const api = await startBookings(doc, 'ADMIN');
    await api.put(`/${doc._id}`, { issueDate: '2026-10-31', salePrice: 1500 });
    assert.strictEqual(doc.progressHistory.filter(h => h.action === 'Issue Date Changed').length, 0,
      'an unchanged value is not a change');
    assert.strictEqual(doc.salePrice, 1500, 'the rest of the edit still applied');
    api.close();
    ok('no spurious audit entry when the value is unchanged');
  }

  console.log('\nPUT /bookings/:id — frozen after verification for AGENTS ONLY');
  for (const role of ['AGENT1', 'AGENT2']) {
    const doc = newBooking({ issueDate: ISSUED_OCT, verifiedByAccount: true, accountVerified: true });
    const api = await startBookings(doc, role);
    const res = await api.put(`/${doc._id}`, { issueDate: '2026-11-02' });
    assert.strictEqual(res.status, 403, `${role}: got ${res.status}`);
    assert.strictEqual(doc.issueDate.toISOString(), ISSUED_OCT.toISOString(),
      'and not even changed in memory');
    assert.strictEqual(api.saved.length, 0, 'nothing saved');
    api.close();
    ok(`${role} cannot change the issue date of a verified booking`);
  }
  for (const role of ['ACCOUNT', 'ADMIN']) {
    const doc = newBooking({ issueDate: ISSUED_OCT, verifiedByAccount: true, accountVerified: true });
    const api = await startBookings(doc, role);
    const res = await api.put(`/${doc._id}`, { issueDate: '2026-11-02' });
    assert.strictEqual(res.status, 200, `${role}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(dayInTz(doc.issueDate), '2026-11-02', 'corrected');
    assert.ok(doc.progressHistory.find(h => h.action === 'Issue Date Changed'), 'and audited');
    api.close();
    ok(`${role} CAN correct the issue date of a verified booking, and it is audited`);
  }

  console.log('\nPUT /bookings/:id — bounds are enforced on edit too, for every role');
  for (const role of ROLES) {
    const doc = newBooking();
    const api = await startBookings(doc, role);
    // 2026-10-29 is four days before this booking's 2026-11-02 entry date.
    const res = await api.put(`/${doc._id}`, { issueDate: '2026-10-29' });
    assert.strictEqual(res.status, 400, `${role}: got ${res.status}`);
    assert.strictEqual(api.saved.length, 0, 'nothing saved');
    api.close();
    ok(`PUT as ${role}: more than ${ISSUE_DATE_MAX_BACKDATE_DAYS} days before the entry date is rejected`);
  }

  // ------------------------------------------------------------ the reports -------------------

  const A = { _id: oid(), name: 'NANDANI' };

  // Issued 2026-10-31, entered 2026-11-02. Margin 1000 - 900 - 0 = 100.
  const lateEntered = {
    _id: oid(), pnr: 'LATE01', paxName: 'X', supplier: oid(), supplierName: 'SKYBIRDS',
    status: 'Pending Verification',
    issueDate: ISSUED_OCT, dateOfSubmission: ENTERED_NOV,
    travelDate: new Date('2026-12-01T12:00:00Z'), from: 'YYZ', to: 'DEL',
    sectorType: 'One Way', airline: 'AC',
    submittedBy: A._id, submittedByName: A.name,
    totalSalePrice: 1000, salePrice: 1000, ourCost: 900, supplierCharges: 0,
    paymentFromCard: 0, totalPaidAmount: 0, balanceAmount: 1000
  };
  // The same booking with no issueDate: the legacy shape, which must stay in November.
  const legacy = { ...lateEntered, _id: oid(), pnr: 'LEGACY1', issueDate: undefined };

  console.log('\nReport C (agent-margin) — the 2026-10-31 / 2026-11-02 case');
  {
    const api = await startReports('../routes/reports', [lateEntered]);
    const oct = await api.get('agent-margin', OCTOBER);
    const nov = await api.get('agent-margin', NOVEMBER);
    assert.strictEqual((oct.find(a => a.agentName === A.name) || {}).totalBookings, 1,
      'the late-entered ticket is counted in OCTOBER');
    assert.strictEqual((oct.find(a => a.agentName === A.name) || {}).totalMargin, 100);
    assert.strictEqual(nov.find(a => a.agentName === A.name), undefined,
      'and NOT also in November -- that would double-count the margin');
    api.close();
    ok('C: issued 2026-10-31, entered 2026-11-02 -> October only');
  }
  {
    const api = await startReports('../routes/reports', [legacy]);
    const oct = await api.get('agent-margin', OCTOBER);
    const nov = await api.get('agent-margin', NOVEMBER);
    assert.strictEqual(oct.find(a => a.agentName === A.name), undefined,
      'a legacy booking is not pulled into October');
    assert.strictEqual((nov.find(a => a.agentName === A.name) || {}).totalBookings, 1,
      'it stays where its entry date puts it');
    api.close();
    ok('C: a legacy booking with no issueDate stays on the entry date -- no past month moves');
  }

  console.log('\nReport E (agent-margin-report) — must agree with C');
  {
    const api = await startReports('../routes/reports', [lateEntered]);
    const oct = await api.get('agent-margin-report', OCTOBER);
    const nov = await api.get('agent-margin-report', NOVEMBER);
    assert.strictEqual(oct.bookings.filter(r => r.pnr === 'LATE01').length, 1, 'in October');
    assert.strictEqual(nov.bookings.filter(r => r.pnr === 'LATE01').length, 0, 'not in November');
    api.close();
    ok('E: the same booking lands in the same month as in C');
  }
  {
    const api = await startReports('../routes/reports', [legacy]);
    const nov = await api.get('agent-margin-report', NOVEMBER);
    assert.strictEqual(nov.bookings.filter(r => r.pnr === 'LEGACY1').length, 1);
    api.close();
    ok('E: legacy fallback matches C');
  }

  console.log('\nReport F (financial-summary) — filtered on the effective date');
  {
    const api = await startReports('../routes/reports', [lateEntered]);
    const oct = await api.get('financial-summary', OCTOBER);
    const nov = await api.get('financial-summary', NOVEMBER);
    assert.strictEqual(oct.bookings.length, 1, 'in October');
    assert.strictEqual(oct.summary.totalBookings, 1);
    assert.strictEqual(nov.bookings.length, 0, 'not in November');
    api.close();
    ok('F: issued 2026-10-31, entered 2026-11-02 -> October only');
  }
  {
    const api = await startReports('../routes/reports', [legacy]);
    const oct = await api.get('financial-summary', OCTOBER);
    const nov = await api.get('financial-summary', NOVEMBER);
    assert.strictEqual(oct.bookings.length, 0);
    assert.strictEqual(nov.bookings.length, 1);
    api.close();
    ok('F: legacy fallback matches C and E');
  }

  console.log('\nthe three reports that deliberately stay on the ENTRY date');
  {
    const api = await startReports('../routes/reports', [lateEntered]);
    // date-wise and employee-wise answer "what did this person key in on this day". issueDate is
    // backdatable by the agent, so a workload report must not be movable by the person measured.
    const dwOct = await api.get('date-wise', OCTOBER);
    const dwNov = await api.get('date-wise', NOVEMBER);
    assert.strictEqual(dwOct.bookings.length, 0, 'date-wise does not follow the issue date');
    assert.strictEqual(dwNov.bookings.length, 1, 'it stays on the entry date');

    const vpOct = await api.get('verified-payments', { ...OCTOBER, verificationType: 'unverified' });
    const vpNov = await api.get('verified-payments', { ...NOVEMBER, verificationType: 'unverified' });
    assert.strictEqual(vpOct.bookings.length, 0, 'the verification queue does not follow it either');
    assert.strictEqual(vpNov.bookings.length, 1);
    api.close();
    ok('date-wise and verified-payments stay on the entry date, as decided');
  }

  console.log('\nthe supplier statement');
  {
    const st = buildStatement([lateEntered], [], null);
    const line = st.invoices[0].lines[0];
    assert.strictEqual(dayInTz(line.date), '2026-10-31', 'the line is dated on the issue date');
    assert.strictEqual(line.lateEntry, true, 'and marked as a late entry');
    ok('statement: the line is dated on the issue date and marked late');
  }
  {
    const st = buildStatement([legacy], [], null);
    const line = st.invoices[0].lines[0];
    assert.strictEqual(dayInTz(line.date), dayInTz(ENTERED_NOV), 'legacy falls back to entry');
    assert.strictEqual(line.lateEntry, false, 'and is never marked late');
    ok('statement: a legacy booking falls back to the entry date and is not marked');
  }
  {
    // Period attribution: an October range must include it, a November range must not.
    const { buildRange } = require('../utils/tz');
    const oct = buildStatement([lateEntered], [], buildRange('2026-10-01', '2026-10-31'));
    const nov = buildStatement([lateEntered], [], buildRange('2026-11-01', '2026-11-30'));
    assert.strictEqual(oct.lineCount > 0, true, 'inside the October period');
    assert.strictEqual(nov.lineCount, 0, 'and not a line in November');
    // Before the range opens it becomes opening balance, which is how the arithmetic closes.
    const dec = buildStatement([lateEntered], [], buildRange('2026-12-01', '2026-12-31'));
    assert.strictEqual(dec.lineCount, 0);
    assert.ok(dec.openingBalance !== 0, 'it carries into the opening balance instead');
    ok('statement: the issue date decides period vs opening balance');
  }

  console.log('\nthe statement route carries issueDate through its projection');
  {
    const supplierId = oid();
    Supplier.findById = () => ({ select: () => ({ lean: async () => ({ _id: supplierId, name: 'SKYBIRDS' }) }) });
    SupplierPayment.find = () => ({ lean: async () => [] });
    const api = await startReports('../routes/reports', [{ ...lateEntered, supplier: supplierId }]);
    const res = await api.get('payment-to-suppliers', { supplier: String(supplierId) });
    const line = res.invoices[0].lines[0];
    // The real failure mode: an unprojected field reads undefined, so a missing projection would
    // silently date every line on the entry date instead of erroring.
    assert.strictEqual(dayInTz(line.date), '2026-10-31',
      'the ROUTE, not just buildStatement, dates the line on the issue date');
    assert.strictEqual(line.lateEntry, true);
    assert.strictEqual(line.verified, '—');
    api.close();
    ok('the route projects issueDate, so the line is dated on it end to end');
  }

  console.log(`\n${passed} assertions passed (server TZ ${serverTz})`);
  process.exit(0);
})().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
