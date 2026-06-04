'use strict';

const { calculateCancellationScenario } = require('../utils/cancellation-engine');

// ══════════════════════════════════════════════════════════════════════
// Test Harness
// ══════════════════════════════════════════════════════════════════════
let passed = 0, failed = 0;
function assert(label, actual, expected) {
  const a = Math.round(actual * 100) / 100;
  const e = Math.round(expected * 100) / 100;
  if (a !== e) {
    console.error(`  ❌ ${label}: got ${a}, expected ${e}`);
    failed++;
  } else {
    passed++;
  }
}

function runScenario(name, params, expected) {
  const r = calculateCancellationScenario(params);
  console.log(`\nScenario: ${name} → detected ${r.scenario}`);
  if (expected.scenario)              assert('scenario',              r.scenario === expected.scenario ? 1 : 0, 1);
  if (expected.ourMargin !== undefined)           assert('ourMargin',             r.ourMargin,             expected.ourMargin);
  if (expected.currentMargin !== undefined)       assert('currentMargin',         r.currentMargin,         expected.currentMargin);
  if (expected.totalSupplierTook !== undefined)   assert('totalSupplierTook',     r.totalSupplierTook,     expected.totalSupplierTook);
  if (expected.airlineDeducted !== undefined)     assert('airlineDeducted',       r.airlineDeducted,       expected.airlineDeducted);
  if (expected.totalCharges !== undefined)        assert('totalCharges',          r.totalCharges,          expected.totalCharges);
  if (expected.supplierWillReturn !== undefined)  assert('supplierWillReturn',    r.supplierWillReturn,    expected.supplierWillReturn);
  if (expected.refundCommittedToClient !== undefined) assert('refundCommittedToClient', r.refundCommittedToClient, expected.refundCommittedToClient);
  if (expected.refundableAmount !== undefined)    assert('refundableAmount',      r.refundableAmount,      expected.refundableAmount);
  if (expected.upfrontNeeded !== undefined)       assert('upfrontNeeded',         r.upfrontNeeded,         expected.upfrontNeeded);
}

// ══════════════════════════════════════════════════════════════════════
// Base values
// ══════════════════════════════════════════════════════════════════════
// salePrice=1200, ourCost=1000, supplierBookingCharge=10
// airlineCancellationCharges=100, airlineRefundAmount=900
// autoSupplierCancellationCharge=30
// Not Updated:  supplierUpdationCharge=0  → totalSupplierTook=40
// Updated:      supplierUpdationCharge=20 → totalSupplierTook=60
// ourMargin = 1200 - (1000 + 10) = 190

const BASE = {
  baseSalePrice: 1200,
  baseOurCost: 1000,
  paidAmount: 1200,
  supplierBookingCharge: 10,
  supplierUpdationCharge: 0,
  autoSupplierCancellationCharge: 30,
  airlineCancellationCharges: 100,
  airlineRefundAmount: 900,
  newMarginInput: 0,
  isPartialPaid: false,
  isClientCard: false,
  isCompanyCard: false,
  isMachineCharge: false
};

console.log('\n========================================');
console.log('CANCELLATION ENGINE TEST SUITE');
console.log('========================================');

// ── SCENARIO 1A: Regular Fully Paid + Charges ──────────────────────
runScenario('1A — Regular Fully Paid, Charges, Not Updated', {
  ...BASE, isChargesMode: true
}, {
  scenario: '1A', ourMargin: 190, currentMargin: 190,
  totalSupplierTook: 40, airlineDeducted: 100,
  totalCharges: 140, supplierWillReturn: 900,
  refundCommittedToClient: 870
});

runScenario('1A — Regular Fully Paid, Charges, Updated', {
  ...BASE, isChargesMode: true, supplierUpdationCharge: 20
}, {
  scenario: '1A', totalSupplierTook: 60,
  totalCharges: 160, supplierWillReturn: 900,
  refundCommittedToClient: 850
});

// ── SCENARIO 1B: Regular Fully Paid + Refund ───────────────────────
runScenario('1B — Regular Fully Paid, Refund, Not Updated', {
  ...BASE, isChargesMode: false
}, {
  scenario: '1B', ourMargin: 190, currentMargin: 190,
  totalSupplierTook: 40, airlineDeducted: 100,
  totalCharges: 140, supplierWillReturn: 900,
  refundCommittedToClient: 870
});

