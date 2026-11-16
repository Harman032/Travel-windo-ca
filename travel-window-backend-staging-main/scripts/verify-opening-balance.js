'use strict';
/**
 * SECOND, INDEPENDENT PATH to the statement's opening balance.
 *
 * The reconciliation in verify-supplier-statement.js feeds statement.openingBalance into its own
 * expected total, so the opening balance cancels out of the residual and is never checked. This
 * script recomputes it from raw documents, through the native driver, with:
 *
 *   - no use of buildStatement for the independent figure
 *   - no use of utils/tz.js: the Toronto day boundary is located here, from Intl's own output
 *     (NOTE: tz.js is still loaded transitively, because this file imports supplier-statement.js
 *     at the bottom to fetch the number it compares against. Nothing above that comparison calls
 *     into either.)
 *   - no mongoose models (raw collections, so no schema casting or defaults)
 *   - no line objects: amounts are accumulated per booking as plain numbers
 *
 * READ THIS BEFORE TRUSTING AN "AGREE": the predicates below -- net, held, credit, capped,
 * absorbed, the derived charge -- are TRANSCRIPTIONS of the implementation, not a second
 * derivation from the business rules. When the cap basis changed, this script had to be edited to
 * match it, which is exactly what a genuinely independent check would not need. So an agreement
 * certifies that two transcriptions of the same rules agree, and that the opening balance is not
 * an artefact of buildStatement's line-and-filter machinery, its date arithmetic or tz.js. It
 * does NOT certify that any rule is correct.
 *
 * It is an independent IMPLEMENTATION of the same documented rules, not an independent
 * specification. A rule that is wrong in both places will agree in both places.
 *
 * READ-ONLY. Refuses any database but travel_window_staging_copy.
 * Prints counts and amounts only.
 *
 *   node scripts/verify-opening-balance.js --month 2026-09
 */
require('dotenv').config();
// This machine's Node resolver points at 127.0.0.1, where nothing is listening, so an Atlas
// SRV lookup fails. Opt in with SCRIPT_DNS=192.168.29.1,8.8.8.8 rather than hard-coding it.
if (process.env.SCRIPT_DNS) require('dns').setServers(process.env.SCRIPT_DNS.split(','));
const mongoose = require('mongoose');
const { buildStatement } = require('../utils/supplier-statement');

const ALLOWED_DB = 'travel_window_staging_copy';
const ZONE = 'America/Toronto';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const m = n => r2(n).toFixed(2).padStart(15);

// Toronto midnight at the start of `ymd`, as a UTC instant. Written fresh, by stepping through
// the zone's own formatted output, so it shares no code with utils/tz.js.
function torontoMidnightUtc(ymd) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false
  });
  const parts = t => { const o = {}; for (const p of fmt.formatToParts(new Date(t))) o[p.type] = p.value; return o; };
  const hits = t => { const p = parts(t); return `${p.year}-${p.month}-${p.day}` === ymd && Number(p.hour) % 24 === 0; };
  let t = Date.parse(ymd + 'T00:00:00Z') - 24 * 3600e3;
  for (let i = 0; i < 4 * 24 * 3; i++) {
    if (hits(t)) {
      while (hits(t - 60e3)) t -= 60e3;
      return new Date(t);
    }
    t += 15 * 60e3;
  }
  throw new Error('could not locate Toronto midnight for ' + ymd);
}

