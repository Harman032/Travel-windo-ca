const fs = require('fs');
const file = 'src/app/components/bookings/booking-detail/booking-detail.component.ts';
let code = fs.readFileSync(file, 'utf8');

const startTag = '<div *ngIf="showCancelForm" class="card bg-red-50">';
const endTag = '</form>\n        </div>';

const startIndex = code.indexOf(startTag);
if (startIndex === -1) {
    console.error("Start tag not found");
    process.exit(1);
}

// Find the corresponding endTag
const endIndexStr = code.indexOf(endTag, startIndex);
if (endIndexStr === -1) {
    console.error("End tag not found");
    process.exit(1);
}
const endIndex = endIndexStr + endTag.length;

const newTemplate = `<div *ngIf="showCancelForm" class="card bg-red-50">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-semibold text-red-800">Process Cancellation</h3>
            <span class="px-2 py-1 bg-red-100 text-red-800 rounded text-sm font-medium">Scenario {{ cancellationResult.scenario }}</span>
          </div>
          
          <form [formGroup]="cancelForm" (ngSubmit)="onCancel()">
            <!-- Supplier Charges Breakdown -->
            <div class="col-span-full p-3 bg-white border border-gray-200 shadow-sm rounded mb-4">
              <p class="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Supplier Charges Breakdown (Auto)</p>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <p class="text-xs text-gray-500">Supplier Booking Charge</p>
                  <p class="font-semibold text-gray-800">CAD {{ (booking.supplierBookingCharge ?? 0) | number:'1.2-2' }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">Supplier Updation Charge</p>
                  <p class="font-semibold text-gray-800">CAD {{ (booking.supplierUpdationCharge ?? 0) | number:'1.2-2' }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">Supplier Cancellation Charge</p>
                  <p class="font-semibold text-gray-800">CAD {{ autoSupplierCancellationCharge | number:'1.2-2' }}</p>
                </div>
              </div>
              <div class="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center bg-gray-50 p-2 rounded">
                <span class="text-sm font-medium text-gray-700">Total Supplier Took</span>
                <span class="text-sm font-bold text-red-600">CAD {{ cancellationResult.totalSupplierTook | number:'1.2-2' }}</span>
              </div>
            </div>

            <!-- Mode Toggle -->
            <div class="flex gap-6 mb-4 p-3 bg-white border border-gray-200 rounded">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="modeToggle" value="charges"
                       [(ngModel)]="cancellationMode" [ngModelOptions]="{standalone: true}" (change)="onCancellationModeChange()">
                <span class="text-sm font-medium text-gray-700">Cancellation Charges</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="modeToggle" value="refundAmount"
                       [(ngModel)]="cancellationMode" [ngModelOptions]="{standalone: true}" (change)="onCancellationModeChange()">
                <span class="text-sm font-medium text-gray-700">Refund Amount</span>
              </label>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded border border-gray-200 mb-4">
              <div><label class="block text-xs text-gray-500">Our Margin</label><p class="font-semibold">CAD {{ cancellationResult.ourMargin | number:'1.2-2' }}</p></div>
              <div><label class="block text-xs text-gray-500">Current Margin</label><p class="font-bold text-green-700">CAD {{ cancellationResult.currentMargin | number:'1.2-2' }}</p></div>
              
              <div *ngIf="cancellationMode === 'charges'">
                <label class="block text-sm font-medium text-gray-700 mb-1">Airline Cancellation Charges <span class="text-red-500">*</span></label>
                <input type="number" formControlName="airlineCancellationCharges" class="input" step="0.01" min="0" />
              </div>
              <div *ngIf="cancellationMode === 'refundAmount'">
                <label class="block text-sm font-medium text-gray-700 mb-1">Airline Refund Amount <span class="text-red-500">*</span></label>
                <input type="number" formControlName="airlineRefundAmount" class="input" step="0.01" min="0" />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">New Margin <span class="text-red-500">*</span></label>
                <input type="number" formControlName="newMargin" class="input" step="0.01" min="0" />
              </div>

              <!-- Computed values row 1 -->
              <div><label class="block text-xs text-gray-500">Total Charges</label><p class="font-bold text-red-700">CAD {{ cancellationResult.totalCharges | number:'1.2-2' }}</p></div>
              <div *ngIf="cancellationMode === 'refundAmount'"><label class="block text-xs text-gray-500">Airline Deducted (Auto-Calculated)</label><p class="font-bold text-orange-600">CAD {{ cancellationResult.airlineDeducted | number:'1.2-2' }}</p></div>
              <div *ngIf="cancellationMode === 'charges'"></div>

              <!-- Computed values row 2 -->
              <div><label class="block text-xs text-gray-500">Supplier Will Return</label><p class="font-bold text-blue-700">CAD {{ cancellationResult.supplierWillReturn | number:'1.2-2' }}</p></div>

              <!-- Computed values row 3 -->
              <div *ngIf="cancellationResult.scenario === '3A' || cancellationResult.scenario === '3B' || cancellationResult.scenario === '5A' || cancellationResult.scenario === '5B'">
                <label class="block text-xs text-gray-500">Upfront Needed</label><p class="font-bold text-red-800">CAD {{ cancellationResult.upfrontNeeded | number:'1.2-2' }}</p>
              </div>
              <div *ngIf="!(cancellationResult.scenario === '3A' || cancellationResult.scenario === '3B' || cancellationResult.scenario === '5A' || cancellationResult.scenario === '5B')"></div>

              <div class="col-span-full mt-2 p-3 bg-green-50 border border-green-200 rounded flex justify-between items-center">
                <label class="block text-xs font-medium text-gray-500 mb-1">{{ cancellationResult.scenario === '2A' || cancellationResult.scenario === '2B' ? 'Refund to Client' : 'Refund Committed to Client' }}</label>
                <p class="text-xl font-bold text-green-700">CAD {{ cancellationResult.refundCommittedToClient | number:'1.2-2' }}</p>
              </div>
              
              <div *ngIf="cancellationResult.scenario === '3A' || cancellationResult.scenario === '3B'" class="col-span-full p-2 bg-blue-50 border border-blue-200 rounded flex justify-between items-center">
                <label class="block text-xs font-medium text-gray-500 mb-1">Refundable Amount To Client</label>
                <p class="text-lg font-bold text-blue-700">CAD {{ cancellationResult.refundableAmount | number:'1.2-2' }}</p>
              </div>
            </div>

            <!-- Common Fields -->
            <div class="mt-4 border-t border-red-200 pt-4">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Remarks <span class="text-red-500">*</span></label>
                <textarea formControlName="remarks" class="input" rows="3" required placeholder="Enter reason for cancellation..."></textarea>
              </div>
              <div class="flex justify-end space-x-2">
                <button type="button" (click)="showCancelForm = false" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-danger">Confirm Cancellation</button>
              </div>
            </div>
          </form>
        </div>`;

code = code.slice(0, startIndex) + newTemplate + code.slice(endIndex);
fs.writeFileSync(file, code);
console.log('Template successfully patched with full UI.');
