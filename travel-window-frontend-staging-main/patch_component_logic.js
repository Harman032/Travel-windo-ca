const fs = require('fs');
const file = 'src/app/components/bookings/booking-detail/booking-detail.component.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Fix cancelForm init
code = code.replace(
/this\.cancelForm = this\.fb\.group\(\{\s*paymentModeWas:[^}]*?remarks: \['', Validators\.required\]\s*\}\);[\s\S]*?this\.cancelForm\.get\('committedToClient'\)\?\.updateValueAndValidity\(\);\s*\}\);/m,
`this.cancelForm = this.fb.group({
      paymentModeWas: ['', Validators.required],
      airlineCancellationCharges: [0],
      airlineRefundAmount: [0],
      newMargin: [0],
      remarks: ['', Validators.required]
    });`
);

// 2. Fix openCancelFormOnly
code = code.replace(
/openCancelFormOnly\(\) \{[\s\S]*?this\.autoSupplierCancellationCharge = scc;\s*this\.cancelForm\.patchValue\(\{\s*supplierCancellationCharges: scc\s*\}\);\s*\}\s*\}\);\s*\}\s*\}\s*\}/m,
`openCancelFormOnly() {
    this.cancellationMode = 'charges';
    
    // Reset form
    this.cancelForm.patchValue({
      airlineCancellationCharges: 0,
      airlineRefundAmount: 0,
      newMargin: 0
    });

    if (this.showCancelForm) {
      this.showCancelForm = false;
      return;
    }
    
    this.showCancelForm = true;
    this.showDateChangeForm = false;
    this.showFlightChangeForm = false;
    
    if (this.booking) {
      const paymentModeWas = this.getPrimaryPaymentMode();
      this.cancelForm.patchValue({ paymentModeWas: paymentModeWas || '' });
      this.cancelForm.get('paymentModeWas')?.disable();

      const supplierId = this.booking?.supplier?._id ?? this.booking?.supplier;
      if (supplierId) {
        this.supplierService.getSuppliers().subscribe({
          next: (suppliers: any[]) => {
            const supplier = suppliers.find(s => s._id === supplierId);
            const scc = supplier?.cancellationCharge ?? 0;
            this.autoSupplierCancellationCharge = scc;
          }
        });
      }
    }
  }`
);

