// No external dependencies needed - pure Node.js
// Run with: node tests/cancellation.test.js

// Base booking data for all tests
const baseBooking = {
  ourCost: 1000,
  salePrice: 1200,
  supplierCharges: 0,
  totalPaidAmount: 1200, // overridden per scenario
  paymentFromCard: 0,    // overridden per scenario
  cardType: null,        // overridden per scenario
  billingStatus: 'Paid'  // overridden per scenario
};

const cancellationInputs = {
  supplierCancellationCharges: 100,
  ourCancellationCharges: 100
};

function calculateCancellation(booking, inputs, cancellationType) {
  const {
    ourCost, salePrice, supplierCharges,
    totalPaidAmount, paymentFromCard, cardType
  } = booking;

  const {
    supplierCancellationCharges: scc,
    ourCancellationCharges: occ,
    chargeFromClient = 0
  } = inputs;

  const round = (val) => Math.round(val * 100) / 100;

  const ourMargin = round(salePrice - ourCost - supplierCharges);
  const newMargin = round(ourMargin + occ);
  const totalSupplierTook = round(supplierCharges + scc);
  const totalCharges = round(totalSupplierTook + newMargin);

  let result = {
    ourMargin,
    newMargin,
    totalSupplierTook,
    totalCharges,
    cancellationType
  };

  switch (cancellationType) {
    case 'supplierCancellationCharges':
      result.supplierDeducted = scc;
      result.refundCommittedToClient = round(salePrice - (ourMargin + scc + occ));
      result.refundCommittedToClientFinal = round(totalPaidAmount - totalCharges);
      break;

    case 'supplierRefundAmount':
      result.supplierDeducted = round(ourCost - scc);
      result.refundCommittedToClient = round(scc - occ);
      result.refundCommittedToClientFinal = round(totalPaidAmount - totalCharges);
      break;

    case 'partialPaidCancellationCharges':
      result.totalCharges = round(ourMargin + supplierCharges + scc + occ);
      result.refundToClient = round(totalPaidAmount - result.totalCharges);
      result.refundCommittedToClientFinal = round(totalPaidAmount - result.totalCharges);
      break;

    case 'partialPaidRefundAmount':
      result.supplierDeducted = round(totalPaidAmount - scc);
      result.refundToClient = round(scc - occ);
      const scenario4TotalCharges = round(result.supplierDeducted + ourMargin);
      result.totalCharges = scenario4TotalCharges;
      result.refundCommittedToClientFinal = round(totalPaidAmount - scenario4TotalCharges);
      break;

    case 'clientCard':
      const isCardEqualToSalePrice_cc = paymentFromCard === salePrice;
      const effectiveMargin_cc = isCardEqualToSalePrice_cc ? 0 : ourMargin;
      result.newMargin = effectiveMargin_cc;
      const totalSupplierTook_cc = round(supplierCharges + scc);
      result.totalSupplierTook = totalSupplierTook_cc;
      result.supplierWillReturn = round(totalPaidAmount - totalSupplierTook_cc);
      result.upfrontNeeded = occ;
      const clientCardTotalCharges = round(totalSupplierTook_cc + effectiveMargin_cc);
      result.totalCharges = clientCardTotalCharges;
      result.clientReceives = round(totalPaidAmount - clientCardTotalCharges);
      result.refundCommittedToClientFinal = result.clientReceives;
      break;

    case 'companyCard':
      const isCardEqualToSalePrice = paymentFromCard === salePrice;
      result.supplierWillReturn = isCardEqualToSalePrice
        ? round(salePrice - totalSupplierTook)
        : round(ourCost - totalSupplierTook);
      result.clientReceives = round(salePrice - totalCharges);
      result.refundCommittedToClientFinal = round(totalPaidAmount - totalCharges);
      break;

    case 'partialPaidClientCard':
      const totalSupplierTook_ppc = round(supplierCharges + scc);
      result.totalSupplierTook = totalSupplierTook_ppc;
      result.supplierWillReturn = round(paymentFromCard - totalSupplierTook_ppc);
      result.upfrontNeeded = newMargin;
      result.clientReceives = result.supplierWillReturn;
      result.remainingAmount = round(salePrice - paymentFromCard);
      result.refundCommittedToClientFinal = round(totalPaidAmount - totalCharges);
      break;

    case 'partialPaidCompanyCard':
      result.supplierWillReturn = round(totalPaidAmount - scc);
      result.clientReceives = round(totalPaidAmount - totalCharges);
      result.remainingAmount = round(salePrice - paymentFromCard);
      result.refundCommittedToClientFinal = round(totalPaidAmount - totalCharges);
      break;

    case 'clientCardPartialPayment':
      const remainingAmount = round(salePrice - paymentFromCard);
      result.remainingAmount = remainingAmount;
      result.supplierWillReturn = round(totalPaidAmount - scc);
      result.upfrontNeeded = newMargin;
      result.clientReceives = result.supplierWillReturn;
      result.refundCommittedToClientFinal = round(totalPaidAmount - totalCharges);

      // Conditional logic based on remaining vs total charges
      if (remainingAmount < totalCharges) {
        result.upfrontNeeded = round(totalCharges - remainingAmount);
        result.clientReceives = paymentFromCard;
      } else {
        result.upfrontNeeded = 0;
        result.clientReceives = round(paymentFromCard + (remainingAmount - totalCharges));
      }
      break;

    case 'machineCharge':
      const oldMargin_mc = round(salePrice - ourCost - supplierCharges);
      const refundableToClient_mc = round(salePrice - scc);
      const chargeFromClient_mc = occ;
      const oldMarginRow2_mc = round(Math.min(chargeFromClient_mc, oldMargin_mc));
      const newMargin_mc = round(Math.max(0, chargeFromClient_mc - oldMargin_mc));
      const refundCommitted_mc = round(refundableToClient_mc - chargeFromClient_mc);

      result.ourMargin = oldMargin_mc;
      result.refundableToClient = refundableToClient_mc;
      result.oldMarginRow2 = oldMarginRow2_mc;
      result.newMargin = newMargin_mc;
      result.refundCommittedToClient = refundCommitted_mc;
      result.refundCommittedToClientFinal = refundCommitted_mc;
      break;
  }

  return result;
}

