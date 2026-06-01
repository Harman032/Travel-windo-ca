const fs = require('fs');

const path = 'c:/Users/harma/Downloads/tarvel-windo-ca/travel-window-frontend-staging-main/src/app/components/bookings/booking-detail/booking-detail.component.ts';
let code = fs.readFileSync(path, 'utf8');

const baseResultHelper = `
  get cancellationResult(): any {
    if (!this.booking) return {};

    const round = (val: number) => Math.round(val * 100) / 100;

    const salePrice = this.booking.salePrice || 0;
    const ourCost = this.booking.ourCost || 0;
    const supplierCharges = this.booking.supplierCharges || 0;
    const totalPaidAmount = this.booking.totalPaidAmount || 0;
    const paymentFromCard = this.booking.paymentFromCard || 0;
    const supplierBookingCharge = this.booking.supplierBookingCharge || 0;
    const supplierUpdationCharge = this.booking.supplierUpdationCharge || 0;
    const autoSupplierCancellationCharge = this.autoSupplierCancellationCharge || 0;

    const scc = Number(this.cancelForm?.get('supplierCancellationCharges')?.value || 0);
    const occ = Number(this.cancelForm?.get('ourCancellationCharges')?.value || 0);
    const chargeFromClient = Number(this.cancelForm?.get('chargeFromClient')?.value || 0);

    const cancellationType = this.cancelForm?.get('cancellationType')?.value || '';

    const totalSupplierTook = round(supplierBookingCharge + supplierUpdationCharge + autoSupplierCancellationCharge);
    const ourMargin = round(salePrice - ourCost - supplierCharges);
    const newMargin = round(ourMargin + occ);

    let result: any = {
      ourMargin,
      newMargin,
      totalSupplierTook,
      cancellationType,
      supplierWillReturn: 0,
      refundCommittedToClient: 0,
      clientReceives: 0,
      totalCharges: 0,
      upfrontNeeded: 0
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

      case 'companyCard': // 4A/4B
        const isCardEqualToSalePrice = paymentFromCard === salePrice;
        result.totalCharges = round(totalSupplierTook + scc);
        result.supplierWillReturn = isCardEqualToSalePrice ? round(salePrice - totalSupplierTook) : round(ourCost - totalSupplierTook);
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

      case 'partialPaidCompanyCard': // 5B
        result.totalCharges = round(totalSupplierTook + scc);
        result.supplierWillReturn = round(totalPaidAmount - result.totalCharges);
        result.refundCommittedToClient = round(totalPaidAmount - (newMargin + result.totalCharges));
        result.clientReceives = result.refundCommittedToClient;
        break;
        
      case 'clientCardPartialPayment':
        const remainingAmount = round(salePrice - paymentFromCard);
        result.totalCharges = round(totalSupplierTook + scc);
        result.supplierWillReturn = round(totalPaidAmount - scc);
        result.upfrontNeeded = newMargin;
        result.clientReceives = result.supplierWillReturn;
        result.refundCommittedToClient = round(totalPaidAmount - result.totalCharges);

        if (remainingAmount < result.totalCharges) {
          result.upfrontNeeded = round(result.totalCharges - remainingAmount);
          result.clientReceives = paymentFromCard;
        } else {
          result.upfrontNeeded = 0;
          result.clientReceives = round(paymentFromCard + (remainingAmount - result.totalCharges));
        }
        break;
        
      case 'machineCharge':
        const oldMargin_mc = round(salePrice - ourCost - supplierCharges);
        const refundableToClient_mc = round(salePrice - scc);
        const chargeFromClient_mc = occ;
        const newMargin_mc = round(Math.max(0, chargeFromClient_mc - oldMargin_mc));
        const refundCommitted_mc = round(refundableToClient_mc - chargeFromClient_mc);

        result.newMargin = newMargin_mc;
        result.refundCommittedToClient = refundCommitted_mc;
        break;
    }

    return result;
  }
`;

