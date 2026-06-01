const round = (val) => Math.round(val * 100) / 100;

function calculateCancellation(booking, cancelForm) {
    const salePrice = booking.salePrice || 0;
    const ourCost = booking.ourCost || 0;
    const supplierCharges = booking.supplierCharges || 0;
    const totalPaidAmount = booking.totalPaidAmount || 0;
    const paymentFromCard = booking.paymentFromCard || 0;
    const supplierBookingCharge = booking.supplierBookingCharge || 0;
    const supplierUpdationCharge = booking.supplierUpdationCharge || 0;
    const autoSupplierCancellationCharge = booking.autoSupplierCancellationCharge || 0;

    const scc = Number(cancelForm?.supplierCancellationCharges || 0);
    const occ = Number(cancelForm?.ourCancellationCharges || 0);
    const chargeFromClient = Number(cancelForm?.chargeFromClient || 0);

    const cancellationType = cancelForm?.cancellationType || '';

    const totalSupplierTook = round(supplierBookingCharge + supplierUpdationCharge + autoSupplierCancellationCharge);
    const ourMargin = round(salePrice - ourCost - supplierCharges);
    const newMargin = round(ourMargin + occ);

    let result = {
      ourMargin,
      newMargin,
      totalSupplierTook,
      cancellationType,
      supplierWillReturn: 0,
      refundCommittedToClient: 0,
      clientReceives: 0,
      totalCharges: 0,
      upfrontNeeded: 0,
      airlineDeducted: 0
    };

    const isRefundAmount = cancellationType.includes('RefundAmount');
    const airlineDeductedFromSale = isRefundAmount ? round(salePrice - scc) : 0;
    const airlineDeductedFromPaid = isRefundAmount ? round(totalPaidAmount - scc) : 0;
    const airlineDeducted = isRefundAmount ? round(ourCost - scc) : 0; 
    
    result.airlineDeducted = isRefundAmount ? (cancellationType.includes('ClientCard') ? airlineDeductedFromSale : airlineDeducted) : 0;

    switch (cancellationType) {
      case 'supplierCancellationCharges': // 1A
        result.totalCharges = round(totalSupplierTook + scc);
        result.supplierWillReturn = round(ourCost - scc - autoSupplierCancellationCharge);
        result.refundCommittedToClient = round(salePrice - (newMargin + result.totalCharges));
        break;

      case 'supplierRefundAmount': // 1B
        result.totalCharges = round(totalSupplierTook + airlineDeducted);
        result.supplierWillReturn = round(ourCost - airlineDeducted - autoSupplierCancellationCharge);
        result.refundCommittedToClient = round(salePrice - (newMargin + result.totalCharges));
        break;

      case 'partialPaidCancellationCharges': // 2A
        result.totalCharges = round(totalSupplierTook + scc);
        result.supplierWillReturn = round(totalPaidAmount - scc - autoSupplierCancellationCharge);
        result.refundCommittedToClient = round(totalPaidAmount - (result.totalCharges + newMargin));
        break;

      case 'partialPaidRefundAmount': // 2B
        result.airlineDeducted = airlineDeductedFromPaid;
        result.totalCharges = round(totalSupplierTook + airlineDeductedFromPaid);
        result.supplierWillReturn = round(totalPaidAmount - airlineDeductedFromPaid - autoSupplierCancellationCharge);
        result.refundCommittedToClient = round(totalPaidAmount - (result.totalCharges + newMargin));
        break;

      case 'clientCard': // 3A
        result.totalCharges = round(totalSupplierTook + scc);
        result.supplierWillReturn = round(salePrice - scc);
        result.upfrontNeeded = round(newMargin + totalSupplierTook);
        result.refundCommittedToClient = round(salePrice - (newMargin + result.totalCharges));
        result.clientReceives = result.refundCommittedToClient;
        break;

      case 'clientCardRefundAmount': // 3B
        result.airlineDeducted = airlineDeductedFromSale;
        result.totalCharges = round(totalSupplierTook + airlineDeductedFromSale);
        result.supplierWillReturn = round(salePrice - airlineDeductedFromSale);
        result.upfrontNeeded = round(newMargin + totalSupplierTook);
        result.refundCommittedToClient = round(salePrice - (newMargin + result.totalCharges));
        result.clientReceives = result.refundCommittedToClient;
        break;

      case 'companyCard': // 4A
        const isCardEqualToSalePrice = paymentFromCard === salePrice;
        result.totalCharges = round(totalSupplierTook + scc);
        result.supplierWillReturn = isCardEqualToSalePrice ? round(salePrice - totalSupplierTook) : round(ourCost - scc - autoSupplierCancellationCharge);
        result.clientReceives = round(salePrice - (newMargin + result.totalCharges));
        result.refundCommittedToClient = result.clientReceives;
        break;
        
      case 'companyCardRefundAmount': // 4B
        const isCardEqualToSalePriceB = paymentFromCard === salePrice;
        result.totalCharges = round(totalSupplierTook + airlineDeducted);
        result.supplierWillReturn = isCardEqualToSalePriceB ? round(salePrice - totalSupplierTook) : round(ourCost - airlineDeducted - autoSupplierCancellationCharge);
        result.clientReceives = round(salePrice - (newMargin + result.totalCharges));
        result.refundCommittedToClient = result.clientReceives;
        break;

      case 'partialPaidClientCard': // 5A
        result.totalCharges = round(totalSupplierTook + scc);
        result.supplierWillReturn = round(totalPaidAmount - result.totalCharges);
        result.upfrontNeeded = round(newMargin + totalSupplierTook);
        result.refundCommittedToClient = round(totalPaidAmount - (newMargin + result.totalCharges));
        result.clientReceives = result.refundCommittedToClient;
        break;
        
      case 'partialPaidClientCardRefundAmount': // 5B
        result.airlineDeducted = airlineDeductedFromPaid;
        result.totalCharges = round(totalSupplierTook + airlineDeductedFromPaid);
        result.supplierWillReturn = round(totalPaidAmount - result.totalCharges);
        result.upfrontNeeded = round(newMargin + totalSupplierTook);
        result.refundCommittedToClient = round(totalPaidAmount - (newMargin + result.totalCharges));
        result.clientReceives = result.refundCommittedToClient;
        break;

      case 'partialPaidCompanyCard': // 5B-like
        result.totalCharges = round(totalSupplierTook + scc);
        result.supplierWillReturn = round(totalPaidAmount - result.totalCharges);
        result.refundCommittedToClient = round(totalPaidAmount - (newMargin + result.totalCharges));
        result.clientReceives = result.refundCommittedToClient;
        break;
    }

    return result;
}

