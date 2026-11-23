'use strict';
// E-TRANSFER DETAILS + BANK FILTER.
//
// E-Transfer is the single mode for e-transfers, cheques and bank transfers, and a new one must
// name the receiving account and the sender. The hard part is not the requirement, it is not
// breaking the ~500 stored rows that predate it.
//
// That is the Cheque incident: a payment-mode enum was tightened without a data migration, and
// because Mongoose re-validates every loaded path on save, 440 bookings could no longer be
// edited, cancelled or verified at all. So `receivingAccount` and `senderName` carry NO required
// and NO enum on the schema, and the rule lives in the route layer where it can ask "is this row
// new or changed?" first.
//
//   node tests/etransfer.test.js

const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { startReports } = require('./report-harness');
const { validatePaymentRows, isUnrecordedAccount, RECEIVING_ACCOUNTS } = require('../utils/payment-rows');

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };
const SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
const oid = () => new mongoose.Types.ObjectId();

const RBC = 'RBC 6336';
const TD = 'TD 0638';
const D = '2026-11-17';

console.log('the constant and the schema');

t('RECEIVING_ACCOUNTS is the two accounts, last four digits only', () => {
  assert.deepStrictEqual(RECEIVING_ACCOUNTS, [RBC, TD]);
  // No full account numbers anywhere: a payments list several roles can read must not carry them.
  for (const a of RECEIVING_ACCOUNTS) assert.ok(/^[A-Z]+ \d{4}$/.test(a), a);
});

t('the model re-exports it, so there is one definition', () => {
  assert.deepStrictEqual(Booking.RECEIVING_ACCOUNTS, RECEIVING_ACCOUNTS);
});

t('both fields are on paymentSchema, with NO required and NO enum', () => {
  const sub = Booking.schema.path('payments').schema;
  for (const f of ['receivingAccount', 'senderName']) {
    const path = sub.path(f);
    assert.ok(path, `${f} missing from paymentSchema`);
    assert.strictEqual(path.isRequired, undefined, `${f} must NOT be required -- Cheque incident`);
    assert.strictEqual(path.enumValues === undefined || path.enumValues.length === 0, true,
      `${f} must NOT have an enum -- it would block every legacy row's save`);
    assert.strictEqual(path.defaultValue, '');
  }
});

t('a legacy row with neither field still validates against the schema', () => {
  const d = new Booking({
    pnr: 'OLD01', paxName: 'X', contactNumber: '+1 5550000', sectorType: 'One Way',
    travelDate: new Date('2026-12-01T12:00:00Z'), from: 'YYZ', to: 'DEL',
    submittedBy: oid(), submittedByName: 'Agent One',
    payments: [{ paidAmount: 100, paymentMode: 'Cheque', paymentDate: new Date('2026-11-17T12:00:00Z') }]
  });
  const err = d.validateSync();
  assert.strictEqual(err, undefined, err && Object.keys(err.errors).join(', '));
});

t('Cheque and Bank Transfer are still accepted modes', () => {
  // They are offered by no dropdown, but ~500 stored rows carry them and must keep saving.
  assert.ok(Booking.PAYMENT_MODES.includes('Cheque'));
  assert.ok(Booking.PAYMENT_MODES.includes('Bank Transfer'));
});

console.log('\nvalidatePaymentRows — a NEW E-Transfer needs both fields');

const etr = (over = {}) => Object.assign({
  paidAmount: 200, paymentMode: 'E-Transfer', paymentDate: D, referenceNo: ''
}, over);

t('no receivingAccount -> rejected, naming both accounts', () => {
  const r = validatePaymentRows([etr({ senderName: 'A' })], []);
  assert.ok(r.error && /receivingAccount is required/.test(r.error), r.error);
  assert.ok(r.error.includes(RBC) && r.error.includes(TD), r.error);
});

t('no senderName -> rejected', () => {
  const r = validatePaymentRows([etr({ receivingAccount: RBC })], []);
  assert.ok(r.error && /senderName is required/.test(r.error), r.error);
});

