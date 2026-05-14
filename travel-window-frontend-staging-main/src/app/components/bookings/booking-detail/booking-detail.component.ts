import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule, FormArray } from '@angular/forms';
import { BookingService, Booking } from '../../../services/booking.service';
import { AuthService } from '../../../services/auth.service';
import { UserService, User } from '../../../services/user.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-booking-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  template: `
    <div class="max-w-7xl mx-auto">
      <div class="page-title-card flex justify-between items-center">
        <h2 class="page-title">Booking Details</h2>
        <button [routerLink]="['/dashboard/bookings']" class="btn-on-gradient">Back to List</button>
      </div>

      <div *ngIf="loading" class="space-y-6">
        <div class="card animate-pulse">
          <div class="skeleton-line w-48 h-6 mb-4"></div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div *ngFor="let i of [1,2,3,4,5,6]" class="space-y-1">
              <div class="skeleton-line w-24 h-3"></div>
              <div class="skeleton-line w-32 h-4"></div>
            </div>
          </div>
        </div>
        <div class="card animate-pulse">
          <div class="skeleton-line w-40 h-5 mb-4"></div>
          <div class="flex flex-wrap gap-2">
            <div class="skeleton-line w-24 h-8 rounded"></div>
            <div class="skeleton-line w-28 h-8 rounded"></div>
            <div class="skeleton-line w-32 h-8 rounded"></div>
          </div>
        </div>
      </div>

      <div *ngIf="loadError && !loading" class="card text-center py-10">
        <p class="text-gray-600 font-medium">{{ loadError }}</p>
        <a [routerLink]="['/dashboard/bookings']" class="btn btn-primary mt-4 inline-block">Back to List</a>
      </div>

      <div *ngIf="booking && !loading" class="space-y-6">
        <!-- Booking Information -->
        <div class="card">
          <h3 class="text-xl font-semibold mb-4 text-gray-700">Booking Information</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">PNR</label>
              <p class="text-gray-900 font-medium">{{ booking.pnr }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Passenger Name</label>
              <p class="text-gray-900">{{ booking.paxName }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Contact Number</label>
              <p class="text-gray-900">{{ booking.contactNumber }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Contact Person</label>
              <p class="text-gray-900">{{ booking.contactPerson || 'N/A' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Status</label>
              <span class="badge" [ngClass]="getStatusClass(getDisplayStatus())">
                {{ getDisplayStatus() }}
              </span>
            </div>
            <div *ngIf="canShowAccountVerified()">
              <label class="block text-sm font-medium text-gray-500 mb-1">Account Verified</label>
              <span [ngClass]="booking.verifiedByAccount ? 'text-green-600 font-medium' : 'text-gray-500'">{{ booking.verifiedByAccount ? 'Verified' : 'Not Verified' }}</span>
            </div>
            <div *ngIf="canShowAdminVerified()">
              <label class="block text-sm font-medium text-gray-500 mb-1">Admin Verified</label>
              <span [ngClass]="booking.verifiedByAdmin ? 'text-green-600 font-medium' : 'text-gray-500'">{{ booking.verifiedByAdmin ? 'Verified' : 'Not Verified' }}</span>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Our Margin</label>
              <p class="text-gray-900 font-medium text-green-600">CAD {{ ((booking?.salePrice || 0) - (booking?.ourCost || 0) - (booking?.supplierCharges || 0)) | number:'1.2-2' }}</p>
            </div>
            <div *ngIf="booking.status === 'Cancelled' && booking.cancellation && booking.cancellation.ourCancellationCharges !== undefined">
              <label class="block text-sm font-medium text-gray-500 mb-1">New Margin</label>
              <p class="text-gray-900 font-medium text-red-600">CAD {{ booking.cancellation.ourCancellationCharges | number:'1.2-2' }}</p>
            </div>
            <div *ngIf="booking.status === 'Cancelled' && booking.cancellation">
              <label class="block text-sm font-medium text-gray-500 mb-1">Current Margin After Cancellation</label>
              <p class="text-gray-900 font-medium text-green-600">CAD {{ booking.cancellation.newMargin | number:'1.2-2' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Date of Submission</label>
              <p class="text-gray-900">{{ booking.dateOfSubmission | date:'dd-MM-yyyy HH:mm' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Submitted By</label>
              <p class="text-gray-900">{{ booking.submittedByName }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Assigned To</label>
              <p class="text-gray-900">{{ getAssignedToDisplay() }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Supplier</label>
              <p class="text-gray-900">{{ booking.supplierName || 'N/A' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Sector Type</label>
              <p class="text-gray-900">{{ booking.sectorType }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Travel Date</label>
              <p class="text-gray-900">{{ booking.travelDate | date:'dd-MM-yyyy' }}</p>
            </div>
            <div *ngIf="booking.returnDate">
              <label class="block text-sm font-medium text-gray-500 mb-1">Return Date</label>
              <p class="text-gray-900">{{ booking.returnDate | date:'dd-MM-yyyy' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Route</label>
              <p class="text-gray-900">{{ booking.from }} → {{ booking.to }}</p>
            </div>
            <div *ngIf="booking.airline">
              <label class="block text-sm font-medium text-gray-500 mb-1">Airline</label>
              <p class="text-gray-900">{{ booking.airline }}</p>
            </div>

            <!-- Admin: Change Status Section -->
            <div *ngIf="isAdmin() || isAccount()" class="col-span-full mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <label class="block text-sm font-medium text-gray-700 mb-2">Change Status</label>
              <div class="flex flex-wrap items-center gap-2">
                <select [(ngModel)]="selectedStatus" [ngModelOptions]="{standalone: true}" class="input max-w-xs h-9 text-sm py-1">
                  <option value="Pending Verification">Pending Verification</option>
                  <option value="Ticketed">Ticketed</option>
                  <option value="Unticketed">Unticketed</option>
                </select>
                <button type="button" (click)="updateStatus()" class="btn btn-primary py-1 px-4 h-9">
                  Update Status
                </button>
              </div>
            </div>
            <!-- Cost breakdown: Base + Date Change + Flight Change charges (refund not applicable on add-on charges) -->
            <div class="col-span-full mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 class="text-sm font-semibold text-gray-700 mb-3">Cost Breakdown</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <p class="text-xs font-medium text-gray-500 uppercase">Our Cost</p>
                  <div class="text-sm">
                    <div *ngIf="(booking?.supplierCharges || 0) > 0" class="flex justify-between text-yellow-700 mb-1"><span>Supplier Charges</span><span>{{ booking?.supplierCharges | number:'1.2-2' }}</span></div>
                    <div class="flex justify-between"><span class="text-gray-600">Base (booking)</span><span>{{ baseOurCost | number:'1.2-2' }}</span></div>
                    <div *ngIf="dateChangeOurAddon > 0" class="flex justify-between text-blue-700"><span>Date Change charges</span><span>{{ dateChangeOurAddon | number:'1.2-2' }}</span></div>
                    <div *ngIf="flightChangeOurAddon > 0" class="flex justify-between text-indigo-700"><span>Flight Change charges</span><span>{{ flightChangeOurAddon | number:'1.2-2' }}</span></div>
                    <div class="flex justify-between font-semibold pt-1 border-t border-gray-200"><span>Total Our Cost</span><span>{{ booking.ourCost | number:'1.2-2' }}</span></div>
                  </div>
                </div>
                <div class="space-y-2">
                  <p class="text-xs font-medium text-gray-500 uppercase">Sale Price</p>
                  <div class="text-sm">
                    <div class="flex justify-between"><span class="text-gray-600">Base (booking)</span><span>{{ baseSalePrice | number:'1.2-2' }}</span></div>
                    <div *ngIf="dateChangeSaleAddon > 0" class="flex justify-between text-blue-700"><span>Date Change charges</span><span>{{ dateChangeSaleAddon | number:'1.2-2' }}</span></div>
                    <div *ngIf="flightChangeSaleAddon > 0" class="flex justify-between text-indigo-700"><span>Flight Change charges</span><span>{{ flightChangeSaleAddon | number:'1.2-2' }}</span></div>
                    <div class="flex justify-between font-semibold pt-1 border-t border-gray-200"><span>Total Sale Price</span><span>{{ booking.salePrice | number:'1.2-2' }}</span></div>
                  </div>
                </div>
              </div>
              <p class="text-xs text-gray-500 mt-2">Date Change &amp; Flight Change charges are separate; refund does not apply on these add-on charges.</p>
            </div>
            <div *ngIf="booking.additionalService">
              <label class="block text-sm font-medium text-gray-500 mb-1">Additional Service</label>
              <p class="text-gray-900">{{ booking.additionalService }} ({{ booking.additionalServicePrice | number:'1.2-2' }})</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Total Sale Price</label>
              <p class="text-gray-900 font-semibold">{{ booking.totalSalePrice | number:'1.2-2' }}</p>
            </div>
            <div *ngIf="canSeePaymentInfo()">
              <label class="block text-sm font-medium text-gray-500 mb-1">Total Paid</label>
              <p class="text-gray-900">{{ booking.totalPaidAmount | number:'1.2-2' }}</p>
            </div>
            <div *ngIf="canSeePaymentInfo()">
              <label class="block text-sm font-medium text-gray-500 mb-1">Balance Amount</label>
              <p class="text-gray-900 font-semibold" [ngClass]="{'text-red-600': (booking.balanceAmount || 0) > 0}">
                {{ (booking.balanceAmount || 0) | number:'1.2-2' }}
              </p>
            </div>
            <div *ngIf="canSeePaymentInfo()">
              <label class="block text-sm font-medium text-gray-500 mb-1">Billing Status</label>
              <span class="badge" [ngClass]="getBillingStatusClass(booking.billingStatus || 'Unpaid')">
                {{ booking.billingStatus || 'Unpaid' }}
              </span>
            </div>
            <div *ngIf="booking.note" class="col-span-full">
              <label class="block text-sm font-medium text-gray-500 mb-1">Note</label>
              <p class="text-gray-900">{{ booking.note }}</p>
            </div>
          </div>

          <!-- Multiple Sectors -->
          <div *ngIf="booking.multipleSectors && booking.multipleSectors.length > 0" class="mt-4">
            <h4 class="text-lg font-semibold mb-2">Multiple Sectors</h4>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Travel Date</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr *ngFor="let sector of booking.multipleSectors">
                    <td class="px-4 py-2 text-sm">{{ sector.travelDate | date:'dd-MM-yyyy' }}</td>
                    <td class="px-4 py-2 text-sm">{{ sector.from }}</td>
                    <td class="px-4 py-2 text-sm">{{ sector.to }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Payments: only Account & Admin can see/manage -->
          <div *ngIf="canSeePaymentInfo() && booking.payments && booking.payments.length > 0" class="mt-4">
            <h4 class="text-lg font-semibold mb-2">Payment History</h4>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr *ngFor="let payment of booking.payments">
                    <td class="px-4 py-2 text-sm">{{ payment.paymentDate | date:'dd-MM-yyyy' }}</td>
                    <td class="px-4 py-2 text-sm">{{ payment.paidAmount | number:'1.2-2' }}</td>
                    <td class="px-4 py-2 text-sm">
                      {{ payment.paymentMode }}
                      <span *ngIf="payment.paymentMode === 'Direct Paid to Supplier'" 
                            class="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded ml-1 font-medium">
                        Direct to Supplier
                      </span>
                    </td>
                    <td class="px-4 py-2 text-sm">{{ payment.referenceNo || 'N/A' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Card Payment Details -->
            <div *ngIf="(booking.paymentFromCard && booking.paymentFromCard > 0) || booking.cardType" class="mt-4 pt-4 border-t border-gray-200">
              <h5 class="text-md font-medium text-gray-700 mb-2">Card Payment Details</h5>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div *ngIf="booking.paymentFromCard && booking.paymentFromCard > 0">
                  <label class="block text-sm font-medium text-gray-500 mb-1">Payment From Card</label>
                  <p class="text-gray-900 font-medium">CAD {{ booking.paymentFromCard | number:'1.2-2' }}</p>
                </div>
                <div *ngIf="booking.cardType">
                  <label class="block text-sm font-medium text-gray-500 mb-1">Card Type</label>
                  <p class="text-gray-900 font-medium">{{ booking.cardType }}</p>
                </div>
                <div *ngIf="booking.cardLast4Digits">
                  <label class="block text-sm font-medium text-gray-500 mb-1">Card Last 4 Digits</label>
                  <p class="text-gray-900 font-medium">{{ booking.cardLast4Digits }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Assign (Account → Agent1/Agent2; Agent2 → Agent1; Admin → Agent1/Agent2/Account) -->
        <div *ngIf="canAssign()" class="card">
          <h3 class="text-xl font-semibold mb-4 text-gray-700">Assign</h3>
          <p class="text-sm text-gray-600 mb-3">Assign this booking to another user with an optional comment.</p>
          <div class="flex flex-wrap items-end gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Assign to</label>
              <select [(ngModel)]="assignToUserId" class="input" [ngModelOptions]="{standalone: true}">
                <option value="">Select user</option>
                <option *ngFor="let u of assignableUsers" [value]="u._id">{{ u.name }} ({{ u.role }})</option>
              </select>
            </div>
            <div class="flex-1 min-w-[200px]">
              <label class="block text-sm font-medium text-gray-700 mb-1">Comment (optional)</label>
              <input type="text" [(ngModel)]="assignComment" placeholder="e.g. Please finalise ticket" class="input w-full" [ngModelOptions]="{standalone: true}" />
            </div>
            <button type="button" (click)="onAssign()" class="btn btn-primary" [disabled]="!assignToUserId || assigning">
              {{ assigning ? 'Assigning...' : 'Assign' }}
            </button>
          </div>
        </div>

        <!-- Cancellation Details -->
        <div *ngIf="booking.cancellation && booking.cancellation.isCancelled" class="card bg-red-50">
          <h3 class="text-xl font-semibold mb-4 text-red-700">Cancellation Details</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Payment Mode Was</label>
              <p class="text-gray-900">{{ booking.cancellation.paymentModeWas }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Total Amount Paid</label>
              <p class="text-gray-900">{{ booking.cancellation.totalAmountPaidByClient | number:'1.2-2' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Refundable Amount</label>
              <p class="text-gray-900">{{ booking.cancellation.refundableAmount | number:'1.2-2' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Old Margin</label>
              <p class="text-gray-900">{{ booking.cancellation.oldMargin | number:'1.2-2' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Current Margin</label>
              <p class="text-gray-900">{{ booking.cancellation.newMargin | number:'1.2-2' }}</p>
            </div>
            <div *ngIf="booking.cancellation.paymentModeWas !== 'Credit Card'">
              <label class="block text-sm font-medium text-gray-500 mb-1">Committed to Client</label>
              <p class="text-gray-900">{{ booking.cancellation.committedToClient | number:'1.2-2' }}</p>
            </div>
            <div *ngIf="booking.cancellation.paymentModeWas === 'Credit Card'">
              <label class="block text-sm font-medium text-gray-500 mb-1">Charge from Client</label>
              <p class="text-gray-900">{{ booking.cancellation.chargeFromClient | number:'1.2-2' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Refund Processed</label>
              <span class="badge" [ngClass]="booking.cancellation.refundProcessed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'">
                {{ booking.cancellation.refundProcessed ? 'Yes' : 'No' }}
              </span>
            </div>
            <!-- Conditional Supplier Cancellation Fields -->
            <div *ngIf="booking.cancellation.cancellationType === 'supplierCancellationCharges'">
              <label class="block text-sm font-medium text-gray-500 mb-1">Supplier Cancellation Charges</label>
              <p class="text-gray-900 font-medium">CAD {{ booking.cancellation.supplierCancellationCharges | number:'1.2-2' }}</p>
            </div>
            <div *ngIf="booking.cancellation.cancellationType === 'supplierRefundAmount'">
              <label class="block text-sm font-medium text-gray-500 mb-1">Supplier Refund Amount</label>
              <p class="text-gray-900 font-medium">CAD {{ booking.cancellation.supplierRefundAmount | number:'1.2-2' }}</p>
            </div>
            <div *ngIf="booking.cancellation.cancellationType === 'supplierRefundAmount'">
              <label class="block text-sm font-medium text-gray-500 mb-1">Supplier Deducted</label>
              <p class="text-gray-900 font-medium">CAD {{ (booking.cancellation.supplierDeducted || 0) | number:'1.2-2' }}</p>
            </div>
            
            <!-- Card Cancellation Fields -->
            <ng-container *ngIf="booking.cancellation.cancellationType === 'clientCard' || booking.cancellation.cancellationType === 'companyCard'">
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">Total Supplier Took</label>
                <p class="text-gray-900 font-medium text-orange-600">CAD {{ (booking.cancellation.totalSupplierTook || 0) | number:'1.2-2' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">New Margin</label>
                <p class="text-gray-900 font-medium text-red-600">CAD {{ (booking.cancellation.ourCancellationCharges || 0) | number:'1.2-2' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">Total Charges</label>
                <p class="text-gray-900 font-bold text-red-700">CAD {{ (booking.cancellation.totalCharges || 0) | number:'1.2-2' }}</p>
              </div>
              <div *ngIf="booking.cancellation.cancellationType === 'companyCard'">
                <label class="block text-sm font-medium text-gray-500 mb-1">Client Receives</label>
                <p class="text-gray-900 font-bold text-green-600">CAD {{ (booking.cancellation.clientReceives || 0) | number:'1.2-2' }}</p>
              </div>
              <div *ngIf="booking.cancellation.cancellationType === 'clientCard' && booking.cancellation.newMargin">
                <label class="block text-sm font-medium text-gray-500 mb-1">Current Margin After Cancellation</label>
                <p class="text-gray-900 font-bold text-green-700">CAD {{ (booking.cancellation.newMargin || 0) | number:'1.2-2' }}</p>
              </div>
            </ng-container>

            <!-- Partial Paid Cancellation Fields -->
            <ng-container *ngIf="booking.cancellation.cancellationType === 'partialPaidCancellationCharges' || booking.cancellation.cancellationType === 'partialPaidRefundAmount'">
              <div *ngIf="booking.cancellation.cancellationType === 'partialPaidCancellationCharges'">
                <label class="block text-sm font-medium text-gray-500 mb-1">Total Charges</label>
                <p class="text-gray-900 font-bold text-red-700">CAD {{ (booking.cancellation.totalCharges || 0) | number:'1.2-2' }}</p>
              </div>
              <div *ngIf="booking.cancellation.cancellationType === 'partialPaidRefundAmount'">
                <label class="block text-sm font-medium text-gray-500 mb-1">Supplier Refund Amount</label>
                <p class="text-gray-900 font-medium">CAD {{ (booking.cancellation.supplierRefundAmount || 0) | number:'1.2-2' }}</p>
              </div>
              <div *ngIf="booking.cancellation.cancellationType === 'partialPaidRefundAmount'">
                <label class="block text-sm font-medium text-gray-500 mb-1">Supplier Deducted</label>
                <p class="text-gray-900 font-bold text-red-700">CAD {{ (booking.cancellation.supplierDeducted || 0) | number:'1.2-2' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">New Margin</label>
                <p class="text-gray-900 font-medium text-red-600">CAD {{ (booking.cancellation.ourCancellationCharges || 0) | number:'1.2-2' }}</p>
              </div>
              <div *ngIf="booking.cancellation.cancellationType === 'partialPaidCancellationCharges'">
                <label class="block text-sm font-medium text-gray-500 mb-1">Supplier Cancellation Charges</label>
                <p class="text-gray-900 font-medium text-orange-600">CAD {{ (booking.cancellation.supplierCancellationCharges || 0) | number:'1.2-2' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">Refund to Client</label>
                <p class="text-gray-900 font-bold text-green-600">CAD {{ (booking.cancellation.refundToClient || 0) | number:'1.2-2' }}</p>
              </div>
              <div *ngIf="booking.cancellation.newMargin">
                <label class="block text-sm font-medium text-gray-500 mb-1">Current Margin After Cancellation</label>
                <p class="text-gray-900 font-bold text-green-700">CAD {{ (booking.cancellation.newMargin || 0) | number:'1.2-2' }}</p>
              </div>
            </ng-container>

            <!-- Partial Paid Card Cancellation Fields -->
            <ng-container *ngIf="booking.cancellation.cancellationType === 'partialPaidClientCard' || booking.cancellation.cancellationType === 'partialPaidCompanyCard'">
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">Refundable Amount</label>
                <p class="text-gray-900 font-bold">CAD {{ (booking.cancellation.refundableAmount ?? booking.cancellation.refundableAmountToClient ?? 0) | number:'1.2-2' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">Committed to Client</label>
                <p class="text-gray-900 font-bold text-orange-700">CAD {{ (booking.cancellation.refundCommittedToClient ?? 0) | number:'1.2-2' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">Total Supplier Took</label>
                <p class="text-gray-900 font-medium text-orange-600">CAD {{ (booking.cancellation.totalSupplierTook ?? 0) | number:'1.2-2' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">Current Margin After Cancellation</label>
                <p class="text-gray-900 font-bold text-green-700">CAD {{ (booking.cancellation.newMargin ?? 0) | number:'1.2-2' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">Total Charges</label>
                <p class="text-gray-900 font-bold text-red-700">CAD {{ (booking.cancellation.totalCharges ?? 0) | number:'1.2-2' }}</p>
              </div>
              <div *ngIf="booking.cancellation.cancellationType === 'partialPaidClientCard'">
                <label class="block text-sm font-medium text-gray-500 mb-1">Upfront Needed from Client</label>
                <p class="text-gray-900 font-bold text-red-600">CAD {{ (booking.cancellation.upfrontNeeded ?? 0) | number:'1.2-2' }}</p>
              </div>
              <div *ngIf="booking.cancellation.cancellationType === 'partialPaidClientCard'">
                <label class="block text-sm font-medium text-gray-500 mb-1">Client Receives</label>
                <p class="text-gray-900 font-bold text-green-600">CAD {{ (booking.cancellation.clientReceives ?? 0) | number:'1.2-2' }}</p>
              </div>
              <div *ngIf="booking.cancellation.cancellationType === 'partialPaidCompanyCard'">
                <label class="block text-sm font-medium text-gray-500 mb-1">Client Receives</label>
                <p class="text-gray-900 font-bold text-green-600">CAD {{ (booking.cancellation.clientReceives ?? 0) | number:'1.2-2' }}</p>
              </div>
            </ng-container>
            <!-- Client Card Partial Payment Cancellation Fields -->
            <ng-container *ngIf="booking.cancellation.cancellationType === 'clientCardPartialPayment'">
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">
                  Supplier Cancellation Charges
                </label>
                <p class="text-gray-900 font-medium text-red-600">
                  CAD {{ (booking.cancellation.supplierCancellationCharges ?? 0) | number:'1.2-2' }}
                </p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">Total Supplier Took</label>
                <p class="text-gray-900 font-medium text-orange-600">CAD {{ (booking.cancellation.totalSupplierTook ?? 0) | number:'1.2-2' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">Current Margin</label>
                <p class="text-gray-900 font-bold text-green-700">CAD {{ (booking.cancellation.newMargin ?? 0) | number:'1.2-2' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">Total Charges</label>
                <p class="text-gray-900 font-bold text-red-700">CAD {{ (booking.cancellation.totalCharges ?? 0) | number:'1.2-2' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">Non-Card Payment</label>
                <p class="text-gray-900 font-medium text-gray-700">CAD {{ (booking.cancellation.remainingAmount ?? 0) | number:'1.2-2' }}</p>
              </div>
              <div *ngIf="(booking.cancellation.upfrontNeeded || 0) > 0">
                <label class="block text-sm font-medium text-gray-500 mb-1">Upfront Needed</label>
                <p class="text-gray-900 font-bold text-red-600">CAD {{ booking.cancellation.upfrontNeeded | number:'1.2-2' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1">Client Receives</label>
                <p class="text-gray-900 font-bold text-green-600">CAD {{ (booking.cancellation.clientReceives ?? 0) | number:'1.2-2' }}</p>
              </div>
            </ng-container>
            <div class="col-span-full">
              <label class="block text-sm font-medium text-gray-500 mb-1">Remarks</label>
              <p class="text-gray-900">{{ booking.cancellation.remarks }}</p>
            </div>
            <div *ngIf="isAdmin()" class="col-span-full mt-4 pt-4 border-t border-red-200 flex space-x-2">
              <button type="button" (click)="revertCancellation()" class="btn btn-primary">
                Revert to active (admin)
              </button>
              <button *ngIf="booking.status === 'Cancelled'" type="button" (click)="recalculateCancellation()" class="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm font-medium">
                Recalculate Cancellation Values
              </button>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="card" *ngIf="!booking.cancellation || !booking.cancellation.isCancelled">
          <h3 class="text-xl font-semibold mb-4 text-gray-700">Actions</h3>
          <div class="flex flex-wrap gap-2">
            <button 
              *ngIf="isAdmin() || isAccount()" 
              (click)="verifyBooking()" 
              class="btn btn-primary"
              [disabled]="isVerified()"
            >
              {{ isVerified() ? 'Verified ✓' : 'Verify' }}
            </button>
            <button 
              *ngIf="canEdit()" 
              [routerLink]="['/dashboard/bookings', booking._id, 'edit']" 
              class="btn btn-secondary"
            >
              Edit
            </button>
            <button 
              *ngIf="canDateChange()" 
              (click)="openDateChangeOnly()" 
              class="btn btn-secondary"
              [class.ring-2]="showDateChangeForm"
              [class.ring-[#0096D2]]="showDateChangeForm"
            >
              Date Change
            </button>
            <button 
              *ngIf="canFlightChange()" 
              (click)="openFlightChangeOnly()" 
              class="btn btn-secondary"
              [class.ring-2]="showFlightChangeForm"
              [class.ring-[#0096D2]]="showFlightChangeForm"
            >
              Flight Change
            </button>
            <button 
              *ngIf="canCancel()" 
              (click)="openCancelFormOnly()" 
              class="btn btn-danger"
              [class.ring-2]="showCancelForm"
              [class.ring-red-500]="showCancelForm"
            >
              Cancel Booking
            </button>
            <button 
              *ngIf="canProcessRefund()" 
              (click)="processRefund()" 
              class="btn btn-primary"
            >
              Process Refund
            </button>
          </div>
        </div>

        <!-- Date Change Form: Old dates not editable; two checkboxes only if date not past; Our Cost / Sale Price (add-on); Payment rows; Remarks mandatory -->
        <div *ngIf="showDateChangeForm" class="card bg-blue-50">
          <h3 class="text-xl font-semibold mb-4 text-gray-700">Date Change</h3>
          <!-- Old Travel & Return Date – not editable -->
          <div class="mb-4 p-3 bg-gray-100 rounded border border-gray-200">
            <p class="text-sm font-medium text-gray-600 mb-1">Old Travel Date &amp; Old Return Date (not editable)</p>
            <p class="text-gray-900">
              <span class="font-semibold">Travel:</span> {{ booking.travelDate | date:'dd-MM-yyyy' }}
              <span class="mx-2">|</span>
              <span class="font-semibold">Return:</span> {{ booking.returnDate ? (booking.returnDate | date:'dd-MM-yyyy') : 'N/A' }}
            </p>
          </div>
          <!-- Original (read-only) -->
          <div class="grid grid-cols-2 md:grid-cols-2 gap-4 mb-4 p-3 bg-white rounded border">
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Original Our Booking Price</label>
              <p class="font-semibold text-gray-900">{{ booking.ourCost | number:'1.2-2' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Original Sale Booking Price</label>
              <p class="font-semibold text-gray-900">{{ booking.salePrice | number:'1.2-2' }}</p>
            </div>
          </div>
          <form [formGroup]="dateChangeForm" (ngSubmit)="onDateChange()">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Editable: Our Cost, Sale Price (add-on) -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Now Date Change Our Cost</label>
                <input type="number" formControlName="newOurCost" class="input" step="0.01" placeholder="Add-on amount" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Now Date Change Sale Cost</label>
                <input type="number" formControlName="newSalePrice" class="input" step="0.01" placeholder="Add-on amount" />
              </div>
              <!-- Change Travel/Return Date – allowed even if current travel or return date is past -->
              <div class="flex items-center">
                <input type="checkbox" formControlName="changeTravelDate" id="changeTravelDate" class="mr-2 h-4 w-4 rounded border-gray-300 accent-button focus:ring-2 focus:ring-button focus:ring-offset-0" />
                <label for="changeTravelDate" class="text-sm font-medium text-gray-700">Change Travel Date</label>
              </div>
              <div class="flex items-center" *ngIf="booking?.returnDate">
                <input type="checkbox" formControlName="changeReturnDate" id="changeReturnDate" class="mr-2 h-4 w-4 rounded border-gray-300 accent-button focus:ring-2 focus:ring-button focus:ring-offset-0" />
                <label for="changeReturnDate" class="text-sm font-medium text-gray-700">Change Return Date</label>
              </div>
              <div *ngIf="dateChangeForm.get('changeTravelDate')?.value">
                <label class="block text-sm font-medium text-gray-700 mb-1">New Travel Date</label>
                <input type="date" formControlName="newTravelDate" class="input" [min]="minDateChangeTravelDate" />
              </div>
              <div *ngIf="dateChangeForm.get('changeReturnDate')?.value">
                <label class="block text-sm font-medium text-gray-700 mb-1">New Return Date</label>
                <input type="date" formControlName="newReturnDate" class="input" [min]="minDateChangeReturnDate" />
              </div>
              <!-- Payment – Add Payment button (multiple rows) -->
              <div class="col-span-full">
                <label class="block text-sm font-medium text-gray-700 mb-2">Payment</label>
                <button type="button" (click)="addDateChangePayment()" class="btn btn-secondary mb-2">Add Payment</button>
                <div formArrayName="payments" class="space-y-3">
                  <div *ngFor="let p of dateChangePaymentsArray.controls; let i = index" [formGroupName]="i" class="flex flex-wrap items-end gap-3 p-3 bg-white rounded border">
                    <div><label class="block text-xs text-gray-600 mb-1">Paid Amount</label><input type="number" formControlName="paidAmount" class="input" step="0.01" /></div>
                    <div><label class="block text-xs text-gray-600 mb-1">Payment Mode</label><select formControlName="paymentMode" class="input"><option value="Cash">Cash</option><option value="Credit Card">Credit Card</option><option value="UPI">UPI</option><option value="E-Transfer">E-Transfer</option><option value="Machine Charge">Machine Charge</option></select></div>
                    <div><label class="block text-xs text-gray-600 mb-1">Payment Date</label><input type="date" formControlName="paymentDate" class="input" /></div>
                    <div><label class="block text-xs text-gray-600 mb-1">Reference No (Optional)</label><input type="text" formControlName="referenceNo" class="input" /></div>
                    <button type="button" (click)="removeDateChangePayment(i)" class="btn btn-danger">Remove</button>
                  </div>
                </div>
              </div>
              <div class="col-span-full">
                <label class="block text-sm font-medium text-gray-700 mb-1">Remarks <span class="text-red-500">*</span></label>
                <textarea formControlName="remarks" class="input" rows="3" placeholder="Mandatory" [class.border-red-500]="dateChangeForm.get('remarks')?.invalid && dateChangeForm.get('remarks')?.touched"></textarea>
                <p *ngIf="dateChangeForm.get('remarks')?.invalid && dateChangeForm.get('remarks')?.touched" class="text-red-500 text-xs mt-1">Remarks is required</p>
              </div>
            </div>
            <div class="mt-4 flex justify-end space-x-2">
              <button type="button" (click)="showDateChangeForm = false" class="btn btn-secondary">Cancel</button>
              <button type="submit" class="btn btn-primary">Submit</button>
            </div>
          </form>
        </div>

        <!-- Flight Change Form (Our Cost/Sale Price optional; payment rows; remarks mandatory) -->
        <div *ngIf="showFlightChangeForm" class="card bg-blue-50">
          <h3 class="text-xl font-semibold mb-4 text-gray-700">Flight Change</h3>
          <form [formGroup]="flightChangeForm" (ngSubmit)="onFlightChange()">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">New Airline</label>
                <input type="text" formControlName="airline" class="input" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">New From</label>
                <input type="text" formControlName="from" class="input" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">New To</label>
                <input type="text" formControlName="to" class="input" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">New Travel Date</label>
                <input type="date" formControlName="travelDate" class="input" [min]="minFlightChangeTravelDate" />
              </div>
              <div *ngIf="booking?.returnDate">
                <label class="block text-sm font-medium text-gray-700 mb-1">New Return Date</label>
                <input type="date" formControlName="returnDate" class="input" [min]="minFlightChangeReturnDate" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Add-on Our Cost <span class="text-gray-500 font-normal">(optional)</span></label>
                <input type="number" formControlName="newOurCost" class="input" step="0.01" placeholder="Extra cost" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Add-on Sale Price <span class="text-gray-500 font-normal">(optional)</span></label>
                <input type="number" formControlName="newSalePrice" class="input" step="0.01" placeholder="Extra sale" />
              </div>
              <div class="col-span-full">
                <label class="block text-sm font-medium text-gray-700 mb-2">Payment</label>
                <button type="button" (click)="addFlightChangePayment()" class="btn btn-secondary mb-2">Add Payment</button>
                <div formArrayName="payments" class="space-y-3">
                  <div *ngFor="let p of flightChangePaymentsArray.controls; let i = index" [formGroupName]="i" class="flex flex-wrap items-end gap-3 p-3 bg-white rounded border">
                    <div><label class="block text-xs text-gray-600 mb-1">Paid Amount</label><input type="number" formControlName="paidAmount" class="input" step="0.01" /></div>
                    <div><label class="block text-xs text-gray-600 mb-1">Mode</label><select formControlName="paymentMode" class="input"><option value="Cash">Cash</option><option value="Credit Card">Credit Card</option><option value="UPI">UPI</option><option value="E-Transfer">E-Transfer</option><option value="Machine Charge">Machine Charge</option></select></div>
                    <div><label class="block text-xs text-gray-600 mb-1">Date</label><input type="date" formControlName="paymentDate" class="input" /></div>
                    <div><label class="block text-xs text-gray-600 mb-1">Reference No</label><input type="text" formControlName="referenceNo" class="input" /></div>
                    <button type="button" (click)="removeFlightChangePayment(i)" class="btn btn-danger">Remove</button>
                  </div>
                </div>
              </div>
              <div class="col-span-full">
                <label class="block text-sm font-medium text-gray-700 mb-1">Remarks <span class="text-red-500">*</span></label>
                <textarea formControlName="remarks" class="input" rows="3" [class.border-red-500]="flightChangeForm.get('remarks')?.invalid && flightChangeForm.get('remarks')?.touched"></textarea>
                <p *ngIf="flightChangeForm.get('remarks')?.invalid && flightChangeForm.get('remarks')?.touched" class="text-red-500 text-xs mt-1">Remarks is required</p>
              </div>
            </div>
            <div class="mt-4 flex justify-end space-x-2">
              <button type="button" (click)="showFlightChangeForm = false" class="btn btn-secondary">Cancel</button>
              <button type="submit" class="btn btn-primary">Submit</button>
            </div>
          </form>
        </div>

        <div *ngIf="showCancelForm" class="card bg-red-50">
          <h3 class="text-xl font-semibold mb-4 text-red-700">Cancel Booking</h3>
          <form [formGroup]="cancelForm" (ngSubmit)="onCancel()">
            <!-- 1. Partial Paid Card flow (MUST COME FIRST) -->
            <ng-container *ngIf="isPartialPaidCard">
              <div class="mb-4">
                <p class="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
                  Partial Paid {{ booking.cardType }} Cancellation: Review calculated charges below.
                </p>
              </div>

              <div class="mt-4 space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label class="block text-sm text-gray-600">Our Cost</label><p class="font-semibold">{{ booking.ourCost | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Sale Price</label><p class="font-semibold">{{ booking.salePrice | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Supplier Charges</label><p class="font-semibold">{{ (booking.supplierCharges || 0) | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Our Margin</label><p class="font-semibold">{{ partialPaidOurMargin | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Paid Amount</label><p class="font-semibold">{{ booking.totalPaidAmount | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Balance Amount</label><p class="font-semibold">{{ (booking.balanceAmount || 0) | number:'1.2-2' }}</p></div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Supplier Cancellation Charges <span class="text-red-500">*</span></label>
                    <input type="number" formControlName="supplierCancellationCharges" class="input" step="0.01" min="0" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">New Margin <span class="text-red-500">*</span></label>
                    <input type="number" formControlName="ourCancellationCharges" class="input" step="0.01" min="0" />
                  </div>
                  <div class="col-span-full border-t border-red-200 pt-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label class="block text-sm text-gray-600">Total Supplier Took</label><p class="text-lg font-bold text-orange-700">{{ partialPaidCardTotalSupplierTook | number:'1.2-2' }}</p></div>
                      <div><label class="block text-sm text-gray-600">Current Margin</label><p class="text-lg font-bold text-green-700">{{ partialPaidCardNewMargin | number:'1.2-2' }}</p></div>
                      <div><label class="block text-sm text-gray-600">Total Charges</label><p class="text-lg font-bold text-red-700">{{ partialPaidCardTotalCharges | number:'1.2-2' }}</p></div>
                      <div>
                        <label class="block text-sm text-gray-600">Supplier Will Return</label>
                        <p class="text-lg font-bold text-blue-700">
                          {{ (booking.cardType === 'Client Card' ? clientCardPartialSupplierWillReturn : partialPaidCardClientReceives) | number:'1.2-2' }}
                        </p>
                      </div>
                      <div class="col-span-full mt-2">
                        <label class="block text-sm font-medium text-gray-500 mb-1">Refund Committed to Client (Not Editable)</label>
                        <p class="text-xl font-bold text-green-700">CAD {{ refundCommittedToClientDisplay | number:'1.2-2' }}</p>
                        <p class="text-xs text-gray-500">Paid Amount – Total Charges</p>
                      </div>
                    </div>
                    <div *ngIf="booking.cardType === 'Client Card'" class="mt-2 p-2 bg-blue-50 text-blue-800 text-xs rounded border border-blue-100">
                      <p>Upfront Needed: CAD {{ clientCardPartialUpfrontNeeded | number:'1.2-2' }}</p>
                      <p>Client Receives: CAD {{ clientCardPartialClientReceives | number:'1.2-2' }}</p>
                    </div>
                    <div *ngIf="booking.cardType === 'Company Card'" class="mt-2 p-2 bg-blue-50 text-blue-800 text-xs rounded border border-blue-100">
                      <p>Client Receives: CAD {{ partialPaidCardClientReceives | number:'1.2-2' }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- 2. Regular Partial Paid flow (Non-Card) -->
            <ng-container *ngIf="isPartialPaid && !isPartialPaidCard">
              <div class="flex items-center gap-6 py-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" formControlName="cancellationType" value="partialPaidCancellationCharges" class="h-4 w-4 accent-red-600" />
                  <span class="text-sm font-medium text-gray-700">Supplier Cancellation Charges</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" formControlName="cancellationType" value="partialPaidRefundAmount" class="h-4 w-4 accent-red-600" />
                  <span class="text-sm font-medium text-gray-700">Supplier Refund Amount</span>
                </label>
              </div>

              <div *ngIf="cancelForm.get('cancellationType')?.value === 'partialPaidCancellationCharges'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="block text-sm text-gray-600">Our Cost</label><p class="font-semibold">{{ booking.ourCost | number:'1.2-2' }}</p></div>
                <div><label class="block text-sm text-gray-600">Sale Price</label><p class="font-semibold">{{ booking.salePrice | number:'1.2-2' }}</p></div>
                <div><label class="block text-sm text-gray-600">Supplier Charges</label><p class="font-semibold">{{ (booking.supplierCharges || 0) | number:'1.2-2' }}</p></div>
                <div><label class="block text-sm text-gray-600">Our Margin</label><p class="font-semibold">{{ partialPaidOurMargin | number:'1.2-2' }}</p></div>
                <div><label class="block text-sm text-gray-600">Paid Amount</label><p class="font-semibold">{{ booking.totalPaidAmount | number:'1.2-2' }}</p></div>
                <div><label class="block text-sm text-gray-600">Balance Amount</label><p class="font-semibold">{{ (booking.balanceAmount || 0) | number:'1.2-2' }}</p></div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Supplier Cancellation Charges <span class="text-red-500">*</span></label>
                  <input type="number" formControlName="supplierCancellationCharges" class="input" step="0.01" min="0" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">New Margin <span class="text-red-500">*</span></label>
                  <input type="number" formControlName="ourCancellationCharges" class="input" step="0.01" min="0" />
                </div>
                <div class="col-span-full border-t border-red-200 pt-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label class="block text-sm text-gray-600">Amount Supplier Will Return</label><p class="text-lg font-bold text-orange-700">{{ partialPaidSupplierWillReturn | number:'1.2-2' }}</p></div>
                    <div><label class="block text-sm text-gray-600">Total Charges</label><p class="text-lg font-bold text-red-700">{{ partialPaidTotalCharges | number:'1.2-2' }}</p></div>
                    <div><label class="block text-sm text-gray-600">Refund to Client</label><p class="text-lg font-bold text-green-700">{{ partialPaidRefundToClient | number:'1.2-2' }}</p></div>
                  </div>
                </div>
              </div>

              <div *ngIf="cancelForm.get('cancellationType')?.value === 'partialPaidRefundAmount'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="block text-sm text-gray-600">Our Cost</label><p class="font-semibold">{{ booking.ourCost | number:'1.2-2' }}</p></div>
                <div><label class="block text-sm text-gray-600">Sale Price</label><p class="font-semibold">{{ booking.salePrice | number:'1.2-2' }}</p></div>
                <div><label class="block text-sm text-gray-600">Supplier Charges</label><p class="font-semibold">{{ (booking.supplierCharges || 0) | number:'1.2-2' }}</p></div>
                <div><label class="block text-sm text-gray-600">Our Margin</label><p class="font-semibold">{{ partialPaidOurMargin | number:'1.2-2' }}</p></div>
                <div><label class="block text-sm text-gray-600">Paid Amount</label><p class="font-semibold">{{ booking.totalPaidAmount | number:'1.2-2' }}</p></div>
                <div><label class="block text-sm text-gray-600">Balance Amount</label><p class="font-semibold">{{ (booking.balanceAmount || 0) | number:'1.2-2' }}</p></div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Supplier Refund Amount <span class="text-red-500">*</span></label>
                  <input type="number" formControlName="supplierCancellationCharges" class="input" step="0.01" min="0" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">New Margin <span class="text-red-500">*</span></label>
                  <input type="number" formControlName="ourCancellationCharges" class="input" step="0.01" min="0" />
                </div>
                <div class="col-span-full border-t border-red-200 pt-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label class="block text-sm text-gray-600">Supplier Deducted</label><p class="text-lg font-bold text-red-700">{{ partialPaidSupplierDeducted | number:'1.2-2' }}</p></div>
                    <div><label class="block text-sm text-gray-600">Refund to Client</label><p class="text-lg font-bold text-green-700">{{ partialPaidRefundToClientSRA | number:'1.2-2' }}</p></div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- 2.5 Client Card Partial Payment flow -->
            <ng-container *ngIf="isClientCardPartialPayment">
              <div class="mb-4">
                <p class="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
                  Client Card Partial Payment Cancellation: Review calculated charges below.
                </p>
              </div>

              <div class="mt-4 space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label class="block text-sm text-gray-600">Our Cost</label><p class="font-semibold">{{ booking.ourCost | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Sale Price</label><p class="font-semibold">{{ booking.salePrice | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Supplier Charges</label><p class="font-semibold">{{ (booking.supplierCharges || 0) | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Our Margin</label><p class="font-semibold">{{ clientCardPartialOurMargin | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Payment From Card</label><p class="font-semibold">{{ (booking.paymentFromCard || 0) | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Remaining Amount</label><p class="font-semibold">{{ clientCardPartialRemainingAmount | number:'1.2-2' }}</p></div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Supplier Cancellation Charges <span class="text-red-500">*</span></label>
                    <input type="number" formControlName="supplierCancellationCharges" class="input" step="0.01" min="0" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">New Margin <span class="text-red-500">*</span></label>
                    <input type="number" formControlName="ourCancellationCharges" class="input" step="0.01" min="0" />
                  </div>

                  <div class="col-span-full border-t border-red-200 pt-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label class="block text-sm text-gray-600">Total Supplier Took</label><p class="text-lg font-bold text-orange-700">{{ clientCardPartialTotalSupplierTook | number:'1.2-2' }}</p></div>
                      <div><label class="block text-sm text-gray-600">Current Margin</label><p class="text-lg font-bold text-green-700">{{ clientCardPartialNewMargin | number:'1.2-2' }}</p></div>
                      <div><label class="block text-sm text-gray-600">Total Charges</label><p class="text-lg font-bold text-red-700">{{ clientCardPartialTotalCharges | number:'1.2-2' }}</p></div>
                      <div>
                        <label class="block text-sm text-gray-600">
                          {{ clientCardPartialRemainingAmount < clientCardPartialTotalCharges ? 'Client Receives Full Card Payment' : 'Client Receives' }}
                        </label>
                        <p class="text-lg font-bold text-blue-700">
                          {{ clientCardPartialClientReceives | number:'1.2-2' }}
                        </p>
                      </div>
                    </div>
                    <div class="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                      <p class="text-sm font-bold text-red-800">
                        Upfront Needed from Client: CAD {{ clientCardPartialUpfrontNeeded | number:'1.2-2' }}
                      </p>
                      <p class="text-xs text-gray-600">
                        Our Margin + Our Cancellation Charges
                      </p>
                      <p class="text-sm font-bold text-green-800 mt-2">
                        Refund Committed to Client: CAD {{ refundCommittedToClientDisplay | number:'1.2-2' }}
                      </p>
                      <p class="text-xs text-gray-500 italic">Paid Amount – Total Charges</p>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- 3. Fully Paid Card flow -->
            <ng-container *ngIf="isClientOrCompanyCard">
              <div class="mb-4">
                <p class="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
                  {{ booking.cardType }} Cancellation: Review calculated margin and charges below.
                </p>
              </div>

              <div class="mt-4 space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label class="block text-sm text-gray-600">Our Cost</label><p class="font-semibold">{{ booking.ourCost | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Sale Price</label><p class="font-semibold">{{ booking.salePrice | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Supplier Charges</label><p class="font-semibold">{{ (booking.supplierCharges || 0) | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Our Margin</label><p class="font-semibold">{{ cancelOurMargin | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Paid Amount</label><p class="font-semibold">{{ (booking.totalPaidAmount || booking.salePrice) | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Balance Amount</label><p class="font-semibold">{{ (booking.balanceAmount || 0) | number:'1.2-2' }}</p></div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Supplier Cancellation Charges <span class="text-red-500">*</span></label>
                    <input type="number" formControlName="supplierCancellationCharges" class="input" step="0.01" min="0" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">New Margin <span class="text-red-500">*</span></label>
                    <input type="number" formControlName="ourCancellationCharges" class="input" step="0.01" min="0" />
                  </div>

                  <div class="col-span-full border-t border-red-200 pt-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label class="block text-sm text-gray-600">Total Supplier Took</label><p class="text-lg font-bold text-orange-700">{{ cancelTotalSupplierTook | number:'1.2-2' }}</p></div>
                      <div><label class="block text-sm text-gray-600">Current Margin</label><p class="text-lg font-bold text-green-700">{{ cancelClientCardNewMargin | number:'1.2-2' }}</p></div>
                      <div><label class="block text-sm text-gray-600">Total Charges</label><p class="text-lg font-bold text-red-700">{{ cancelTotalCharges | number:'1.2-2' }}</p></div>
                      <div>
                        <label class="block text-sm text-gray-600">
                          Supplier Will Return
                        </label>
                        <p class="text-lg font-bold text-blue-700">
                          {{ (booking.cardType === 'Client Card' ? cancelClientCardSupplierWillReturn : cancelCompanyCardSupplierWillReturn) | number:'1.2-2' }}
                        </p>
                      </div>
                      <div class="col-span-full mt-2">
                        <label class="block text-sm font-medium text-gray-500 mb-1">Refund Committed to Client (Not Editable)</label>
                        <p class="text-xl font-bold text-green-700">CAD {{ refundCommittedToClientDisplay | number:'1.2-2' }}</p>
                        <p class="text-xs text-gray-500">Paid Amount – Total Charges</p>
                      </div>
                    </div>
                    <div *ngIf="booking.cardType === 'Client Card'" class="mt-2 p-2 bg-blue-50 text-blue-800 text-xs rounded border border-blue-100">
                      <p>Upfront Needed: CAD {{ cancelClientCardUpfrontNeeded | number:'1.2-2' }}</p>
                      <p>Client Receives: CAD {{ cancelClientCardClientReceives | number:'1.2-2' }}</p>
                    </div>
                    <div *ngIf="booking.cardType === 'Company Card'" class="mt-2 p-2 bg-blue-50 text-blue-800 text-xs rounded border border-blue-100">
                      <p>Client Receives: CAD {{ cancelCompanyCardClientReceives | number:'1.2-2' }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- 4. Regular Fully Paid flow (Non-Card) -->
            <ng-container *ngIf="!isPartialPaid && !isClientOrCompanyCard && !isClientCardPartialPayment">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Payment Mode Was <span class="text-red-500">*</span></label>
                <select formControlName="paymentModeWas" class="input" required [class.border-red-500]="cancelForm.get('paymentModeWas')?.invalid && cancelForm.get('paymentModeWas')?.touched">
                  <option value="">Select payment mode</option>
                  <option value="Cash">Cash</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Machine Charge">Machine Charge</option>
                  <option value="E-Transfer">E-Transfer</option>
                </select>
              </div>

              <!-- Credit Card flow -->
              <div *ngIf="cancelForm.get('paymentModeWas')?.value === 'Credit Card'" class="mt-4 space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label class="block text-sm text-gray-600">Base Sale Price</label><p class="font-semibold">{{ totalSalePriceForCancel | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Old Margin</label><p class="font-semibold">{{ baseMargin | number:'1.2-2' }}</p></div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Supplier Cancellation Charges <span class="text-red-500">*</span></label>
                    <input type="number" formControlName="supplierCancellationCharges" class="input" step="0.01" min="0" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Any Charges From Client <span class="text-red-500">*</span></label>
                    <input type="number" formControlName="chargeFromClient" class="input" step="0.01" min="0" />
                  </div>
                  <div><label class="block text-sm text-gray-600">Current Margin</label><p class="font-semibold">{{ newMargin | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Refund Committed To Client</label><p class="font-semibold">{{ cancelRefundCommittedToClient | number:'1.2-2' }}</p></div>
                </div>
              </div>

              <!-- Non-Credit Card flow -->
              <div *ngIf="cancelForm.get('paymentModeWas')?.value && cancelForm.get('paymentModeWas')?.value !== 'Credit Card'" class="mt-4 space-y-4">
                <div class="flex items-center gap-6 py-2">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" formControlName="cancellationType" value="supplierCancellationCharges" class="h-4 w-4 accent-red-600" />
                    <span class="text-sm font-medium text-gray-700">Supplier Cancellation Charges</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" formControlName="cancellationType" value="supplierRefundAmount" class="h-4 w-4 accent-red-600" />
                    <span class="text-sm font-medium text-gray-700">Supplier Refund Amount</span>
                  </label>
                </div>
                <!-- Supplier Cancellation Charges Block -->
                <div *ngIf="cancelForm.get('cancellationType')?.value === 'supplierCancellationCharges'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <!-- Row 1 -->
                  <div><label class="block text-sm text-gray-600">Base Sale Price</label><p class="font-semibold">{{ totalSalePriceForCancel | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Our Old Margin</label><p class="font-semibold">{{ baseMargin | number:'1.2-2' }}</p></div>

                  <!-- Row 2 -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Supplier Cancellation Charges <span class="text-red-500">*</span></label>
                    <input type="number" formControlName="supplierCancellationCharges" class="input" step="0.01" min="0" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">New Margin <span class="text-red-500">*</span></label>
                    <input type="number" formControlName="ourCancellationCharges" class="input" step="0.01" min="0" />
                  </div>

                  <!-- Row 3 -->
                  <div>
                    <label class="block text-sm text-gray-600">Total Cancellation Charges</label>
                    <p class="font-semibold">{{ cancelTotalCancellationCharges | number:'1.2-2' }}</p>
                  </div>
                  <div>
                    <label class="block text-sm text-gray-600">Refund Committed To Client</label>
                    <p class="font-semibold text-green-700">{{ refundCommittedToClientNonCC | number:'1.2-2' }}</p>
                    <p class="text-xs text-gray-400 mt-1">Base Sale Price &minus; Total Cancellation Charges</p>
                  </div>

                  <!-- Row 4 -->
                  <div>
                    <label class="block text-sm text-gray-600">Current Margin</label>
                    <p class="font-semibold text-blue-700">{{ cancelNewMarginSCC | number:'1.2-2' }}</p>
                  </div>

                </div>

                <!-- Supplier Refund Amount Block -->
                <div *ngIf="cancelForm.get('cancellationType')?.value === 'supplierRefundAmount'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <!-- Row 1 -->
                  <div><label class="block text-sm text-gray-600">Base Sale Price</label><p class="font-semibold">{{ totalSalePriceForCancel | number:'1.2-2' }}</p></div>
                  <div><label class="block text-sm text-gray-600">Our Old Margin</label><p class="font-semibold">{{ baseMargin | number:'1.2-2' }}</p></div>

                  <!-- Row 2 -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Supplier Refund Amount <span class="text-red-500">*</span></label>
                    <input type="number" formControlName="supplierCancellationCharges" class="input" step="0.01" min="0" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">New Margin <span class="text-red-500">*</span></label>
                    <input type="number" formControlName="ourCancellationCharges" class="input" step="0.01" min="0" />
                  </div>

                  <!-- Row 3 -->
                  <div>
                    <label class="block text-sm text-gray-600">Supplier Deducted</label>
                    <p class="font-semibold text-red-700">{{ supplierDeductedRefundMode | number:'1.2-2' }}</p>
                  </div>
                  <div>
                    <label class="block text-sm text-gray-600">Refund Committed To Client</label>
                    <p class="font-semibold text-green-700">{{ refundCommittedToClientRefundMode | number:'1.2-2' }}</p>
                    <p class="text-xs text-gray-400 mt-1">Supplier Refund Amount &minus; Our Cancellation Charges</p>
                  </div>
                  
                  <!-- Row 4 -->
                  <div>
                    <label class="block text-sm text-gray-600">Current Margin</label>
                    <p class="font-semibold text-blue-700">{{ cancelNewMarginSRA | number:'1.2-2' }}</p>
                  </div>

                </div>
              </div>
            </ng-container>

            <!-- Common Fields (Remarks and Action Buttons) -->
            <div class="mt-4 border-t border-red-200 pt-4">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Remarks <span class="text-red-500">*</span></label>
                <textarea formControlName="remarks" class="input" rows="3" required [class.border-red-500]="cancelForm.get('remarks')?.invalid && cancelForm.get('remarks')?.touched" placeholder="Enter reason for cancellation..."></textarea>
                <p *ngIf="cancelForm.get('remarks')?.invalid && cancelForm.get('remarks')?.touched" class="text-red-500 text-xs mt-1">Remarks is required</p>
              </div>

              <div class="flex justify-end space-x-2">
                <button type="button" (click)="showCancelForm = false" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-danger">Confirm Cancellation</button>
              </div>
            </div>
          </form>
        </div>
        <div *ngIf="booking.cancellation?.isCancelled" class="card bg-orange-50 border border-orange-200">
          <h3 class="text-xl font-semibold mb-4 text-orange-700">Refund Status</h3>
          <div class="space-y-6">

            <!-- 1. Refund Awaited from Supplier -->
            <div class="flex items-start gap-3">
              <span class="mt-0.5 h-4 w-4 rounded-full bg-orange-400 flex-shrink-0"></span>
              <div>
                <p class="font-medium text-gray-800">Refund Awaited from Supplier</p>
                <div class="mt-2 space-y-2">
                  <ng-container *ngIf="isCardCancellation">
                    <p class="text-sm font-semibold text-orange-800">
                      Supplier Will Return: CAD {{ (booking.cancellation?.supplierWillReturn != null ? booking.cancellation.supplierWillReturn : expectedSupplierReturn) | number:'1.2-2' }}
                    </p>
                    <p class="text-sm font-semibold text-red-800">
                      Total Charges: CAD {{ (booking.cancellation?.totalCharges ?? 0) | number:'1.2-2' }}
                    </p>
                    <p class="text-sm font-bold text-green-700 mt-2">
                      Refund Committed to Client: CAD {{ (booking.cancellation?.refundCommittedToClient ?? 0) | number:'1.2-2' }}
                    </p>
                    <p class="text-[10px] text-gray-500 italic">Paid Amount – Total Charges</p>
                    
                    <!-- Company card only -->
                    <div *ngIf="isCompanyCardCancellation">
                      <p class="text-sm font-bold text-green-800 mt-2">
                        Client Receives: CAD {{ (booking.cancellation?.clientReceives ?? 0) | number:'1.2-2' }}
                      </p>
                    </div>

                    <!-- Client card only -->
                    <div *ngIf="isClientCardCancellation" class="mt-2 space-y-1">
                      <p class="text-sm font-bold text-red-800">
                        Upfront Needed: CAD {{ (booking.cancellation?.upfrontNeeded ?? 0) | number:'1.2-2' }}
                      </p>
                      <p class="text-sm font-bold text-green-800">
                        Client Receives: CAD {{ (booking.cancellation?.clientReceives ?? 0) | number:'1.2-2' }}
                      </p>
                    </div>

                    <!-- Client Card Partial Payment only -->
                    <div *ngIf="booking.cancellation?.cancellationType === 'clientCardPartialPayment'" class="mt-2 space-y-1">
                      <ng-container *ngIf="(booking.cancellation?.upfrontNeeded || 0) > 0">
                        <p class="text-sm font-bold text-red-800">
                          Upfront Needed: CAD {{ booking.cancellation?.upfrontNeeded | number:'1.2-2' }}
                        </p>
                        <p class="text-sm font-bold text-green-800">
                          Client Receives Card Payment: CAD {{ (booking?.paymentFromCard || 0) | number:'1.2-2' }}
                        </p>
                      </ng-container>
                      <ng-container *ngIf="(booking.cancellation?.upfrontNeeded || 0) <= 0">
                        <p class="text-sm font-bold text-gray-600">
                          No upfront needed
                        </p>
                        <p class="text-sm font-bold text-green-800">
                          Client Receives: CAD {{ booking.cancellation?.clientReceives | number:'1.2-2' }}
                        </p>
                      </ng-container>
                    </div>
                  </ng-container>
                  
                  <ng-container *ngIf="!isCardCancellation">
                    <p class="text-sm font-semibold text-orange-800">
                      Amount Supplier Will Return: CAD {{ expectedSupplierReturn | number:'1.2-2' }}
                    </p>
                    <p *ngIf="booking.cancellation?.cancellationType === 'supplierRefundAmount'" class="text-xs text-orange-700">
                      Supplier Deducted: CAD {{ (booking.cancellation?.supplierDeducted || 0) | number:'1.2-2' }}
                    </p>
                    <p class="text-xs text-orange-700">
                      Refund Committed to Client: CAD {{ (booking.cancellation?.committedToClient || booking.cancellation?.refundToClient || 0) | number:'1.2-2' }}
                    </p>
                  </ng-container>
                </div>
                <p class="text-xs text-gray-500 mt-2 italic">Automatically set when cancellation is confirmed</p>
              </div>
            </div>

            <!-- 2. Refund Received from Supplier -->
            <div class="flex items-start gap-3">
              <span class="mt-0.5 h-4 w-4 rounded-full flex-shrink-0" [ngClass]="booking.cancellation?.refundReceivedFromSupplier?.date ? 'bg-green-500' : 'bg-gray-300'"></span>
              <div class="flex-1">
                <p class="font-medium text-gray-800 mb-2">Refund Received from Supplier</p>
                <div *ngIf="booking.cancellation?.refundReceivedFromSupplier?.date" class="text-sm text-gray-600 mb-2">
                  <span class="font-medium">Date:</span> {{ booking.cancellation.refundReceivedFromSupplier.date | date:'dd-MM-yyyy' }}
                  <span *ngIf="booking.cancellation.refundReceivedFromSupplier.remarks" class="ml-4"><span class="font-medium">Remarks:</span> {{ booking.cancellation.refundReceivedFromSupplier.remarks }}</span>
                </div>
                <div *ngIf="isAdmin() || isAccount()" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Date</label>
                    <input type="date" [(ngModel)]="refundReceivedDate" [ngModelOptions]="{standalone: true}" class="input" />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                    <input type="text" [(ngModel)]="refundReceivedRemarks" [ngModelOptions]="{standalone: true}" class="input" placeholder="Optional remarks" />
                  </div>
                  <div class="sm:col-span-2">
                    <button type="button" (click)="saveRefundReceived()" [disabled]="savingRefundReceived || !refundReceivedDate" class="btn btn-primary text-sm" [class.opacity-50]="savingRefundReceived || !refundReceivedDate">
                      {{ savingRefundReceived ? 'Saving...' : 'Save' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. Refund Paid to Client -->
            <div class="flex items-start gap-3">
              <span class="mt-0.5 h-4 w-4 rounded-full flex-shrink-0" [ngClass]="booking.cancellation?.refundPaidToClient?.date ? 'bg-green-500' : 'bg-gray-300'"></span>
              <div class="flex-1">
                <p class="font-medium text-gray-800 mb-2">Refund Paid to Client</p>
                <div *ngIf="booking.cancellation?.refundPaidToClient?.date" class="text-sm text-gray-600 mb-2">
                  <span class="font-medium">Date:</span> {{ booking.cancellation.refundPaidToClient.date | date:'dd-MM-yyyy' }}
                  <span *ngIf="booking.cancellation.refundPaidToClient.remarks" class="ml-4"><span class="font-medium">Remarks:</span> {{ booking.cancellation.refundPaidToClient.remarks }}</span>
                </div>
                <div *ngIf="isAdmin() || isAccount()" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Date</label>
                    <input type="date" [(ngModel)]="refundPaidDate" [ngModelOptions]="{standalone: true}" class="input" />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                    <input type="text" [(ngModel)]="refundPaidRemarks" [ngModelOptions]="{standalone: true}" class="input" placeholder="Optional remarks" />
                  </div>
                  <div class="sm:col-span-2">
                    <button type="button" (click)="saveRefundPaid()" [disabled]="savingRefundPaid || !refundPaidDate" class="btn btn-primary text-sm" [class.opacity-50]="savingRefundPaid || !refundPaidDate">
                      {{ savingRefundPaid ? 'Saving...' : 'Save' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Progress History -->
        <div class="card overflow-hidden">
          <h3 class="text-xl font-semibold text-gray-800 mb-1">Progress History</h3>
          <p class="text-sm text-gray-500 mb-6">Who changed what and when</p>

          <div *ngIf="booking.progressHistory && booking.progressHistory.length > 0" class="relative">
            <!-- Timeline line -->
            <div class="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200 rounded-full"></div>

            <div class="space-y-0">
              <div *ngFor="let history of booking.progressHistory; let i = index" class="relative flex gap-4 pb-6 last:pb-0">
                <!-- Dot -->
                <div class="relative z-10 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow"
                  [ngClass]="getHistoryActionClass(history.action)">
                  {{ i + 1 }}
                </div>
                <!-- Content card -->
                <div class="flex-1 min-w-0 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow p-4">
                  <div class="flex flex-wrap items-center gap-2 gap-y-1 mb-1">
                    <span class="font-semibold text-gray-900">{{ history.action }}</span>
                    <span class="text-xs text-gray-400">·</span>
                    <span class="text-sm text-gray-600">{{ history.performedByName }}</span>
                    <span class="text-xs text-gray-400">{{ history.timestamp | date:'dd-MM-yyyy HH:mm' }}</span>
                  </div>
                  <p *ngIf="history.remarks" class="text-sm text-gray-600 mt-2 pl-1 border-l-2 border-gray-200">{{ history.remarks }}</p>
                  <!-- Old → New -->
                  <div *ngIf="history.changes && getChangeEntries(history).length" class="mt-3 space-y-2">
                    <div *ngFor="let row of getChangeEntries(history)" class="flex flex-wrap items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span class="font-medium text-gray-600 min-w-[80px]">{{ row.label }}</span>
                      <span class="text-red-600/90 line-through">{{ row.old }}</span>
                      <span class="text-gray-400">→</span>
                      <span class="text-green-700 font-medium">{{ row.new }}</span>
                    </div>
                  </div>
                  <!-- Simple changes: compact grid -->
                  <div *ngIf="history.changes && getChangeEntries(history).length === 0 && getSimpleChanges(history).length" class="mt-3 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 px-4 py-3 text-sm">
                      <div *ngFor="let row of getSimpleChanges(history)" class="flex gap-2 items-baseline">
                        <span class="font-medium text-gray-600 shrink-0 min-w-[7rem]">{{ row.label }}</span>
                        <span class="text-gray-800 break-words">{{ row.value }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div *ngIf="!booking.progressHistory || booking.progressHistory.length === 0"
            class="text-center py-10 px-4 rounded-xl bg-gray-50 border border-dashed border-gray-200">
            <p class="text-gray-500 font-medium">No history yet</p>
            <p class="text-sm text-gray-400 mt-1">Changes to this booking will appear here</p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class BookingDetailComponent implements OnInit {
  booking: Booking | null = null;
  loading = true;
  loadError: string | null = null;
  showDateChangeForm = false;
  showFlightChangeForm = false;
  showCancelForm = false;
  dateChangeForm: FormGroup;
  flightChangeForm: FormGroup;
  cancelForm: FormGroup;
  assignableUsers: User[] = [];
  assignToUserId = '';
  assignComment = '';
  assigning = false;

  // Refund status form state
  refundReceivedDate = '';
  refundReceivedRemarks = '';
  refundPaidDate = '';
  refundPaidRemarks = '';
  savingRefundReceived = false;
  savingRefundPaid = false;
  adminVerifiedStatus = false;
  accountVerifiedStatus = false;
  selectedStatus = '';

  constructor(
    private bookingService: BookingService,
    private authService: AuthService,
    private userService: UserService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private toastr: ToastrService
  ) {
    this.dateChangeForm = this.fb.group({
      changeTravelDate: [false],
      changeReturnDate: [false],
      newTravelDate: [''],
      newReturnDate: [''],
      newOurCost: [null],
      newSalePrice: [null],
      payments: this.fb.array([]),
      remarks: ['', Validators.required]
    });

    this.flightChangeForm = this.fb.group({
      airline: [''],
      from: [''],
      to: [''],
      travelDate: [''],
      returnDate: [''],
      newOurCost: [null],
      newSalePrice: [null],
      payments: this.fb.array([]),
      remarks: ['', Validators.required]
    });

    this.cancelForm = this.fb.group({
      paymentModeWas: ['', Validators.required],
      refundableAmount: [0],
      committedToClient: [null],
      chargeFromClient: [null],
      cancellationType: ['supplierCancellationCharges'],
      supplierCancellationCharges: [0],
      ourCancellationCharges: [0],
      remarks: ['', Validators.required]
    });

    // Watch payment mode changes to update validators
    this.cancelForm.get('paymentModeWas')?.valueChanges.subscribe(mode => {
      const isCardFlow = this.isClientOrCompanyCard || this.isPartialPaidCard;
      if (mode === 'Credit Card' && !isCardFlow) {
        this.cancelForm.get('chargeFromClient')?.setValidators([Validators.required]);
        this.cancelForm.get('committedToClient')?.clearValidators();
      } else {
        this.cancelForm.get('committedToClient')?.clearValidators();
        this.cancelForm.get('chargeFromClient')?.clearValidators();
      }
      this.cancelForm.get('chargeFromClient')?.updateValueAndValidity();
      this.cancelForm.get('committedToClient')?.updateValueAndValidity();
    });
  }

  get dateChangePaymentsArray(): FormArray {
    return this.dateChangeForm.get('payments') as FormArray;
  }

  addDateChangePayment() {
    this.dateChangePaymentsArray.push(this.fb.group({
      paidAmount: [0],
      paymentMode: ['Cash'],
      paymentDate: [new Date().toISOString().split('T')[0]],
      referenceNo: ['']
    }));
  }

  removeDateChangePayment(i: number) {
    this.dateChangePaymentsArray.removeAt(i);
  }

  get flightChangePaymentsArray(): FormArray {
    return this.flightChangeForm.get('payments') as FormArray;
  }

  addFlightChangePayment() {
    this.flightChangePaymentsArray.push(this.fb.group({
      paidAmount: [0],
      paymentMode: ['Cash'],
      paymentDate: [new Date().toISOString().split('T')[0]],
      referenceNo: ['']
    }));
  }

  removeFlightChangePayment(i: number) {
    this.flightChangePaymentsArray.removeAt(i);
  }

  /** True if travel date is before today (checkboxes only if not past per spec) */
  isTravelDatePast(): boolean {
    if (!this.booking?.travelDate) return false;
    const t = new Date(this.booking.travelDate);
    t.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return t < today;
  }

  /** True if return date is before today */
  isReturnDatePast(): boolean {
    if (!this.booking?.returnDate) return true;
    const t = new Date(this.booking.returnDate);
    t.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return t < today;
  }

  /** Min date for Date Change new travel date = today (local) */
  get minDateChangeTravelDate(): string {
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /** Min date for Date Change new return date = new travel date (if set) or today */
  get minDateChangeReturnDate(): string {
    const t = this.dateChangeForm?.get('newTravelDate')?.value;
    if (t) {
      const s = typeof t === 'string' ? t : (t instanceof Date ? `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` : '');
      if (s) return s;
    }
    return this.minDateChangeTravelDate;
  }

  /** Min date for Flight Change travel date = today (local); past dates not selectable */
  get minFlightChangeTravelDate(): string {
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /** Min date for Flight Change return date = selected travel date or today */
  get minFlightChangeReturnDate(): string {
    const t = this.flightChangeForm?.get('travelDate')?.value;
    if (t) {
      const s = typeof t === 'string' ? t : (t instanceof Date ? `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` : '');
      if (s) return s;
    }
    return this.minFlightChangeTravelDate;
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.loadBooking(params['id']);
      }
    });
  }

  loadBooking(id: string) {
    this.loading = true;
    this.loadError = null;
    this.bookingService.getBooking(id).subscribe({
      next: (booking) => {
        this.booking = booking;
        this.loading = false;
        this.selectedStatus = booking.status || 'Unticketed';
        this.initializeForms();
        if (this.canAssign()) {
          this.userService.getAssignableUsers().subscribe({
            next: (users) => {
              this.assignableUsers = users;
              const assignedTo = this.booking?.assignedTo;
              const assignedToId = assignedTo && (typeof assignedTo === 'object' ? (assignedTo._id ?? (assignedTo as any).id) : assignedTo);
              const assignedIdStr = assignedToId ? String(assignedToId) : '';

              if (assignedIdStr) {
                const assignedInList = this.assignableUsers.find(u => String(u._id) === assignedIdStr);
                this.assignToUserId = assignedInList ? (assignedInList._id ?? assignedIdStr) : assignedIdStr;
              } else {
                const createdBy = this.booking?.submittedBy;
                const createdById = createdBy && (typeof createdBy === 'object' ? (createdBy._id ?? (createdBy as any).id) : createdBy);
                const idStr = createdById ? String(createdById) : '';
                const createdUserInList = idStr && this.assignableUsers.find(u => String(u._id) === idStr);
                if (createdUserInList) {
                  this.assignToUserId = createdUserInList._id ?? idStr;
                } else if (this.assignableUsers.length === 1) {
                  this.assignToUserId = this.assignableUsers[0]._id ?? '';
                } else {
                  this.assignToUserId = '';
                }
              }
            },
            error: () => { this.assignableUsers = []; }
          });
        }
      },
      error: (err) => {
        this.loading = false;
        this.loadError = err?.error?.message || (err?.status === 403 ? 'You don\'t have permission to view this booking.' : 'Failed to load booking. Please try again.');
      }
    });
  }

  isAdmin(): boolean {
    const user = this.authService.getCurrentUserValue();
    return user?.role === 'ADMIN';
  }

  recalculateCancellation() {
    if (!this.booking || !this.booking._id) return;
    const bookingId = this.booking._id;
    this.bookingService.recalculateCancellation(bookingId).subscribe({
      next: () => {
        this.loadBooking(bookingId);
      }
    });
  }

  isAccount(): boolean {
    const user = this.authService.getCurrentUserValue();
    return user?.role === 'ACCOUNT';
  }

  /** Account verified visible to Admin + Account only */
  canShowAccountVerified(): boolean {
    const user = this.authService.getCurrentUserValue();
    return user?.role === 'ADMIN' || user?.role === 'ACCOUNT';
  }

  /** Admin verified visible to Admin only */
  canShowAdminVerified(): boolean {
    const user = this.authService.getCurrentUserValue();
    return user?.role === 'ADMIN';
  }

  updateStatus() {
    if (!this.booking || !this.selectedStatus) return;
    
    this.bookingService.updateBooking(this.booking._id!, { status: this.selectedStatus }).subscribe({
      next: () => {
        this.toastr.success(`Status updated to ${this.selectedStatus}`);
        this.loadBooking(this.booking!._id!);
      },
      error: (err) => this.toastr.error(err?.error?.message || 'Update failed')
    });
  }

  getDisplayStatus(): string {
    if (!this.booking) return 'Ticketed';
    if (this.booking.cancellation?.isCancelled) return 'Cancelled';
    // Use actual status from database if it's Ticketed or Unticketed
    if (this.booking.status === 'Ticketed' || this.booking.status === 'Unticketed') {
      return this.booking.status;
    }
    // Default: show Unticketed for Agent2 supplier, Ticketed for others
    if (this.booking.supplierName === 'Agent2') return 'Unticketed';
    return 'Ticketed';
  }

  revertCancellation() {
    if (!this.booking) return;
    this.bookingService.updateBooking(this.booking._id!, {
      status: 'Pending Verification',
      cancellation: { isCancelled: false }
    }).subscribe({
      next: () => {
        this.toastr.success('Booking reverted to active', 'Success');
        this.loadBooking(this.booking!._id!);
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Failed to revert cancellation', 'Error');
      }
    });
  }

  initializeForms() {
    if (this.booking) {
      this.dateChangeForm.patchValue({
        newOurCost: 0,
        newSalePrice: 0
      });
      // Cancel form: auto-select Payment Mode Was from how customer paid; disable so it cannot be changed
      const paymentModeWas = this.getPrimaryPaymentMode();
      
      let cancelType = 'supplierCancellationCharges';
      if (this.isPartialPaidCard) {
        cancelType = this.booking.cardType === 'Client Card' ? 'partialPaidClientCard' : 'partialPaidCompanyCard';
      } else if (this.isPartialPaid) {
        cancelType = 'partialPaidCancellationCharges';
      }

      this.cancelForm.patchValue({
        paymentModeWas: paymentModeWas || '',
        cancellationType: cancelType
      });
      this.cancelForm.get('paymentModeWas')?.disable();
      // Pre-fill refund status fields from existing data
      const c = this.booking.cancellation;
      if (c?.refundReceivedFromSupplier?.date) {
        this.refundReceivedDate = new Date(c.refundReceivedFromSupplier.date).toISOString().split('T')[0];
        this.refundReceivedRemarks = c.refundReceivedFromSupplier.remarks || '';
      }
      if (c?.refundPaidToClient?.date) {
        this.refundPaidDate = new Date(c.refundPaidToClient.date).toISOString().split('T')[0];
        this.refundPaidRemarks = c.refundPaidToClient.remarks || '';
      }
    }
  }

  /** Primary payment mode from booking (customer's payment) – largest paidAmount, else first. Maps to cancellation enum: Cash, Cheque, Credit Card. */
  getPrimaryPaymentMode(): string {
    if (!this.booking?.payments?.length) return '';
    const payments = this.booking.payments as { paidAmount?: number; paymentMode?: string }[];
    const primary = payments.reduce((best, p) => {
      const amount = typeof p.paidAmount === 'number' ? p.paidAmount : Number(p.paidAmount) || 0;
      return !best || amount > (typeof best.paidAmount === 'number' ? best.paidAmount : Number(best.paidAmount) || 0) ? p : best;
    }, payments[0]);
    const mode = (primary?.paymentMode || '').trim();
    if (mode === 'Credit Card' || mode === 'Cheque') return mode;
    return 'Cash';
  }

  isVerified(): boolean {
    if (!this.booking) return false;
    const user = this.authService.getCurrentUserValue();
    if (!user) return false;
    if (user.role === 'ADMIN') return !!(this.booking.adminVerified || this.booking.verifiedByAdmin);
    if (user.role === 'ACCOUNT') return !!(this.booking.accountVerified || this.booking.verifiedByAccount);
    return false;
  }

  /** Edit: Admin/Account full; Agent1/Agent2 until verified (per spec all can add/edit) */
  canEdit(): boolean {
    if (!this.booking) return false;
    const user = this.authService.getCurrentUserValue();
    if (!user) return false;
    const verified = this.booking.verifiedByAccount || this.booking.verifiedByAdmin;
    if (user.role === 'ADMIN' || user.role === 'ACCOUNT') return this.booking.status !== 'Draft';
    if (user.role === 'AGENT1' || user.role === 'AGENT2') return !verified;
    return false;
  }

  /** Date Change: Agent1, Agent2, Account, Admin (all can do per spec) */
  canDateChange(): boolean {
    return this.booking !== null && (!this.booking.cancellation || !this.booking.cancellation.isCancelled);
  }

  /** Flight Change: Agent1, Agent2, Account, Admin (all can do per spec) */
  canFlightChange(): boolean {
    return this.booking !== null && (!this.booking.cancellation || !this.booking.cancellation.isCancelled);
  }

  /** Open only Date Change form; close Flight Change and Cancel */
  openDateChangeOnly() {
    if (this.showDateChangeForm) {
      this.showDateChangeForm = false;
      return;
    }
    this.showDateChangeForm = true;
    this.showFlightChangeForm = false;
    this.showCancelForm = false;
  }

  /** Open only Flight Change form; close Date Change and Cancel */
  openFlightChangeOnly() {
    if (this.showFlightChangeForm) {
      this.showFlightChangeForm = false;
      return;
    }
    this.showFlightChangeForm = true;
    this.showDateChangeForm = false;
    this.showCancelForm = false;
  }

  /** Open only Cancel form; close Date Change and Flight Change */
  openCancelFormOnly() {
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
    }
  }

  /** Build list of old → new for Progress History (Date Change, Flight Change, etc.) */
  getChangeEntries(history: any): { label: string; old: string; new: string }[] {
    const c = history.changes || {};
    const out: { label: string; old: string; new: string }[] = [];
    const isAddOnOnly = c.ourCostAddon != null || c.salePriceAddon != null;

    // Date Change: oldTravelDate, newTravelDate, oldReturnDate, newReturnDate; for add-on-only skip base Our Cost/Sale Price rows
    if (c.oldTravelDate != null || c.newTravelDate != null) {
      out.push({
        label: 'Travel Date',
        old: c.oldTravelDate ? this.formatDate(c.oldTravelDate) : '–',
        new: c.newTravelDate ? this.formatDate(c.newTravelDate) : '–'
      });
    }
    const oldRet = c.oldReturnDate ? this.formatDate(c.oldReturnDate) : '–';
    const newRet = c.newReturnDate ? this.formatDate(c.newReturnDate) : '–';
    const isEpochOr1970 = (d: any) => {
      if (!d) return true;
      const t = typeof d === 'string' ? new Date(d).getTime() : (d instanceof Date ? d.getTime() : 0);
      return !t || new Date(t).getFullYear() <= 1970;
    };
    if ((c.oldReturnDate != null || c.newReturnDate != null) && !(isEpochOr1970(c.oldReturnDate) && isEpochOr1970(c.newReturnDate))) {
      out.push({
        label: 'Return Date',
        old: isEpochOr1970(c.oldReturnDate) ? '–' : oldRet,
        new: isEpochOr1970(c.newReturnDate) ? '–' : newRet
      });
    }
    if (!isAddOnOnly && (c.oldOurCost != null || c.newOurCost != null)) {
      out.push({
        label: 'Our Cost',
        old: c.oldOurCost != null ? String(c.oldOurCost) : '–',
        new: c.newOurCost != null ? String(c.newOurCost) : '–'
      });
    }
    if (!isAddOnOnly && (c.oldSalePrice != null || c.newSalePrice != null)) {
      out.push({
        label: 'Sale Price',
        old: c.oldSalePrice != null ? String(c.oldSalePrice) : '–',
        new: c.newSalePrice != null ? String(c.newSalePrice) : '–'
      });
    }
    if (c.ourCostAddon != null && (c.ourCostAddon !== 0 || c.oldOurCost != null)) {
      const prevAddon = c.previousOurCostAddon != null ? String(c.previousOurCostAddon) : '–';
      out.push({
        label: 'Our Cost Add-on',
        old: prevAddon,
        new: String(c.ourCostAddon)
      });
    }
    if (c.salePriceAddon != null && (c.salePriceAddon !== 0 || c.oldSalePrice != null)) {
      const prevAddon = c.previousSalePriceAddon != null ? String(c.previousSalePriceAddon) : '–';
      out.push({
        label: 'Sale Price Add-on',
        old: prevAddon,
        new: String(c.salePriceAddon)
      });
    }

    // Flight Change: oldDetails / newDetails
    const oldD = c.oldDetails || {};
    const newD = c.newDetails || {};
    const flightKeys = ['airline', 'from', 'to', 'travelDate', 'returnDate'] as const;
    for (const k of flightKeys) {
      const ov = oldD[k];
      const nv = newD[k];
      if (ov != null || nv != null) {
        const label = k === 'from' ? 'From' : k === 'to' ? 'To' : k === 'travelDate' ? 'Travel Date' : k === 'returnDate' ? 'Return Date' : 'Airline';
        out.push({
          label,
          old: ov != null ? (k === 'travelDate' || k === 'returnDate' ? this.formatDate(ov) : String(ov)) : '–',
          new: nv != null ? (k === 'travelDate' || k === 'returnDate' ? this.formatDate(nv) : String(nv)) : '–'
        });
      }
    }

    return out;
  }

  /** Simple key-value for history that has no old/new (e.g. Booking Updated by Admin) */
  getSimpleChanges(history: any): { label: string; value: string }[] {
    const c = history.changes || {};
    const skip = [
      'remarks', 'changedBy', 'changedAt', 'newDetails', 'oldDetails',
      'oldTravelDate', 'newTravelDate', 'oldReturnDate', 'newReturnDate',
      'oldOurCost', 'newOurCost', 'oldSalePrice', 'newSalePrice',
      'ourCostAddon', 'salePriceAddon',
      'multipleSectors', '__v'
    ];
    const labels: Record<string, string> = {
      paxName: 'Passenger', contactPerson: 'Contact Person', contactNumber: 'Contact',
      from: 'From', to: 'To', travelDate: 'Travel Date', returnDate: 'Return Date',
      status: 'Status', supplier: 'Supplier', supplierName: 'Supplier',
      ourCost: 'Our Cost', salePrice: 'Sale Price', pnr: 'PNR',
      dateOfSubmission: 'Submitted', sectorType: 'Sector', note: 'Note',
      airline: 'Airline', additionalService: 'Add. Service', additionalServicePrice: 'Add. Service Price',
      paymentType: 'Payment Type', billingStatus: 'Billing Status', cancellation: 'Cancellation',
      payments: 'Payments'
    };
    const dateKeys = ['travelDate', 'returnDate', 'dateOfSubmission', 'paymentDate'];
    const out: { label: string; value: string }[] = [];
    for (const key of Object.keys(c)) {
      if (skip.includes(key)) continue;
      const val = c[key];
      const label = labels[key] || this.formatLabel(key);
      let value = '';
      if (val == null) value = '–';
      else if (Array.isArray(val)) value = val.length ? (key === 'payments' ? `${val.length} payment(s)` : `${val.length} item(s)`) : '–';
      else if (typeof val === 'object' && val !== null && !(val instanceof Date)) value = JSON.stringify(val).length > 50 ? 'Updated' : JSON.stringify(val);
      else if (dateKeys.includes(key) || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val))) value = this.formatDate(val);
      else value = String(val);
      if (value) out.push({ label, value });
    }
    return out;
  }

  private formatLabel(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
  }

  private formatDate(v: any): string {
    if (!v) return '–';
    const d = typeof v === 'string' ? new Date(v) : v;
    if (!(d instanceof Date) || isNaN(d.getTime())) return String(v);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  /** Badge color for progress history action type */
  getHistoryActionClass(action: string): string {
    const a = (action || '').toLowerCase();
    if (a.includes('cancel') || a.includes('refund')) return 'bg-red-500';
    if (a.includes('verified') || a.includes('submit')) return 'bg-green-600';
    if (a.includes('date change')) return 'bg-blue-500';
    if (a.includes('flight change')) return 'bg-indigo-500';
    if (a.includes('seat')) return 'bg-amber-500';
    return 'bg-[#0096D2]';
  }

  /** Payment-related fields: Agent1, Agent2, Account, Admin can all see (all can collect/manage payments per spec) */
  canSeePaymentInfo(): boolean {
    const user = this.authService.getCurrentUserValue();
    return !!user && ['AGENT1', 'AGENT2', 'ACCOUNT', 'ADMIN'].includes(user.role);
  }

  /** Assigned To display: show assigned user if set, else created user (Submitted By), else – */
  getAssignedToDisplay(): string {
    if (!this.booking) return '–';
    const assigned = this.booking.assignedTo;
    if (assigned && (typeof assigned === 'object' && assigned.name)) return assigned.name;
    return this.booking.submittedByName || (this.booking.submittedBy && typeof this.booking.submittedBy === 'object' && (this.booking.submittedBy as any).name) || '–';
  }

  /** Account can assign to Agent1/Agent2; Agent2 to Agent1; Admin to Agent1/Agent2/Account */
  canAssign(): boolean {
    return this.authService.hasRole('ACCOUNT') || this.authService.hasRole('AGENT2') || this.authService.hasRole('ADMIN');
  }

  onAssign() {
    if (!this.booking?._id || !this.assignToUserId) return;
    this.assigning = true;
    this.bookingService.assignBooking(this.booking._id, this.assignToUserId, this.assignComment || undefined).subscribe({
      next: () => {
        this.assigning = false;
        this.assignComment = '';
        this.toastr.success('Booking assigned successfully');
        this.loadBooking(this.booking!._id!);
      },
      error: (err) => {
        this.assigning = false;
        this.toastr.error(err?.error?.message || 'Assign failed', 'Error');
      }
    });
  }

  canCancel(): boolean {
    if (!this.booking) return false;
    const user = this.authService.getCurrentUserValue();
    if (!user || !['AGENT1', 'AGENT2', 'ACCOUNT', 'ADMIN'].includes(user.role)) return false;
    return !this.booking.cancellation || !this.booking.cancellation.isCancelled;
  }

  canProcessRefund(): boolean {
    if (!this.booking || !this.booking.cancellation || !this.booking.cancellation.isCancelled) return false;
    const user = this.authService.getCurrentUserValue();
    return user?.role === 'ACCOUNT' || user?.role === 'ADMIN';
  }

  verifyBooking() {
    if (!this.booking) return;
    const user = this.authService.getCurrentUserValue();
    if (!user) return;

    let update: any = {};
    if (user.role === 'ADMIN') {
      update = { adminVerified: true };
    } else if (user.role === 'ACCOUNT') {
      update = { accountVerified: true };
    } else {
      return;
    }

    this.bookingService.updateBooking(this.booking._id!, update).subscribe({
      next: () => {
        this.toastr.success('Booking verified successfully', 'Success');
        this.loadBooking(this.booking!._id!);
      },
      error: (err) => this.toastr.error(err?.error?.message || 'Verification failed', 'Error')
    });
  }

  onDateChange() {
    if (this.dateChangeForm.invalid) {
      this.dateChangeForm.markAllAsTouched();
      return;
    }
    if (this.booking) {
      const formValue = this.dateChangeForm.value;
      const paymentsPayload = (formValue.payments || []).map((p: any) => ({
        paidAmount: typeof p.paidAmount === 'number' ? p.paidAmount : parseFloat(p.paidAmount) || 0,
        paymentMode: p.paymentMode || 'Cash',
        paymentDate: p.paymentDate ? new Date(p.paymentDate) : new Date(),
        referenceNo: p.referenceNo || ''
      }));
      const payload = {
        changeTravelDate: formValue.changeTravelDate,
        changeReturnDate: formValue.changeReturnDate,
        newTravelDate: formValue.newTravelDate,
        newReturnDate: formValue.newReturnDate,
        newOurCost: formValue.newOurCost,
        newSalePrice: formValue.newSalePrice,
        payments: paymentsPayload,
        remarks: formValue.remarks
      };
      this.bookingService.dateChange(this.booking._id!, payload).subscribe({
        next: () => {
          this.showDateChangeForm = false;
          this.loadBooking(this.booking!._id!);
        },
        error: (err) => this.toastr.error(err?.error?.message || 'Date change failed', 'Error')
      });
    }
  }

  onFlightChange() {
    if (this.flightChangeForm.invalid) {
      this.flightChangeForm.markAllAsTouched();
      return;
    }
    if (this.booking) {
      const formValue = this.flightChangeForm.value;
      const newDetails: any = {};
      if (formValue.airline) newDetails.airline = formValue.airline;
      if (formValue.from) newDetails.from = formValue.from;
      if (formValue.to) newDetails.to = formValue.to;
      if (formValue.travelDate) newDetails.travelDate = formValue.travelDate;
      if (formValue.returnDate && this.booking?.returnDate) newDetails.returnDate = formValue.returnDate;
      const paymentsPayload = (formValue.payments || []).map((p: any) => ({
        paidAmount: typeof p.paidAmount === 'number' ? p.paidAmount : parseFloat(p.paidAmount) || 0,
        paymentMode: p.paymentMode || 'Cash',
        paymentDate: p.paymentDate ? new Date(p.paymentDate) : new Date(),
        referenceNo: p.referenceNo || ''
      }));

      this.bookingService.flightChange(this.booking._id!, {
        newDetails,
        newOurCost: formValue.newOurCost,
        newSalePrice: formValue.newSalePrice,
        payments: paymentsPayload,
        remarks: formValue.remarks
      }).subscribe({
        next: () => {
          this.showFlightChangeForm = false;
          this.loadBooking(this.booking!._id!);
        },
        error: (err) => this.toastr.error(err?.error?.message || 'Flight change failed', 'Error')
      });
    }
  }

  onCancel() {
    const isCardFlow = this.isClientOrCompanyCard || this.isPartialPaidCard;
    if (isCardFlow) {
      this.cancelForm.patchValue({ paymentModeWas: 'Credit Card' });
    }

    if (this.cancelForm.invalid) {
      this.cancelForm.markAllAsTouched();
      return;
    }
    const formValue = this.cancelForm.getRawValue();
    const paymentModeWas = isCardFlow ? 'Credit Card' : formValue.paymentModeWas;
    
    if (this.booking && paymentModeWas) {
      const isCC = paymentModeWas === 'Credit Card';
      this.bookingService.cancelBooking(this.booking._id!, {
        paymentModeWas: paymentModeWas,
        refundableAmount: formValue.refundableAmount || 0,
        committedToClient: isCC ? formValue.committedToClient : this.refundCommittedToClientNonCC,
        chargeFromClient: formValue.chargeFromClient,
        supplierCancellationCharges: formValue.supplierCancellationCharges ?? 0,
        ourCancellationCharges: formValue.ourCancellationCharges ?? 0,
        remarks: formValue.remarks,
        cancellationType: this.isPartialPaidCard ?
                          (this.booking.cardType === 'Client Card' ? 'partialPaidClientCard' : 'partialPaidCompanyCard') :
                          this.isClientCardPartialPayment ? 'clientCardPartialPayment' :
                          this.isClientOrCompanyCard ?
                          (this.booking.cardType === 'Client Card' ? 'clientCard' : 'companyCard') :
                          formValue.cancellationType,
        totalSupplierTook: (this.isClientOrCompanyCard || this.isPartialPaidCard) ? this.cancelTotalSupplierTook : 0,
        totalCharges: (this.isClientOrCompanyCard || this.isPartialPaidCard) ? this.cancelTotalCharges : 0,
        clientReceives: this.isClientOrCompanyCard ? 
                        (this.booking.cardType === 'Company Card' ? this.cancelCompanyCardClientReceives : this.cancelClientCardClientReceives) : 0,
        newMargin: (this.isClientOrCompanyCard || this.isPartialPaidCard) ? this.cancelClientCardNewMargin : 0,
        supplierWillReturn: this.isClientOrCompanyCard ? 
                            (this.booking.cardType === 'Company Card' ? this.cancelCompanyCardSupplierWillReturn : this.cancelClientCardSupplierWillReturn) : 0,
        upfrontNeeded: this.isClientOrCompanyCard && this.booking.cardType === 'Client Card' ? this.cancelClientCardUpfrontNeeded : 0
      }).subscribe({
        next: () => {
          this.showCancelForm = false;
          this.loadBooking(this.booking!._id!);
        },
        error: (err) => this.toastr.error(err?.error?.message || 'Cancellation failed', 'Error')
      });
    }
  }

  processRefund() {
    if (this.booking) {
      this.bookingService.processRefund(this.booking._id!).subscribe({
        next: () => {
          this.loadBooking(this.booking!._id!);
        }
      });
    }
  }

  saveRefundReceived() {
    if (!this.booking || !this.refundReceivedDate) return;
    this.savingRefundReceived = true;
    this.bookingService.updateRefundStatus(this.booking._id!, {
      refundReceivedFromSupplier: { date: this.refundReceivedDate, remarks: this.refundReceivedRemarks }
    }).subscribe({
      next: () => {
        this.savingRefundReceived = false;
        this.toastr.success('Refund Received from Supplier saved', 'Success');
        this.loadBooking(this.booking!._id!);
      },
      error: (err) => {
        this.savingRefundReceived = false;
        this.toastr.error(err?.error?.message || 'Failed to save', 'Error');
      }
    });
  }

  saveRefundPaid() {
    if (!this.booking || !this.refundPaidDate) return;
    this.savingRefundPaid = true;
    this.bookingService.updateRefundStatus(this.booking._id!, {
      refundPaidToClient: { date: this.refundPaidDate, remarks: this.refundPaidRemarks }
    }).subscribe({
      next: () => {
        this.savingRefundPaid = false;
        this.toastr.success('Refund Paid to Client saved', 'Success');
        this.loadBooking(this.booking!._id!);
      },
      error: (err) => {
        this.savingRefundPaid = false;
        this.toastr.error(err?.error?.message || 'Failed to save', 'Error');
      }
    });
  }

  get oldMargin(): number {
    if (!this.booking) return 0;
    return (this.booking.salePrice || 0) - (this.booking.ourCost || 0);
  }

  /** Sum of Date Change our-cost add-ons (refund not applicable) */
  get dateChangeOurAddon(): number {
    if (!this.booking?.dateChanges?.length) return 0;
    return (this.booking.dateChanges as { ourCostAddon?: number }[]).reduce((s, d) => s + (Number(d.ourCostAddon) || 0), 0);
  }
  /** Sum of Date Change sale-price add-ons */
  get dateChangeSaleAddon(): number {
    if (!this.booking?.dateChanges?.length) return 0;
    return (this.booking.dateChanges as { salePriceAddon?: number }[]).reduce((s, d) => s + (Number(d.salePriceAddon) || 0), 0);
  }
  /** Sum of Flight Change our-cost add-ons (refund not applicable) */
  get flightChangeOurAddon(): number {
    if (!this.booking?.flightChanges?.length) return 0;
    return (this.booking.flightChanges as { ourCostAddon?: number }[]).reduce((s, d) => s + (Number(d.ourCostAddon) || 0), 0);
  }
  /** Sum of Flight Change sale-price add-ons */
  get flightChangeSaleAddon(): number {
    if (!this.booking?.flightChanges?.length) return 0;
    return (this.booking.flightChanges as { salePriceAddon?: number }[]).reduce((s, d) => s + (Number(d.salePriceAddon) || 0), 0);
  }
  /** Base our cost (before date/flight change add-ons) */
  get baseOurCost(): number {
    if (!this.booking) return 0;
    return Math.max(0, (Number(this.booking.ourCost) || 0) - this.dateChangeOurAddon - this.flightChangeOurAddon);
  }
  /** Base sale price (before date/flight change add-ons) */
  get baseSalePrice(): number {
    if (!this.booking) return 0;
    return Math.max(0, (Number(this.booking.salePrice) || 0) - this.dateChangeSaleAddon - this.flightChangeSaleAddon);
  }
  /** Base margin (for refund/cancel calculations – on base sale and cost only) */
  get baseMargin(): number {
    return this.baseSalePrice - this.baseOurCost - (this.booking?.supplierCharges || 0);
  }

  get totalSalePriceForCancel(): number {
    // Cancellation calculations are base-only (excluding date/flight add-ons).
    return this.baseSalePrice;
  }

  /** Portion of sale price that is refundable (excludes Date Change & Flight Change add-ons). */
  get refundablePortionOfSalePrice(): number {
    return this.baseSalePrice;
  }

  get cancelRefundableToClient(): number {
    const scc = this.cancelForm?.get('supplierCancellationCharges')?.value ?? 0;
    return Math.max(0, this.refundablePortionOfSalePrice - scc);
  }

  get cancelCurrentMargin(): number {
    if (!this.booking) return 0;
    const paymentMode = this.cancelForm?.get('paymentModeWas')?.value;
    if (paymentMode === 'Credit Card') {
      return this.cancelOldMarginCC;
    }
    const scc = this.cancelForm?.get('supplierCancellationCharges')?.value ?? 0;
    const refundable = this.cancelRefundableToClient;
    return this.baseMargin + scc + refundable - this.refundablePortionOfSalePrice;
  }

  /** Credit Card cancel: Old Margin = 0 when Any Charges From Client empty; else if Charge < Base Margin then Base Margin − Charge else Base Margin */
  get cancelOldMarginCC(): number {
    const chargeRaw = this.cancelForm?.get('chargeFromClient')?.value;
    if (chargeRaw === null || chargeRaw === undefined || chargeRaw === '') return 0;
    const charge = typeof chargeRaw === 'number' ? chargeRaw : parseFloat(chargeRaw);
    if (isNaN(charge) || charge <= 0) return 0;
    const base = this.baseMargin;
    return charge < base ? base - charge : base;
  }

  get cancelRefundCommittedToClient(): number {
    const scc = this.cancelForm?.get('supplierCancellationCharges')?.value ?? 0;
    const charge = this.cancelForm?.get('chargeFromClient')?.value ?? 0;
    const chargeNum = typeof charge === 'number' ? charge : parseFloat(charge) || 0;
    return Math.max(0, this.refundablePortionOfSalePrice - scc - chargeNum);
  }

  get cancelTotalCancellationCharges(): number {
    const scc = this.cancelForm?.get('supplierCancellationCharges')?.value ?? 0;
    const occ = this.cancelForm?.get('ourCancellationCharges')?.value ?? 0;
    return this.baseMargin + scc + occ;
  }

  get cancelRefundableCommittedToClient(): number {
    return Math.max(0, this.refundablePortionOfSalePrice - this.cancelTotalCancellationCharges);
  }

  /** Non–Credit Card: Refund Committed To Client = Total Sale Price − Total Cancellation Charges (read-only, no textbox) */
  get refundCommittedToClientNonCC(): number {
    return Math.max(0, this.totalSalePriceForCancel - this.cancelTotalCancellationCharges);
  }

  /** Supplier Refund Amount mode: Supplier Deducted = Our Cost − Supplier Refund Amount */
  get supplierDeductedRefundMode(): number {
    const sra = this.cancelForm?.get('supplierCancellationCharges')?.value ?? 0;
    const ourCost = this.baseOurCost;
    return ourCost - Number(sra);
  }

  /** Supplier Refund Amount mode: Refund Committed To Client = Supplier Refund Amount − Our Cancellation Charges */
  get refundCommittedToClientRefundMode(): number {
    const sra = this.cancelForm?.get('supplierCancellationCharges')?.value ?? 0;
    const occ = this.cancelForm?.get('ourCancellationCharges')?.value ?? 0;
    return Math.max(0, Number(sra) - Number(occ));
  }

  /** SCC mode: New Margin = (Sale Price − Committed To Client) − Supplier Deducted */
  get cancelNewMarginSCC(): number {
    const scc = Number(this.cancelForm?.get('supplierCancellationCharges')?.value) || 0;
    return Math.round((this.totalSalePriceForCancel - this.refundCommittedToClientNonCC - scc) * 100) / 100;
  }

  /** SRA mode: New Margin = (Sale Price − Committed To Client) − Supplier Deducted */
  get cancelNewMarginSRA(): number {
    return Math.round((this.totalSalePriceForCancel - this.refundCommittedToClientRefundMode - this.supplierDeductedRefundMode) * 100) / 100;
  }

  get newMargin(): number {
    if (!this.booking || !this.cancelForm) return 0;
    const formValue = this.cancelForm.getRawValue();
    const paymentMode = formValue.paymentModeWas;

    if (paymentMode === 'Credit Card') {
      const chargeRaw = formValue.chargeFromClient;
      const charge = (chargeRaw !== null && chargeRaw !== undefined && chargeRaw !== '') ? (typeof chargeRaw === 'number' ? chargeRaw : parseFloat(chargeRaw) || 0) : 0;
      const base = this.baseMargin;
      return charge > base ? charge - base : 0;
    } else {
      const isRefundMode = formValue.cancellationType === 'supplierRefundAmount';
      const sra = Number(formValue.supplierCancellationCharges) || 0; // scc field used for refund amount in refund mode
      const occ = Number(formValue.ourCancellationCharges) || 0;
      const committed = isRefundMode ? this.refundCommittedToClientRefundMode : this.refundCommittedToClientNonCC;
      
      // Profit = (Sale Price - Committed to Client) - (Our Cost - Supplier Refund)
      const inflow = this.refundablePortionOfSalePrice - committed;
      const supplierRefund = isRefundMode ? sra : (this.baseOurCost - sra); // In charge mode, supplier refund = our cost - charge
      const outflow = this.baseOurCost - supplierRefund;
      
      return inflow - outflow;
    }
  }

  get expectedSupplierReturn(): number {
    if (!this.booking?.cancellation) return 0;
    const c = this.booking.cancellation;

    if (c.cancellationType === 'partialPaidCancellationCharges') {
      const paidAmount = Number(this.booking.totalPaidAmount) || 0;
      const scc = Number(c.supplierCancellationCharges) || 0;
      return Math.round(paidAmount - scc);
    }
    
    if (c.cancellationType === 'partialPaidRefundAmount') {
      return Math.round(c.supplierRefundAmount || 0);
    }

    if (c.cancellationType === 'clientCard' || c.cancellationType === 'companyCard' || c.cancellationType === 'partialPaidClientCard' || c.cancellationType === 'partialPaidCompanyCard') {
      const baseOurCost = (Number(this.booking.ourCost) || 0) - this.dateChangeOurAddon - this.flightChangeOurAddon;
      return baseOurCost;
    }
    if (c.cancellationType === 'supplierRefundAmount') {
      return c.supplierRefundAmount || 0;
    } else {
      const baseSale = this.totalSalePriceForCancel;
      const scc = c.supplierCancellationCharges || 0;
      const oldMargin = c.oldMargin || 0;
      return baseSale - scc - oldMargin;
    }
  }

  getStatusDisplay(status: string): string {
    if (status === 'Unticketed') return 'Unticketed';
    if (status === 'Ticketed') return 'Ticketed';
    return status || 'Draft';
  }

  // --- New Card Cancellation Logic ---

  get isClientCardPartialPayment(): boolean {
    return !!this.booking &&
           this.booking.cardType === 'Client Card' &&
           (this.booking.paymentFromCard || 0) < (this.booking.salePrice || 0) &&
           !this.isPartialPaid;
  }

  get clientCardPartialOurMargin(): number {
    if (!this.booking) return 0;
    return Math.round((this.booking.salePrice || 0) - (this.booking.ourCost || 0) - (this.booking.supplierCharges || 0));
  }

  get clientCardPartialTotalSupplierTook(): number {
    const supplierCharges = this.booking?.supplierCharges ?? 0;
    const scc = Number(this.cancelForm?.get('supplierCancellationCharges')?.value ?? 0);
    return Math.round((supplierCharges + scc) * 100) / 100;
  }

  get clientCardPartialNewMargin(): number {
    const ourMargin = this.clientCardPartialOurMargin;
    const occ = Number(this.cancelForm?.get('ourCancellationCharges')?.value || 0);
    return Math.round((ourMargin + occ) * 100) / 100;
  }

  get clientCardPartialTotalCharges(): number {
    return Math.round((this.clientCardPartialTotalSupplierTook + this.clientCardPartialNewMargin) * 100) / 100;
  }

  get clientCardPartialRemainingAmount(): number {
    if (!this.booking) return 0;
    const salePrice = this.booking.salePrice || 0;
    const paymentFromCard = this.booking.paymentFromCard || 0;
    return Math.round(salePrice - paymentFromCard);
  }

  get clientCardPartialSupplierWillReturn(): number {
    const paymentFromCard = this.booking?.paymentFromCard ?? 0;
    const scc = Number(this.cancelForm?.get('supplierCancellationCharges')?.value ?? 0);
    return Math.round((paymentFromCard - scc) * 100) / 100;
  }

  get clientCardPartialUpfrontNeeded(): number {
    const salePrice = this.booking?.salePrice ?? 0;
    const paymentFromCard = this.booking?.paymentFromCard ?? 0;
    const remainingAmount = Math.round((salePrice - paymentFromCard) * 100) / 100;
    const totalCharges = this.clientCardPartialTotalCharges;
    
    if (remainingAmount < totalCharges) {
      return Math.round((totalCharges - remainingAmount) * 100) / 100;
    }
    return 0;
  }

  get clientCardPartialClientReceives(): number {
    const paymentFromCard = this.booking?.paymentFromCard ?? 0;
    const salePrice = this.booking?.salePrice ?? 0;
    const remainingAmount = Math.round((salePrice - paymentFromCard) * 100) / 100;
    const totalCharges = this.clientCardPartialTotalCharges;
    
    if (remainingAmount < totalCharges) {
      return paymentFromCard;
    }
    return Math.round((paymentFromCard + (remainingAmount - totalCharges)) * 100) / 100;
  }

  get isClientOrCompanyCard(): boolean {
    return !!this.booking &&
           !this.isPartialPaid &&
           !this.isClientCardPartialPayment &&
           (this.booking.cardType === 'Client Card' || this.booking.cardType === 'Company Card');
  }

  get cancelOurMargin(): number {
    if (!this.booking) return 0;
    const salePrice = this.baseSalePrice;
    const ourCost = this.baseOurCost;
    const supplierCharges = this.booking.supplierCharges || 0;
    return Math.round((salePrice - ourCost - supplierCharges) * 100) / 100;
  }

  get cancelTotalSupplierTook(): number {
    const supplierCharges = this.booking?.supplierCharges || 0;
    const scc = Number(this.cancelForm?.get('supplierCancellationCharges')?.value) || 0;
    return Math.round((supplierCharges + scc) * 100) / 100;
  }

  get cancelClientCardNewMargin(): number {
    const ourMargin = this.cancelOurMargin;
    const occ = Number(this.cancelForm?.get('ourCancellationCharges')?.value) || 0;
    return Math.round((ourMargin + occ) * 100) / 100;
  }

  get cancelTotalCharges(): number {
    const totalSupplierTook = this.cancelTotalSupplierTook;
    const newMargin = this.cancelClientCardNewMargin;
    return Math.round((totalSupplierTook + newMargin) * 100) / 100;
  }

  get cancelCompanyCardClientReceives(): number {
    const salePrice = this.baseSalePrice;
    const totalCharges = this.cancelTotalCharges;
    return Math.round((salePrice - totalCharges) * 100) / 100;
  }

  get cancelCompanyCardSupplierWillReturn(): number {
    if (!this.booking) return 0;
    const isCardEqualToSalePrice = this.booking.paymentFromCard === this.booking.salePrice;
    const isCardEqualToOurCost = this.booking.paymentFromCard === this.booking.ourCost;
    const salePrice = this.baseSalePrice;
    const ourCost = this.baseOurCost;
    const totalSupplierTook = this.cancelTotalSupplierTook;

    if (isCardEqualToSalePrice) {
      return Math.round((salePrice - totalSupplierTook) * 100) / 100;
    } else if (isCardEqualToOurCost) {
      return Math.round((ourCost - totalSupplierTook) * 100) / 100;
    } else {
      return Math.round((ourCost - totalSupplierTook) * 100) / 100;
    }
  }

  get cancelClientCardSupplierWillReturn(): number {
    if (!this.booking) return 0;
    const salePrice = this.baseSalePrice;
    const ourMargin = this.cancelOurMargin;
    const totalSupplierTook = this.cancelTotalSupplierTook;
    return Math.round((salePrice - ourMargin - totalSupplierTook) * 100) / 100;
  }

  get cancelClientCardUpfrontNeeded(): number {
    const occ = Number(this.cancelForm?.get('ourCancellationCharges')?.value) || 0;
    return Math.round(occ * 100) / 100;
  }

  get cancelClientCardClientReceives(): number {
    return this.cancelClientCardSupplierWillReturn;
  }

  // --- Partial Paid Cancellation Logic ---

  get isPartialPaid(): boolean {
    return this.booking?.billingStatus === 'Partial Paid';
  }

  get partialPaidOurMargin(): number {
    if (!this.booking) return 0;
    return Math.round((this.booking.salePrice || 0) - (this.booking.ourCost || 0) - (this.booking.supplierCharges || 0));
  }

  get partialPaidTotalCharges(): number {
    if (!this.booking) return 0;
    const ourMargin = this.partialPaidOurMargin;
    const supplierCharges = this.booking.supplierCharges || 0;
    const scc = this.cancelForm?.get('supplierCancellationCharges')?.value || 0;
    const occ = this.cancelForm?.get('ourCancellationCharges')?.value || 0;
    return Math.round((ourMargin + supplierCharges + scc + occ) * 100) / 100;
  }

  get partialPaidRefundToClient(): number {
    if (!this.booking) return 0;
    const paidAmount = this.booking.totalPaidAmount || 0;
    const totalCharges = this.partialPaidTotalCharges;
    return Math.round((paidAmount - totalCharges) * 100) / 100;
  }

  get partialPaidSupplierDeducted(): number {
    if (!this.booking) return 0;
    const paidAmount = this.booking.totalPaidAmount || 0;
    const sra = this.cancelForm?.get('supplierCancellationCharges')?.value || 0; // using scc field for refund amount in this mode
    return Math.round((paidAmount - sra) * 100) / 100;
  }

  get partialPaidRefundToClientSRA(): number {
    const sra = this.cancelForm?.get('supplierCancellationCharges')?.value || 0;
    const occ = this.cancelForm?.get('ourCancellationCharges')?.value || 0;
    return Math.round((sra - occ) * 100) / 100;
  }

  get partialPaidSupplierWillReturn(): number {
    if (!this.booking) return 0;
    const paidAmount = this.booking.totalPaidAmount || 0;
    const scc = this.cancelForm?.get('supplierCancellationCharges')?.value || 0;
    return Math.round((paidAmount - scc) * 100) / 100;
  }

  // --- Partial Paid Card Cancellation Logic ---

  get isPartialPaidCard(): boolean {
    return !!this.booking &&
           this.booking.billingStatus === 'Partial Paid' &&
           (this.booking.cardType === 'Client Card' ||
            this.booking.cardType === 'Company Card');
  }

  get partialPaidCardTotalSupplierTook(): number {
    const supplierCharges = this.booking?.supplierCharges || 0;
    const scc = this.cancelForm?.get('supplierCancellationCharges')?.value || 0;
    return Math.round((supplierCharges + scc) * 100) / 100;
  }

  get partialPaidCardNewMargin(): number {
    const ourMargin = this.partialPaidOurMargin;
    const occ = this.cancelForm?.get('ourCancellationCharges')?.value || 0;
    return Math.round((ourMargin + occ) * 100) / 100;
  }

  get partialPaidCardTotalCharges(): number {
    const totalSupplierTook = this.partialPaidCardTotalSupplierTook;
    const newMargin = this.partialPaidCardNewMargin;
    return Math.round((totalSupplierTook + newMargin) * 100) / 100;
  }

  get partialPaidCardUpfrontNeeded(): number {
    return this.partialPaidCardTotalCharges;
  }

  get partialPaidCardClientReceives(): number {
    const paidAmount = this.booking?.totalPaidAmount || 0;
    if (this.booking?.cardType === 'Client Card') {
      return paidAmount;
    }
    const totalCharges = this.partialPaidCardTotalCharges;
    return Math.round((paidAmount - totalCharges) * 100) / 100;
  }

  get isCardCancellation(): boolean {
    const type = this.booking?.cancellation?.cancellationType;
    return type === 'clientCard' || type === 'companyCard' || 
           type === 'partialPaidClientCard' || type === 'partialPaidCompanyCard' ||
           type === 'clientCardPartialPayment';
  }

  get isClientCardCancellation(): boolean {
    const type = this.booking?.cancellation?.cancellationType;
    return type === 'clientCard' || type === 'partialPaidClientCard';
  }

  get isCompanyCardCancellation(): boolean {
    const type = this.booking?.cancellation?.cancellationType;
    return type === 'companyCard' || type === 'partialPaidCompanyCard';
  }

  get refundCommittedToClientDisplay(): number {
    const paidAmount = this.booking?.totalPaidAmount ?? 0;
    const totalCharges = this.getCurrentTotalCharges();
    return Math.round((paidAmount - totalCharges) * 100) / 100;
  }

  private getCurrentTotalCharges(): number {
    if (!this.booking) return 0;
    
    // 1. Card scenarios (including partial)
    if (this.isPartialPaidCard || this.isClientOrCompanyCard || this.isClientCardPartialPayment) {
      if (this.isClientCardPartialPayment) return this.clientCardPartialTotalCharges;
      if (this.isPartialPaidCard) return this.partialPaidCardTotalCharges;
      return this.cancelTotalCharges;
    }
    
    // 2. Regular Partial Paid
    if (this.isPartialPaid) {
      return this.partialPaidTotalCharges;
    }
    
    // 3. Regular Fully Paid
    return this.cancelTotalCancellationCharges;
  }

  // -----------------------------------

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Draft': 'bg-gray-100 text-gray-800',
      'Submitted': 'bg-blue-100 text-blue-800',
      'Pending Verification': 'bg-yellow-100 text-yellow-800',
      'Account Verified': 'bg-green-100 text-green-800',
      'Admin Verified': 'bg-green-200 text-green-900',
      'Billed': 'bg-purple-100 text-purple-800',
      'Paid': 'bg-green-200 text-green-900',
      'Cancelled': 'bg-red-100 text-red-800',
      'Ticketed': 'bg-green-100 text-green-800',
      'Unticketed': 'bg-orange-100 text-orange-800'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  }

  getBillingStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Unpaid': 'bg-red-100 text-red-800',
      'Partial Paid': 'bg-yellow-100 text-yellow-800',
      'Fully Paid': 'bg-green-100 text-green-800'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  }
}
