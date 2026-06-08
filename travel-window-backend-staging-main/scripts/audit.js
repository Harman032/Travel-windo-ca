const { calculateCancellationScenario } = require('../utils/cancellation-engine');

// We need to define recalculateCancellationValues exactly as it is in the route, but using raw objects
function recalculateCancellationValues(booking) {
  const c = booking.cancellation;
  if (!c || !c.isCancelled) return;
  
  const dateChangeSaleAddon = (booking.dateChanges || []).reduce((s, d) => s + (Number(d?.salePriceAddon) || 0), 0);
  const flightChangeSaleAddon = (booking.flightChanges || []).reduce((s, d) => s + (Number(d?.salePriceAddon) || 0), 0);
  const dateChangeOurAddon = (booking.dateChanges || []).reduce((s, d) => s + (Number(d?.ourCostAddon) || 0), 0);
  const flightChangeOurAddon = (booking.flightChanges || []).reduce((s, d) => s + (Number(d?.ourCostAddon) || 0), 0);
  
  const baseSalePrice = Math.max(0, (Number(booking.salePrice) || 0) - dateChangeSaleAddon - flightChangeSaleAddon);
  const baseOurCost = Math.max(0, (Number(booking.ourCost) || 0) - dateChangeOurAddon - flightChangeOurAddon);
  
  const isChargesMode = c.cancellationMode === 'charges';
  const acc = isChargesMode ? (Number(c.airlineCancellationCharges) || 0) : 0;
  const ara = isChargesMode ? 0 : (Number(c.airlineRefundAmount) || 0);
  const nm = Number(c.newMargin) || 0;
  
  const autoSCC = Math.max(0,
    (Number(booking.supplierCharges) || 0) -
    (Number(booking.supplierBookingCharge) || 0) -
    (Number(booking.supplierUpdationCharge) || 0)
  );
  
  const isPartialPaid = booking.paymentType === 'Partial';
  const isClientCard = booking.cardType === 'Client Card';
  const isCompanyCard = booking.cardType === 'Company Card';
  const isMachineCharge = !booking.cardType && booking.payments?.some(p => p.paymentMode === 'Machine Charge');
  
  const result = calculateCancellationScenario({
    baseSalePrice,
    baseOurCost,
    paidAmount: Number(booking.totalPaidAmount) || 0,
    supplierBookingCharge: Number(booking.supplierBookingCharge) || 0,
    supplierUpdationCharge: Number(booking.supplierUpdationCharge) || 0,
    autoSupplierCancellationCharge: autoSCC,
    isChargesMode,
    airlineCancellationCharges: acc,
    airlineRefundAmount: ara,
    newMarginInput: nm,
    isPartialPaid,
    isClientCard,
    isCompanyCard,
    isMachineCharge
  });
  
  c.oldMargin = result.ourMargin;
  c.currentMargin = result.currentMargin;
  c.totalSupplierTook = result.totalSupplierTook;
  c.airlineDeducted = result.airlineDeducted;
  c.totalCharges = result.totalCharges;
  c.supplierWillReturn = result.supplierWillReturn;
  c.refundCommittedToClient = result.refundCommittedToClient;
  c.refundableAmount = result.refundableAmount;
  c.clientReceives = result.refundCommittedToClient;
  c.upfrontNeeded = result.upfrontNeeded;
}