t('an account outside the list -> rejected', () => {
  const r = validatePaymentRows([etr({ receivingAccount: 'HSBC 1234', senderName: 'A' })], []);
  assert.ok(r.error && /is not one of/.test(r.error), r.error);
});

t('both present -> accepted and stored', () => {
  const r = validatePaymentRows([etr({ receivingAccount: TD, senderName: '  Ravi  ' })], []);
  assert.strictEqual(r.error, undefined, r.error);
  assert.strictEqual(r.payments[0].receivingAccount, TD);
  assert.strictEqual(r.payments[0].senderName, 'Ravi', 'trimmed');
});

t('whitespace-only values do not count as present', () => {
  const r = validatePaymentRows([etr({ receivingAccount: '   ', senderName: 'A' })], []);
  assert.ok(r.error, 'a blank account is not an account');
});

t('the error names the ROW INDEX, so a multi-row form can point at it', () => {
  const r = validatePaymentRows([
    etr({ receivingAccount: RBC, senderName: 'A' }),
    etr({ receivingAccount: RBC, senderName: 'A' }),
    etr({})
  ], []);
  assert.ok(r.error && r.error.includes('payments[2]'), r.error);
});

console.log('\nvalidatePaymentRows — EVERY OTHER MODE is unaffected');

t('Cash, UPI, Credit Card and the rest need neither field', () => {
  for (const mode of Booking.PAYMENT_MODES.filter(m => m !== 'E-Transfer')) {
    const r = validatePaymentRows([{ paidAmount: 50, paymentMode: mode, paymentDate: D }], []);
    assert.strictEqual(r.error, undefined, `${mode}: ${r.error}`);
    assert.strictEqual(r.payments[0].receivingAccount, '');
    assert.strictEqual(r.payments[0].senderName, '');
  }
});

t('a new Cheque row is accepted even though no dropdown offers it', () => {
  // The mode is legacy, not forbidden: rejecting it at the route would break the import paths and
  // any stored row round-tripping through a form.
  const r = validatePaymentRows([{ paidAmount: 50, paymentMode: 'Cheque', paymentDate: D }], []);
  assert.strictEqual(r.error, undefined, r.error);
});

console.log('\nvalidatePaymentRows — an UNCHANGED legacy row passes through untouched');

const storedLegacy = [{
  paidAmount: 200, paymentMode: 'E-Transfer', referenceNo: 'R1',
  paymentDate: new Date('2026-11-17T12:00:00Z')
  // no receivingAccount, no senderName: saved before the fields existed
}];

t('sent back unchanged -> accepted, with no bank details', () => {
  const r = validatePaymentRows(
    [{ paidAmount: 200, paymentMode: 'E-Transfer', referenceNo: 'R1', paymentDate: D }],
    storedLegacy
  );
  assert.strictEqual(r.error, undefined, r.error);
  assert.strictEqual(r.payments[0].receivingAccount, '');
});

t('a legacy Cheque row sent back unchanged -> accepted', () => {
  const stored = [{ paidAmount: 99, paymentMode: 'Cheque', referenceNo: '', paymentDate: new Date('2026-11-17T12:00:00Z') }];
  const r = validatePaymentRows([{ paidAmount: 99, paymentMode: 'Cheque', referenceNo: '', paymentDate: D }], stored);
  assert.strictEqual(r.error, undefined, r.error);
});

t('changing the AMOUNT makes it a new row, so both fields are then required', () => {
  const r = validatePaymentRows(
    [{ paidAmount: 500, paymentMode: 'E-Transfer', referenceNo: 'R1', paymentDate: D }],
    storedLegacy
  );
  assert.ok(r.error && /receivingAccount is required/.test(r.error), r.error);
});

t('changing the DATE makes it a new row too', () => {
  const r = validatePaymentRows(
    [{ paidAmount: 200, paymentMode: 'E-Transfer', referenceNo: 'R1', paymentDate: '2026-11-18' }],
    storedLegacy
  );
  assert.ok(r.error && /receivingAccount is required/.test(r.error), r.error);
});

