const fs = require('fs');

const path = 'c:/Users/harma/Downloads/tarvel-windo-ca/travel-window-frontend-staging-main/src/app/components/bookings/booking-detail/booking-detail.component.ts';
let code = fs.readFileSync(path, 'utf8');

const patch = `
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

  // Common routing getters that match the templates
  get cancelTotalSupplierTook(): number { return this.cancellationResult.totalSupplierTook ?? 0; }
  get cancelOurMargin(): number { return this.cancellationResult.ourMargin ?? 0; }
  get cancelCurrentMargin(): number { return this.cancellationResult.newMargin ?? 0; }
  get cancelTotalCharges(): number { return this.cancellationResult.totalCharges ?? 0; }
  
  get cancelSupplierWillReturn(): number { return this.cancellationResult.supplierWillReturn ?? 0; }
  get cancelClientCardSupplierWillReturn(): number { return this.cancellationResult.supplierWillReturn ?? 0; }
  get cancelCompanyCardSupplierWillReturn(): number { return this.cancellationResult.supplierWillReturn ?? 0; }
  get partialPaidSupplierWillReturn(): number { return this.cancellationResult.supplierWillReturn ?? 0; }
  get partialPaidRefundAmountSupplierWillReturn(): number { return this.cancellationResult.supplierWillReturn ?? 0; }
  get partialPaidCardSupplierWillReturn(): number { return this.cancellationResult.supplierWillReturn ?? 0; }
  get clientCardPartialSupplierWillReturn(): number { return this.cancellationResult.supplierWillReturn ?? 0; }

  get cancelClientCardUpfrontNeeded(): number { return this.cancellationResult.upfrontNeeded ?? 0; }
  get partialPaidCardUpfrontNeeded(): number { return this.cancellationResult.upfrontNeeded ?? 0; }
  get clientCardPartialUpfrontNeeded(): number { return this.cancellationResult.upfrontNeeded ?? 0; }

  get cancelCompanyCardClientReceives(): number { return this.cancellationResult.clientReceives ?? 0; }
  get cancelClientCardClientReceives(): number { return this.cancellationResult.clientReceives ?? 0; }
  get partialPaidCardClientReceives(): number { return this.cancellationResult.clientReceives ?? 0; }
  get clientCardPartialClientReceives(): number { return this.cancellationResult.clientReceives ?? 0; }

  get cancelRefundCommittedToClient(): number { return this.cancellationResult.refundCommittedToClient ?? 0; }
  get refundCommittedToClientNonCC(): number { return this.cancellationResult.refundCommittedToClient ?? 0; }
  get refundCommittedToClientRefundMode(): number { return this.cancellationResult.refundCommittedToClient ?? 0; }
  get partialPaidRefundToClient(): number { return this.cancellationResult.refundCommittedToClient ?? 0; }
  get partialPaidRefundToClientSRA(): number { return this.cancellationResult.refundCommittedToClient ?? 0; }

  get cancelTotalCancellationCharges(): number { return this.cancellationResult.totalCharges ?? 0; }
  get partialPaidTotalCharges(): number { return this.cancellationResult.totalCharges ?? 0; }
  get partialPaidCardTotalCharges(): number { return this.cancellationResult.totalCharges ?? 0; }
  get clientCardPartialTotalCharges(): number { return this.cancellationResult.totalCharges ?? 0; }
  get partialPaidTotalChargesSRA(): number { return this.cancellationResult.totalCharges ?? 0; }

  get cancelCurrentMarginSCC(): number { return this.cancellationResult.newMargin ?? 0; }
  get cancelCurrentMarginSRA(): number { return this.cancellationResult.newMargin ?? 0; }
  get partialPaidNewMargin(): number { return this.cancellationResult.newMargin ?? 0; }
  get partialPaidCardNewMargin(): number { return this.cancellationResult.newMargin ?? 0; }
  get clientCardPartialNewMargin(): number { return this.cancellationResult.newMargin ?? 0; }
  get cancelNewMarginSCC(): number { return this.cancellationResult.newMargin ?? 0; }
  get cancelNewMarginSRA(): number { return this.cancellationResult.newMargin ?? 0; }
  get newMargin(): number { return this.cancellationResult.newMargin ?? 0; }
`;

// Find all code to replace
const startIndex = code.indexOf('  get cancelOurMargin(): number {');
const endIndex = code.indexOf('  getStatusClass(status: string): string {');

if (startIndex !== -1 && endIndex !== -1) {
  const newCode = code.slice(0, startIndex) + patch + '\n  // -----------------------------------\n\n' + code.slice(endIndex);
  fs.writeFileSync(path, newCode);
  console.log('Successfully patched frontend!');
} else {
  console.log('Could not find start/end bounds.');
}
