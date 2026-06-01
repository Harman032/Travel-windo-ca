import re

with open('c:/Users/harma/Downloads/tarvel-windo-ca/travel-window-backend-staging-main/tests/cancellation.test.js', 'r') as f:
    code = f.read()

new_func = """function calculateCancellation(booking, inputs, cancellationType) {
  const {
    ourCost, salePrice, supplierCharges,
    totalPaidAmount, paymentFromCard, cardType,
    supplierBookingCharge = 0, supplierUpdationCharge = 0, autoSupplierCancellationCharge = 0
  } = booking;

  const {
    supplierCancellationCharges: scc,
    ourCancellationCharges: occ,
    chargeFromClient = 0
  } = inputs;

  const round = (val) => Math.round(val * 100) / 100;

  const totalSupplierTook = round(
    supplierBookingCharge + supplierUpdationCharge + autoSupplierCancellationCharge
  );

  const ourMargin = round(salePrice - ourCost - supplierBookingCharge);
  const newMargin = round(ourMargin + occ);
  
  let result = {
    ourMargin,
    newMargin,
    totalSupplierTook,
    cancellationType
  };

  const isRefundAmount = cancellationType.includes('RefundAmount');
  const airlineDeductedFromSale = isRefundAmount ? round(salePrice - scc) : 0;
  const airlineDeductedFromPaid = isRefundAmount ? round(totalPaidAmount - scc) : 0;
  const airlineDeducted = isRefundAmount ? round(ourCost - scc) : 0; 
  
  switch (cancellationType) {
    case 'supplierCancellationCharges': // 1A
      result.totalCharges = round(totalSupplierTook + scc);
      result.supplierWillReturn = round(ourCost - scc - autoSupplierCancellationCharge);
      result.refundCommittedToClient = round(salePrice - (newMargin + result.totalCharges));
      result.refundCommittedToClientFinal = result.refundCommittedToClient;
      result.supplierDeducted = scc;
      break;

    case 'supplierRefundAmount': // 1B
      result.totalCharges = round(totalSupplierTook + airlineDeducted);
      result.supplierWillReturn = round(ourCost - airlineDeducted - autoSupplierCancellationCharge);
      result.refundCommittedToClient = round(salePrice - (newMargin + result.totalCharges));
      result.refundCommittedToClientFinal = result.refundCommittedToClient;
      result.supplierDeducted = airlineDeducted;
      break;

    case 'partialPaidCancellationCharges': // 2A
      result.totalCharges = round(totalSupplierTook + scc);
      result.refundToClient = round(totalPaidAmount - (result.totalCharges + newMargin));
      result.supplierWillReturn = round(totalPaidAmount - scc - autoSupplierCancellationCharge);
      result.refundCommittedToClientFinal = result.refundToClient;
      break;

    case 'partialPaidRefundAmount': // 2B
      result.totalCharges = round(totalSupplierTook + airlineDeductedFromPaid);
      result.refundToClient = round(totalPaidAmount - (result.totalCharges + newMargin));
      result.supplierWillReturn = round(totalPaidAmount - airlineDeductedFromPaid - autoSupplierCancellationCharge);
      result.refundCommittedToClientFinal = result.refundToClient;
      result.supplierDeducted = airlineDeductedFromPaid;
      break;

    case 'clientCard': // 3A
      result.totalCharges = round(totalSupplierTook + scc);
      result.supplierWillReturn = round(salePrice - scc);
      result.upfrontNeeded = round(newMargin + totalSupplierTook);
      result.refundCommittedToClient = round(salePrice - (newMargin + result.totalCharges));
      result.clientReceives = result.refundCommittedToClient;
      result.refundCommittedToClientFinal = result.clientReceives;
      break;

    case 'companyCard': // 4A
      result.totalCharges = round(totalSupplierTook + scc);
      result.supplierWillReturn = round(ourCost - scc - autoSupplierCancellationCharge);
      result.clientReceives = round(salePrice - (newMargin + result.totalCharges));
      result.refundCommittedToClientFinal = result.clientReceives;
      break;

    case 'partialPaidClientCard': // 5A
      result.totalCharges = round(totalSupplierTook + scc);
      result.supplierWillReturn = round(totalPaidAmount - result.totalCharges);
      result.upfrontNeeded = round(newMargin + totalSupplierTook);
      result.refundCommittedToClient = round(totalPaidAmount - (newMargin + result.totalCharges));
      result.clientReceives = result.refundCommittedToClient;
      result.remainingAmount = round(salePrice - paymentFromCard);
      result.refundCommittedToClientFinal = result.clientReceives;
      break;

    case 'partialPaidCompanyCard': // 5A but company card logic
      result.totalCharges = round(totalSupplierTook + scc);
      result.supplierWillReturn = round(totalPaidAmount - result.totalCharges);
      result.clientReceives = round(totalPaidAmount - (newMargin + result.totalCharges));
      result.remainingAmount = round(salePrice - paymentFromCard);
      result.refundCommittedToClientFinal = result.clientReceives;
      break;

    case 'clientCardPartialPayment': // Not in requirements, keeping basic fallback
      result.totalCharges = round(totalSupplierTook + scc);
      result.supplierWillReturn = round(totalPaidAmount - result.totalCharges);
      result.upfrontNeeded = round(newMargin + totalSupplierTook);
      result.remainingAmount = round(salePrice - paymentFromCard);
      result.clientReceives = round(totalPaidAmount - (newMargin + result.totalCharges));
      result.refundCommittedToClientFinal = result.clientReceives;
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
}"""

code = re.sub(r'function calculateCancellation.*?return result;\n}', new_func, code, flags=re.DOTALL)

with open('c:/Users/harma/Downloads/tarvel-windo-ca/travel-window-backend-staging-main/tests/cancellation.test.js', 'w') as f:
    f.write(code)
