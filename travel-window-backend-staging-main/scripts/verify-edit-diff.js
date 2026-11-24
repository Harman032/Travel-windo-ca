'use strict';
/**
 * Integration check for f002425 -- the verification reset decided from what the document changed,
 * not from how many keys the request body carried -- against the staging COPY, through the real
 * PUT /api/bookings/:id, with the body the Angular edit form actually posts.
 *
 *   MONGODB_URI=<uri ending /travel_window_staging_copy> node scripts/verify-edit-diff.js
 *
 * WHY THE PAYLOAD IS BUILT THE WAY IT IS
 *
 * The defect f002425 fixed was invisible to twelve passing assertions because those assertions
 * hand-built the request body. The product does not: new-booking.component.ts:869 takes
 * bookingForm.getRawValue() -- the WHOLE form -- drops countryCode, dateOfSubmission, submittedBy
 * and submittedByName, and posts the remaining 24 keys back at their stored values. So "I only
 * changed the Issue Date" arrives as a 24-field write.
 *
 * buildFormBody below therefore reproduces loadBooking() -> getRawValue() -> bookingData from the
 * STORED document, control by control, and assertFormShape asserts its key set against the
 * controls declared in createForm() (new-booking.component.ts:586). If a control is added or
 * renamed on the frontend and not here, this script fails instead of quietly testing a shape the
 * product no longer sends.
 *
 * SAFETY
 *
 * Refuses any database but travel_window_staging_copy. It does WRITE, but never to a real row:
 * every case runs against a CLONE -- a fresh _id and a unique PNR, inserted from a real stored
 * booking so the document shape is real -- and the clones are deleted at the end, including on a
 * crash. Nothing in the copy's own data is read-modify-written.
 *
 * OUTPUT
 *
 * PNRs, counts, amounts, flags and dates only. No passenger names, no phone numbers, no payment
 * reference numbers and no sender names: the source PNR is printed so a finding can be traced,
 * and every clone's own PNR is synthetic.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');

const ALLOWED_DB = 'travel_window_staging_copy';
const uri = process.env.MONGODB_URI || process.env.travel_window_MONGODB_URI;
const dbNameOf = u => ((/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(u || '') || [])[1] || '');
if (!uri || decodeURIComponent(dbNameOf(uri)) !== ALLOWED_DB) {
  console.error(`Refusing to run: MONGODB_URI must point at database "${ALLOWED_DB}" (found "${uri ? dbNameOf(uri) : 'no URI'}").`);
  process.exit(2);
}

const Booking = require('../models/Booking');
const User = require('../models/User');
const { TZ } = require('../utils/tz');

// Module scope so the crash handler at the bottom can still delete them. A clone left behind in
// the copy is a synthetic ZZ-prefixed PNR that would then show up in every report figure anyone
// measures afterwards.
const clones = [];

// ---------------------------------------------------------------------------------------------
// The frontend's own helpers, mirrored. src/app/utils/tz.ts:14 and :23.
// ---------------------------------------------------------------------------------------------
const dayInTz = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d));
const OFFSET_MIDNIGHT =
  /^(\d{4}-\d{2}-\d{2})[T ]00:00(?::00(?:\.0{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/i;
const toDateInputValue = (v) => {
  if (v == null || v === '') return '';
  if (typeof v === 'string') {
    const t = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const off = OFFSET_MIDNIGHT.exec(t);
    if (off) return off[1];
  }
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  if (d.getTime() % 86400000 === 0) return d.toISOString().slice(0, 10);
  return dayInTz(d);
};
// new-booking.component.ts:988
const parseContactNumber = (full) => {
  const trimmed = (full || '').trim();
  if (!trimmed) return { countryCode: '+91', localNumber: '' };
  const m = trimmed.match(/^(\+\d{1,4})\s*(.*)$/);
  return m ? { countryCode: m[1], localNumber: (m[2] || '').trim() } : { countryCode: '+91', localNumber: trimmed };
};

// Exactly the controls createForm() declares (new-booking.component.ts:586), minus the three the
// edit path deletes and minus countryCode, which is folded into contactNumber.
const EDIT_BODY_KEYS = [
  'paxName', 'contactPerson', 'contactNumber', 'pnr', 'sectorType', 'issueDate', 'travelDate',
  'from', 'to', 'returnDate', 'multipleSectors', 'note', 'airline', 'supplier', 'ourCost',
  'salePrice', 'supplierCharges', 'paymentFromCard', 'cardType', 'cardLast4Digits',
  'isCardPayment', 'additionalServices', 'paymentType', 'payments'
].sort();

/** loadBooking() -> getRawValue() -> bookingData, from a stored document. */
function buildFormBody(doc, over = {}) {
  const { countryCode, localNumber } = parseContactNumber(doc.contactNumber || '');
  const contactNumber = (countryCode.replace(/\s/g, '') + ' ' + (localNumber || '').replace(/\D/g, '')).trim();
  const body = {
    paxName: doc.paxName ?? '',
    contactPerson: doc.contactPerson ?? '',
    contactNumber,
    pnr: doc.pnr ?? '',
    sectorType: doc.sectorType ?? 'One Way',
    issueDate: toDateInputValue(doc.issueDate) || null,
    travelDate: toDateInputValue(doc.travelDate) || null,
    from: doc.from ?? '',
    to: doc.to ?? '',
    returnDate: toDateInputValue(doc.returnDate) || null,
    multipleSectors: (doc.multipleSectors || []).map(s => ({
      travelDate: toDateInputValue(s.travelDate) || null,
      from: s.from || '',
      to: s.to || ''
    })),
    note: doc.note ?? '',
    airline: doc.airline ?? '',
    supplier: (doc.supplier && doc.supplier._id) || doc.supplier || '',
    ourCost: doc.ourCost ?? 0,
    salePrice: doc.salePrice ?? 0,
    supplierCharges: doc.supplierCharges ?? 0,
    paymentFromCard: doc.paymentFromCard ?? 0,
    cardType: doc.cardType ?? '',
    cardLast4Digits: doc.cardLast4Digits ?? '',
    isCardPayment: !!(doc.cardType || (doc.paymentFromCard && doc.paymentFromCard > 0)),
    additionalServices: (doc.additionalServices && doc.additionalServices.length)
      ? doc.additionalServices.map(r => ({ serviceName: r.serviceName || '', serviceCost: r.serviceCost ?? 0 }))
      : (doc.additionalService
        ? [{ serviceName: doc.additionalService, serviceCost: doc.additionalServicePrice ?? 0 }]
        : []),
    paymentType: doc.paymentType ?? 'Full',
    // The payments transform at new-booking.component.ts:874. Note it sends the raw 'YYYY-MM-DD'
    // the date input holds, never a Date -- that conversion was the cause of the 00:00Z dates.
    payments: (doc.payments || []).map(p => ({
      paidAmount: typeof p.paidAmount === 'number' ? p.paidAmount : parseFloat(p.paidAmount) || 0,
      paymentMode: p.paymentMode || 'Cash',
      paymentDate: toDateInputValue(p.paymentDate) || dayInTz(),
      referenceNo: p.referenceNo || '',
      receivingAccount: p.receivingAccount || '',
      senderName: p.senderName || ''
    }))
  };
  return Object.assign(body, over);
}