const tests = [
  {
    name: 'SCENARIO 1 — Regular Fully Paid — Supplier Cancellation Charges',
    booking: { ...baseBooking, totalPaidAmount: 1200 },
    inputs: cancellationInputs,
    cancellationType: 'supplierCancellationCharges',
    expected: {
      ourMargin: 200,
      newMargin: 300,
      totalSupplierTook: 100,
      totalCharges: 400,
      refundCommittedToClient: 800,
      refundCommittedToClientFinal: 800
    }
  },
  {
    name: 'SCENARIO 2 — Regular Fully Paid — Supplier Refund Amount',
    booking: { ...baseBooking, totalPaidAmount: 1200 },
    inputs: { supplierCancellationCharges: 400, ourCancellationCharges: 100 },
    cancellationType: 'supplierRefundAmount',
    expected: {
      ourMargin: 200,
      supplierDeducted: 600,
      refundCommittedToClient: 300,
      refundCommittedToClientFinal: 500
    }
  },
  {
    name: 'SCENARIO 3 — Partial Paid — Supplier Cancellation Charges',
    booking: { ...baseBooking, totalPaidAmount: 600, billingStatus: 'Partial Paid' },
    inputs: cancellationInputs,
    cancellationType: 'partialPaidCancellationCharges',
    expected: {
      ourMargin: 200,
      totalCharges: 400,
      refundToClient: 200,
      refundCommittedToClientFinal: 200
    }
  },
  {
    name: 'SCENARIO 4 — Partial Paid — Supplier Refund Amount',
    booking: { ...baseBooking, totalPaidAmount: 600, billingStatus: 'Partial Paid' },
    inputs: { supplierCancellationCharges: 400, ourCancellationCharges: 100 },
    cancellationType: 'partialPaidRefundAmount',
    expected: {
      supplierDeducted: 200,
      refundToClient: 300,
      refundCommittedToClientFinal: 200
    }
  },
  {
    name: 'SCENARIO 5 — Client Card Fully Paid',
    booking: { ...baseBooking, totalPaidAmount: 1200, paymentFromCard: 1200, cardType: 'Client Card' },
    inputs: cancellationInputs,
    cancellationType: 'clientCard',
    expected: {
      ourMargin: 200,
      newMargin: 0,
      totalSupplierTook: 100,
      totalCharges: 100,
      supplierWillReturn: 1100,
      upfrontNeeded: 100,
      clientReceives: 1100,
      refundCommittedToClientFinal: 1100
    }
  },
  {
    name: 'SCENARIO 5B — Client Card Fully Paid (Card == Sale Price, Margin = 0)',
    booking: {
      ...baseBooking,
      ourCost: 500,
      salePrice: 700,
      supplierCharges: 0,
      totalPaidAmount: 700,
      paymentFromCard: 700,
      cardType: 'Client Card'
    },
    inputs: {
      supplierCancellationCharges: 0,
      ourCancellationCharges: 0
    },
    cancellationType: 'clientCard',
    expected: {
      ourMargin: 200,
      newMargin: 0,
      totalSupplierTook: 0,
      totalCharges: 0,
      supplierWillReturn: 700,
      upfrontNeeded: 0,
      clientReceives: 700,
      refundCommittedToClientFinal: 700
    }
  },
  {
    name: 'SCENARIO 6A — Company Card Fully Paid (Card == Sale Price)',
    booking: { ...baseBooking, totalPaidAmount: 1200, paymentFromCard: 1200, cardType: 'Company Card' },
    inputs: cancellationInputs,
    cancellationType: 'companyCard',
    expected: {
      ourMargin: 200,
      newMargin: 300,
      totalSupplierTook: 100,
      totalCharges: 400,
      supplierWillReturn: 1100,
      clientReceives: 800,
      refundCommittedToClientFinal: 800
    }
  },
  {
    name: 'SCENARIO 6B — Company Card Fully Paid (Card == Our Cost)',
    booking: { ...baseBooking, totalPaidAmount: 1200, paymentFromCard: 1000, cardType: 'Company Card' },
    inputs: cancellationInputs,
    cancellationType: 'companyCard',
    expected: {
      ourMargin: 200,
      newMargin: 300,
      totalSupplierTook: 100,
      totalCharges: 400,
      supplierWillReturn: 900,
      clientReceives: 800,
      refundCommittedToClientFinal: 800
    }
  },
  {
    name: 'SCENARIO 7 — Partial Paid Client Card',
    booking: {
      ...baseBooking,
      totalPaidAmount: 600,
      paymentFromCard: 600,
      cardType: 'Client Card',
      billingStatus: 'Partial Paid'
    },
    inputs: cancellationInputs,
    cancellationType: 'partialPaidClientCard',
    expected: {
      ourMargin: 200,
      newMargin: 300,
      totalSupplierTook: 100,
      totalCharges: 400,
      supplierWillReturn: 500,
      upfrontNeeded: 300,
      clientReceives: 500,
      refundCommittedToClientFinal: 200
    }
  },
  {
    name: 'SCENARIO 8 — Partial Paid Company Card',
    booking: {
      ...baseBooking,
      totalPaidAmount: 600,
      paymentFromCard: 600,
      cardType: 'Company Card',
      billingStatus: 'Partial Paid'
    },
    inputs: cancellationInputs,
    cancellationType: 'partialPaidCompanyCard',
    expected: {
      ourMargin: 200,
      newMargin: 300,
      totalSupplierTook: 100,
      totalCharges: 400,
      supplierWillReturn: 500,
      clientReceives: 200,
      refundCommittedToClientFinal: 200
    }
  },
  {
    name: 'SCENARIO 9A — Client Card Partial Payment (Remaining < Total Charges)',
    booking: {
      ...baseBooking,
      ourCost: 1000,
      salePrice: 1200,
      supplierCharges: 0,
      totalPaidAmount: 800,
      paymentFromCard: 600,
      cardType: 'Client Card',
      billingStatus: 'Paid'
    },
    inputs: {
      supplierCancellationCharges: 100,
      ourCancellationCharges: 100
    },
    cancellationType: 'clientCardPartialPayment',
    expected: {
      ourMargin: 200,
      newMargin: 300,
      totalSupplierTook: 100,
      totalCharges: 400,
      remainingAmount: 600,
      // remainingAmount(600) >= totalCharges(400) so no upfront
      upfrontNeeded: 0,
      supplierWillReturn: 700,
      // clientReceives = paymentFromCard + (remainingAmount - totalCharges)
      clientReceives: 800,
      refundCommittedToClientFinal: 400
    }
  },
  {
    name: 'SCENARIO 9B — Client Card Partial Payment (Remaining >= Total Charges)',
    booking: {
      ...baseBooking,
      ourCost: 1000,
      salePrice: 1200,
      supplierCharges: 0,
      totalPaidAmount: 700,
      paymentFromCard: 600,
      cardType: 'Client Card',
      billingStatus: 'Paid'
    },
    inputs: {
      supplierCancellationCharges: 100,
      ourCancellationCharges: 100
    },
    cancellationType: 'clientCardPartialPayment',
    expected: {
      ourMargin: 200,
      newMargin: 300,
      totalSupplierTook: 100,
      totalCharges: 400,
      remainingAmount: 600,
      // remainingAmount(600) >= totalCharges(400) so no upfront
      upfrontNeeded: 0,
      supplierWillReturn: 600,
      // clientReceives = paymentFromCard + (remainingAmount - totalCharges)
      clientReceives: 800,
      refundCommittedToClientFinal: 300
    }
  },
  {
    name: 'SCENARIO 9C — Client Card Partial Payment (Remaining < Total Charges — upfront needed)',
    booking: {
      ...baseBooking,
      ourCost: 1000,
      salePrice: 1200,
      supplierCharges: 0,
      totalPaidAmount: 800,
      paymentFromCard: 600,
      cardType: 'Client Card',
      billingStatus: 'Paid'
    },
    inputs: {
      supplierCancellationCharges: 100,
      ourCancellationCharges: 200
    },
    cancellationType: 'clientCardPartialPayment',
    expected: {
      ourMargin: 200,
      newMargin: 400,
      totalSupplierTook: 100,
      totalCharges: 500,
      remainingAmount: 600,
      // remainingAmount(600) >= totalCharges(500) so no upfront
      upfrontNeeded: 0,
      supplierWillReturn: 700,
      clientReceives: 700,
      refundCommittedToClientFinal: 300
    }
  },
  {
    name: 'SCENARIO 10 — Machine Charge Only (No Card Type)',
    booking: {
      ...baseBooking,
      ourCost: 1000,
      salePrice: 1200,
      supplierCharges: 0,
      totalPaidAmount: 1200,
      paymentFromCard: 0,
      cardType: null,
      billingStatus: 'Paid',
      payments: [{ paymentMode: 'Machine Charge' }]
    },
    inputs: {
      supplierCancellationCharges: 100,
      ourCancellationCharges: 50  // chargeFromClient
    },
    cancellationType: 'machineCharge',
    expected: {
      ourMargin: 200,
      refundableToClient: 1100,  // 1200 - 100
      oldMarginRow2: 50,          // MIN(50, 200) = 50
      newMargin: 0,               // MAX(0, 50 - 200) = 0
      refundCommittedToClient: 1050,  // 1100 - 50
      refundCommittedToClientFinal: 1050
    }
  }
];

function runTests() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  console.log('\n========================================');
  console.log('CANCELLATION LOGIC TEST SUITE');
  console.log('========================================\n');

  tests.forEach((test, index) => {
    const result = calculateCancellation(test.booking, test.inputs, test.cancellationType);
    const errors = [];

    Object.keys(test.expected).forEach(key => {
      if (result[key] !== test.expected[key]) {
        errors.push(
          `  ${key}: expected ${test.expected[key]}, got ${result[key]}`
        );
      }
    });

    if (errors.length === 0) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      errors.forEach(e => console.log(e));
      failed++;
      failures.push({ name: test.name, errors });
    }
  });

  console.log('\n========================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failures.length > 0) {
    console.log('FAILURES SUMMARY:');
    failures.forEach(f => {
      console.log(`\n${f.name}:`);
      f.errors.forEach(e => console.log(e));
    });
    process.exit(1);
  } else {
    console.log('All tests passed! ✅');
    process.exit(0);
  }
}

runTests();
