import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PaymentService, PaymentRow, PaymentsResponse, PaymentModeFilter } from '../../../services/payment.service';
const PAYMENT_MODES: PaymentModeFilter[] = [
  'All Modes',
  'Bank Transfer',
  'Credit Card',
  'Cheque',
  'Cash',
  'UPI',
];

@Component({
  selector: 'app-payments-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="max-w-7xl mx-auto">
      <div class="page-title-card">
        <h2 class="page-title">Payments Management</h2>
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <ng-container *ngIf="loading">
          <div *ngFor="let i of [1,2,3]" class="card animate-pulse">
            <div class="skeleton-line w-28 h-3 mb-2"></div>
            <div class="skeleton-line w-20 h-8"></div>
          </div>
        </ng-container>
        <ng-container *ngIf="!loading">
          <div class="card">
            <p class="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Payments</p>
            <p class="mt-1 text-2xl font-semibold text-primary-600">{{ summary.totalPayments }}</p>
          </div>
          <div class="card">
            <p class="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Amount</p>
            <p class="mt-1 text-2xl font-semibold text-primary-600">₹{{ summary.totalAmount | number:'1.0-0' }}</p>
          </div>
          <div class="card">
            <p class="text-sm font-medium text-gray-500 uppercase tracking-wider">Average Payment</p>
            <p class="mt-1 text-2xl font-semibold text-primary-600">₹{{ summary.averagePayment | number:'1.2-2' }}</p>
          </div>
        </ng-container>
      </div>

      <!-- Filters -->
      <div class="card mb-6">
        <h3 class="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Booking PNR</label>
            <input
              type="text"
              [(ngModel)]="filters.pnr"
              (ngModelChange)="loadPayments()"
              class="input"
              placeholder="Search by PNR"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
            <select
              [(ngModel)]="filters.paymentMode"
              (ngModelChange)="loadPayments()"
              class="input"
            >
              <option *ngFor="let m of paymentModes" [value]="m">{{ m }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              [(ngModel)]="filters.startDate"
              (ngModelChange)="loadPayments()"
              class="input"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              [(ngModel)]="filters.endDate"
              (ngModelChange)="loadPayments()"
              class="input"
            />
          </div>
        </div>
      </div>

      <!-- Payments table -->
      <div class="card overflow-x-auto -mx-3 sm:mx-0">
        <div class="inline-block min-w-full align-middle">
          <!-- Loading skeleton -->
          <table *ngIf="loading" class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking PNR</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Passenger</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mode</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added By</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr *ngFor="let i of [1,2,3,4,5]" class="animate-pulse">
                <td class="px-6 py-4 whitespace-nowrap"><div class="skeleton-line w-20 h-4"></div></td>
                <td class="px-6 py-4 whitespace-nowrap"><div class="skeleton-line w-16 h-4"></div></td>
                <td class="px-6 py-4 whitespace-nowrap"><div class="skeleton-line w-24 h-4"></div></td>
                <td class="px-6 py-4 whitespace-nowrap"><div class="skeleton-line w-14 h-4"></div></td>
                <td class="px-6 py-4 whitespace-nowrap"><div class="skeleton-line w-20 h-4"></div></td>
                <td class="px-6 py-4"><div class="skeleton-line w-24 h-4"></div></td>
                <td class="px-6 py-4 whitespace-nowrap"><div class="skeleton-line w-20 h-4"></div></td>
              </tr>
            </tbody>
          </table>
          <!-- Actual table -->
          <table *ngIf="!loading" class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking PNR</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Passenger</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mode</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added By</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr *ngIf="payments.length === 0" class="bg-white">
                <td colspan="7" class="px-6 py-8 text-center text-gray-500">No payments found.</td>
              </tr>
              <tr *ngFor="let p of payments" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ p.date | date:'d/M/yyyy' }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600">
                  <a [routerLink]="['/dashboard/bookings', p.bookingId]" class="hover:underline">{{ p.bookingPnr }}</a>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ p.passenger }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{{ p.amount | number:'1.0-0' }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ p.mode }}</td>
                <td class="px-6 py-4 text-sm text-gray-600">{{ p.reference }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{{ p.addedBy }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class PaymentsManagementComponent implements OnInit {
  payments: PaymentRow[] = [];
  summary = { totalPayments: 0, totalAmount: 0, averagePayment: 0 };
  loading = true;
  paymentModes = PAYMENT_MODES;
  filters = {
    pnr: '',
    paymentMode: 'All Modes' as PaymentModeFilter,
    startDate: '' as string,
    endDate: '' as string,
  };

  constructor(private paymentService: PaymentService) {}

  ngOnInit() {
    this.loadPayments();
  }

  loadPayments() {
    this.loading = true;
    const f = this.filters;
    this.paymentService.getPayments({
      pnr: f.pnr || undefined,
      paymentMode: f.paymentMode === 'All Modes' ? undefined : f.paymentMode,
      startDate: f.startDate || undefined,
      endDate: f.endDate || undefined,
    }).subscribe({
      next: (res: PaymentsResponse) => {
        this.payments = res.payments;
        this.summary = res.summary;
        this.loading = false;
      },
      error: () => {
        this.payments = [];
        this.summary = { totalPayments: 0, totalAmount: 0, averagePayment: 0 };
        this.loading = false;
      },
    });
  }
}
