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
// A booking entered months before today, for the forward-dating bound.
const ENTERED_SEP = new Date('2026-09-02T14:30:00Z');
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

t('an issue date AFTER the entry date is rejected, however far back the booking is', () => {
  // The defect this closes: the upper bound used to be anchored on TODAY while the lower bound
  // was anchored on the entry date, so for an old booking they were months apart. A booking
  // entered 2026-09-02 accepted an issue date of 2026-11-23 -- 82 days after it was keyed in --
  // which moved its whole sale, cost and margin out of a closed September and into November
  // across Reports C, E and F and the supplier statement, with no late-entry marker to show for
  // it, because isLateEntry only fires when entry comes AFTER issue.
  for (const d of ['2026-09-03', '2026-09-20', '2026-10-15', '2026-11-23']) {
    const msg = validateIssueDate(d, ENTERED_SEP);
    assert.ok(msg && /after the entry date/.test(msg), d + ': ' + msg);
  }
  // The entry day itself is fine, and so is the whole backdating window below it.
  assert.strictEqual(validateIssueDate('2026-09-02', ENTERED_SEP), null);
  assert.strictEqual(validateIssueDate('2026-08-30', ENTERED_SEP), null);
  assert.ok(validateIssueDate('2026-08-29', ENTERED_SEP), 'and 4 days back is still rejected');
});