t('changing the MODE to E-Transfer makes it a new row', () => {
  const stored = [{ paidAmount: 200, paymentMode: 'Cash', referenceNo: '', paymentDate: new Date('2026-11-17T12:00:00Z') }];
  const r = validatePaymentRows([{ paidAmount: 200, paymentMode: 'E-Transfer', referenceNo: '', paymentDate: D }], stored);
  assert.ok(r.error, r.error);
});

t('changing the mode AWAY from E-Transfer needs nothing', () => {
  const r = validatePaymentRows(
    [{ paidAmount: 200, paymentMode: 'Cash', referenceNo: 'R1', paymentDate: D }],
    storedLegacy
  );
  assert.strictEqual(r.error, undefined, r.error);
});

t('editing ONLY the sender name on an existing row is not a "change"', () => {
  const stored = [{
    paidAmount: 200, paymentMode: 'E-Transfer', referenceNo: 'R1',
    paymentDate: new Date('2026-11-17T12:00:00Z'), receivingAccount: RBC, senderName: 'Old'
  }];
  const r = validatePaymentRows(
    [{ paidAmount: 200, paymentMode: 'E-Transfer', referenceNo: 'R1', paymentDate: D, senderName: 'New' }],
    stored
  );
  assert.strictEqual(r.error, undefined, r.error);
  assert.strictEqual(r.payments[0].senderName, 'New', 'and the new name is kept');
});

t('a client that omits the fields cannot blank a stored row', () => {
  const stored = [{
    paidAmount: 200, paymentMode: 'E-Transfer', referenceNo: 'R1',
    paymentDate: new Date('2026-11-17T12:00:00Z'), receivingAccount: TD, senderName: 'Ravi'
  }];
  const r = validatePaymentRows(
    [{ paidAmount: 200, paymentMode: 'E-Transfer', referenceNo: 'R1', paymentDate: D }],
    stored
  );
  assert.strictEqual(r.payments[0].receivingAccount, TD, 'carried forward');
  assert.strictEqual(r.payments[0].senderName, 'Ravi');
});

console.log('\nisUnrecordedAccount — what "Not recorded" means');

t('an E-Transfer with no account, and every legacy mode, are Not recorded', () => {
  assert.strictEqual(isUnrecordedAccount({ paymentMode: 'E-Transfer' }), true);
  assert.strictEqual(isUnrecordedAccount({ paymentMode: 'Cheque' }), true);
  assert.strictEqual(isUnrecordedAccount({ paymentMode: 'Bank Transfer' }), true);
  assert.strictEqual(isUnrecordedAccount({ paymentMode: 'Cash' }), true);
  assert.strictEqual(isUnrecordedAccount({ paymentMode: 'E-Transfer', receivingAccount: '  ' }), true);
});

t('a recorded account is not', () => {
  assert.strictEqual(isUnrecordedAccount({ paymentMode: 'E-Transfer', receivingAccount: RBC }), false);
});

// ------------------------------------------------------------------ the routes ----------------

