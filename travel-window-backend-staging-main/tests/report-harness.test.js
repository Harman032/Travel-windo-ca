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

console.log('\n' + n + ' assertions passed');