runScenario('1B — Regular Fully Paid, Refund, Updated', {
  ...BASE, isChargesMode: false, supplierUpdationCharge: 20
}, {
  scenario: '1B', totalSupplierTook: 60,
  totalCharges: 160, supplierWillReturn: 900,
  refundCommittedToClient: 850
});

// ── SCENARIO 2A: Partial Paid + Charges ────────────────────────────
runScenario('2A — Partial Paid, Charges, Not Updated', {
  ...BASE, isChargesMode: true, isPartialPaid: true, paidAmount: 600
}, {
  scenario: '2A', ourMargin: 190, currentMargin: 190,
  totalSupplierTook: 40, totalCharges: 140,
  supplierWillReturn: 500,
  refundCommittedToClient: 270
});

runScenario('2A — Partial Paid, Charges, Updated', {
  ...BASE, isChargesMode: true, isPartialPaid: true, paidAmount: 600, supplierUpdationCharge: 20
}, {
  scenario: '2A', totalSupplierTook: 60,
  totalCharges: 160, supplierWillReturn: 500,
  refundCommittedToClient: 250
});

// ── SCENARIO 2B: Partial Paid + Refund ─────────────────────────────
runScenario('2B — Partial Paid, Refund, Not Updated', {
  ...BASE, isChargesMode: false, isPartialPaid: true, paidAmount: 600, airlineRefundAmount: 500
}, {
  scenario: '2B', ourMargin: 190, currentMargin: 190,
  totalSupplierTook: 40, airlineDeducted: 100,
  totalCharges: 140, supplierWillReturn: 500,
  refundCommittedToClient: 270
});

runScenario('2B — Partial Paid, Refund, Updated', {
  ...BASE, isChargesMode: false, isPartialPaid: true, paidAmount: 600, airlineRefundAmount: 500, supplierUpdationCharge: 20
}, {
  scenario: '2B', totalSupplierTook: 60,
  totalCharges: 160, supplierWillReturn: 500,
  refundCommittedToClient: 250
});

// ── SCENARIO 3A: Client Card Fully Paid + Charges ──────────────────
runScenario('3A — Client Card, Charges, Not Updated', {
  ...BASE, isChargesMode: true, isClientCard: true
}, {
  scenario: '3A', ourMargin: 190, currentMargin: 190,
  totalSupplierTook: 40, totalCharges: 140,
  supplierWillReturn: 1100,
  upfrontNeeded: 230,
  refundCommittedToClient: 870,
  refundableAmount: 1100
});

runScenario('3A — Client Card, Charges, Updated', {
  ...BASE, isChargesMode: true, isClientCard: true, supplierUpdationCharge: 20
}, {
  scenario: '3A', totalSupplierTook: 60,
  totalCharges: 160, supplierWillReturn: 1100,
  upfrontNeeded: 250,
  refundCommittedToClient: 850,
  refundableAmount: 1100
});

// ── SCENARIO 3B: Client Card Fully Paid + Refund ───────────────────
runScenario('3B — Client Card, Refund, Not Updated', {
  ...BASE, isChargesMode: false, isClientCard: true
}, {
  scenario: '3B', ourMargin: 190, currentMargin: 190,
  totalSupplierTook: 40,
  airlineDeducted: 300,
  totalCharges: 340,
  supplierWillReturn: 900,
  upfrontNeeded: 230,
  refundCommittedToClient: 670,
  refundableAmount: 900
});

runScenario('3B — Client Card, Refund, Updated', {
  ...BASE, isChargesMode: false, isClientCard: true, supplierUpdationCharge: 20
}, {
  scenario: '3B', totalSupplierTook: 60,
  airlineDeducted: 300,
  totalCharges: 360,
  supplierWillReturn: 900,
  upfrontNeeded: 250,
  refundCommittedToClient: 650,
  refundableAmount: 900
});

// ── SCENARIO 4A: Company Card + Charges ────────────────────────────
runScenario('4A — Company Card, Charges, Not Updated', {
  ...BASE, isChargesMode: true, isCompanyCard: true
}, {
  scenario: '4A', ourMargin: 190, currentMargin: 190,
  totalSupplierTook: 40, totalCharges: 140,
  supplierWillReturn: 860,
  refundCommittedToClient: 870
});

runScenario('4A — Company Card, Charges, Updated', {
  ...BASE, isChargesMode: true, isCompanyCard: true, supplierUpdationCharge: 20
}, {
  scenario: '4A', totalSupplierTook: 60,
  totalCharges: 160, supplierWillReturn: 840,
  refundCommittedToClient: 850
});