function newBooking(over = {}) {
  return new Booking(Object.assign({
    pnr: 'TEST01', paxName: 'X', contactNumber: '+1 5550000', sectorType: 'One Way',
    travelDate: new Date('2026-12-01T12:00:00Z'), from: 'YYZ', to: 'DEL',
    submittedBy: oid(), submittedByName: 'Agent One',
    status: 'Pending Verification', salePrice: 1000, ourCost: 900,
    dateOfSubmission: new Date('2026-11-17T14:00:00Z')
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
  return { put: (p, b) => call('PUT', p, b), post: (p, b) => call('POST', p, b), saved, created, close: () => server.close() };
}

const ROLES = ['AGENT1', 'AGENT2', 'ACCOUNT', 'ADMIN'];

(async () => {

  const createBody = (over) => Object.assign({
    paxName: 'X', contactNumber: '+1 5550000', pnr: 'NEW01', sectorType: 'One Way',
    travelDate: '2026-12-01', from: 'YYZ', to: 'DEL',
    ourCost: 900, salePrice: 1000, paymentType: 'Full'
  }, over);

  console.log('\nPOST /bookings — the rule holds for every role');
  for (const role of ROLES) {
    {
      const api = await startBookings(null, role);
      const res = await api.post('/', createBody({ payments: [etr({})] }));
      assert.strictEqual(res.status, 400, `${role}: got ${res.status}`);
      assert.strictEqual(api.created.length, 0, 'nothing created');
      api.close();
    }
    {
      const api = await startBookings(null, role);
      const res = await api.post('/', createBody({ payments: [etr({ receivingAccount: RBC, senderName: 'Ravi' })] }));
      assert.strictEqual(res.status, 201, `${role}: ${JSON.stringify(res.body)}`);
      const d = api.created[api.created.length - 1];
      assert.strictEqual(d.payments[0].receivingAccount, RBC);
      assert.strictEqual(d.payments[0].senderName, 'Ravi');
      api.close();
    }
    {
      const api = await startBookings(null, role);
      const res = await api.post('/', createBody({ payments: [{ paidAmount: 200, paymentMode: 'Cash', paymentDate: D }] }));
      assert.strictEqual(res.status, 201, `${role} Cash: ${JSON.stringify(res.body)}`);
      api.close();
    }
    ok(`POST as ${role}: E-Transfer without the fields -> 400, with them -> 201, Cash unaffected`);
  }

  console.log('\nPOST /bookings — each installment row is validated');
  {
    const api = await startBookings(null, 'AGENT1');
    const res = await api.post('/', createBody({
      paymentType: 'Installments',
      payments: [
        etr({ receivingAccount: RBC, senderName: 'Ravi' }),
        etr({ paidAmount: 300 })  // second row is incomplete
      ]
    }));
    assert.strictEqual(res.status, 400, `got ${res.status}`);
    assert.ok(res.body.message.includes('payments[1]'), res.body.message);
    assert.strictEqual(api.created.length, 0);
    api.close();
    ok('an incomplete SECOND installment row is caught and names its index');
  }
  {
    const api = await startBookings(null, 'AGENT1');
    const res = await api.post('/', createBody({
      paymentType: 'Installments',
      payments: [
        etr({ receivingAccount: RBC, senderName: 'Ravi' }),
        etr({ paidAmount: 300, receivingAccount: TD, senderName: 'Sunita' })
      ]
    }));
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    const d = api.created[api.created.length - 1];
    assert.strictEqual(d.payments[0].receivingAccount, RBC);
    assert.strictEqual(d.payments[1].receivingAccount, TD);
    api.close();
    ok('two complete installment rows can name different accounts');
  }

  console.log('\nPUT /bookings/:id — a new E-Transfer row, every role');
  for (const role of ROLES) {
    const doc = newBooking();
    const api = await startBookings(doc, role);
    const bad = await api.put(`/${doc._id}`, { payments: [etr({})] });
    assert.strictEqual(bad.status, 400, `${role}: got ${bad.status}`);
    assert.strictEqual(api.saved.length, 0, 'nothing saved');
    const good = await api.put(`/${doc._id}`, { payments: [etr({ receivingAccount: TD, senderName: 'Ravi' })] });
    assert.strictEqual(good.status, 200, `${role}: ${JSON.stringify(good.body)}`);
    assert.strictEqual(doc.payments[0].receivingAccount, TD);
    api.close();
    ok(`PUT as ${role}: incomplete rejected, complete stored -- including the ADMIN branch`);
  }

  console.log('\nLEGACY ROWS KEEP SAVING through every booking action');
  // The Cheque incident in one test: a stored Cheque row with no bank details must not block any
  // of these. Each action loads the whole document and saves it, which is what re-validates
  // every path.
  const legacyRow = {
    paidAmount: 200, paymentMode: 'Cheque', referenceNo: 'R1',
    paymentDate: new Date('2026-11-17T12:00:00Z')
  };
  const actions = [
    ['edit (PUT, untouched)', async (api, doc) => api.put(`/${doc._id}`, { salePrice: 1234 })],
    ['edit (PUT, row round-tripped)', async (api, doc) => api.put(`/${doc._id}`, {
      salePrice: 1300,
      payments: [{ paidAmount: 200, paymentMode: 'Cheque', referenceNo: 'R1', paymentDate: D }]
    })],
    ['date change', async (api, doc) => api.post(`/${doc._id}/date-change`, {
      changeTravelDate: true, newTravelDate: '2026-12-15', remarks: 'r'
    })],
    ['flight change', async (api, doc) => api.post(`/${doc._id}/flight-change`, {
      newDetails: { airline: 'AC', from: 'YYZ', to: 'DEL' }, remarks: 'r'
    })],
    ['seat book', async (api, doc) => api.post(`/${doc._id}/seat-book`, {
      newOurCost: 50, newSalePrice: 80, remarks: 'r'
    })],
    ['cancel', async (api, doc) => api.post(`/${doc._id}/cancel`, {
      remarks: 'r', paymentModeWas: 'Cheque', cancellationMode: 'charges', airlineCancellationCharges: 10
    })],
    ['verify (account)', async (api, doc) => api.post(`/${doc._id}/verify-account`, {})],
    ['verify (admin)', async (api, doc) => api.post(`/${doc._id}/verify-admin`, {})]
  ];
  for (const [label, run] of actions) {
    const doc = newBooking({ payments: [{ ...legacyRow }] });
    const api = await startBookings(doc, 'ADMIN');
    const res = await run(api, doc);
    assert.ok(res.status === 200 || res.status === 201, `${label}: ${res.status} ${JSON.stringify(res.body)}`);
    assert.strictEqual(doc.payments[0].paymentMode, 'Cheque', `${label}: legacy mode survived`);
    api.close();
    ok(`legacy Cheque row with no bank details survives: ${label}`);
  }

  // ------------------------------------------------------------ the bank filter ---------------

  console.log('\nGET /api/payments — the bank filter, and totals of the FILTERED set');
  {
    const bookingsFixture = [{
      _id: oid(), pnr: 'AAA111', paxName: 'X', submittedByName: 'Agent One',
      payments: [
        { paidAmount: 100, paymentMode: 'E-Transfer', paymentDate: new Date('2026-11-17T12:00:00Z'), referenceNo: '', receivingAccount: RBC, senderName: 'Ravi' },
        { paidAmount: 200, paymentMode: 'E-Transfer', paymentDate: new Date('2026-11-17T12:00:00Z'), referenceNo: '', receivingAccount: TD, senderName: 'Sunita' },
        { paidAmount: 400, paymentMode: 'E-Transfer', paymentDate: new Date('2026-11-17T12:00:00Z'), referenceNo: '', receivingAccount: '', senderName: '' },
        { paidAmount: 800, paymentMode: 'Cheque', paymentDate: new Date('2026-11-17T12:00:00Z'), referenceNo: '' }
      ]
    }];

    const admin = { _id: oid(), role: 'ADMIN', isActive: true, name: 'Admin' };
    User.findById = () => ({ select: () => Promise.resolve(admin) });
    Booking.find = () => {
      const chain = {
        select: () => chain, lean: () => chain,
        then: (res, rej) => Promise.resolve(bookingsFixture).then(res, rej)
      };
      return chain;
    };
    const app = express();
    app.use(express.json());
    app.use('/api/payments', require('../routes/payments'));
    const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
    const token = jwt.sign({ userId: String(admin._id), role: 'ADMIN' }, SECRET);
    const get = async (params = {}) => {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/payments?${new URLSearchParams(params)}`,
        { headers: { Authorization: `Bearer ${token}` } });
      return { status: res.status, body: await res.json().catch(() => null) };
    };

    // Independent sums, computed here rather than taken from the response.
    const expected = {
      All: { count: 4, total: 1500 },
      [RBC]: { count: 1, total: 100 },
      [TD]: { count: 1, total: 200 },
      'Not recorded': { count: 2, total: 1200 }  // the bare E-Transfer plus the legacy Cheque
    };
    for (const [value, exp] of Object.entries(expected)) {
      const res = await get(value === 'All' ? {} : { receivingAccount: value });
      assert.strictEqual(res.status, 200, `${value}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.payments.length, exp.count, `${value}: row count`);
      assert.strictEqual(res.body.summary.totalPayments, exp.count, `${value}: summary count`);
      assert.strictEqual(res.body.summary.totalAmount, exp.total, `${value}: summary total`);
      // And the summary really is the sum of the rows returned, not of everything.
      const sum = res.body.payments.reduce((s, r) => s + r.amount, 0);
      assert.strictEqual(res.body.summary.totalAmount, sum, `${value}: total == sum of rows`);
      console.log(`      ${String(value).padEnd(13)} rows ${exp.count}   total ${exp.total.toFixed(2)}`);
    }
    ok('each filter value returns only matching rows, and the totals are that set\'s own sum');

    {
      const res = await get({ receivingAccount: 'HSBC 1234' });
      assert.strictEqual(res.status, 400, `got ${res.status}`);
      ok('an unknown receivingAccount is rejected with 400, not silently ignored');
    }
    {
      const res = await get({});
      assert.strictEqual(res.body.payments[0].receivingAccount !== undefined, true);
      assert.strictEqual(res.body.payments[0].senderName !== undefined, true);
      ok('both fields are returned to the screen, so the projection carries them');
    }
    server.close();
  }

  console.log('\nGET /reports/verified-payments — option (i): the booking list is filtered');
  {
    const base = {
      paxName: 'X', status: 'Pending Verification', submittedBy: oid(), submittedByName: 'Agent One',
      dateOfSubmission: new Date('2026-11-17T14:00:00Z'),
      travelDate: new Date('2026-12-01T12:00:00Z'), from: 'YYZ', to: 'DEL', sectorType: 'One Way',
      totalSalePrice: 1000, ourCost: 900, supplierCharges: 0,
      adminVerified: false, accountVerified: false
    };
    const rows = [
      { ...base, _id: oid(), pnr: 'RBC001', payments: [{ paidAmount: 100, paymentMode: 'E-Transfer', receivingAccount: RBC, senderName: 'Ravi', paymentDate: new Date('2026-11-17T12:00:00Z') }] },
      { ...base, _id: oid(), pnr: 'TD001', payments: [{ paidAmount: 200, paymentMode: 'E-Transfer', receivingAccount: TD, senderName: 'Sunita', paymentDate: new Date('2026-11-17T12:00:00Z') }] },
      { ...base, _id: oid(), pnr: 'LEG001', payments: [{ paidAmount: 800, paymentMode: 'Cheque', paymentDate: new Date('2026-11-17T12:00:00Z') }] }
    ];
    const api = await startReports('../routes/reports', rows);
    const q = { verificationType: 'unverified' };

    const all = await api.get('verified-payments', q);
    assert.strictEqual(all.bookings.length, 3);
    assert.strictEqual(all.summary.totalBookings, 3);

    const rbc = await api.get('verified-payments', { ...q, receivingAccount: RBC });
    assert.deepStrictEqual(rbc.bookings.map(b => b.pnr), ['RBC001']);
    assert.strictEqual(rbc.summary.totalBookings, 1, 'the summary follows the filter');
    assert.strictEqual(rbc.summary.totalSalePrice, 1000);
    assert.strictEqual(rbc.summary.totalMargin, 100);

    const td = await api.get('verified-payments', { ...q, receivingAccount: TD });
    assert.deepStrictEqual(td.bookings.map(b => b.pnr), ['TD001']);

    const none = await api.get('verified-payments', { ...q, receivingAccount: 'Not recorded' });
    assert.deepStrictEqual(none.bookings.map(b => b.pnr), ['LEG001'],
      'the legacy Cheque booking is the Not recorded one');
    assert.strictEqual(none.summary.totalBookings, 1);

    const bad = await api.get('verified-payments', { ...q, receivingAccount: 'HSBC 1234' });
    assert.ok(/Unknown receivingAccount/.test(bad.message || ''), JSON.stringify(bad));

    api.close();
    ok('each filter value returns only matching bookings, and the four tiles follow');
    ok('an unknown account is rejected here too');
  }

  console.log(`\n${passed} assertions passed`);
  process.exit(0);
})().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
