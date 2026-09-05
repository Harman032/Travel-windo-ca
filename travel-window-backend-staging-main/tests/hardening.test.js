'use strict';
// Self-check for the Part 9/10/12 hardening helpers. Run: node tests/hardening.test.js
const assert = require('assert');
const { parseStrictNumber, validateFinancialFields } = require('../utils/validate-financial');
const { resolvePagination } = require('../utils/pagination');
const { safeSearchTerm, escapeRegex } = require('../utils/search-safety');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FAIL: ${name}\n  ${e.message}`);
    process.exitCode = 1;
  }
}

// --- financial validation ---
check('rejects "100XYZ" (the exact client example)', () => {
  assert.strictEqual(parseStrictNumber('100XYZ').ok, false);
});
check('accepts a clean numeric string', () => {
  const r = parseStrictNumber('123.45');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value, 123.45);
});
check('accepts a plain number', () => {
  assert.strictEqual(parseStrictNumber(50).ok, true);
});
check('rejects NaN/Infinity', () => {
  assert.strictEqual(parseStrictNumber(NaN).ok, false);
  assert.strictEqual(parseStrictNumber(Infinity).ok, false);
});
check('rejects non-numeric types (object/array/bool)', () => {
  assert.strictEqual(parseStrictNumber({}).ok, false);
  assert.strictEqual(parseStrictNumber([]).ok, false);
  assert.strictEqual(parseStrictNumber(true).ok, false);
});
check('blank string treated as 0 (matches prior `!= null` fallback behavior)', () => {
  const r = parseStrictNumber('');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value, 0);
});
check('validateFinancialFields skips undefined/null (field not sent)', () => {
  assert.strictEqual(validateFinancialFields({ ourCost: undefined, salePrice: null }), null);
});
check('validateFinancialFields flags the bad field by name', () => {
  assert.strictEqual(validateFinancialFields({ ourCost: 100, salePrice: '100XYZ' }), 'salePrice');
});
check('valid negative margin still accepted (not a validation target)', () => {
  assert.strictEqual(parseStrictNumber('-140').ok, true);
});

// --- pagination (client's exact edge cases) ---
check('page=foo -> page 1, no NaN', () => {
  const r = resolvePagination('foo', '50');
  assert.strictEqual(r.page, 1);
  assert.ok(Number.isFinite(r.skip));
});
check('page=-10 -> page 1', () => {
  assert.strictEqual(resolvePagination('-10', '50').page, 1);
});
check('limit=foo -> default limit', () => {
  assert.strictEqual(resolvePagination('1', 'foo').limit, 50);
});
check('limit=-5 -> default limit', () => {
  assert.strictEqual(resolvePagination('1', '-5').limit, 50);
});
check('limit=999999999 -> falls back to default (matches client-supplied example exactly)', () => {
  assert.strictEqual(resolvePagination('1', '999999999').limit, 50);
});
check('valid page/limit pass through unchanged', () => {
  const r = resolvePagination('3', '25');
  assert.strictEqual(r.page, 3);
  assert.strictEqual(r.limit, 25);
  assert.strictEqual(r.skip, 50);
});

// --- search safety ---
check('escapes regex metacharacters', () => {
  assert.strictEqual(escapeRegex('a.b*c'), 'a\\.b\\*c');
});
check('rejects overlong search terms', () => {
  assert.strictEqual(safeSearchTerm('x'.repeat(200)), null);
});
check('rejects empty/whitespace-only search terms', () => {
  assert.strictEqual(safeSearchTerm('   '), null);
});
check('normal PNR/phone search terms pass through escaped', () => {
  assert.strictEqual(safeSearchTerm('AYW4M6'), 'AYW4M6');
  assert.strictEqual(safeSearchTerm('+1 (555) 123-4567'), '\\+1 \\(555\\) 123-4567');
});

console.log(`\n${passed} checks passed${process.exitCode ? ', SOME FAILED' : ''}`);