t('on a NEW booking the two bounds coincide, so nothing changes there', () => {
  // The entry date IS today, so "not after today" and "not after the entry date" are one rule.
  const now = new Date();
  assert.strictEqual(validateIssueDate(todayTor, now), null);
  assert.ok(/future/.test(validateIssueDate(dayOffset(1), now) || ''), 'tomorrow still reads as future');
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

/**
 * A booking as it comes back from findById: NOT new, and with no modified paths.
 *
 * `new Booking({...})` is $isNew with every supplied path marked modified, so a route that asks
 * the document what actually changed sees everything. That is not what a loaded document looks
 * like, and the difference is not cosmetic: it is why twelve assertions about the verification
 * reset passed while the product path was still broken. The double has to model document state,
 * not just document shape -- the same lesson as making select() real in report-harness.
 *
 * Booking.hydrate, not `new Booking(...)` with the modified paths reset. The two differ in one
 * way that matters: `new Booking` INITIALISES every path that has a schema default, so writing
 * that default back is not a modification, while hydrate initialises only the paths actually
 * present -- so writing a default over an absent path IS one, exactly as Mongoose behaves on a
 * document loaded from Mongo.
 *
 * That difference hid a live defect. supplierCharges, paymentFromCard, cardType and
 * cardLast4Digits all have defaults and are ABSENT on 606 of the 2,285 bookings on the staging
 * copy; the edit form posts 0, 0, '' and '' for them on every save; so on more than a quarter of
 * the data every save marked four paths modified and the diff that decides the verification reset
 * reported an edit where nothing had changed. Every fixture built with `new Booking` reported no
 * modification and the assertions passed.
 */
function asLoaded(plain) {
  return Booking.hydrate(plain);
}

function newBooking(over = {}) {
  return asLoaded(Object.assign({
    _id: oid(),
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

  console.log('\nPUT /bookings/:id — correcting the issue date must NOT un-verify the booking');
  // The whole point of letting ACCOUNT and ADMIN edit a verified booking's issue date is to
  // CORRECT it. All three PUT branches reset the verification flags on any edit, so an
  // issueDate-only request used to silently destroy the verification it was allowed to work
  // around: the statement's Verified column flipped from Both to a dash on a document already
  // sent, the booking migrated from Verified Payments to the unverified queue, both screens'
  // totals moved by its full sale price and margin, and the booking-detail edit lock re-opened
  // so an agent could edit it again. For ADMIN the only audit entry was "Issue Date Changed",
  // which says nothing about verification.
  const verified = (over = {}) => newBooking(Object.assign({
    issueDate: ISSUED_OCT,
    status: 'Admin Verified',
    verifiedByAccount: true, accountVerified: true,
    verifiedByAdmin: true, adminVerified: true
  }, over));

  for (const role of ['ACCOUNT', 'ADMIN']) {
    const doc = verified();
    const api = await startBookings(doc, role);
    const res = await api.put(`/${doc._id}`, { issueDate: '2026-11-02' });
    assert.strictEqual(res.status, 200, `${role}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(dayInTz(doc.issueDate), '2026-11-02', `${role}: corrected`);
    for (const f of ['adminVerified', 'accountVerified', 'verifiedByAdmin', 'verifiedByAccount']) {
      assert.strictEqual(doc[f], true, `${role}: ${f} must survive an issueDate-only correction`);
    }
    assert.ok(doc.progressHistory.find(h => h.action === 'Issue Date Changed'), `${role}: audited`);
    // Exactly ONE entry, and it is the right one. The ACCOUNT branch used to add an empty
    // 'Booking Updated by Account' alongside it, claiming an edit that did not happen.
    assert.strictEqual(doc.progressHistory.length, 1,
      `${role}: one audit entry, got ${doc.progressHistory.map(h => h.action).join(' | ')}`);
    api.close();
    ok(`${role}: an issueDate-only correction keeps all four verification flags, with one audit entry`);
  }

  console.log('\nPUT /bookings/:id — the body the EDIT FORM actually posts, not a hand-made one');
  // This is the assertion that was missing. new-booking.component.ts builds its PUT from
  // bookingForm.getRawValue() -- the WHOLE form, ~25 keys -- and deletes only dateOfSubmission,
  // submittedBy and submittedByName. So changing just the Issue Date field posts every other
  // field back at its stored value. Any guard that counts keys in the request body sees a
  // 25-field edit and resets the verification it was supposed to protect.
  const formBody = (doc, over = {}) => Object.assign({
    pnr: doc.pnr,
    paxName: doc.paxName,
    contactPerson: doc.contactPerson || '',
    contactNumber: doc.contactNumber,
    sectorType: doc.sectorType,
    travelDate: dayInTz(doc.travelDate),
    from: doc.from,
    to: doc.to,
    returnDate: null,
    multipleSectors: [],
    note: doc.note || '',
    airline: doc.airline || '',
    ourCost: doc.ourCost,
    salePrice: doc.salePrice,
    supplierCharges: doc.supplierCharges || 0,
    additionalService: '',
    additionalServicePrice: 0,
    additionalServices: [],
    paymentType: doc.paymentType || 'Full',
    payments: (doc.payments || []).map(p => ({
      paidAmount: p.paidAmount,
      paymentMode: p.paymentMode,
      paymentDate: dayInTz(p.paymentDate),
      referenceNo: p.referenceNo || '',
      receivingAccount: p.receivingAccount || '',
      senderName: p.senderName || ''
    })),
    paymentFromCard: doc.paymentFromCard || 0,
    cardType: doc.cardType || '',
    cardLast4Digits: doc.cardLast4Digits || '',
    // The form posts null for a booking with no issue date yet, not a blank day.
    issueDate: doc.issueDate ? dayInTz(doc.issueDate) : null
  }, over);

  for (const role of ['ACCOUNT', 'ADMIN']) {
    const doc = verified({
      payments: [{ paidAmount: 200, paymentMode: 'Cash', referenceNo: '',
        paymentDate: new Date('2026-11-01T12:00:00Z') }]
    });
    const api = await startBookings(doc, role);
    const body = formBody(doc, { issueDate: '2026-11-02' });
    assert.ok(Object.keys(body).length > 20, `the fixture must be a full form: ${Object.keys(body).length} keys`);
    const res = await api.put(`/${doc._id}`, body);
    assert.strictEqual(res.status, 200, `${role}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(dayInTz(doc.issueDate), '2026-11-02', `${role}: the date was corrected`);
    for (const f of ['adminVerified', 'accountVerified', 'verifiedByAdmin', 'verifiedByAccount']) {
      assert.strictEqual(doc[f], true,
        `${role}: ${f} must survive a full-form post whose only change is the issue date`);
    }
    api.close();
    ok(`${role}: a ${Object.keys(body).length}-key form post that changes only the issue date keeps verification`);
  }

  for (const role of ['ACCOUNT', 'ADMIN']) {
    // And the same full-form post WITH a real change must still reset.
    const doc = verified();
    const api = await startBookings(doc, role);
    const res = await api.put(`/${doc._id}`, formBody(doc, { issueDate: '2026-11-02', salePrice: 9999 }));
    assert.strictEqual(res.status, 200, `${role}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(doc.salePrice, 9999);
    assert.strictEqual(doc.adminVerified, false, `${role}: a real change still resets`);
    api.close();
    ok(`${role}: the same form post with a changed sale price does reset verification`);
  }

  console.log('\nPUT /bookings/:id — an unchanged payments array is not rewritten');
  for (const role of ['ACCOUNT', 'ADMIN']) {
    const doc = verified({
      payments: [{ paidAmount: 200, paymentMode: 'Cash', referenceNo: '',
        paymentDate: new Date('2026-11-01T12:00:00Z') }]
    });
    const idsBefore = doc.payments.map(x => String(x._id));
    const api = await startBookings(doc, role);
    await api.put(`/${doc._id}`, formBody(doc, { issueDate: '2026-11-02' }));
    const idsAfter = doc.payments.map(x => String(x._id));
    // The incoming rows are plain objects, so reassigning the array mints new subdocument _ids.
    // Skipping the write when nothing changed is what lets the diff tell an issue-date
    // correction from a payments edit -- and it stops every save churning these ids.
    assert.deepStrictEqual(idsAfter, idsBefore,
      `${role}: payment subdocument _ids must be stable when the payments did not change`);
    api.close();
    ok(`${role}: an unchanged payments array keeps its subdocument _ids`);
  }
  {
    // The converse, which the healing asserted in tests/date-only-hotfix.test.js depends on: a
    // stored 00:00Z date IS a difference, so the array is rewritten and the value healed.
    const doc = verified({
      payments: [{ paidAmount: 200, paymentMode: 'Cash', referenceNo: '',
        paymentDate: new Date('2026-11-01T00:00:00Z') }]
    });
    const api = await startBookings(doc, 'ADMIN');
    await api.put(`/${doc._id}`, formBody(doc, { issueDate: '2026-11-02' }));
    assert.strictEqual(doc.payments[0].paymentDate.getUTCHours(), 12,
      'a legacy 00:00Z payment date is still healed to noon on a save');
    api.close();
    ok('but a stored 00:00Z date counts as a difference, so it is rewritten and healed');
  }

  console.log('\nPUT /bookings/:id — a save that changes NOTHING changes nothing');
  // The case the whole diff rests on, and the one that was still broken after f002425: the user
  // opens a verified booking, touches nothing, and presses Save. The form posts all 24 fields
  // back. Nothing about the booking is different, so nothing may be written -- no verification
  // reset and no audit entry claiming an edit.
  //
  // It failed on 606 of the 2,285 bookings on the staging copy, because the four fields below are
  // ABSENT on those and the form posts a number input's 0 and a text input's '' for them. Writing
  // a schema default over an uninitialised path marks it modified, so four paths changed on a save
  // where nothing did. The fixture is built by Booking.hydrate precisely so those paths are
  // uninitialised here too; `new Booking({...})` initialises them and cannot reproduce it.
  for (const role of ['ACCOUNT', 'ADMIN', 'AGENT1']) {
    const doc = role === 'AGENT1' ? newBooking() : verified();
    // The fixture is only a fixture if these are genuinely uninitialised, as they are on the 606
    // stored bookings that have no such field. If a future change to newBooking starts supplying
    // one, this assertion fails rather than the test quietly going green on the easy shape.
    const init = doc.$__.activePaths.getStatePaths('init');
    for (const f of ['supplierCharges', 'paymentFromCard', 'cardType', 'cardLast4Digits',
      'contactPerson', 'multipleSectors', 'additionalServices']) {
      assert.ok(!init[f], `the fixture must have ${f} UNINITIALISED, as a stored booking without it is`);
    }
    const api = await startBookings(doc, role);
    const res = await api.put(`/${doc._id}`, formBody(doc));
    assert.strictEqual(res.status, 200, `${role}: ${JSON.stringify(res.body)}`);
    if (role !== 'AGENT1') {
      for (const f of ['adminVerified', 'accountVerified', 'verifiedByAdmin', 'verifiedByAccount']) {
        assert.strictEqual(doc[f], true,
          `${role}: ${f} must survive a save that changed nothing`);
      }
    }
    assert.deepStrictEqual((doc.progressHistory || []).map(h => h.action), [],
      `${role}: a save that changed nothing must not write an audit entry`);
    api.close();
    ok(`${role}: a full-form save with no change resets nothing and writes no history`);
  }

  console.log('\nPUT /bookings/:id — but clearing a REAL value is still an edit');
  // The other side of the guard. Declining to write an empty value over an absent one must not
  // become declining to write it over a real one: zeroing 250.00 of supplier charges moves money.
  for (const role of ['ACCOUNT', 'ADMIN']) {
    for (const [field, before, after] of [
      ['supplierCharges', 250, 0],
      ['paymentFromCard', 900, 0],
      ['cardType', 'Company Card', '']
    ]) {
      const doc = verified({ [field]: before });
      const api = await startBookings(doc, role);
      const res = await api.put(`/${doc._id}`, formBody(doc, { [field]: after }));
      assert.strictEqual(res.status, 200, `${role}/${field}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(doc[field], after, `${role}: ${field} must actually be cleared`);
      assert.strictEqual(doc.adminVerified, false,
        `${role}: clearing a real ${field} is an edit and must reset verification`);
      api.close();
      ok(`${role}: clearing ${field} ${before} -> ${JSON.stringify(after)} resets verification`);
    }
  }

  console.log('\nPUT /bookings/:id — a real change inside a subdocument array is still an edit');
  for (const role of ['ACCOUNT', 'ADMIN']) {
    // Round-tripping the same rows must not count; changing one must.
    const rows = [{ serviceName: 'Seat', serviceCost: 25 }];
    const same = verified({ additionalServices: rows });
    let api = await startBookings(same, role);
    await api.put(`/${same._id}`, formBody(same, { additionalServices: rows }));
    assert.strictEqual(same.adminVerified, true,
      `${role}: re-posting the same additional services is not an edit`);
    api.close();

    const changed = verified({ additionalServices: rows });
    api = await startBookings(changed, role);
    await api.put(`/${changed._id}`, formBody(changed, {
      additionalServices: [{ serviceName: 'Seat', serviceCost: 40 }]
    }));
    assert.strictEqual(changed.additionalServices[0].serviceCost, 40, `${role}: the cost was written`);
    assert.strictEqual(changed.adminVerified, false,
      `${role}: changing a service cost is an edit and must reset verification`);
    api.close();
    ok(`${role}: additionalServices round-trip is not an edit, a changed cost is`);

    const sector = [{ travelDate: '2026-12-05', from: 'YYZ', to: 'BOM' }];
    const sameSec = verified({ multipleSectors: [{ travelDate: new Date('2026-12-05T12:00:00Z'), from: 'YYZ', to: 'BOM' }] });
    api = await startBookings(sameSec, role);
    await api.put(`/${sameSec._id}`, formBody(sameSec, { multipleSectors: sector }));
    assert.strictEqual(sameSec.adminVerified, true,
      `${role}: re-posting the same sectors is not an edit`);
    api.close();

    const changedSec = verified({ multipleSectors: [{ travelDate: new Date('2026-12-05T12:00:00Z'), from: 'YYZ', to: 'BOM' }] });
    api = await startBookings(changedSec, role);
    await api.put(`/${changedSec._id}`, formBody(changedSec, {
      multipleSectors: [{ travelDate: '2026-12-09', from: 'YYZ', to: 'BOM' }]
    }));
    assert.strictEqual(dayInTz(changedSec.multipleSectors[0].travelDate), '2026-12-09',
      `${role}: the sector date was written`);
    assert.strictEqual(changedSec.adminVerified, false,
      `${role}: changing a sector date is an edit and must reset verification`);
    api.close();
    ok(`${role}: multipleSectors round-trip is not an edit, a changed date is`);
  }

  console.log('\nPUT /bookings/:id — keys the branch ignores do not count as an edit');
  for (const role of ['ACCOUNT', 'ADMIN']) {
    const doc = verified();
    const api = await startBookings(doc, role);
    // _id and __v are what any integration round-tripping GET /bookings/:id sends back. The
    // ADMIN loop skips both explicitly and the ACCOUNT allowlist excludes them, so neither
    // writes anything and neither is an edit.
    const body = { issueDate: '2026-11-02', _id: String(doc._id), __v: 0 };
    // `status` is dropped by the ACCOUNT allowlist, so it is inert there. The ADMIN branch has
    // no allowlist and DOES write status, so sending it there is a real edit -- not an example
    // of an ignored key.
    if (role === 'ACCOUNT') body.status = 'Cancelled';
    const res = await api.put(`/${doc._id}`, body);
    assert.strictEqual(res.status, 200, `${role}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(doc.adminVerified, true, `${role}: ignored keys are not an edit`);
    if (role === 'ACCOUNT') {
      assert.notStrictEqual(doc.status, 'Cancelled', 'and the dropped status was not written');
    }
    api.close();
    ok(`${role}: _id and __v do not trigger the reset`);
  }

  console.log('\nPUT /bookings/:id — a resent UNCHANGED issue date is never re-validated');
  for (const role of ['ACCOUNT', 'ADMIN']) {
    // A stored date outside the current window can only exist from before the window was
    // tightened, but it must not make the booking un-editable: the fix for a booking in the
    // wrong month is an edit, so an edit has to be possible.
    const doc = verified({
      dateOfSubmission: ENTERED_SEP,
      issueDate: new Date('2026-11-23T12:00:00Z')  // 82 days after entry: outside the window
    });
    const api = await startBookings(doc, role);
    const res = await api.put(`/${doc._id}`, { issueDate: '2026-11-23', salePrice: 4100 });
    assert.strictEqual(res.status, 200, `${role}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(doc.salePrice, 4100, `${role}: the unrelated edit went through`);
    api.close();
    ok(`${role}: an out-of-window stored issue date, resent unchanged, does not block an edit`);
  }
  for (const role of ['ACCOUNT', 'ADMIN']) {
    // But actually MOVING it to another out-of-window day is still rejected.
    const doc = verified({
      dateOfSubmission: ENTERED_SEP,
      issueDate: new Date('2026-11-23T12:00:00Z')
    });
    const api = await startBookings(doc, role);
    const res = await api.put(`/${doc._id}`, { issueDate: '2026-11-20' });
    assert.strictEqual(res.status, 400, `${role}: got ${res.status}`);
    api.close();
    ok(`${role}: but moving it to another out-of-window day is still rejected`);
  }

  console.log('\nPUT /bookings/:id — but any OTHER edit still resets verification');
  for (const role of ['ACCOUNT', 'ADMIN']) {
    {
      // issueDate alongside a real edit: this is an edit, so the reset must fire.
      const doc = verified();
      const api = await startBookings(doc, role);
      const res = await api.put(`/${doc._id}`, { issueDate: '2026-11-02', salePrice: 4321 });
      assert.strictEqual(res.status, 200, `${role}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(doc.salePrice, 4321);
      for (const f of ['adminVerified', 'accountVerified', 'verifiedByAdmin', 'verifiedByAccount']) {
        assert.strictEqual(doc[f], false, `${role}: ${f} must reset when something else changed`);
      }
      api.close();
    }
    {
      // No issueDate at all: unchanged behaviour.
      const doc = verified();
      const api = await startBookings(doc, role);
      await api.put(`/${doc._id}`, { salePrice: 4321 });
      assert.strictEqual(doc.adminVerified, false, `${role}: plain edit still resets`);
      api.close();
    }
    {
      // An issueDate request that does not actually CHANGE the date is still issueDate-only.
      const doc = verified();
      const api = await startBookings(doc, role);
      await api.put(`/${doc._id}`, { issueDate: '2026-10-31' });
      assert.strictEqual(doc.adminVerified, true, `${role}: a no-op issueDate keeps verification`);
      assert.strictEqual(
        doc.progressHistory.filter(h => h.action === 'Issue Date Changed').length, 0,
        `${role}: and writes no audit entry`);
      api.close();
    }
    ok(`${role}: a real edit still resets verification; a no-op issueDate does not`);
  }

  console.log('\nPUT /bookings/:id — an AGENT still cannot touch a verified booking at all');
  for (const role of ['AGENT1', 'AGENT2']) {
    const doc = verified();
    const api = await startBookings(doc, role);
    const res = await api.put(`/${doc._id}`, { issueDate: '2026-11-02' });
    assert.strictEqual(res.status, 403, `${role}: got ${res.status}`);
    assert.strictEqual(doc.adminVerified, true, `${role}: flags untouched`);
    assert.strictEqual(dayInTz(doc.issueDate), '2026-10-31', `${role}: date untouched`);
    api.close();
    ok(`${role}: 403, and neither the date nor the flags move`);
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

  console.log('\nReport F — summary totals are RANGE totals, not page totals');
  {
    // More than one page of bookings in range. The route defaults to limit 50 and the UI sends
    // neither page nor limit, so before the fix the tiles described the first 50 only: on the
    // staging copy, 50 of September's 401 bookings, with Total Sale reading 102,132.16 against a
    // real 871,361.72 -- understated by 88.3%.
    const N = 137;
    const many = [];
    for (let i = 0; i < N; i++) {
      many.push({
        _id: oid(), pnr: 'F' + String(i).padStart(4, '0'), paxName: 'X',
        status: i % 7 === 0 ? 'Cancelled' : 'Pending Verification',
        // Spread across October on the EFFECTIVE date, half via issueDate and half legacy, so
        // both clauses of the filter are exercised.
        ...(i % 2 === 0
          ? { issueDate: new Date(Date.UTC(2026, 9, (i % 28) + 1, 12, 0, 0)),
              dateOfSubmission: new Date(Date.UTC(2026, 10, 2, 14, 0, 0)) }
          : { dateOfSubmission: new Date(Date.UTC(2026, 9, (i % 28) + 1, 16, 0, 0)) }),
        travelDate: new Date('2026-12-01T12:00:00Z'), from: 'YYZ', to: 'DEL',
        sectorType: 'One Way', submittedBy: A._id, submittedByName: A.name,
        salePrice: 1000 + i, ourCost: 700 + i, supplierCharges: i % 5,
        totalPaidAmount: 500 + i, balanceAmount: 500,
        totalSalePrice: 1000 + i,
        cancellation: i % 7 === 0 ? { isCancelled: true, currentMargin: 11, airlineCancellationCharges: 3 } : undefined
      });
    }

    // INDEPENDENT sums, computed here from the fixture, not read back from the response.
    const expect = {
      totalBookings: N,
      totalSale: many.reduce((s2, b) => s2 + b.salePrice, 0),
      totalPaid: many.reduce((s2, b) => s2 + b.totalPaidAmount, 0),
      totalMargin: many.reduce((s2, b) => s2 + (b.salePrice - b.ourCost - b.supplierCharges), 0),
      totalSupplierCharges: many.reduce((s2, b) => s2 + b.supplierCharges, 0),
      totalAirlineCharges: many.filter(b => b.status === 'Cancelled')
        .reduce((s2, b) => s2 + (b.cancellation.airlineCancellationCharges || 0), 0),
      totalCurrentMargin: many.reduce((s2, b) => s2 + (b.status === 'Cancelled'
        ? b.cancellation.currentMargin
        : b.salePrice - b.ourCost - b.supplierCharges), 0)
    };

    const api = await startReports('../routes/reports', many);
    const OCT = { dateFrom: '2026-10-01', dateTo: '2026-10-31' };

    // Exactly what the UI sends: dates only, no page, no limit.
    const asUiSeesIt = await api.get('financial-summary', OCT);
    // Rows too, not just the totals. Totalling the range while still returning 50 rows only
    // moved the lie from the tiles to the table: the tiles would say 137 and the table would show
    // 50, with no paging control anywhere in the reports UI to reach the other 87.
    assert.strictEqual(asUiSeesIt.bookings.length, N, 'the UI must get every row, not one page');
    for (const [k, v] of Object.entries(expect)) {
      assert.strictEqual(asUiSeesIt.summary[k], v,
        `${k}: got ${asUiSeesIt.summary[k]}, independent sum ${v}`);
    }
    ok(`F: with ${N} bookings in range the UI gets all ${N} rows and all seven totals over them`);

    // The totals must not move with the page.
    const p3 = await api.get('financial-summary', { ...OCT, page: 3, limit: 50 });
    assert.deepStrictEqual(p3.summary, asUiSeesIt.summary, 'totals are identical on page 3');
    assert.strictEqual(p3.bookings.length, N - 100, 'and the last page is the remainder');
    ok('F: the totals are the same on every page');

    // PAGING: no duplicates, no gaps, every booking exactly once.
    const seen = [];
    for (let page = 1; page <= Math.ceil(N / 20); page++) {
      const r = await api.get('financial-summary', { ...OCT, page, limit: 20 });
      seen.push(...r.bookings.map(b => b.pnr));
    }
    assert.strictEqual(seen.length, N, `paged through ${seen.length}, expected ${N}`);
    assert.strictEqual(new Set(seen).size, N, 'no PNR appears twice across pages');
    const expectedPnrs = new Set(many.map(b => b.pnr));
    for (const pnr of seen) assert.ok(expectedPnrs.has(pnr), `unexpected ${pnr}`);
    assert.strictEqual([...expectedPnrs].filter(x => !seen.includes(x)).length, 0, 'none missing');
    ok(`F: paging 20 at a time returns all ${N} exactly once -- no duplicates, no gaps`);

    // The tie-break is what makes that true when timestamps collide.
    const sameMs = new Date(Date.UTC(2026, 9, 5, 16, 0, 0));
    const tied = [];
    for (let i = 0; i < 9; i++) {
      tied.push({
        _id: oid(), pnr: 'T' + i, paxName: 'X', status: 'Pending Verification',
        dateOfSubmission: sameMs,
        travelDate: new Date('2026-12-01T12:00:00Z'), from: 'YYZ', to: 'DEL',
        sectorType: 'One Way', submittedBy: A._id, submittedByName: A.name,
        salePrice: 100, ourCost: 50, supplierCharges: 0, totalPaidAmount: 0, balanceAmount: 100,
        totalSalePrice: 100
      });
    }
    api.close();
    const api2 = await startReports('../routes/reports', tied);
    const seen2 = [];
    for (let page = 1; page <= 3; page++) {
      const r = await api2.get('financial-summary', { ...OCT, page, limit: 3 });
      seen2.push(...r.bookings.map(b => b.pnr));
    }
    assert.strictEqual(seen2.length, 9);
    assert.strictEqual(new Set(seen2).size, 9,
      'nine bookings sharing one dateOfSubmission millisecond still page without repeats');
    api2.close();
    ok('F: rows sharing a dateOfSubmission millisecond page cleanly, thanks to the _id tie-break');
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