const baseBooking = {
  ourCost: 1000,
  salePrice: 1200,
  supplierBookingCharge: 10,
  supplierUpdationCharge: 0,
  autoSupplierCancellationCharge: 30,
  supplierCharges: 10,
  totalPaidAmount: 1200,
  paymentFromCard: 0
};

const scenarios = [
  { name: "SCENARIO 1A", booking: baseBooking, form: { cancellationType: 'supplierCancellationCharges', supplierCancellationCharges: 100, ourCancellationCharges: 50 },
    expected: { totalSupplierTook: 40, ourMargin: 190, newMargin: 240, totalCharges: 140, refundCommittedToClient: 820, supplierWillReturn: 870 } },
  
  { name: "SCENARIO 1B", booking: baseBooking, form: { cancellationType: 'supplierRefundAmount', supplierCancellationCharges: 900, ourCancellationCharges: 50 },
    expected: { airlineDeducted: 100, totalCharges: 140, refundCommittedToClient: 820, supplierWillReturn: 870 } },

  { name: "SCENARIO 2A", booking: {...baseBooking, totalPaidAmount: 600}, form: { cancellationType: 'partialPaidCancellationCharges', supplierCancellationCharges: 100, ourCancellationCharges: 50 },
    expected: { totalSupplierTook: 40, totalCharges: 140, newMargin: 240, refundCommittedToClient: 220, supplierWillReturn: 470 } },

  { name: "SCENARIO 2B", booking: {...baseBooking, totalPaidAmount: 600}, form: { cancellationType: 'partialPaidRefundAmount', supplierCancellationCharges: 500, ourCancellationCharges: 50 },
    expected: { airlineDeducted: 100, totalCharges: 140, refundCommittedToClient: 220, supplierWillReturn: 470 } },

  { name: "SCENARIO 3A", booking: {...baseBooking, paymentFromCard: 1200}, form: { cancellationType: 'clientCard', supplierCancellationCharges: 100, ourCancellationCharges: 50 },
    expected: { totalSupplierTook: 40, totalCharges: 140, supplierWillReturn: 1100, upfrontNeeded: 280, refundCommittedToClient: 820 } },

  { name: "SCENARIO 3B", booking: {...baseBooking, paymentFromCard: 1200}, form: { cancellationType: 'clientCardRefundAmount', supplierCancellationCharges: 900, ourCancellationCharges: 50 },
    expected: { airlineDeducted: 300, totalCharges: 340, supplierWillReturn: 900, upfrontNeeded: 280, refundCommittedToClient: 620 } },

  { name: "SCENARIO 4A", booking: {...baseBooking, paymentFromCard: 1000}, form: { cancellationType: 'companyCard', supplierCancellationCharges: 100, ourCancellationCharges: 50 },
    expected: { totalSupplierTook: 40, totalCharges: 140, supplierWillReturn: 870, refundCommittedToClient: 820 } },

  { name: "SCENARIO 4B", booking: {...baseBooking, paymentFromCard: 1000}, form: { cancellationType: 'companyCardRefundAmount', supplierCancellationCharges: 900, ourCancellationCharges: 50 },
    expected: { airlineDeducted: 100, totalCharges: 140, supplierWillReturn: 870, refundCommittedToClient: 820 } },

  { name: "SCENARIO 5A", booking: {...baseBooking, totalPaidAmount: 600}, form: { cancellationType: 'partialPaidClientCard', supplierCancellationCharges: 100, ourCancellationCharges: 50 },
    expected: { totalSupplierTook: 40, totalCharges: 140, supplierWillReturn: 460, upfrontNeeded: 280, refundCommittedToClient: 220 } },

  { name: "SCENARIO 5B", booking: {...baseBooking, totalPaidAmount: 600}, form: { cancellationType: 'partialPaidClientCardRefundAmount', supplierCancellationCharges: 500, ourCancellationCharges: 50 },
    expected: { airlineDeducted: 100, totalCharges: 140, supplierWillReturn: 460, upfrontNeeded: 280, refundCommittedToClient: 220 } }
];

let failed = false;
scenarios.forEach(sc => {
  let res = calculateCancellation(sc.booking, sc.form);
  let passed = true;
  console.log("\n[" + sc.name + "]");
  for(let key in sc.expected) {
    if (res[key] !== sc.expected[key]) {
      console.log("  FAILED " + key + ": Expected " + sc.expected[key] + ", got " + res[key]);
      passed = false;
      failed = true;
    } else {
      console.log("  OK " + key + ": " + res[key]);
    }
  }
});

if(failed) {
  console.log("\nSome tests failed.");
  process.exit(1);
} else {
  console.log("\nAll tests passed successfully.");
}