(async () => {
  const uri = process.env.MONGODB_URI;
  const named = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(uri || '');
  if (!uri) { console.error('MONGODB_URI is not set.'); process.exit(2); }
  if (!named || decodeURIComponent(named[1]) !== ALLOWED_DB) { console.error('Refusing to run: not ' + ALLOWED_DB); process.exit(2); }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  if (mongoose.connection.name !== ALLOWED_DB) { console.error('Refusing: connected to ' + mongoose.connection.name); await mongoose.disconnect(); process.exit(2); }
  const raw = mongoose.connection.db;

  const month = arg('month', '2026-09');
  const from = month + '-01';
  const cutoff = torontoMidnightUtc(from);

  const names = arg('suppliers', 'SKYBIRDS,INTERNATIONAL,AIRLINE WEBSITE').split(',').map(s => s.trim());

  console.log('='.repeat(84));
  console.log('Opening balance - second independent path (READ ONLY)');
  console.log(`database : ${mongoose.connection.name}`);
  console.log(`period   : opens ${from} ${ZONE}  ->  cutoff ${cutoff.toISOString()}`);
  console.log('='.repeat(84));

  const supDocs = await raw.collection('suppliers').find({}).toArray();
  let allAgree = true;

  for (const want of names) {
    const sup = supDocs.find(s => String(s.name || '').trim().toUpperCase() === want.toUpperCase());
    if (!sup) { console.log(`\n${want}: no such supplier`); allAgree = false; continue; }

    const bookings = await raw.collection('bookings').find({ supplier: sup._id, status: { $ne: 'Draft' } }).toArray();
    const payments = await raw.collection('supplierpayments').find({ supplier: sup._id }).toArray();

    const before = t => !!t && new Date(t).getTime() < cutoff.getTime();
    const num = v => Number(v) || 0;
    let fares = 0, fees = 0, addons = 0, credits = 0, cancelFees = 0, paid = 0;
    let nFare = 0, nFee = 0, nAddon = 0, nCredit = 0, nCancelFee = 0, nPaid = 0;

    for (const b of bookings) {
      const issue = b.dateOfSubmission;

      let addon = 0;
      for (const f of ['dateChanges', 'flightChanges']) {
        for (const c of (Array.isArray(b[f]) ? b[f] : [])) addon += num(c && c.ourCostAddon);
      }
      addon = r2(addon);

      const net = r2(r2(num(b.ourCost) - addon) - r2(num(b.paymentFromCard)));
      if (before(issue)) { fares = r2(fares + net); nFare++; }

      const canc = (b.status === 'Cancelled' && b.cancellation && b.cancellation.isCancelled) ? b.cancellation : null;
      const rawWR = canc ? r2(num(canc.supplierWillReturn)) : 0;
      const onCard = r2(num(b.paymentFromCard)) !== 0;
      const wr = rawWR > 0 ? rawWR : 0;
      // The cap is what the supplier HOLDS, not the fare line: the add-ons were paid to the
      // supplier and are billed back on their own dated lines, so they count toward the ceiling.
      const held = r2(num(b.ourCost) - r2(num(b.paymentFromCard)));
      const credit = !canc ? 0 : r2(onCard ? Math.min(wr, held > 0 ? held : 0) : wr);
      const capped = !!canc && (credit !== rawWR || credit === 0);
      const absorbed = !!canc && r2(num(canc.totalSupplierTook)) !== 0 && !capped;

      if (!absorbed && before(issue)) {
        for (const f of ['supplierBookingCharge', 'supplierUpdationCharge']) {
          const amt = r2(num(b[f]));
          if (amt !== 0) { fees = r2(fees + amt); nFee++; }
        }
      }

      for (const f of ['dateChanges', 'flightChanges']) {
        for (const c of (Array.isArray(b[f]) ? b[f] : [])) {
          const amt = r2(num(c && c.ourCostAddon));
          if (amt !== 0 && before((c && c.changedAt) || issue)) { addons = r2(addons + amt); nAddon++; }
        }
      }

      if (canc) {
        const when = canc.cancelledAt || issue;
        if (credit !== 0 && before(when)) { credits = r2(credits - credit); nCredit++; }
        if (capped && before(when)) {
          const cc = r2(num(b.supplierCharges) - num(b.supplierBookingCharge) - num(b.supplierUpdationCharge));
          if (cc > 0) { cancelFees = r2(cancelFees + cc); nCancelFee++; }
        }
      }
    }

    for (const p of payments) {
      if (before(p.paymentDate)) { paid = r2(paid - r2(num(p.amount))); nPaid++; }
    }

    const independent = r2(fares + fees + addons + credits + cancelFees + paid);

    const range = { $gte: cutoff, $lte: new Date(Date.parse('2999-01-01T00:00:00Z')) };
    const st = buildStatement(bookings, payments, range);
    const diff = r2(independent - st.openingBalance);
    if (diff !== 0) allAgree = false;

    console.log(`\n${want}  (${bookings.length} bookings, ${payments.length} supplier payments)`);
    console.log(`  fare lines        ${m(fares)}   (${nFare})`);
    console.log(`  service fees      ${m(fees)}   (${nFee})`);
    console.log(`  change add-ons    ${m(addons)}   (${nAddon})`);
    console.log(`  cancel credits    ${m(credits)}   (${nCredit})`);
    console.log(`  cancel charges    ${m(cancelFees)}   (${nCancelFee})`);
    console.log(`  payments made     ${m(paid)}   (${nPaid})`);
    console.log(`  ${'-'.repeat(50)}`);
    console.log(`  INDEPENDENT       ${m(independent)}`);
    console.log(`  statement         ${m(st.openingBalance)}`);
    console.log(`  difference        ${m(diff)}  ${diff === 0 ? 'AGREE' : '*** MISMATCH ***'}`);
  }

  console.log('\n' + '='.repeat(84));
  console.log(allAgree ? 'All opening balances agree on both paths.' : 'MISMATCH - see above.');
  await mongoose.disconnect();
  process.exit(allAgree ? 0 : 1);
})().catch(async e => { console.error(e && e.message); try { await mongoose.disconnect(); } catch (_) {} process.exit(1); });
