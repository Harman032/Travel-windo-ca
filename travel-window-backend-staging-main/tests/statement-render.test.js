'use strict';
// The Payment to Suppliers statement is a fixed-width table whose rows use colspan to leave cells
// blank. Adding the client's Verified column means every one of those colspans has to move, and a
// single stale number silently shifts the Fare column out of line in the printed PDF a supplier
// receives. Nothing else in the suite can see that, so this file counts the cells.
//
// It reads the frontend component as text on purpose: the assertion is about the rendered table,
// and a template is the one place the backend tests cannot otherwise reach.
//
//   node tests/statement-render.test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildStatement } = require('../utils/supplier-statement');

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };

const COMPONENT = path.join(
  __dirname, '..', '..', 'travel-window-frontend-staging-main',
  'src', 'app', 'components', 'reports', 'reports.component.ts'
);

const src = fs.readFileSync(COMPONENT, 'utf8');

// The statement table only, so other reports' tables cannot interfere with the count.
const tableStart = src.indexOf('<table class="statement-table">');
const tableEnd = src.indexOf('</table>', tableStart);
assert.ok(tableStart !== -1 && tableEnd !== -1, 'statement table not found in the component');
const table = src.slice(tableStart, tableEnd);

const COLUMNS = 9;

/** Total columns a row occupies: one per cell, plus colspan-1 for each span. */
const rowWidth = (row) => {
  const cells = row.match(/<(?:td|th)\b[^>]*>/g) || [];
  return cells.reduce((n, cell) => {
    const m = /colspan="(\d+)"/.exec(cell);
    return n + (m ? Number(m[1]) : 1);
  }, 0);
};

const rows = table.match(/<tr\b[\s\S]*?<\/tr>/g) || [];

console.log('statement table — every row must span exactly 9 columns');

t(`found ${rows.length} rows, and the table has rows to count`, () => {
  assert.ok(rows.length >= 9, `expected at least 9 rows, found ${rows.length}`);
});

t(`every row spans exactly ${COLUMNS} columns`, () => {
  rows.forEach((row, i) => {
    const width = rowWidth(row);
    const label = (/class="([^"]*)"/.exec(row) || [, '(no class)'])[1];
    assert.strictEqual(width, COLUMNS,
      `row ${i} (${label}) spans ${width}, not ${COLUMNS}:\n${row.slice(0, 200)}`);
  });
});

t('the header band names nine columns, with Fare still last', () => {
  const band = rows.find(r => r.includes('statement-band'));
  assert.ok(band, 'header band row not found');
  const headers = [...band.matchAll(/<th[^>]*>([^<]*)</g)].map(m => m[1].trim());
  assert.deepStrictEqual(headers, [
    'Issue Dt', 'Invoice No', 'Ticket No', 'Passenger', 'Vendor', 'Start Dt', 'Itinerary',
    'Verified', 'Fare'
  ]);
  // A financial statement's amount column belongs on the right edge, so Verified goes before it.
  assert.strictEqual(headers[headers.length - 1], 'Fare');
});

console.log('\nthe Verified column renders on screen AND in print');

t('the value is bound in the detail row', () => {
  assert.ok(/\{\{\s*line\.verified\s*\}\}/.test(table), 'line.verified is not rendered');
});

t('the cell is NOT marked no-print, so it appears in the PDF', () => {
  const cell = /<td class="statement-verified"[^>]*>/.exec(table);
  assert.ok(cell, 'the statement-verified cell is missing');
  assert.ok(!/no-print/.test(cell[0]), 'the Verified cell must print: the client asked for both');
});

