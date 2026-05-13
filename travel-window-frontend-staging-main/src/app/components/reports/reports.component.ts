import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ReportService } from '../../services/report.service';
import { SupplierService, Supplier } from '../../services/supplier.service';
import { UserService, User } from '../../services/user.service';
import { Booking } from '../../services/booking.service';
import { AuthService } from '../../services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto">
      <div class="page-title-card">
        <h2 class="page-title">Reports</h2>
      </div>

      <!-- Report Type Selection -->
      <div class="card mb-6">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Select Report Type</h3>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
          <ng-container *ngIf="isAdmin() || isAccount()">
            <button (click)="selectReportType('date-wise')" class="btn" [ngClass]="selectedReportType === 'date-wise' ? 'btn-primary' : 'btn-secondary'">Date-wise</button>
            <button (click)="selectReportType('supplier-wise')" class="btn" [ngClass]="selectedReportType === 'supplier-wise' ? 'btn-primary' : 'btn-secondary'">Supplier-wise</button>
            <button (click)="selectReportType('employee-wise')" class="btn" [ngClass]="selectedReportType === 'employee-wise' ? 'btn-primary' : 'btn-secondary'">Employee-wise</button>
            <button (click)="selectReportType('pending-verification')" class="btn" [ngClass]="selectedReportType === 'pending-verification' ? 'btn-primary' : 'btn-secondary'">Pending Verification</button>
            <button (click)="selectReportType('outstanding-balance')" class="btn" [ngClass]="selectedReportType === 'outstanding-balance' ? 'btn-primary' : 'btn-secondary'">Outstanding Balance</button>
            <button (click)="selectReportType('payment-supplier')" class="btn" [ngClass]="selectedReportType === 'payment-supplier' ? 'btn-primary' : 'btn-secondary'">Payment to Supplier</button>
            <button (click)="selectReportType('unverified-payments')" class="btn" [ngClass]="selectedReportType === 'unverified-payments' ? 'btn-primary' : 'btn-secondary'">Unverified Payments</button>
            <button (click)="selectReportType('agent-margin')" class="btn" [ngClass]="selectedReportType === 'agent-margin' ? 'btn-primary' : 'btn-secondary'">Agent Margin</button>
            <button (click)="selectReportType('financial-summary')" class="btn" [ngClass]="selectedReportType === 'financial-summary' ? 'btn-primary' : 'btn-secondary'">Financial Summary</button>
          </ng-container>
          <button (click)="selectReportType('agent-booking-list')" class="btn" [ngClass]="selectedReportType === 'agent-booking-list' ? 'btn-primary' : 'btn-secondary'">Date Wise Booking List</button>
          <button (click)="selectReportType('agent-margin-report')" class="btn" [ngClass]="selectedReportType === 'agent-margin-report' ? 'btn-primary' : 'btn-secondary'">Date Wise Margin Report</button>
        </div>
      </div>

      <!-- Date-wise Report (Admin/Account Only) -->
      <div *ngIf="(isAdmin() || isAccount()) && selectedReportType === 'date-wise'" class="card mb-6">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Date-wise Report</h3>
        <form [formGroup]="dateWiseForm" (ngSubmit)="loadDateWiseReport()" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input type="date" formControlName="dateFrom" class="input" required [max]="today" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input type="date" formControlName="dateTo" class="input" required [max]="today" />
          </div>
          <div class="flex items-end">
            <button type="submit" class="btn btn-primary w-full">Generate Report</button>
          </div>
        </form>
      </div>

      <!-- Supplier-wise Report (Admin/Account Only) -->
      <div *ngIf="(isAdmin() || isAccount()) && selectedReportType === 'supplier-wise'" class="card mb-6">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Supplier-wise Report</h3>
        <form [formGroup]="supplierWiseForm" (ngSubmit)="loadSupplierWiseReport()" class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <select formControlName="supplier" class="input">
              <option value="">All Suppliers</option>
              <option *ngFor="let s of suppliers" [value]="s._id">{{ s.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input type="date" formControlName="dateFrom" class="input" [max]="today" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input type="date" formControlName="dateTo" class="input" [max]="today" />
          </div>
          <div class="flex items-end">
            <button type="submit" class="btn btn-primary w-full">Generate Report</button>
          </div>
        </form>
      </div>

      <!-- Employee-wise Report (Admin/Account Only) -->
      <div *ngIf="(isAdmin() || isAccount()) && selectedReportType === 'employee-wise'" class="card mb-6">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Employee-wise Report</h3>
        <form [formGroup]="employeeWiseForm" (ngSubmit)="loadEmployeeWiseReport()" class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            <select formControlName="employee" class="input">
              <option value="">All Employees</option>
              <option *ngFor="let u of users" [value]="u._id">{{ u.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input type="date" formControlName="dateFrom" class="input" [max]="today" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input type="date" formControlName="dateTo" class="input" [max]="today" />
          </div>
          <div class="flex items-end">
            <button type="submit" class="btn btn-primary w-full">Generate Report</button>
          </div>
        </form>
      </div>

      <!-- Payment to Supplier Report Filter (Admin/Account Only) -->
      <div *ngIf="(isAdmin() || isAccount()) && selectedReportType === 'payment-supplier'" class="card mb-6">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Date-wise Payment to Supplier Report</h3>
        <form [formGroup]="paymentSupplierForm" (ngSubmit)="loadPaymentSupplierReport()" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input type="date" formControlName="dateFrom" class="input" [max]="today" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input type="date" formControlName="dateTo" class="input" [max]="today" />
          </div>
          <div class="flex items-end">
            <button type="submit" class="btn btn-primary w-full">Generate Report</button>
          </div>
        </form>
      </div>

      <!-- Agent Margin Summary Report (Admin/Account Only) -->
      <div *ngIf="(isAdmin() || isAccount()) && selectedReportType === 'agent-margin'" class="card mb-6">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Agent Margin Report</h3>
        <form [formGroup]="agentMarginForm" (ngSubmit)="loadAgentMarginReport()" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input type="date" formControlName="dateFrom" class="input" [max]="today" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input type="date" formControlName="dateTo" class="input" [max]="today" />
          </div>
          <div class="flex items-end">
            <button type="submit" class="btn btn-primary w-full">Generate Report</button>
          </div>
        </form>
      </div>

      <!-- Loading skeleton -->
      <div *ngIf="loading" class="card space-y-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div *ngFor="let i of [1,2,3,4]" class="p-4 rounded-lg bg-gray-50 animate-pulse">
            <div class="skeleton-line w-24 h-3 mb-2"></div>
            <div class="skeleton-line w-16 h-8"></div>
          </div>
        </div>
        <div class="border-t border-gray-100 pt-4">
          <div class="skeleton-line w-40 h-5 mb-4"></div>
          <div class="space-y-2">
            <div *ngFor="let i of [1,2,3,4,5]" class="flex gap-4 animate-pulse">
              <div class="skeleton-line flex-1 h-4"></div>
              <div class="skeleton-line w-24 h-4"></div>
              <div class="skeleton-line w-20 h-4"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Date-wise Results -->
      <div *ngIf="selectedReportType === 'date-wise' && dateWiseData && !loading" class="card">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Date-wise Report Results</h3>
        <div class="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-blue-50 p-4 rounded-lg">
            <p class="text-sm text-gray-600">Total Bookings</p>
            <p class="text-2xl font-bold text-blue-900">{{ dateWiseData.summary?.totalBookings || 0 }}</p>
          </div>
          <div class="bg-green-50 p-4 rounded-lg">
            <p class="text-sm text-gray-600">Total Sale Price</p>
            <p class="text-2xl font-bold text-green-900">{{ dateWiseData.summary?.totalSalePrice | number:'1.2-2' }}</p>
          </div>
          <div class="bg-purple-50 p-4 rounded-lg">
            <p class="text-sm text-gray-600">Total Paid</p>
            <p class="text-2xl font-bold text-purple-900">{{ dateWiseData.summary?.totalPaidAmount | number:'1.2-2' }}</p>
          </div>
          <div class="bg-red-50 p-4 rounded-lg">
            <p class="text-sm text-gray-600">Total Balance</p>
            <p class="text-2xl font-bold text-red-900">{{ dateWiseData.summary?.totalBalance | number:'1.2-2' }}</p>
          </div>
        </div>
        <div class="overflow-x-auto -mx-3 sm:mx-0">
          <div class="inline-block min-w-full align-middle">
            <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">PNR</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sale Price</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr *ngFor="let booking of dateWiseData.bookings">
                <td class="px-4 py-2 text-sm">
                  <div class="flex items-center gap-1">
                    {{ booking.pnr }}
                    <button (click)="copyToClipboard(booking.pnr)" class="text-gray-400 hover:text-blue-600" title="Copy PNR">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                    </button>
                  </div>
                </td>
                <td class="px-4 py-2 text-sm">{{ booking.paxName }}</td>
                <td class="px-4 py-2 text-sm">{{ booking.totalSalePrice | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm">{{ booking.totalPaidAmount | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm">{{ booking.balanceAmount | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm">
                  <span class="badge" [ngClass]="getStatusClass(booking.status)">{{ booking.status }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <!-- Supplier-wise Results -->
      <div *ngIf="selectedReportType === 'supplier-wise' && supplierWiseData && !loading" class="card">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Supplier-wise Report Results</h3>
        <div *ngFor="let group of supplierWiseData.groups" class="mb-6">
          <h4 class="text-lg font-semibold mb-2">{{ group.supplier }}</h4>
          <div class="mb-2 grid grid-cols-3 gap-4">
            <div class="bg-gray-50 p-2 rounded">
              <span class="text-sm text-gray-600">Total Sale: </span>
              <span class="font-semibold">{{ group.totalSalePrice | number:'1.2-2' }}</span>
            </div>
            <div class="bg-gray-50 p-2 rounded">
              <span class="text-sm text-gray-600">Total Paid: </span>
              <span class="font-semibold">{{ group.totalPaidAmount | number:'1.2-2' }}</span>
            </div>
            <div class="bg-gray-50 p-2 rounded">
              <span class="text-sm text-gray-600">Balance: </span>
              <span class="font-semibold">{{ group.totalBalance | number:'1.2-2' }}</span>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">PNR</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sale Price</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr *ngFor="let booking of group.bookings">
                  <td class="px-4 py-2 text-sm">{{ booking.pnr }}</td>
                  <td class="px-4 py-2 text-sm">{{ booking.paxName }}</td>
                  <td class="px-4 py-2 text-sm">{{ booking.totalSalePrice | number:'1.2-2' }}</td>
                  <td class="px-4 py-2 text-sm">{{ booking.balanceAmount | number:'1.2-2' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Employee-wise Results -->
      <div *ngIf="selectedReportType === 'employee-wise' && employeeWiseData && !loading" class="card">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Employee-wise Report Results</h3>
        <div *ngFor="let group of employeeWiseData.groups" class="mb-6">
          <h4 class="text-lg font-semibold mb-2">{{ group.employee }}</h4>
          <div class="mb-2 grid grid-cols-3 gap-4">
            <div class="bg-gray-50 p-2 rounded">
              <span class="text-sm text-gray-600">Total Sale: </span>
              <span class="font-semibold">{{ group.totalSalePrice | number:'1.2-2' }}</span>
            </div>
            <div class="bg-gray-50 p-2 rounded">
              <span class="text-sm text-gray-600">Total Paid: </span>
              <span class="font-semibold">{{ group.totalPaidAmount | number:'1.2-2' }}</span>
            </div>
            <div class="bg-gray-50 p-2 rounded">
              <span class="text-sm text-gray-600">Balance: </span>
              <span class="font-semibold">{{ group.totalBalance | number:'1.2-2' }}</span>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">PNR</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sale Price</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr *ngFor="let booking of group.bookings">
                  <td class="px-4 py-2 text-sm">{{ booking.pnr }}</td>
                  <td class="px-4 py-2 text-sm">{{ booking.paxName }}</td>
                  <td class="px-4 py-2 text-sm">{{ booking.totalSalePrice | number:'1.2-2' }}</td>
                  <td class="px-4 py-2 text-sm">{{ booking.balanceAmount | number:'1.2-2' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Pending Verification Results -->
      <div *ngIf="selectedReportType === 'pending-verification' && pendingVerificationData && !loading" class="card">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Pending Verification Report</h3>
        <div class="mb-4">
          <p class="text-lg font-semibold">Total Pending: {{ pendingVerificationData.count || 0 }}</p>
        </div>
        <div class="overflow-x-auto -mx-3 sm:mx-0">
          <div class="inline-block min-w-full align-middle">
            <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">PNR</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Submitted By</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr *ngFor="let booking of pendingVerificationData.bookings">
                <td class="px-4 py-2 text-sm">{{ booking.pnr }}</td>
                <td class="px-4 py-2 text-sm">{{ booking.paxName }}</td>
                <td class="px-4 py-2 text-sm">{{ booking.submittedByName }}</td>
                <td class="px-4 py-2 text-sm">{{ booking.supplierName || 'N/A' }}</td>
                <td class="px-4 py-2 text-sm">
                  <span class="badge" [ngClass]="getStatusClass(booking.status)">{{ booking.status }}</span>
                </td>
                <td class="px-4 py-2 text-sm">{{ booking.dateOfSubmission | date:'dd-MM-yyyy' }}</td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <!-- Outstanding Balance Results -->
      <div *ngIf="selectedReportType === 'outstanding-balance' && outstandingBalanceData && !loading" class="card">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Outstanding Balance Report</h3>
        <div class="mb-4">
          <p class="text-lg font-semibold">Total Outstanding: {{ outstandingBalanceData.totalOutstanding | number:'1.2-2' }}</p>
          <p class="text-sm text-gray-600">Total Bookings: {{ outstandingBalanceData.count || 0 }}</p>
        </div>
        <div class="overflow-x-auto -mx-3 sm:mx-0">
          <div class="inline-block min-w-full align-middle">
            <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">PNR</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Sale</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr *ngFor="let booking of outstandingBalanceData.bookings">
                <td class="px-4 py-2 text-sm">{{ booking.pnr }}</td>
                <td class="px-4 py-2 text-sm">{{ booking.paxName }}</td>
                <td class="px-4 py-2 text-sm">{{ booking.totalSalePrice | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm">{{ booking.totalPaidAmount | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm font-semibold text-red-600">{{ booking.balanceAmount | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm">
                  <span class="badge" [ngClass]="getStatusClass(booking.status)">{{ booking.status }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </div>
      <!-- Payment to Supplier Results -->
      <div *ngIf="selectedReportType === 'payment-supplier' && paymentSupplierData && !loading" class="card">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Payment to Supplier Report Results</h3>
        <div class="overflow-x-auto -mx-3 sm:mx-0">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supplier Name</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Paid (Our Cost)</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Booking Cost (Sale Price)</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr *ngFor="let item of paymentSupplierData">
                <td class="px-4 py-2 text-sm">{{ item.date | date:'dd-MM-yyyy' }}</td>
                <td class="px-4 py-2 text-sm">{{ item.supplierName }}</td>
                <td class="px-4 py-2 text-sm text-blue-600">{{ item.paymentPaid | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm">{{ item.totalBookingCost | number:'1.2-2' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Unverified Payments Results -->
      <div *ngIf="selectedReportType === 'unverified-payments' && unverifiedPaymentsData && !loading" class="card">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-semibold text-gray-700">Unverified Payments</h3>
          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-600">Payment Type:</label>
            <select [(ngModel)]="unverifiedPaymentType" (change)="loadUnverifiedPaymentsReport()" class="input w-48 bg-white">
              <option value="all">All Payments</option>
              <option value="card">Card Payments</option>
              <option value="other">Other Payments</option>
            </select>
          </div>
        </div>
        <div class="overflow-x-auto -mx-3 sm:mx-0">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">PNR</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sale Price</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Our Cost</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supplier Charges</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Supplier Took (Cancelled)</th>
                <th *ngIf="unverifiedPaymentType !== 'other'" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Card Paid</th>
                <th *ngIf="unverifiedPaymentType !== 'other'" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Card Type</th>
                <th *ngIf="unverifiedPaymentType !== 'other'" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Last 4</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">CR / DR</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr *ngFor="let item of unverifiedPaymentsData">
                <td class="px-4 py-2 text-sm">
                  <div class="flex items-center gap-1">
                    {{ item.bookingId }}
                    <button (click)="copyToClipboard(item.bookingId)" class="text-gray-400 hover:text-blue-600" title="Copy Reference">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                    </button>
                  </div>
                </td>
                <td class="px-4 py-2 text-sm">{{ item.passengerName }}</td>
                <td class="px-4 py-2 text-sm">{{ item.salePrice | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm text-green-600 font-medium">{{ item.ourCost | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm">
                  {{ item.paymentMode }}
                  <span *ngIf="item.paymentMode === 'Machine Charge'" 
                        class="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded ml-1 font-medium">
                    Machine Charge
                  </span>
                </td>
                <td class="px-4 py-2 text-sm">{{ item.supplierName }}</td>
                <td class="px-4 py-2 text-sm">{{ item.supplierCharges || 0 | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm">
                  <span *ngIf="item.status === 'Cancelled'">{{ item.totalSupplierTook !== null ? (item.totalSupplierTook | number:'1.2-2') : '0.00' }}</span>
                  <span *ngIf="item.status !== 'Cancelled'">-</span>
                </td>
                <td *ngIf="unverifiedPaymentType !== 'other'" class="px-4 py-2 text-sm">{{ item.paymentFromCard > 0 ? item.paymentFromCard : '-' }}</td>
                <td *ngIf="unverifiedPaymentType !== 'other'" class="px-4 py-2 text-sm">{{ item.cardType || '-' }}</td>
                <td *ngIf="unverifiedPaymentType !== 'other'" class="px-4 py-2 text-sm">{{ item.cardLast4Digits || '-' }}</td>
                <td class="px-4 py-2 text-sm font-bold">
                  <ng-container *ngIf="getCRDRValue(item) as res">
                    <span *ngIf="res.type === 'CR'" class="text-green-600">CR: {{ res.value | number:'1.2-2' }}</span>
                    <span *ngIf="res.type === 'DR'" class="text-red-600">DR: {{ res.value | number:'1.2-2' }}</span>
                    <span *ngIf="!res.type">-</span>
                  </ng-container>
                </td>
                <td class="px-4 py-2 text-sm">
                  <span class="badge" [ngClass]="getStatusClass(item.status)">{{ item.status }}</span>
                </td>
                <td class="px-4 py-2 text-sm">
                  <div class="flex gap-1">
                    <button class="btn btn-primary text-xs px-2 py-1" (click)="verifyPayment(item._id)">Verify</button>
                    <a [href]="'/dashboard/bookings/' + item._id" class="btn btn-secondary text-xs px-2 py-1">View</a>
                  </div>
                </td>
              </tr>
              <tr *ngIf="unverifiedPaymentsData.length === 0">
                <td colspan="10" class="px-4 py-4 text-sm text-center text-gray-500">No unverified payments found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Agent Margin Results -->
      <div *ngIf="selectedReportType === 'agent-margin' && agentMarginData && !loading" class="card">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Agent Margin Report Results</h3>
        <div class="overflow-x-auto -mx-3 sm:mx-0">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Agent Name</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Bookings</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Sale Price</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Margin</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr *ngFor="let item of agentMarginData">
                <td class="px-4 py-2 text-sm">{{ item.agentName }}</td>
                <td class="px-4 py-2 text-sm">{{ item.totalBookings }}</td>
                <td class="px-4 py-2 text-sm">{{ item.totalSalePrice | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm font-semibold" [ngClass]="{'text-green-600': item.totalMargin > 0, 'text-red-600': item.totalMargin < 0}">
                  {{ item.totalMargin | number:'1.2-2' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Agent Booking List Filter -->
      <div *ngIf="selectedReportType === 'agent-booking-list'" class="card mb-6">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Date Wise Booking List</h3>
        <form [formGroup]="agentBookingListForm" (ngSubmit)="loadAgentBookingList()" class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Date From</label><input type="date" formControlName="dateFrom" class="input" [max]="today" /></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Date To</label><input type="date" formControlName="dateTo" class="input" [max]="today" /></div>
          <div *ngIf="isAdmin() || isAccount()"><label class="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            <select formControlName="employee" class="input"><option value="">All</option><option *ngFor="let u of users" [value]="u._id">{{ u.name }}</option></select>
          </div>
          <div class="flex items-end"><button type="submit" class="btn btn-primary w-full">Generate</button></div>
        </form>
      </div>

      <!-- Agent Booking List Results -->
      <div *ngIf="selectedReportType === 'agent-booking-list' && agentBookingListData && !loading" class="card">
        <div class="overflow-x-auto -mx-3 sm:mx-0"><table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50"><tr>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">PNR</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Booking Date</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Travel Date</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Return Date</th>
          </tr></thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr *ngFor="let b of agentBookingListData.bookings">
              <td class="px-4 py-2 text-sm">{{ b.pnr }}</td>
              <td class="px-4 py-2 text-sm">{{ b.paxName }}</td>
              <td class="px-4 py-2 text-sm">{{ b.dateOfSubmission | date:'dd-MM-yyyy' }}</td>
              <td class="px-4 py-2 text-sm">{{ b.travelDate | date:'dd-MM-yyyy' }}</td>
              <td class="px-4 py-2 text-sm">{{ b.returnDate ? (b.returnDate | date:'dd-MM-yyyy') : '-' }}</td>
            </tr>
          </tbody>
        </table></div>
      </div>

      <!-- Agent Margin Report Filter -->
      <div *ngIf="selectedReportType === 'agent-margin-report'" class="card mb-6">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Date Wise Margin Report</h3>
        <form [formGroup]="agentMarginReportForm" (ngSubmit)="loadAgentMarginDetailReport()" class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Date From</label><input type="date" formControlName="dateFrom" class="input" [max]="today" /></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Date To</label><input type="date" formControlName="dateTo" class="input" [max]="today" /></div>
          <div *ngIf="isAdmin() || isAccount()"><label class="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            <select formControlName="employee" class="input"><option value="">All</option><option *ngFor="let u of users" [value]="u._id">{{ u.name }}</option></select>
          </div>
          <div class="flex items-end"><button type="submit" class="btn btn-primary w-full">Generate</button></div>
        </form>
      </div>

      <!-- Agent Margin Report Results -->
      <div *ngIf="selectedReportType === 'agent-margin-report' && agentMarginReportData && !loading" class="card">
        <div class="mb-4 bg-green-50 p-4 rounded-lg inline-block"><p class="text-sm text-gray-600">Total Margin</p><p class="text-2xl font-bold text-green-900">{{ agentMarginReportData.totalMargin | number:'1.2-2' }}</p></div>
        <div class="overflow-x-auto -mx-3 sm:mx-0"><table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50"><tr>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">PNR</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Our Cost</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sale Price</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
          </tr></thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr *ngFor="let b of agentMarginReportData.bookings">
              <td class="px-4 py-2 text-sm">{{ b.pnr }}</td>
              <td class="px-4 py-2 text-sm">{{ b.paxName }}</td>
              <td class="px-4 py-2 text-sm">{{ b.ourCost | number:'1.2-2' }}</td>
              <td class="px-4 py-2 text-sm">{{ b.salePrice | number:'1.2-2' }}</td>
              <td class="px-4 py-2 text-sm font-semibold" [ngClass]="{'text-green-600': b.margin > 0, 'text-red-600': b.margin < 0}">{{ b.margin | number:'1.2-2' }}</td>
            </tr>
          </tbody>
        </table></div>
      </div>

      <!-- Financial Summary Filter -->
      <div *ngIf="selectedReportType === 'financial-summary'" class="card mb-6">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Date Wise Financial Summary</h3>
        <form [formGroup]="financialSummaryForm" (ngSubmit)="loadFinancialSummary()" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Date From</label><input type="date" formControlName="dateFrom" class="input" required [max]="today" /></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Date To</label><input type="date" formControlName="dateTo" class="input" required [max]="today" /></div>
          <div class="flex items-end"><button type="submit" class="btn btn-primary w-full">Generate</button></div>
        </form>
      </div>

      <!-- Financial Summary Results -->
      <div *ngIf="selectedReportType === 'financial-summary' && financialSummaryData && !loading" class="card">
        <div class="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-blue-50 p-4 rounded-lg"><p class="text-sm text-gray-600">Total Bookings</p><p class="text-2xl font-bold text-blue-900">{{ financialSummaryData.summary?.totalBookings || 0 }}</p></div>
          <div class="bg-green-50 p-4 rounded-lg"><p class="text-sm text-gray-600">Total Sale</p><p class="text-2xl font-bold text-green-900">{{ financialSummaryData.summary?.totalSale | number:'1.2-2' }}</p></div>
          <div class="bg-purple-50 p-4 rounded-lg"><p class="text-sm text-gray-600">Total Paid</p><p class="text-2xl font-bold text-purple-900">{{ financialSummaryData.summary?.totalPaid | number:'1.2-2' }}</p></div>
          <div class="bg-orange-50 p-4 rounded-lg"><p class="text-sm text-gray-600">Total Margin</p><p class="text-2xl font-bold text-orange-900">{{ financialSummaryData.summary?.totalMargin | number:'1.2-2' }}</p></div>
        </div>
        <div class="overflow-x-auto -mx-3 sm:mx-0"><table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50"><tr>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">PNR</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Our Cost</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sale Price</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
          </tr></thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr *ngFor="let b of financialSummaryData.bookings">
              <td class="px-4 py-2 text-sm">{{ b.pnr }}</td>
              <td class="px-4 py-2 text-sm">{{ b.paxName }}</td>
              <td class="px-4 py-2 text-sm">{{ b.ourCost | number:'1.2-2' }}</td>
              <td class="px-4 py-2 text-sm">{{ b.salePrice | number:'1.2-2' }}</td>
              <td class="px-4 py-2 text-sm font-semibold" [ngClass]="{'text-green-600': b.margin > 0, 'text-red-600': b.margin < 0}">{{ b.margin | number:'1.2-2' }}</td>
              <td class="px-4 py-2 text-sm">{{ b.totalPaidAmount | number:'1.2-2' }}</td>
              <td class="px-4 py-2 text-sm" [ngClass]="{'text-red-600 font-semibold': b.balanceAmount > 0}">{{ b.balanceAmount | number:'1.2-2' }}</td>
            </tr>
          </tbody>
        </table></div>
      </div>
    </div>
  `
})
export class ReportsComponent implements OnInit {
  selectedReportType: string = 'date-wise';
  loading = false;
  suppliers: Supplier[] = [];
  users: User[] = [];
  unverifiedPaymentType: string = 'all';
  today = new Date().toISOString().split('T')[0];

  dateWiseForm: FormGroup;
  supplierWiseForm: FormGroup;
  employeeWiseForm: FormGroup;
  paymentSupplierForm: FormGroup;
  agentMarginForm: FormGroup;
  agentBookingListForm: FormGroup;
  agentMarginReportForm: FormGroup;
  financialSummaryForm: FormGroup;

  dateWiseData: any = null;
  supplierWiseData: any = null;
  employeeWiseData: any = null;
  pendingVerificationData: any = null;
  outstandingBalanceData: any = null;
  paymentSupplierData: any = null;
  unverifiedPaymentsData: any = null;
  agentMarginData: any = null;
  agentBookingListData: any = null;
  agentMarginReportData: any = null;
  financialSummaryData: any = null;

  constructor(
    private reportService: ReportService,
    private supplierService: SupplierService,
    private userService: UserService,
    private authService: AuthService,
    private toastr: ToastrService,
    private fb: FormBuilder
  ) {
    this.dateWiseForm = this.fb.group({ dateFrom: [''], dateTo: [''] });
    this.supplierWiseForm = this.fb.group({ supplier: [''], dateFrom: [''], dateTo: [''] });
    this.employeeWiseForm = this.fb.group({ employee: [''], dateFrom: [''], dateTo: [''] });
    this.paymentSupplierForm = this.fb.group({ dateFrom: [''], dateTo: [''] });
    this.agentMarginForm = this.fb.group({ dateFrom: [''], dateTo: [''] });
    this.agentBookingListForm = this.fb.group({ dateFrom: [''], dateTo: [''], employee: [''] });
    this.agentMarginReportForm = this.fb.group({ dateFrom: [''], dateTo: [''], employee: [''] });
    this.financialSummaryForm = this.fb.group({ dateFrom: [''], dateTo: [''] });
  }

  isAgent(): boolean {
    const user = this.authService.getCurrentUserValue();
    return user?.role === 'AGENT1' || user?.role === 'AGENT2';
  }

  isAdmin(): boolean {
    const user = this.authService.getCurrentUserValue();
    return user?.role === 'ADMIN';
  }

  isAccount(): boolean {
    const user = this.authService.getCurrentUserValue();
    return user?.role === 'ACCOUNT';
  }

  ngOnInit() {
    const user = this.authService.getCurrentUserValue();
    if (this.isAgent()) {
      this.selectedReportType = 'agent-booking-list';
    } else {
      this.selectedReportType = 'date-wise';
    }

    this.loadSuppliers();
    this.loadUsers();

    // Only load these if user has permissions
    if (this.isAdmin() || this.isAccount()) {
      this.loadPendingVerificationReport();
      this.loadOutstandingBalanceReport();
      this.loadUnverifiedPaymentsReport();
    }
  }

  selectReportType(type: string) {
    this.selectedReportType = type;
    if (type === 'unverified-payments' && !this.unverifiedPaymentsData) {
      this.loadUnverifiedPaymentsReport();
    }
  }

  loadSuppliers() {
    this.supplierService.getSuppliers().subscribe({
      next: (suppliers) => {
        this.suppliers = suppliers;
      }
    });
  }

  loadUsers() {
    this.userService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
      }
    });
  }

  loadDateWiseReport() {
    if (this.dateWiseForm.invalid) return;

    const { dateFrom, dateTo } = this.dateWiseForm.value;
    this.loading = true;

    this.reportService.getDateWiseReport(dateFrom, dateTo).subscribe({
      next: (data) => {
        this.dateWiseData = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadSupplierWiseReport() {
    const { supplier, dateFrom, dateTo } = this.supplierWiseForm.value;
    this.loading = true;

    this.reportService.getSupplierWiseReport(supplier || undefined, dateFrom || undefined, dateTo || undefined).subscribe({
      next: (data) => {
        this.supplierWiseData = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadEmployeeWiseReport() {
    const { employee, dateFrom, dateTo } = this.employeeWiseForm.value;
    this.loading = true;

    this.reportService.getEmployeeWiseReport(employee || undefined, dateFrom || undefined, dateTo || undefined).subscribe({
      next: (data) => {
        this.employeeWiseData = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadPendingVerificationReport() {
    this.loading = true;
    this.reportService.getPendingVerificationReport().subscribe({
      next: (data) => {
        this.pendingVerificationData = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadOutstandingBalanceReport() {
    this.loading = true;
    this.reportService.getOutstandingBalanceReport().subscribe({
      next: (data) => {
        this.outstandingBalanceData = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadPaymentSupplierReport() {
    const { dateFrom, dateTo } = this.paymentSupplierForm.value;
    this.loading = true;
    this.reportService.getPaymentToSupplierReport(dateFrom || undefined, dateTo || undefined).subscribe({
      next: (data) => {
        this.paymentSupplierData = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadUnverifiedPaymentsReport() {
    this.loading = true;
    this.reportService.getUnverifiedPaymentsReport(this.unverifiedPaymentType).subscribe({
      next: (data) => {
        this.unverifiedPaymentsData = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadAgentMarginReport() {
    const { dateFrom, dateTo } = this.agentMarginForm.value;
    this.loading = true;
    this.reportService.getAgentMarginReport(dateFrom || undefined, dateTo || undefined).subscribe({
      next: (data) => {
        this.agentMarginData = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadAgentBookingList() {
    const { dateFrom, dateTo, employee } = this.agentBookingListForm.value;
    this.loading = true;
    this.reportService.getAgentBookingList(dateFrom || undefined, dateTo || undefined, employee || undefined).subscribe({
      next: (data) => {
        this.agentBookingListData = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadAgentMarginDetailReport() {
    const { dateFrom, dateTo, employee } = this.agentMarginReportForm.value;
    this.loading = true;
    this.reportService.getAgentMarginDetailReport(dateFrom || undefined, dateTo || undefined, employee || undefined).subscribe({
      next: (data) => {
        this.agentMarginReportData = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadFinancialSummary() {
    if (this.financialSummaryForm.invalid) return;
    const { dateFrom, dateTo } = this.financialSummaryForm.value;
    this.loading = true;
    this.reportService.getFinancialSummary(dateFrom, dateTo).subscribe({
      next: (data) => {
        this.financialSummaryData = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  verifyPayment(bookingId: string) {
    if (!confirm('Are you sure you want to verify this payment?')) return;
    this.reportService.verifyBookingFromReport(bookingId).subscribe({
      next: () => {
        alert('Payment verified successfully!');
        this.loadUnverifiedPaymentsReport();
      },
      error: () => {
        alert('Failed to verify payment.');
      }
    });
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.toastr.success('Copied to clipboard', 'Success');
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  }

  getCRDRValue(item: any): { type: 'CR' | 'DR' | null, value: number } {
    const salePrice = item.salePrice || 0;
    const ourCost = item.ourCost || 0;
    const supplierCharges = item.supplierCharges || 0;
    const paymentFromCard = item.paymentFromCard || 0;
    const cardType = item.cardType;

    // Special Condition: Client Card Overpayment (Paid > Sale Price)
    // Formula: paymentFromCard - ourCost (Credit from supplier)
    if (cardType === 'Client Card' && paymentFromCard < salePrice) {
      return {
        type: 'DR',
        value: Math.round((ourCost - paymentFromCard) * 100) / 100
      };
    }

    // CR Logic: (Client Card OR Company Card)
    // For card payments, the user wants to see the margin (Sale Price - Cost - Charges) as Credit.
    if (cardType === 'Client Card' || cardType === 'Company Card') {
      return {
        type: 'CR',
        value: Math.round((salePrice - ourCost - supplierCharges) * 100) / 100
      };
    }

    // DR Logic: (Cash, Transfer, etc. where no card type is assigned)
    // We owe the supplier the cost + any charges.
    return {
      type: 'DR',
      value: Math.round((ourCost + supplierCharges) * 100) / 100
    };
  }

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Draft': 'bg-gray-100 text-gray-800',
      'Submitted': 'bg-blue-100 text-blue-800',
      'Pending Verification': 'bg-yellow-100 text-yellow-800',
      'Account Verified': 'bg-green-100 text-green-800',
      'Admin Verified': 'bg-green-200 text-green-900',