// ── SCENARIO 4B: Company Card + Refund ─────────────────────────────
runScenario('4B — Company Card, Refund, Not Updated', {
  ...BASE, isChargesMode: false, isCompanyCard: true
}, {
  scenario: '4B', ourMargin: 190, currentMargin: 190,
  totalSupplierTook: 40, airlineDeducted: 100,
  totalCharges: 140, supplierWillReturn: 860,
  refundCommittedToClient: 870
});

runScenario('4B — Company Card, Refund, Updated', {
  ...BASE, isChargesMode: false, isCompanyCard: true, supplierUpdationCharge: 20
}, {
  scenario: '4B', totalSupplierTook: 60,
  airlineDeducted: 100, totalCharges: 160,
  supplierWillReturn: 840,
  refundCommittedToClient: 850
});

// ── SCENARIO 5A: Partial Paid Client Card + Charges ────────────────
runScenario('5A — Partial Paid Client Card, Charges, Not Updated', {
  ...BASE, isChargesMode: true, isPartialPaid: true, isClientCard: true, paidAmount: 600
}, {
  scenario: '5A', ourMargin: 190, currentMargin: 190,
  totalSupplierTook: 40, totalCharges: 140,
  supplierWillReturn: 500,
  upfrontNeeded: 190,
  refundCommittedToClient: 500
});

runScenario('5A — Partial Paid Client Card, Charges, Updated', {
  ...BASE, isChargesMode: true, isPartialPaid: true, isClientCard: true, paidAmount: 600, supplierUpdationCharge: 20
}, {
  scenario: '5A', totalSupplierTook: 60,
  totalCharges: 160, supplierWillReturn: 500,
  upfrontNeeded: 190,
  refundCommittedToClient: 500
});

// ── SCENARIO 5B: Partial Paid Client Card + Refund ─────────────────
runScenario('5B — Partial Paid Client Card, Refund, Not Updated', {
  ...BASE, isChargesMode: false, isPartialPaid: true, isClientCard: true, paidAmount: 600, airlineRefundAmount: 500
}, {
  scenario: '5B', ourMargin: 190, currentMargin: 190,
  totalSupplierTook: 40, airlineDeducted: 100,
  totalCharges: 140, supplierWillReturn: 500,
  upfrontNeeded: 190,
  refundCommittedToClient: 500
});

runScenario('5B — Partial Paid Client Card, Refund, Updated', {
  ...BASE, isChargesMode: false, isPartialPaid: true, isClientCard: true, paidAmount: 600, airlineRefundAmount: 500, supplierUpdationCharge: 20
}, {
  scenario: '5B', totalSupplierTook: 60,
  airlineDeducted: 100, totalCharges: 160,
  supplierWillReturn: 500,
  upfrontNeeded: 190,
  refundCommittedToClient: 500
});

// ── MACHINE CHARGE → treated as Scenario 1 ─────────────────────────
runScenario('Machine Charge — Charges, Not Updated', {
  ...BASE, isChargesMode: true, isMachineCharge: true
}, {
  scenario: '1A', totalSupplierTook: 40,
  totalCharges: 140, supplierWillReturn: 860,
  refundCommittedToClient: 870
});

runScenario('Machine Charge — Refund, Not Updated', {
  ...BASE, isChargesMode: false, isMachineCharge: true
}, {
  scenario: '1B', totalSupplierTook: 40,
  airlineDeducted: 100, totalCharges: 140,
  supplierWillReturn: 860,
  refundCommittedToClient: 870
});

runScenario('Machine Charge — Charges, Updated', {
  ...BASE, isChargesMode: true, isMachineCharge: true, supplierUpdationCharge: 20
}, {
  scenario: '1A', totalSupplierTook: 60,
  totalCharges: 160, supplierWillReturn: 840,
  refundCommittedToClient: 850
});

// ── With newMargin input ───────────────────────────────────────────
runScenario('1A — With New Margin 50, Not Updated', {
  ...BASE, isChargesMode: true, newMarginInput: 50
}, {
  scenario: '1A', ourMargin: 190, currentMargin: 240,
  totalSupplierTook: 40, totalCharges: 140,
  supplierWillReturn: 900,
  refundCommittedToClient: 820
});

console.log('\n========================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('========================================');

if (failed > 0) {
  console.log('\n⚠️ Some tests failed!');
  process.exit(1);
} else {
  console.log('\nAll tests passed! ✅');
}