function replaceGetterBody(name, replacementBody) {
  // Matches "  get name(): Type {" and captures it, then replaces everything until the matching "  }"
  const regex = new RegExp(\`(  get \\b\${name}\\b(?:\\s*\\([^)]*\\))?\\s*:\\s*[a-zA-Z\\[\\]<> ]+\\s*\\{)[\\s\\S]*?(^  \\})\`, 'm');
  if (!code.match(regex)) {
      console.log(\`Warning: Could not find getter \${name}\`);
  } else {
      code = code.replace(regex, \`$1\\n    return \${replacementBody};\\n$2\`);
  }
}

// 1. Inject cancellationResult before cancelTotalSupplierTook
code = code.replace('  get cancelTotalSupplierTook(): number {', baseResultHelper + '\\n  get cancelTotalSupplierTook(): number {');

// 2. Replace all the relevant bodies
const mappings = {
  cancelTotalSupplierTook: 'this.cancellationResult.totalSupplierTook ?? 0',
  cancelOurMargin: 'this.cancellationResult.ourMargin ?? 0',
  cancelTotalCharges: 'this.cancellationResult.totalCharges ?? 0',
  cancelCompanyCardSupplierWillReturn: 'this.cancellationResult.supplierWillReturn ?? 0',
  cancelClientCardSupplierWillReturn: 'this.cancellationResult.supplierWillReturn ?? 0',
  cancelCompanyCardClientReceives: 'this.cancellationResult.clientReceives ?? 0',
  cancelClientCardOurMargin: 'this.cancellationResult.ourMargin ?? 0',
  cancelClientCardCurrentMargin: 'this.cancellationResult.newMargin ?? 0',
  cancelClientCardUpfrontNeeded: 'this.cancellationResult.upfrontNeeded ?? 0',
  cancelClientCardClientReceives: 'this.cancellationResult.clientReceives ?? 0',
  partialPaidOurMargin: 'this.cancellationResult.ourMargin ?? 0',
  partialPaidTotalCharges: 'this.cancellationResult.totalCharges ?? 0',
  partialPaidRefundToClient: 'this.cancellationResult.refundCommittedToClient ?? 0',
  partialPaidSupplierWillReturn: 'this.cancellationResult.supplierWillReturn ?? 0',
  partialPaidOurMarginSRA: 'this.cancellationResult.ourMargin ?? 0',
  partialPaidTotalChargesSRA: 'this.cancellationResult.totalCharges ?? 0',
  partialPaidRefundToClientSRA: 'this.cancellationResult.refundCommittedToClient ?? 0',
  partialPaidRefundAmountSupplierWillReturn: 'this.cancellationResult.supplierWillReturn ?? 0',
  partialPaidCardTotalSupplierTook: 'this.cancellationResult.totalSupplierTook ?? 0',
  partialPaidCardNewMargin: 'this.cancellationResult.newMargin ?? 0',
  partialPaidCardTotalCharges: 'this.cancellationResult.totalCharges ?? 0',
  partialPaidCardClientReceives: 'this.cancellationResult.clientReceives ?? 0',
  cancelRefundableToClient: 'this.cancellationResult.refundCommittedToClient ?? 0', // fallback approximation
  cancelRefundCommittedToClient: 'this.cancellationResult.refundCommittedToClient ?? 0',
  cancelTotalCancellationCharges: 'this.cancellationResult.totalCharges ?? 0',
  refundCommittedToClientNonCC: 'this.cancellationResult.refundCommittedToClient ?? 0',
  refundCommittedToClientRefundMode: 'this.cancellationResult.refundCommittedToClient ?? 0',
  cancelNewMarginSCC: 'this.cancellationResult.newMargin ?? 0',
  cancelNewMarginSRA: 'this.cancellationResult.newMargin ?? 0',
  newMargin: 'this.cancellationResult.newMargin ?? 0',
  clientCardPartialOurMargin: 'this.cancellationResult.ourMargin ?? 0',
  clientCardPartialTotalSupplierTook: 'this.cancellationResult.totalSupplierTook ?? 0',
  clientCardPartialNewMargin: 'this.cancellationResult.newMargin ?? 0',
  clientCardPartialTotalCharges: 'this.cancellationResult.totalCharges ?? 0',
  clientCardPartialSupplierWillReturn: 'this.cancellationResult.supplierWillReturn ?? 0',
  clientCardPartialUpfrontNeeded: 'this.cancellationResult.upfrontNeeded ?? 0',
  clientCardPartialClientReceives: 'this.cancellationResult.clientReceives ?? 0'
};

for (const [key, value] of Object.entries(mappings)) {
    replaceGetterBody(key, value);
}

fs.writeFileSync(path, code);
console.log('Frontend patched safely!');