async function run() {
  // --- 6. SCENARIO 1A NOT UPDATED ---
  console.log('\n--- 6. CREATING BOOKING FOR SCENARIO 1A (NOT UPDATED) ---');
  let b1 = {
    bookingId: 'AUDIT-1A-123',
    salePrice: 1200,
    ourCost: 1000,
    supplierBookingCharge: 10,
    supplierUpdationCharge: 0,
    supplierCharges: 40,
    totalPaidAmount: 1200,
    status: 'Billed'
  };
  
  const formPayload1 = {
    paymentModeWas: 'Bank Transfer',
    cancellationMode: 'charges',
    airlineCancellationCharges: 100,
    newMargin: 50,
    remarks: 'Audit 1A Not Updated'
  };
  
  const result1 = calculateCancellationScenario({
    baseSalePrice: 1200,
    baseOurCost: 1000,
    paidAmount: 1200,
    supplierBookingCharge: 10,
    supplierUpdationCharge: 0,
    autoSupplierCancellationCharge: 30, // 40 - 10 - 0
    isChargesMode: true,
    airlineCancellationCharges: 100,
    newMarginInput: 50,
    isPartialPaid: false,
    isClientCard: false,
    isCompanyCard: false,
    isMachineCharge: false
  });
  
  b1.cancellation = {
    isCancelled: true,
    paymentModeWas: formPayload1.paymentModeWas,
    cancellationMode: formPayload1.cancellationMode,
    airlineCancellationCharges: formPayload1.airlineCancellationCharges,
    oldMargin: result1.ourMargin,
    newMargin: formPayload1.newMargin,
    currentMargin: result1.currentMargin,
    totalSupplierTook: result1.totalSupplierTook,
    totalCharges: result1.totalCharges,
    supplierWillReturn: result1.supplierWillReturn,
    refundCommittedToClient: result1.refundCommittedToClient,
    refundableAmount: result1.refundableAmount,
    totalAmountPaid: 1200,
    remarks: formPayload1.remarks
  };
  
  console.log("Expected:");
  console.log("Current Margin = 240");
  console.log("Total Supplier Took = 40");
  console.log("Total Charges = 140");
  console.log("Supplier Will Return = 860");
  console.log("Refund Committed = 820");
  console.log("\nActual Saved Object (MongoDB format):");
  console.log(JSON.stringify(b1.cancellation, null, 2));


  // --- 7. SCENARIO 1A UPDATED ---
  console.log('\n--- 7. CREATING BOOKING FOR SCENARIO 1A (UPDATED) ---');
  let b2 = {
    bookingId: 'AUDIT-1A-UPD-123',
    salePrice: 1200,
    ourCost: 1000,
    supplierBookingCharge: 10,
    supplierUpdationCharge: 20,
    supplierCharges: 60,
    totalPaidAmount: 1200,
    status: 'Billed'
  };
  
  const result2 = calculateCancellationScenario({
    baseSalePrice: 1200,
    baseOurCost: 1000,
    paidAmount: 1200,
    supplierBookingCharge: 10,
    supplierUpdationCharge: 20,
    autoSupplierCancellationCharge: 30, // 60 - 10 - 20
    isChargesMode: true,
    airlineCancellationCharges: 100,
    newMarginInput: 0,
    isPartialPaid: false,
    isClientCard: false,
    isCompanyCard: false,
    isMachineCharge: false
  });
  
  b2.cancellation = {
    isCancelled: true,
    totalSupplierTook: result2.totalSupplierTook,
    supplierWillReturn: result2.supplierWillReturn,
  };
  
  console.log("Expected: Total Supplier Took = 60, Supplier Will Return = 840");
  console.log("Actual Saved DB Values:");
  console.log("Total Supplier Took:", b2.cancellation.totalSupplierTook);
  console.log("Supplier Will Return:", b2.cancellation.supplierWillReturn);


  // --- 8. RECALCULATION VERIFICATION ---
  console.log('\n--- 8. RECALCULATING HISTORIC BOOKING ---');
  let b3 = {
    bookingId: 'AUDIT-LEGACY-123',
    salePrice: 1200,
    ourCost: 1000,
    supplierBookingCharge: 10,
    supplierUpdationCharge: 0,
    supplierCharges: 40,
    totalPaidAmount: 1200,
    status: 'Cancelled',
    cancellation: {
      isCancelled: true,
      cancellationMode: 'charges',
      airlineCancellationCharges: 100,
      newMargin: 50,
      
      // WRONG LEGACY VALUES
      totalSupplierTook: 999,
      totalCharges: 999,
      supplierWillReturn: 999,
      refundCommittedToClient: 999
    }
  };
  
  console.log("BEFORE RECALCULATION:");
  console.log("Total Supplier Took:", b3.cancellation.totalSupplierTook);
  console.log("Supplier Will Return:", b3.cancellation.supplierWillReturn);
  console.log("Refund Committed To Client:", b3.cancellation.refundCommittedToClient);
  
  // Run recalculate
  recalculateCancellationValues(b3);
  
  console.log("\nAFTER RECALCULATION (Should match Scenario 1A Expected):");
  console.log("Total Supplier Took:", b3.cancellation.totalSupplierTook);
  console.log("Supplier Will Return:", b3.cancellation.supplierWillReturn);
  console.log("Refund Committed To Client:", b3.cancellation.refundCommittedToClient);

  console.log('\nDone.');
}

run().catch(console.error);
