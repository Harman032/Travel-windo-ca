import re

with open('src/app/components/bookings/booking-detail/booking-detail.component.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add cancellationMode variable to the class
class_def = 'export class BookingDetailComponent implements OnInit {\n'
code = code.replace(class_def, class_def + '  cancellationMode: \'charges\' | \'refundAmount\' = \'charges\';\n')

# 2. Add airlineCancellationCharges and airlineRefundAmount to the cancelForm init
fb_group = '''    this.cancelForm = this.fb.group({
      paymentModeWas: ['', Validators.required],
      refundableAmount: [0],
      committedToClient: [null],
      chargeFromClient: [null],
      cancellationType: ['supplierCancellationCharges'],
      supplierCancellationCharges: [0],
      ourCancellationCharges: [0],
      remarks: ['', Validators.required]
    });'''
fb_group_new = '''    this.cancelForm = this.fb.group({
      paymentModeWas: ['', Validators.required],
      refundableAmount: [0],
      committedToClient: [null],
      chargeFromClient: [null],
      cancellationType: ['supplierCancellationCharges'],
      supplierCancellationCharges: [0],
      ourCancellationCharges: [0],
      airlineCancellationCharges: [0],
      airlineRefundAmount: [0],
      remarks: ['', Validators.required]
    });'''
code = code.replace(fb_group, fb_group_new)

# 3. Add onCancellationModeChange method
method_to_add = '''
  onCancellationModeChange(): void {
    if (this.cancellationMode === 'charges') {
      this.cancelForm.get('airlineCancellationCharges')?.setValidators([Validators.required, Validators.min(0)]);
      this.cancelForm.get('airlineRefundAmount')?.clearValidators();
      this.cancelForm.patchValue({ airlineRefundAmount: 0 });
    } else {
      this.cancelForm.get('airlineRefundAmount')?.setValidators([Validators.required, Validators.min(0)]);
      this.cancelForm.get('airlineCancellationCharges')?.clearValidators();
      this.cancelForm.patchValue({ airlineCancellationCharges: 0 });
    }
    this.cancelForm.get('airlineCancellationCharges')?.updateValueAndValidity();
    this.cancelForm.get('airlineRefundAmount')?.updateValueAndValidity();
  }
'''
code = code.replace('openCancelForm(): void {\n', method_to_add + '\n  openCancelForm(): void {\n    this.cancellationMode = \'charges\';\n    this.onCancellationModeChange();\n')

# 4. Update cancellationResult to use the new fields for card scenarios
cancellation_result_start = '''  get cancellationResult(): any {
    if (!this.booking) return {};

    const salePrice = this.baseSalePrice;
    const ourCost = this.baseOurCost;
    const supplierCharges = this.booking.supplierCharges || 0;
    const totalPaidAmount = this.booking.totalPaidAmount || 0;
    const paymentFromCard = this.booking.paymentFromCard || 0;
    const supplierBookingCharge = this.booking.supplierBookingCharge || 0;
    const supplierUpdationCharge = this.booking.supplierUpdationCharge || 0;
    const autoSupplierCancellationCharge = this.autoSupplierCancellationCharge || 0;

    const scc = Number(this.cancelForm?.get('supplierCancellationCharges')?.value || 0);
    const occ = Number(this.cancelForm?.get('ourCancellationCharges')?.value || 0);
    const chargeFromClient = Number(this.cancelForm?.get('chargeFromClient')?.value || 0);

    const cancellationType = this.cancelForm?.get('cancellationType')?.value || '';'''

cancellation_result_new = '''  get cancellationResult(): any {
    if (!this.booking) return {};

    const salePrice = this.baseSalePrice;
    const ourCost = this.baseOurCost;
    const supplierCharges = this.booking.supplierCharges || 0;
    const totalPaidAmount = this.booking.totalPaidAmount || 0;
    const paymentFromCard = this.booking.paymentFromCard || 0;
    const supplierBookingCharge = this.booking.supplierBookingCharge || 0;
    const supplierUpdationCharge = this.booking.supplierUpdationCharge || 0;
    const autoSupplierCancellationCharge = this.autoSupplierCancellationCharge || 0;

    const mode = this.cancellationMode;
    const acc = Number(this.cancelForm?.get('airlineCancellationCharges')?.value || 0);
    const ara = Number(this.cancelForm?.get('airlineRefundAmount')?.value || 0);
    
    const scc_base = Number(this.cancelForm?.get('supplierCancellationCharges')?.value || 0);
    let scc = scc_base;
    let cancellationType = this.cancelForm?.get('cancellationType')?.value || '';
    
    const isCardMode = this.isClientOrCompanyCard || this.isPartialPaidCard || this.isClientCardPartialPayment;
    if (isCardMode && !this.isMachineChargeOnly) {
      scc = mode === 'charges' ? acc : ara;
      if (mode === 'refundAmount') {
         if (cancellationType === 'clientCard') cancellationType = 'clientCardRefundAmount';
         if (cancellationType === 'companyCard') cancellationType = 'companyCardRefundAmount';
         if (cancellationType === 'partialPaidClientCard') cancellationType = 'partialPaidClientCardRefundAmount';
      }
    }

    const occ = Number(this.cancelForm?.get('ourCancellationCharges')?.value || 0);
    const chargeFromClient = Number(this.cancelForm?.get('chargeFromClient')?.value || 0);
'''
code = code.replace(cancellation_result_start, cancellation_result_new)

# 5. Modify HTML template for cards
html_radio = '''
              <div class="flex gap-6 mb-4 mt-4 border-b border-gray-200 pb-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="cancellationMode" value="charges" [(ngModel)]="cancellationMode" [ngModelOptions]="{standalone: true}" (change)="onCancellationModeChange()" class="h-4 w-4 accent-red-600">
                  <span class="text-sm font-medium text-gray-700">Airline Cancellation Charges</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="cancellationMode" value="refundAmount" [(ngModel)]="cancellationMode" [ngModelOptions]="{standalone: true}" (change)="onCancellationModeChange()" class="h-4 w-4 accent-red-600">
                  <span class="text-sm font-medium text-gray-700">Airline Refund Amount</span>
                </label>
              </div>
'''

html_inputs = '''
                  <div *ngIf="cancellationMode === 'charges'">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Airline Cancellation Charges <span class="text-red-500">*</span></label>
                    <input type="number" formControlName="airlineCancellationCharges" class="input" step="0.01" min="0" />
                  </div>
                  <div *ngIf="cancellationMode === 'refundAmount'">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Airline Refund Amount <span class="text-red-500">*</span></label>
                    <input type="number" formControlName="airlineRefundAmount" class="input" step="0.01" min="0" />
                  </div>
'''

old_input = '''                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Supplier Cancellation Charges <span class="text-red-500">*</span></label>
                    <input type="number" formControlName="supplierCancellationCharges" class="input" step="0.01" min="0" />
                  </div>'''


# Client Card Partial Payment
# 1. clientCardPartialPayment
target_1 = '            <ng-container *ngIf="isClientCardPartialPayment && !isMachineChargeOnly">\n              <div class="mb-4">'
code = code.replace(target_1, target_1 + html_radio)

# 2. Fully Paid Card flow
target_2 = '            <ng-container *ngIf="isClientOrCompanyCard && !isMachineChargeOnly">\n              <div class="mb-4">'
code = code.replace(target_2, target_2 + html_radio)

# 3. Partial Paid Card flow
target_3 = '            <ng-container *ngIf="isPartialPaidCard && !isMachineChargeOnly">\n              <div class="mb-4">'
code = code.replace(target_3, target_3 + html_radio)

parts = code.split('<!-- 6. Regular Fully Paid flow (Non-Card) -->')
parts_before = parts[0].replace(old_input, html_inputs)
code = parts_before + '<!-- 6. Regular Fully Paid flow (Non-Card) -->' + parts[1]

# 6. Add "Airline Deducted" row if in refund amount mode.
airline_deducted_div = '''
                      <div *ngIf="cancellationMode === 'refundAmount'">
                        <label class="block text-sm text-gray-600">Airline Deducted</label>
                        <p class="text-lg font-bold text-orange-600">{{ cancellationResult.airlineDeducted | number:'1.2-2' }}</p>
                      </div>'''

# Replace "Total Charges" with "Total Charges + Airline Deducted" in the Card blocks.
code = code.replace('''<div><label class="block text-sm text-gray-600">Total Charges</label><p class="text-lg font-bold text-red-700">{{ clientCardPartialTotalCharges | number:'1.2-2' }}</p></div>''', '''<div><label class="block text-sm text-gray-600">Total Charges</label><p class="text-lg font-bold text-red-700">{{ clientCardPartialTotalCharges | number:'1.2-2' }}</p></div>''' + airline_deducted_div)

code = code.replace('''<div><label class="block text-sm text-gray-600">Total Charges</label><p class="text-lg font-bold text-red-700">{{ cancelTotalCharges | number:'1.2-2' }}</p></div>''', '''<div><label class="block text-sm text-gray-600">Total Charges</label><p class="text-lg font-bold text-red-700">{{ cancelTotalCharges | number:'1.2-2' }}</p></div>''' + airline_deducted_div)

code = code.replace('''<div><label class="block text-sm text-gray-600">Total Charges</label><p class="text-lg font-bold text-red-700">{{ partialPaidCardTotalCharges | number:'1.2-2' }}</p></div>''', '''<div><label class="block text-sm text-gray-600">Total Charges</label><p class="text-lg font-bold text-red-700">{{ partialPaidCardTotalCharges | number:'1.2-2' }}</p></div>''' + airline_deducted_div)

with open('src/app/components/bookings/booking-detail/booking-detail.component.ts', 'w', encoding='utf-8') as f:
    f.write(code)
