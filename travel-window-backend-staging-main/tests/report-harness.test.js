'use strict';
/**
 * The test double's own test.
 *
 * report-harness.js replaces Booking.find for every report-route test. It used to stub select()
 * as a no-op, which made projection mistakes undetectable — the statement route shipped with
 * paymentFromCard missing from its projection and every test passed. Now that select() is
 * applied, the projection logic is real logic inside a test double, and a wrong double lies in
 * both directions: it can pass where Mongo would fail, and fail where Mongo would pass.
 *
 *   node tests/report-harness.test.js
 */
const assert = require('assert');
const { project } = require('./report-harness');

let n = 0;
const ok = m => { n++; console.log('  ok  ' + m); };

const doc = {
  _id: 'id1',
  pnr: 'ABC123',
  ourCost: 100,
  paymentFromCard: 0,          // falsy but PRESENT
  returnDate: null,            // explicitly null
  cancellation: { isCancelled: true, supplierWillReturn: 140, totalSupplierTook: 10 },
  dateChanges: [{ ourCostAddon: 150 }],
  password: 'secret'
};

console.log('projection: inclusion');

{
  const out = project(doc, 'pnr ourCost');
  assert.deepStrictEqual(out, { pnr: 'ABC123', ourCost: 100, _id: 'id1' });
  ok('only the named fields come back, and _id is added as Mongoose adds it');
}

{
  const out = project(doc, 'pnr');
  assert.strictEqual('ourCost' in out, false);
  assert.strictEqual(out.ourCost, undefined);
  ok('an unprojected field is absent, so reading it yields undefined — the real failure mode');
}

{
  // The exact shape of the bug that shipped: a field the handler reads but does not project.
  const out = project(doc, 'ourCost');
  assert.strictEqual(out.paymentFromCard, undefined,
    'if this were the stored 0 instead of undefined the harness would hide the bug again');
  ok('a falsy-but-present field is still dropped when it is not projected');
}

{
  const out = project(doc, 'paymentFromCard returnDate');
  assert.strictEqual(out.paymentFromCard, 0, 'a projected 0 survives');
  assert.strictEqual(out.returnDate, null, 'a stored null is returned as null, as Mongo does');
  ok('a projected zero and a projected null both survive');
}

{
  // Only *absent* is absent. Mongoose with lean() applies no schema defaults, so a field that
  // was never written stays missing rather than arriving as its default.
  const out = project({ _id: 'x', pnr: 'P' }, 'pnr supplierCharges');
  assert.strictEqual('supplierCharges' in out, false);
  ok('a field missing from the document is not invented from its schema default');
}

console.log('\nprojection: nested paths');

{
  const out = project(doc, 'pnr cancellation.supplierWillReturn');
  assert.deepStrictEqual(out, {
    pnr: 'ABC123',
    cancellation: { supplierWillReturn: 140 },
    _id: 'id1'
  });
  ok('a dotted path yields the subset, not the whole subdocument and not undefined');
}

{
  const out = project(doc, 'cancellation.nothingHere');
  assert.deepStrictEqual(out, { _id: 'id1' });
  ok('a dotted path to a missing leaf adds nothing');
}

{
  const out = project(doc, 'cancellation');
  assert.deepStrictEqual(out.cancellation, doc.cancellation);
  ok('projecting the parent still returns the whole subdocument');
}

console.log('\nprojection: exclusion');

{
  const out = project(doc, '-password');
  assert.strictEqual('password' in out, false);
  assert.strictEqual(out.pnr, 'ABC123', 'everything else survives an exclusion projection');
  assert.strictEqual(out.ourCost, 100);
  ok('-password removes one field and keeps the rest — not { _id } only');
}

{
  const out = project(doc, '-password -ourCost');
  assert.strictEqual('password' in out, false);
  assert.strictEqual('ourCost' in out, false);
  assert.strictEqual(out._id, 'id1');
  ok('several exclusions, and _id is still there');
}

console.log('\nprojection: no projection');

{
  assert.strictEqual(project(doc, null), doc);
  assert.strictEqual(project(doc, ''), doc);
  assert.strictEqual(project(doc, '   '), doc);
  ok('no select() means the whole document, by identity');
}

console.log('\nprojection: the two forms that used to collapse the document');

{
  // '+field' is Mongoose's opt-in for a schema path marked `select: false`. It means "the usual
  // document PLUS this one", not "only this one".
  const out = project(doc, '+password');
  assert.strictEqual(out.password, 'secret', 'the opted-in field is there');
  assert.strictEqual(out.pnr, 'ABC123', 'and so is everything else');
  assert.strictEqual(out.ourCost, 100);
  ok('+password adds a field rather than collapsing the document to { _id }');
}

{
  // A path through an array projects each ELEMENT down to that subset.
  const out = project(doc, 'pnr dateChanges.ourCostAddon');
  assert.deepStrictEqual(out.dateChanges, [{ ourCostAddon: 150 }],
    'each element keeps only the named leaf');
  assert.strictEqual(out.pnr, 'ABC123');
  ok('an array path yields a subset per element, not undefined');
}

console.log('\nsort runs on the stored document, not the projection');

(async () => {
  // The reordering fix had no test: project() in isolation cannot see it. This drives the real
  // find().sort().select() chain, sorting on a field that is NOT projected -- which is the only
  // shape where the old project-then-sort order produced the wrong answer. Mongo sorts, skips and
  // limits the stored document and projects last.
  const { startReports } = require('./report-harness');
  const mongoose = require('mongoose');
  const oid = () => new mongoose.Types.ObjectId();

  // A throwaway route that sorts on ourCost while projecting only the PNR.
  const path = require('path');
  const fs = require('fs');
  const routeFile = path.join(__dirname, 'tmp-sort-route.js');
  fs.writeFileSync(routeFile,
    "const express = require('express');\n" +
    "const Booking = require('../models/Booking');\n" +
    "const router = express.Router();\n" +
    "router.get('/sorted', async (req, res) => {\n" +
    "  const rows = await Booking.find({}).select('pnr').sort({ ourCost: 1 }).skip(1).limit(2).lean();\n" +
    "  res.json(rows);\n" +
    "});\n" +
    "module.exports = router;\n");

  try {
    const bookings = [
      { _id: oid(), pnr: 'HIGH', ourCost: 900, status: 'Ticketed' },
      { _id: oid(), pnr: 'LOW', ourCost: 100, status: 'Ticketed' },
      { _id: oid(), pnr: 'MID', ourCost: 500, status: 'Ticketed' },
      { _id: oid(), pnr: 'TOP', ourCost: 999, status: 'Ticketed' }
    ];
    const api = await startReports(routeFile, bookings);
    const rows = await api.get('sorted');

    assert.deepStrictEqual(rows.map(r => r.pnr), ['MID', 'HIGH'],
      'sorted by ourCost ascending, then skip 1 and limit 2 -- LOW, MID, HIGH, TOP');
    assert.strictEqual('ourCost' in rows[0], false,
      'and ourCost is still absent from the result: it was sorted on, not returned');
    ok('a route may sort on a field it does not project, exactly as Mongo allows');
    api.close();
  } finally {
    fs.unlinkSync(routeFile);
  }
})().then(() => {
  console.log('\n' + n + ' assertions passed');
}).catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