function assertFormShape(body) {
  const keys = Object.keys(body).sort();
  const missing = EDIT_BODY_KEYS.filter(k => !keys.includes(k));
  const extra = keys.filter(k => !EDIT_BODY_KEYS.includes(k));
  if (missing.length || extra.length) {
    throw new Error(`payload no longer matches the edit form: missing [${missing}] extra [${extra}]`);
  }
  return keys.length;
}

const amt = n => Math.round((Number(n) || 0) * 100) / 100;
const flagsOf = d => ['adminVerified', 'accountVerified', 'verifiedByAdmin', 'verifiedByAccount']
  .map(f => `${f.replace('erified', '')}=${d[f] === true ? 'T' : d[f] === false ? 'F' : '-'}`).join(' ');
// Dates and amounts only. No referenceNo, no senderName.
const payLine = p => `${amt(p.paidAmount)} ${p.paymentMode} ${p.paymentDate ? p.paymentDate.toISOString() : 'NO DATE'}`;

(async () => {
  await mongoose.connect(uri);
  if (mongoose.connection.db.databaseName !== ALLOWED_DB) {
    console.error(`Connected database is "${mongoose.connection.db.databaseName}", refusing.`);
    process.exit(2);
  }

  const users = {};
  for (const role of ['AGENT1', 'ACCOUNT', 'ADMIN']) {
    users[role] = await User.findOne({ role, isActive: true }).lean();
    if (!users[role]) { console.error(`No active ${role} on the copy.`); process.exit(2); }
  }
  const tokenFor = role => jwt.sign({ userId: String(users[role]._id), role },
    process.env.JWT_SECRET || 'your_jwt_secret_key_here');

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.id = 'verify-edit-diff'; next(); });
  app.use('/api/bookings', require('../routes/bookings'));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const port = server.address().port;
  const put = async (id, body, role) => {
    const res = await fetch(`http://127.0.0.1:${port}/api/bookings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(role)}` },
      body: JSON.stringify(body)
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  // ------------------------------------------------------------------------------------------
  // Source rows, chosen for shape. Read raw so nothing is normalised on the way in.
  // ------------------------------------------------------------------------------------------
  const raw = mongoose.connection.db.collection('bookings');
  const pick = async (q, label) => {
    const d = await raw.findOne(q);
    if (!d) console.log(`  (no source row for ${label})`);
    return d;
  };
  const sources = {
    plain: await pick({ status: { $nin: ['Cancelled', 'Draft'] }, 'payments.0': { $exists: true } }, 'plain'),
    oneWay: await pick({ sectorType: 'One Way', returnDate: { $in: [null, undefined] }, status: { $nin: ['Cancelled', 'Draft'] } }, 'One Way'),
    cheque: await pick({ 'payments.paymentMode': 'Cheque' }, 'legacy Cheque'),
    midnight: await pick({ payments: { $elemMatch: { paymentDate: { $exists: true } } }, $expr: { $gt: [{ $size: { $ifNull: ['$payments', []] } }, 0] } }, 'any with payments')
  };
  // A payment stored at exactly 00:00Z -- the three live rows' shape. Found by scan, not by query,
  // because the predicate is on the time-of-day component.
  {
    const cur = raw.find({ 'payments.0': { $exists: true } }, { projection: { pnr: 1, payments: 1 } });
    let found = null;
    while (await cur.hasNext()) {
      const d = await cur.next();
      if ((d.payments || []).some(p => p.paymentDate && p.paymentDate.getTime() % 86400000 === 0)) { found = d; break; }
    }
    await cur.close();
    sources.midnight = found ? await raw.findOne({ _id: found._id }) : null;
    if (!found) console.log('  (no stored payment at exactly 00:00Z on the copy; case (g) uses a planted clone)');
  }

  let seq = 0;
  /** Inserts a clone of `src` with a fresh _id and a unique PNR, optionally mutated first. */
  const cloneOf = async (src, mutate) => {
    const d = JSON.parse(JSON.stringify(src), (k, v) =>
      (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v) ? new Date(v) : v));
    delete d._id;
    delete d.__v;
    d.pnr = 'ZZ' + String(++seq).padStart(4, '0');
    d.progressHistory = [];
    if (mutate) mutate(d);
    const r = await raw.insertOne(d);
    clones.push(r.insertedId);
    return r.insertedId;
  };

  const results = [];
  const run = async (name, role, src, { mutate, over, expect }) => {
    if (!src) { results.push({ name, role, note: 'SKIPPED: no source row' }); return; }
    const id = await cloneOf(src, mutate);
    const before = await Booking.findById(id).lean();
    const body = buildFormBody(before, (typeof over === 'function' ? over(before) : over) || {});
    const keyCount = assertFormShape(body);
    const res = await put(id, body, role);
    const after = await Booking.findById(id).lean();
    const histNew = (after.progressHistory || []).map(h => h.action);
    results.push({
      name, role, keyCount, status: res.status,
      message: res.status >= 400 ? res.body.message : '',
      srcPnr: src.pnr,
      flagsBefore: flagsOf(before), flagsAfter: flagsOf(after),
      history: histNew,
      issueBefore: before.issueDate ? before.issueDate.toISOString() : null,
      issueAfter: after.issueDate ? after.issueDate.toISOString() : null,
      saleBefore: amt(before.salePrice), saleAfter: amt(after.salePrice),
      paysBefore: (before.payments || []).map(payLine),
      paysPosted: body.payments.map(p => `${amt(p.paidAmount)} ${p.paymentMode} ${p.paymentDate}`),
      paysAfter: (after.payments || []).map(payLine),
      payIdsStable: JSON.stringify((before.payments || []).map(p => String(p._id)))
        === JSON.stringify((after.payments || []).map(p => String(p._id))),
      expect
    });
  };

  // Verified for ACCOUNT/ADMIN (the reset is the thing under test); unverified for AGENT1, which
  // is 403 on a verified booking and so can never reach the reset at all.
  const verify = d => {
    d.adminVerified = true; d.accountVerified = true;
    d.verifiedByAdmin = true; d.verifiedByAccount = true;
    d.status = 'Pending Verification';
  };
  const unverify = d => {
    d.adminVerified = false; d.accountVerified = false;
    d.verifiedByAdmin = false; d.verifiedByAccount = false;
    d.status = 'Pending Verification';
  };
  const noon = d => {
    for (const p of (d.payments || [])) if (p.paymentDate) {
      p.paymentDate = new Date(Date.UTC(p.paymentDate.getUTCFullYear(), p.paymentDate.getUTCMonth(), p.paymentDate.getUTCDate(), 12));
    }
  };
  const midnightZ = d => {
    for (const p of (d.payments || [])) if (p.paymentDate) {
      p.paymentDate = new Date(Date.UTC(p.paymentDate.getUTCFullYear(), p.paymentDate.getUTCMonth(), p.paymentDate.getUTCDate()));
    }
  };

  for (const role of ['AGENT1', 'ACCOUNT', 'ADMIN']) {
    const base = role === 'AGENT1' ? unverify : verify;
    const prep = extra => d => { base(d); noon(d); if (extra) extra(d); };

    await run('(a) save with no change', role, sources.plain,
      { mutate: prep(), expect: 'no reset, no new history' });

    // The entry day itself: inside the window for any source row, whatever month it was keyed
    // in. Using today's date here only measured the window guard, not the reset.
    await run('(b) issue date only', role, sources.plain,
      { mutate: prep(d => { d.issueDate = null; }),
        over: d => ({ issueDate: dayInTz(d.dateOfSubmission) }),
        expect: 'no reset, "Issue Date Changed" only' });

    await run('(c) sale price only', role, sources.plain,
      { mutate: prep(), over: { salePrice: 9999.99 }, expect: 'reset (ACCOUNT/ADMIN)' });

    await run('(d) add a payment row', role, sources.plain, {
      mutate: prep(),
      over: null,
      expect: 'reset (ACCOUNT/ADMIN)'
    });

    await run('(e) edit a legacy Cheque row amount', role, sources.cheque,
      { mutate: prep(), over: null, expect: 'reset (ACCOUNT/ADMIN)' });

    await run('(f) One Way booking, save unchanged', role, sources.oneWay,
      { mutate: prep(), expect: 'no reset -- returnDate null over absent must not count' });

    await run('(g) legacy 00:00Z payment, saved unchanged', role, sources.midnight || sources.plain,
      { mutate: d => { base(d); midnightZ(d); }, expect: 'no reset; the date is healed to noon' });
  }

  // (d) and (e) need a changed payments array, which `over` has to build from the body. Rerun
  // those two with the mutation applied to the payload rather than to the document.
  const rerun = [];
  for (const role of ['AGENT1', 'ACCOUNT', 'ADMIN']) {
    const base = role === 'AGENT1' ? unverify : verify;
    for (const [name, src, tweak] of [
      ['(d) add a payment row', sources.plain,
        rows => [...rows, { paidAmount: 1.01, paymentMode: 'Cash', paymentDate: dayInTz(), referenceNo: '', receivingAccount: '', senderName: '' }]],
      ['(e) edit a legacy Cheque row amount', sources.cheque,
        rows => rows.map(r => (r.paymentMode === 'Cheque' ? { ...r, paidAmount: amt(r.paidAmount) + 0.01 } : r))]
    ]) {
      if (!src) { rerun.push({ name, role, note: 'SKIPPED: no source row' }); continue; }
      const id = await cloneOf(src, d => { base(d); noon(d); });
      const before = await Booking.findById(id).lean();
      const body = buildFormBody(before);
      body.payments = tweak(body.payments);
      assertFormShape(body);
      const res = await put(id, body, role);
      const after = await Booking.findById(id).lean();
      rerun.push({
        name, role, keyCount: Object.keys(body).length, status: res.status,
        message: res.status >= 400 ? res.body.message : '',
        srcPnr: src.pnr,
        flagsBefore: flagsOf(before), flagsAfter: flagsOf(after),
        history: (after.progressHistory || []).map(h => h.action),
        saleBefore: amt(before.salePrice), saleAfter: amt(after.salePrice),
        paysBefore: (before.payments || []).map(payLine),
        paysAfter: (after.payments || []).map(payLine),
        issueBefore: null, issueAfter: null, payIdsStable: null
      });
    }
  }

  const print = (rows) => {
    for (const r of rows) {
      console.log(`\n### ${r.name}  [${r.role}]`);
      if (r.note) { console.log(`    ${r.note}`); continue; }
      console.log(`    source PNR ${r.srcPnr} -> clone;  body keys ${r.keyCount};  HTTP ${r.status}${r.message ? '  "' + r.message + '"' : ''}`);
      console.log(`    flags  before: ${r.flagsBefore}`);
      console.log(`           after:  ${r.flagsAfter}`);
      console.log(`    history written: ${r.history.length ? r.history.join(' | ') : '(none)'}`);
      if (r.issueBefore !== null || r.issueAfter !== null) {
        console.log(`    issueDate: ${r.issueBefore || 'null'} -> ${r.issueAfter || 'null'}`);
      }
      if (r.saleBefore !== r.saleAfter) console.log(`    salePrice: ${r.saleBefore} -> ${r.saleAfter}`);
      console.log(`    payments before: ${r.paysBefore.join('  |  ') || '(none)'}`);
      if (r.paysPosted) console.log(`    payments posted: ${r.paysPosted.join('  |  ') || '(none)'}`);
      console.log(`    payments after:  ${r.paysAfter.join('  |  ') || '(none)'}`);
      if (r.payIdsStable !== null) console.log(`    payment subdocument _ids unchanged: ${r.payIdsStable}`);
      if (r.expect) console.log(`    expected: ${r.expect}`);
    }
  };

  console.log('\n================ cases (a) (b) (c) (f) (g), plus the no-op forms of (d) and (e) ================');
  print(results);
  console.log('\n================ (d) and (e) with the payments array actually changed ================');
  print(rerun);

  server.close();
  if (clones.length) {
    const del = await raw.deleteMany({ _id: { $in: clones } });
    console.log(`\nDeleted ${del.deletedCount} of ${clones.length} clones.`);
  }
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('\nFAILED:', e.message);
  try {
    // Never leave clones behind, even on a crash.
    if (clones.length) {
      const del = await mongoose.connection.db.collection('bookings').deleteMany({ _id: { $in: clones } });
      console.error(`Deleted ${del.deletedCount} of ${clones.length} clones after the failure.`);
    }
  } catch (_) { /* best effort */ }
  try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
  process.exit(1);
});