// 3. Fix cancellationResult getter
const getCancellationResultStart = code.indexOf('  get cancellationResult(): any {');
const getCancellationResultEnd = code.indexOf('  // --- Flow Control Getters');
if (getCancellationResultStart !== -1 && getCancellationResultEnd !== -1) {
  const replacement = `  get cancellationResult(): any {
    if (!this.booking) return {};
    const round = (val: number) => Math.round(val * 100) / 100;
    const salePrice = this.booking.salePrice || 0;
    const ourCost = this.booking.ourCost || 0;
    const totalPaidAmount = this.booking.totalPaidAmount || 0;
    const supplierBookingCharge = this.booking.supplierBookingCharge || 0;
    const supplierUpdationCharge = this.booking.supplierUpdationCharge || 0;
    const autoSCC = this.autoSupplierCancellationCharge || 0;

    const acc = Number(this.cancelForm?.get('airlineCancellationCharges')?.value || 0);
    const ara = Number(this.cancelForm?.get('airlineRefundAmount')?.value || 0);
    const nm = Number(this.cancelForm?.get('newMargin')?.value || 0);

    const baseSalePrice = Math.max(0, salePrice - this.dateChangeSaleAddon - this.flightChangeSaleAddon);
    const baseOurCost = Math.max(0, ourCost - this.dateChangeOurAddon - this.flightChangeOurAddon);

    const isPartialPaid = this.booking.billingStatus === 'Partial Paid';
    const isClientCard = this.booking.cardType === 'Client Card';
    const isCompanyCard = this.booking.cardType === 'Company Card';
    const isMachineCharge = this.cancelForm?.get('paymentModeWas')?.value === 'Machine Charge';

    const totalSupplierTook = round(supplierBookingCharge + supplierUpdationCharge + autoSCC);
    const ourMargin = round(baseSalePrice - (baseOurCost + supplierBookingCharge));
    const currentMargin = round(ourMargin + nm);
    const paidAmount = totalPaidAmount;

    let result: any = {
      ourMargin,
      currentMargin,
      newMargin: nm,
      totalSupplierTook,
      supplierWillReturn: 0,
      refundCommittedToClient: 0,
      totalCharges: 0,
      upfrontNeeded: 0,
      airlineDeducted: 0,
      refundableAmount: 0,
      scenario: '',
      clientReceives: 0
    };

    const isChargesMode = this.cancellationMode === 'charges';

    if (isMachineCharge || (!isPartialPaid && !isClientCard && !isCompanyCard)) {
      if (isChargesMode) {
        result.scenario = '1A';
        result.totalCharges = round(acc + totalSupplierTook);
        result.supplierWillReturn = round(baseOurCost - acc - totalSupplierTook);
        result.refundCommittedToClient = round(baseSalePrice - (currentMargin + result.totalCharges));
      } else {
        result.scenario = '1B';
        result.airlineDeducted = round(baseOurCost - ara);
        result.totalCharges = round(result.airlineDeducted + totalSupplierTook);
        result.supplierWillReturn = round(baseOurCost - result.airlineDeducted - totalSupplierTook);
        result.refundCommittedToClient = round(baseSalePrice - (currentMargin + result.totalCharges));
      }
      result.clientReceives = result.refundCommittedToClient;
    } else if (isPartialPaid && !isClientCard && !isCompanyCard) {
      if (isChargesMode) {
        result.scenario = '2A';
        result.totalCharges = round(acc + totalSupplierTook);
        result.supplierWillReturn = round(paidAmount - totalSupplierTook - acc);
        result.refundCommittedToClient = round(paidAmount - (result.totalCharges + currentMargin));
      } else {
        result.scenario = '2B';
        result.airlineDeducted = round(paidAmount - ara);
        result.totalCharges = round(result.airlineDeducted + totalSupplierTook);
        result.supplierWillReturn = round(paidAmount - totalSupplierTook - result.airlineDeducted);
        result.refundCommittedToClient = round(paidAmount - (result.totalCharges + currentMargin));
      }
      result.clientReceives = result.refundCommittedToClient;
    } else if (isClientCard && !isPartialPaid) {
      if (isChargesMode) {
        result.scenario = '3A';
        result.totalCharges = round(totalSupplierTook + acc);
        result.supplierWillReturn = round(baseSalePrice - acc);
        result.upfrontNeeded = round(currentMargin + totalSupplierTook);
        result.refundCommittedToClient = round(baseSalePrice - (currentMargin + result.totalCharges));
        result.refundableAmount = result.supplierWillReturn;
      } else {
        result.scenario = '3B';
        result.airlineDeducted = round(baseSalePrice - ara);
        result.totalCharges = round(totalSupplierTook + result.airlineDeducted);
        result.supplierWillReturn = round(baseSalePrice - result.airlineDeducted);
        result.upfrontNeeded = round(currentMargin + totalSupplierTook);
        result.refundCommittedToClient = round(baseSalePrice - (currentMargin + result.totalCharges));
        result.refundableAmount = result.supplierWillReturn;
      }
      result.clientReceives = result.refundCommittedToClient;
    } else if (isCompanyCard && !isPartialPaid) {
      if (isChargesMode) {
        result.scenario = '4A';
        result.totalCharges = round(totalSupplierTook + acc);
        result.supplierWillReturn = round(baseOurCost - totalSupplierTook - acc);
        result.refundCommittedToClient = round(baseSalePrice - (currentMargin + result.totalCharges));
      } else {
        result.scenario = '4B';
        result.airlineDeducted = round(baseOurCost - ara);
        result.totalCharges = round(totalSupplierTook + result.airlineDeducted);
        result.supplierWillReturn = round(baseOurCost - totalSupplierTook - result.airlineDeducted);
        result.refundCommittedToClient = round(baseSalePrice - (currentMargin + result.totalCharges));
      }
      result.clientReceives = result.refundCommittedToClient;
    } else if (isClientCard && isPartialPaid) {
      if (isChargesMode) {
        result.scenario = '5A';
        result.totalCharges = round(totalSupplierTook + acc);
        result.supplierWillReturn = round(paidAmount - result.totalCharges);
        result.upfrontNeeded = round(currentMargin);
        result.refundCommittedToClient = result.supplierWillReturn;
      } else {
        result.scenario = '5B';
        result.airlineDeducted = round(paidAmount - ara);
        result.totalCharges = round(totalSupplierTook + result.airlineDeducted);
        result.supplierWillReturn = round(paidAmount - result.totalCharges);
        result.upfrontNeeded = round(currentMargin);
        result.refundCommittedToClient = result.supplierWillReturn;
      }
      result.clientReceives = result.refundCommittedToClient;
    }

    return result;
  }

`;
  code = code.slice(0, getCancellationResultStart) + replacement + code.slice(getCancellationResultEnd);
}