t('no print rule hides the column', () => {
  const printBlock = src.slice(src.indexOf('@media print'));
  assert.ok(!/statement-verified[^{]*\{[^}]*display:\s*none/.test(printBlock),
    'the print stylesheet must not hide .statement-verified');
});

t('the screen-only provisional banner and generated line are still no-print', () => {
  // Guards against a careless sweep flipping these the other way.
  assert.ok(/class="statement-provisional no-print"/.test(src), 'provisional banner stays screen-only');
  assert.ok(/class="statement-generated no-print"/.test(src), 'generated line stays screen-only');
});

console.log('\nthe label itself');

const money = (over = {}) => Object.assign({
  _id: 'b1', pnr: 'AAA111', paxName: 'X', supplier: 's1', status: 'Pending Verification',
  dateOfSubmission: new Date('2026-11-10T12:00:00Z'),
  travelDate: new Date('2026-12-01T12:00:00Z'),
  from: 'YYZ', to: 'DEL', sectorType: 'One Way', airline: 'AC',
  ourCost: 1000, paymentFromCard: 0, supplierCharges: 0
}, over);

const labelOf = (over) => {
  const st = buildStatement([money(over)], [], null);
  return st.invoices[0].lines[0].verified;
};

t('both flags -> Both', () => {
  assert.strictEqual(labelOf({ adminVerified: true, accountVerified: true }), 'Both');
});
t('admin only -> Admin', () => {
  assert.strictEqual(labelOf({ adminVerified: true, accountVerified: false }), 'Admin');
});
t('account only -> Account', () => {
  assert.strictEqual(labelOf({ adminVerified: false, accountVerified: true }), 'Account');
});
t('neither -> em dash', () => {
  assert.strictEqual(labelOf({ adminVerified: false, accountVerified: false }), '—');
});
t('an UNPROJECTED pair reads as undefined and labels em dash, never "Both"', () => {
  // The real failure mode: a missing .select() yields undefined, not an error. It must degrade to
  // a dash, not claim a booking is verified.
  assert.strictEqual(labelOf({}), '—');
});
t('only a literal true counts, so a truthy string cannot label Both', () => {
  assert.strictEqual(labelOf({ adminVerified: 'no', accountVerified: 'no' }), '—');
});

t('a payment line carries a dash, not a blank', () => {
  const st = buildStatement([], [{
    _id: 'p1', supplier: 's1', amount: 500, reference: 'R',
    paymentDate: new Date('2026-11-12T12:00:00Z')
  }], null);
  const line = st.invoices[0].lines[0];
  assert.strictEqual(line.kind, 'payment');
  assert.strictEqual(line.verified, '—');
});

console.log('\ntotals are untouched by the new column');

t('the same bookings total identically whatever the flags say', () => {
  const variants = [
    { adminVerified: true, accountVerified: true },
    { adminVerified: true, accountVerified: false },
    { adminVerified: false, accountVerified: true },
    { adminVerified: false, accountVerified: false },
    {}
  ];
  const payments = [{
    _id: 'p1', supplier: 's1', amount: 250, reference: 'R',
    paymentDate: new Date('2026-11-12T12:00:00Z')
  }];
  const base = JSON.stringify(buildStatement([money(variants[0])], payments, null).totals);
  for (const v of variants) {
    const st = buildStatement([money(v)], payments, null);
    assert.strictEqual(JSON.stringify(st.totals), base, `totals moved for ${JSON.stringify(v)}`);
    assert.strictEqual(st.lineCount, buildStatement([money(variants[0])], payments, null).lineCount);
  }
});

t('the statement invariant still closes: totalOpen = opening + sum(lines)', () => {
  const st = buildStatement(
    [money({ adminVerified: true }), money({ _id: 'b2', pnr: 'BBB222', ourCost: 400 })],
    [{ _id: 'p1', supplier: 's1', amount: 300, reference: 'R', paymentDate: new Date('2026-11-12T12:00:00Z') }],
    null
  );
  const sum = st.invoices.reduce((s, inv) => s + inv.lines.reduce((x, l) => x + l.fare, 0), 0);
  assert.strictEqual(
    Math.round((st.openingBalance + sum) * 100) / 100,
    Math.round(st.totals.totalOpen * 100) / 100
  );
});

console.log('\nthe projection must carry both flags');

t('the statement route selects adminVerified and accountVerified', () => {
  const route = fs.readFileSync(path.join(__dirname, '..', 'routes', 'reports.js'), 'utf8');
  const start = route.indexOf("router.get('/payment-to-suppliers'");
  const end = route.indexOf('router.get', start + 10);
  const body = route.slice(start, end);
  // The BOOKING projection, not the one-field Supplier lookup earlier in the same route.
  const selAt = body.indexOf(".select('pnr paxName");
  assert.ok(selAt !== -1, "the booking .select('pnr paxName ...') was not found");
  const sel = body.slice(selAt, body.indexOf('.lean(', selAt));
  assert.ok(/adminVerified/.test(sel), 'adminVerified missing from the projection');
  assert.ok(/accountVerified/.test(sel), 'accountVerified missing from the projection');
  // The fields the earlier money fixes depend on must stay too.
  for (const f of ['paymentFromCard', 'supplierCharges', 'cancellation', 'dateChanges', 'flightChanges']) {
    assert.ok(sel.includes(f), `${f} dropped from the projection`);
  }
});

console.log(`\n${passed} assertions passed`);