// 4. Fix onCancel method
const onCancelStart = code.indexOf('  onCancel(): void {');
const onCancelEnd = code.indexOf('  processRefund() {');
if (onCancelStart !== -1 && onCancelEnd !== -1) {
  const replacement = `  onCancel(): void {
    if (this.cancelForm.invalid) {
      this.cancelForm.markAllAsTouched();
      return;
    }

    if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
      return;
    }

    const mode = this.cancellationMode; // 'charges' or 'refundAmount'
    const acc = Number(this.cancelForm.get('airlineCancellationCharges')?.value || 0);
    const ara = Number(this.cancelForm.get('airlineRefundAmount')?.value || 0);
    const nm = Number(this.cancelForm.get('newMargin')?.value || 0);
    
    let cancellationType = '';
    
    const isPartialPaid = this.booking?.billingStatus === 'Partial Paid';
    const isClientCard = this.booking?.cardType === 'Client Card';
    const isCompanyCard = this.booking?.cardType === 'Company Card';
    const isMachineCharge = this.cancelForm.get('paymentModeWas')?.value === 'Machine Charge';

    if (isMachineCharge) {
      cancellationType = 'machineCharge';
    } else if (isPartialPaid && !isClientCard && !isCompanyCard) {
      cancellationType = mode === 'charges' ? 'partialPaidCancellationCharges' : 'partialPaidRefundAmount';
    } else if (isClientCard && !isPartialPaid) {
      cancellationType = mode === 'charges' ? 'clientCard' : 'clientCardRefundAmount';
    } else if (isCompanyCard && !isPartialPaid) {
      cancellationType = mode === 'charges' ? 'companyCard' : 'companyCardRefundAmount';
    } else if (isClientCard && isPartialPaid) {
      cancellationType = mode === 'charges' ? 'partialPaidClientCard' : 'partialPaidClientCardRefundAmount';
    } else {
      cancellationType = mode === 'charges' ? 'supplierCancellationCharges' : 'supplierRefundAmount';
    }

    const payload = {
      remarks: this.cancelForm.get('remarks')?.value,
      cancellationType: cancellationType,
      supplierCancellationCharges: mode === 'charges' ? acc : ara, // engine expects this legacy field unfortunately
      ourCancellationCharges: nm, // engine expects this legacy field unfortunately
      airlineCancellationCharges: acc,
      airlineRefundAmount: ara,
      newMargin: nm
    };

    console.log('Cancellation payload:', payload); // debug log

    this.bookingService.cancelBooking(this.booking!._id!, payload).subscribe({
      next: () => {
        this.showCancelForm = false;
        this.loadBooking(this.booking!._id!);
      },
      error: (err) => this.toastr.error(err?.error?.message || 'Cancellation failed', 'Error')
    });
  }

`;
  code = code.slice(0, onCancelStart) + replacement + code.slice(onCancelEnd);
}

fs.writeFileSync(file, code);
console.log('Successfully patched component logic.');
