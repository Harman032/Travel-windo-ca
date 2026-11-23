import { TzDatePipe } from '../../utils/tz-date.pipe';
import { todayInTz } from '../../utils/tz';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ReportService } from '../../services/report.service';
import { SupplierService, Supplier } from '../../services/supplier.service';
import { UserService, User } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TzDatePipe],
  template: `
    <div class="max-w-7xl mx-auto">
      <div class="page-title-card">
        <h2 class="page-title">Reports</h2>
      </div>

      <!-- Report Type Selection -->
      <div class="card mb-6">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Select Report Type</h3>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 auto-rows-fr">
          <ng-container *ngIf="isAdmin() || isAccount()">
            <button (click)="selectReportType('date-wise')" class="btn h-full flex items-center justify-center text-center" [ngClass]="selectedReportType === 'date-wise' ? 'btn-primary' : 'btn-secondary'">Date-wise</button>
            <button (click)="selectReportType('employee-wise')" class="btn h-full flex items-center justify-center text-center" [ngClass]="selectedReportType === 'employee-wise' ? 'btn-primary' : 'btn-secondary'">Employee-wise</button>
            <button (click)="selectReportType('pending-verification')" class="btn h-full flex items-center justify-center text-center" [ngClass]="selectedReportType === 'pending-verification' ? 'btn-primary' : 'btn-secondary'">Pending Verification</button>
            <button (click)="selectReportType('outstanding-balance')" class="btn h-full flex items-center justify-center text-center" [ngClass]="selectedReportType === 'outstanding-balance' ? 'btn-primary' : 'btn-secondary'">Outstanding Balance</button>
            <button (click)="selectReportType('payment-to-suppliers')" class="btn h-full flex items-center justify-center text-center" [ngClass]="selectedReportType === 'payment-to-suppliers' ? 'btn-primary' : 'btn-secondary'">Payment to Suppliers</button>
            <button (click)="selectReportType('agent-margin')" class="btn h-full flex items-center justify-center text-center" [ngClass]="selectedReportType === 'agent-margin' ? 'btn-primary' : 'btn-secondary'">Agent Margin</button>
            <button (click)="selectReportType('financial-summary')" class="btn h-full flex items-center justify-center text-center" [ngClass]="selectedReportType === 'financial-summary' ? 'btn-primary' : 'btn-secondary'">Financial Summary</button>
            <button (click)="selectReportType('verified-payments')" class="btn h-full flex items-center justify-center text-center" [ngClass]="selectedReportType === 'verified-payments' ? 'btn-primary' : 'btn-secondary'">Verified Payments</button>
          </ng-container>
          <button (click)="selectReportType('agent-booking-list')" class="btn h-full flex items-center justify-center text-center" [ngClass]="selectedReportType === 'agent-booking-list' ? 'btn-primary' : 'btn-secondary'">Date Wise Booking List</button>
          <button (click)="selectReportType('agent-margin-report')" class="btn h-full flex items-center justify-center text-center" [ngClass]="selectedReportType === 'agent-margin-report' ? 'btn-primary' : 'btn-secondary'">Date Wise Margin Report</button>
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
                <td class="px-4 py-2 text-sm">{{ booking.dateOfSubmission | tzDate:'dd-MM-yyyy' }}</td>
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
      <!-- ===== Payment to Suppliers: per-supplier statement ===== -->
      <div *ngIf="selectedReportType === 'payment-to-suppliers'" class="card mb-6 no-print">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Payment to Suppliers</h3>
        <form [formGroup]="supplierStatementForm" (ngSubmit)="loadSupplierStatement()" class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Supplier <span class="text-red-600">*</span></label>
            <select formControlName="supplier" class="input">
              <option value="">Select a supplier…</option>
              <option *ngFor="let s of suppliers" [value]="s._id">{{ s.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input type="date" formControlName="dateFrom" class="input" [max]="today" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input type="date" formControlName="dateTo" class="input" [max]="today" />
          </div>
          <div class="flex items-end">
            <button type="submit" class="btn btn-primary w-full" [disabled]="!supplierStatementForm.get('supplier')?.value">Generate Statement</button>
          </div>
        </form>

        <!-- Record a payment to this supplier -->
        <div class="mt-6 pt-6 border-t border-gray-200" *ngIf="supplierStatementForm.get('supplier')?.value">
          <h4 class="text-sm font-semibold text-gray-700 mb-3">Record a payment to this supplier</h4>
          <p class="text-xs text-gray-500 mb-3">
            For a balance carried over from before the system, add a payment dated before the first
            statement period and note it "Opening balance".
          </p>
          <form [formGroup]="supplierPaymentForm" (ngSubmit)="addSupplierPayment()" class="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input type="date" formControlName="paymentDate" class="input" [max]="today" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Amount</label>
              <input type="number" step="0.01" min="0.01" formControlName="amount" class="input" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Reference</label>
              <input type="text" formControlName="reference" class="input" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Note</label>
              <input type="text" formControlName="note" class="input" />
            </div>
            <div class="flex items-end">
              <button type="submit" class="btn btn-secondary w-full" [disabled]="supplierPaymentForm.invalid || savingSupplierPayment">
                {{ savingSupplierPayment ? 'Saving…' : 'Add payment' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Statement -->
      <div *ngIf="selectedReportType === 'payment-to-suppliers' && statementData && !loading" class="card statement">
        <div class="flex justify-end mb-4 no-print">
          <button type="button" class="btn btn-secondary" (click)="printStatement()">Print / Save as PDF</button>
        </div>

        <!--
          Screen only, never printed. The caveat is about OUR inability to recover the
          cancellation scenario from OUR own stored data; printing it on a document the supplier
          receives would invite a dispute over every cancelled line, including the correct ones.
          Deliberately unconditional and uncounted: narrowing it to the affected bookings would
          need cancellationMode in the statement's projection and a flag in the payload.
        -->
        <div class="statement-provisional no-print">
          <b>Provisional:</b> cancelled lines in this period may have no stored cancellation mode;
          supplier charges on those lines may be understated. <i>(Screen only — not printed.)</i>
        </div>

        <!-- Company block -->
        <div class="statement-head">
          <div class="statement-company">
            <div class="font-bold text-lg">{{ statementData.company?.name }}</div>
            <div>{{ statementData.company?.addressLine1 }}</div>
            <div>{{ statementData.company?.addressLine2 }}</div>
            <div>{{ statementData.company?.phone }}</div>
            <div>{{ statementData.company?.email }}</div>
          </div>
          <div class="statement-meta">
            <div class="font-bold text-lg">Client Statement</div>
            <div *ngIf="statementData.dateFrom"><span class="font-semibold">From:</span> {{ statementData.dateFrom }}</div>
            <div><span class="font-semibold">To:</span> {{ statementData.dateTo || '—' }}</div>
          </div>
        </div>

        <div class="statement-supplier">{{ statementData.supplierName }}</div>

        <!-- Screen only: in print the same line is in the running head on every page. -->
        <div class="statement-generated no-print">
          Generated {{ statementData.generatedAt | tzDate:'long' }}
        </div>

        <table class="statement-table">
          <thead>
            <!-- A thead row, not a floating div: only thead repeats on every printed page. -->
            <tr class="print-running-head">
              <th colspan="9">
                {{ statementData.generatedAt | tzDate:'long' }} &nbsp;|&nbsp; Client Statement: {{ statementData.company?.name }}
              </th>
              <!--
                The row is hidden on screen and shown in print. That used to leave the screen with
                no generation time at all once the duplicate in the meta block was removed, which
                is the wrong thing to drop from a financial document an operator reads before
                sending. The screen-only line below carries it.
              -->
            </tr>
            <tr class="statement-band">
              <th>Issue Dt</th>
              <th>Invoice No</th>
              <th>Ticket No</th>
              <th>Passenger</th>
              <th>Vendor</th>
              <th>Start Dt</th>
              <th>Itinerary</th>
              <th>Verified</th>
              <th class="text-right">Fare</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="statementData.openingBalance" class="statement-opening">
              <td colspan="8">Opening balance</td>
              <td class="text-right">{{ statementData.openingBalance | number:'1.2-2' }}</td>
            </tr>

            <ng-container *ngFor="let inv of statementData.invoices">
              <ng-container *ngFor="let line of inv.lines; let first = first">
                <!-- line 1: Issue Dt, Invoice No, Remarks -->
                <tr class="statement-line-1">
                  <td>
                    {{ line.date | tzDate:'yyyy-MM-dd' }}
                    <span *ngIf="line.lateEntry && showLateEntry" class="statement-late">late</span>
                  </td>
                  <td>{{ line.invoiceNo }}</td>
                  <td colspan="7"></td>
                </tr>
                <!-- line 2: Ticket No, Passenger, Vendor, Start Dt, Itinerary, Fare -->
                <tr class="statement-line-2">
                  <td colspan="2"></td>
                  <td>{{ line.ticketNo }}</td>
                  <td>{{ clean(line.passenger) }}</td>
                  <td>{{ line.vendor | uppercase }}</td>
                  <td>{{ line.startDate ? (line.startDate | tzDate:'yyyy-MM-dd') : '' }}</td>
                  <td>{{ line.itinerary }}</td>
                  <td class="statement-verified">{{ line.verified }}</td>
                  <td class="text-right" [class.credit]="line.fare < 0">{{ line.fare | number:'1.2-2' }}</td>
                </tr>
                <tr *ngIf="line.kind === 'payment'" class="statement-line-2 no-print">
                  <td colspan="8"></td>
                  <td class="text-right">
                    <button type="button" class="text-xs text-red-600 underline" (click)="deleteSupplierPayment(line.paymentId)">delete</button>
                  </td>
                </tr>
              </ng-container>
              <tr *ngIf="inv.showSubtotal" class="statement-subtotal">
                <td colspan="8" class="text-right">Subtotal {{ inv.invoiceNo }}</td>
                <td class="text-right">{{ inv.subtotal | number:'1.2-2' }}</td>
              </tr>
            </ng-container>

            <tr *ngIf="statementData.lineCount === 0">
              <td colspan="9" class="px-4 py-8 text-center text-gray-500">No activity for this supplier in the selected period.</td>
            </tr>

            <!-- In tbody, NOT tfoot: a tfoot is a table-footer-group, which browsers repeat on
                 every printed page. Totals belong once, at the end. -->
            <tr class="statement-total">
              <td colspan="8" class="text-right">Total Open</td>
              <td class="text-right">{{ statementData.totals?.totalOpen | number:'1.2-2' }}</td>
            </tr>
            <tr class="statement-total">
              <td colspan="8" class="text-right">Account Balance</td>
              <td class="text-right">{{ statementData.totals?.accountBalance | number:'1.2-2' }}</td>
            </tr>
          </tbody>
        </table>

        <div class="text-xs text-gray-500 mt-4 no-print">
          {{ statementData.lineCount }} line(s). Negative amounts are credits. All rows shown; no paging.
        </div>
      </div>


      <!-- Verified Payments Report Filter (Admin/Account Only) -->
      <div *ngIf="(isAdmin() || isAccount()) && selectedReportType === 'verified-payments'" class="card mb-6">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Verified Payments Report</h3>
        <form [formGroup]="verifiedPaymentsForm" (ngSubmit)="loadVerifiedPayments()" class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input type="date" formControlName="dateFrom" class="input" [max]="today" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input type="date" formControlName="dateTo" class="input" [max]="today" />
          </div>
          <div *ngIf="isAdmin()">
            <label class="block text-sm font-medium text-gray-700 mb-1">Agent</label>
            <select formControlName="agent" class="input">
              <option value="all">All Agents</option>
              <option *ngFor="let u of users" [value]="u._id">{{ u.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Verification Type</label>
            <select formControlName="verificationType" class="input">
              <option value="both">Verified — both</option>
              <option value="original">Verified — original booking</option>
              <option value="cancellation">Verified — cancellation</option>
              <option value="unverified">Not yet verified — original booking</option>
              <option value="unverified-cancellation">Not yet verified — cancellation</option>
            </select>
          </div>
          <div class="flex items-end md:col-span-1">
            <button type="submit" class="btn btn-primary w-full">Generate Report</button>
          </div>
        </form>
      </div>

      <!-- Verified Payments Results -->
      <div *ngIf="selectedReportType === 'verified-payments' && verifiedPaymentsData && !loading" class="card">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Verified Payments Report Results</h3>
        
        <div class="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-blue-50 p-4 rounded-lg">
            <p class="text-sm text-gray-600">Total Bookings</p>
            <p class="text-2xl font-bold text-blue-900">{{ verifiedPaymentsData.summary?.totalBookings || 0 }}</p>
          </div>
          <div class="bg-green-50 p-4 rounded-lg">
            <p class="text-sm text-gray-600">Total Sale Price</p>
            <p class="text-2xl font-bold text-green-900">{{ verifiedPaymentsData.summary?.totalSalePrice | number:'1.2-2' }}</p>
          </div>
          <div class="bg-indigo-50 p-4 rounded-lg">
            <p class="text-sm text-gray-600">Total Our Cost</p>
            <p class="text-2xl font-bold text-indigo-900">{{ verifiedPaymentsData.summary?.totalOurCost | number:'1.2-2' }}</p>
          </div>
          <div class="bg-orange-50 p-4 rounded-lg">
            <p class="text-sm text-gray-600">Total Margin</p>
            <p class="text-2xl font-bold text-orange-900">{{ verifiedPaymentsData.summary?.totalMargin | number:'1.2-2' }}</p>
          </div>
        </div>

        <div class="overflow-x-auto -mx-3 sm:mx-0">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">PNR</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pax Name</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sale Price</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Our Cost</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supplier Charges</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Our Margin</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reference No</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Verified By</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Verified At</th>
                <th *ngIf="showingUnverified()" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr *ngFor="let b of verifiedPaymentsData.bookings">
                <td class="px-4 py-2 text-sm">{{ b.dateOfSubmission | tzDate:'dd-MM-yyyy' }}</td>
                <td class="px-4 py-2 text-sm">{{ b.pnr }}</td>
                <td class="px-4 py-2 text-sm">{{ b.paxName }}</td>
                <td class="px-4 py-2 text-sm">{{ b.submittedBy?.name }}</td>
                <td class="px-4 py-2 text-sm font-semibold">{{ b.totalSalePrice | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm">{{ b.ourCost | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm">{{ b.supplierCharges | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm font-bold text-green-700">{{ (b.totalSalePrice - b.ourCost - b.supplierCharges) | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm">{{ b.payments && b.payments.length > 0 ? b.payments[0].referenceNo : '-' }}</td>
                <td class="px-4 py-2 text-sm">{{ b.verifiedByAdminUser?.name }}</td>
                <td class="px-4 py-2 text-sm">{{ b.verifiedByAdminDate | tzDate:'dd-MM-yyyy' }}</td>
                <td *ngIf="showingUnverified()" class="px-4 py-2 text-sm">
                  <button class="btn btn-primary text-xs px-2 py-1" (click)="verifyPayment(b._id)">Verify</button>
                </td>
              </tr>
              <tr *ngIf="verifiedPaymentsData.bookings.length === 0">
                <td [attr.colspan]="showingUnverified() ? 12 : 11" class="px-4 py-8 text-center text-gray-500">
                  {{ showingUnverified() ? 'Nothing is waiting to be verified for the selected filters.' : 'No verified payments found for the selected filters.' }}
                </td>
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
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Date From</label><input type="date" formControlName="dateFrom" class="input" /></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Date To</label><input type="date" formControlName="dateTo" class="input" /></div>
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
              <td class="px-4 py-2 text-sm">{{ b.dateOfSubmission | tzDate:'dd-MM-yyyy' }}</td>
              <td class="px-4 py-2 text-sm">{{ b.travelDate | tzDate:'dd-MM-yyyy' }}</td>
              <td class="px-4 py-2 text-sm">{{ b.returnDate ? (b.returnDate | tzDate:'dd-MM-yyyy') : '-' }}</td>
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
  `,
  styles: [`
    /* Supplier statement. Printing is done by the browser: no PDF library, and a <thead>
       repeats on every page natively. "Page N of M" inside the document is not achievable in
       Chrome (no @page content counters), so the page number comes from the browser's own
       print footer. */
    .statement { font-size: 12px; }
    .statement-head { display: flex; justify-content: space-between; gap: 2rem; margin-bottom: 1rem; }
    .statement-company div, .statement-meta div { line-height: 1.4; }
    .statement-meta { text-align: right; }
    .statement-supplier { font-weight: 700; font-size: 14px; padding: 0.5rem 0; border-top: 1px solid #111; }
    .statement-table { width: 100%; border-collapse: collapse; }
    .statement-table th, .statement-table td { padding: 2px 6px; vertical-align: top; }
    /* The grey column band under the header row, as in the client's statement. */
    .statement-band th { background: #e5e7eb; border-top: 1px solid #9ca3af; border-bottom: 1px solid #9ca3af;
                         text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; }
    .statement-line-1 td { padding-top: 6px; }
    .statement-line-2 td { padding-bottom: 6px; }
    .statement-opening td { font-style: italic; border-bottom: 1px solid #d1d5db; }
    /* Underline above a subtotal, as in the client's statement. */
    .statement-subtotal td { border-top: 1px solid #111; font-weight: 600; }
    .statement-total td { border-top: 2px solid #111; font-weight: 700; }
    /* Client-requested Verified column: Account / Admin / Both / em dash. Narrow, and
       deliberately NOT .no-print -- the client asked for it on screen AND in print. */
    .statement-verified { white-space: nowrap; font-size: 11px; }
    /* "late" beside the issue date: the booking was keyed in after the day it was issued, which
       is why the line falls in this period. Prints, per the client; hidden by showLateEntry. */
    .statement-late { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
                      color: #92400e; border: 1px solid #d97706; border-radius: 2px;
                      padding: 0 2px; margin-left: 4px; vertical-align: 1px; }
    .credit { color: #b91c1c; }
    .text-right { text-align: right; }
    .statement-provisional { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px;
                             padding: 8px 12px; margin-bottom: 12px; font-size: 11px; color: #78350f; }
    .statement-generated { font-size: 11px; color: #6b7280; padding-bottom: 6px; }
    .print-running-head { display: none; }
    .print-running-head th { background: none; border: 0; font-weight: 400; text-transform: none;
                             font-size: 10px; color: #374151; padding: 0 0 4px 0; text-align: left; }

    @media print {
      /* Page numbers come from the print engine: Chrome has no @page margin boxes, so
         counter(page) cannot be rendered from the document. The app relies on the browser's
         own print footer; the generated PDF uses Chrome's headerTemplate, which carries the
         same line plus the page number. */
      @page { size: letter; margin: 14mm 12mm; }
      .no-print { display: none !important; }
      /* Everything on the page except the statement is chrome. */
      :host ::ng-deep body * { visibility: hidden; }
      .statement, .statement * { visibility: visible; }
      .statement { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: 0; padding: 0; }
      /* Repeat the header row and the running head on every page. */
      .statement-table thead { display: table-header-group; }
      .print-running-head { display: table-row; }
      /* Never split an invoice's two lines or its subtotal across a page break. */
      .statement-line-1, .statement-line-2, .statement-subtotal, .statement-total { page-break-inside: avoid; }
      .statement-line-1 { page-break-after: avoid; }
    }
  `]
})
export class ReportsComponent implements OnInit {
  /**
   * The one flag that controls the "late entry" marker on the statement.
   *
   * true  -- marked on screen AND in print, which is what the client asked for: a late entry is
   *          why a line sits in this period rather than the next, and the supplier can see from
   *          our own dates that we are not moving money between weeks arbitrarily.
   * false -- the marker disappears from both. Flip this one constant; there is no second place
   *          to change and no print rule to keep in step, which is why the cell is not .no-print.
   */
  readonly showLateEntry = true;

  /**
   * Display-only tidy-up for stored text: trim the ends and collapse runs of internal
   * whitespace. 80 stored PNRs carry stray whitespace and passenger names have the same
   * problem. Never written back -- the stored value is left exactly as it is.
   */
  clean(v: any): string {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  selectedReportType: string = 'date-wise';
  loading = false;
  suppliers: Supplier[] = [];
  users: User[] = [];
  // Toronto's today, not UTC's. The old `toISOString()` form was already tomorrow between
  // 20:00 and midnight Toronto, so every report's date picker allowed a day that had not started.
  today = todayInTz();

  dateWiseForm: FormGroup;
  employeeWiseForm: FormGroup;
  agentMarginForm: FormGroup;
  agentBookingListForm: FormGroup;
  agentMarginReportForm: FormGroup;
  financialSummaryForm: FormGroup;
  verifiedPaymentsForm: FormGroup;
  supplierStatementForm: FormGroup;
  supplierPaymentForm: FormGroup;

  dateWiseData: any = null;
  employeeWiseData: any = null;
  pendingVerificationData: any = null;
  outstandingBalanceData: any = null;
  statementData: any = null;
  savingSupplierPayment = false;
  agentMarginData: any = null;
  agentBookingListData: any = null;
  agentMarginReportData: any = null;
  financialSummaryData: any = null;
  verifiedPaymentsData: any = null;

  constructor(
    private reportService: ReportService,
    private supplierService: SupplierService,
    private userService: UserService,
    private authService: AuthService,
    private toastr: ToastrService,
    private fb: FormBuilder,
    private http: HttpClient
  ) {
    this.dateWiseForm = this.fb.group({ dateFrom: [''], dateTo: [''] });
    this.employeeWiseForm = this.fb.group({ employee: [''], dateFrom: [''], dateTo: [''] });
    this.agentMarginForm = this.fb.group({ dateFrom: [''], dateTo: [''] });
    this.agentBookingListForm = this.fb.group({ dateFrom: [''], dateTo: [''], employee: [''] });
    this.agentMarginReportForm = this.fb.group({ dateFrom: [''], dateTo: [''], employee: [''] });
    this.financialSummaryForm = this.fb.group({ dateFrom: [''], dateTo: [''] });
    this.verifiedPaymentsForm = this.fb.group({ dateFrom: [''], dateTo: [''], agent: ['all'], verificationType: ['both'] });
    this.supplierStatementForm = this.fb.group({ supplier: [''], dateFrom: [''], dateTo: [''] });
    this.supplierPaymentForm = this.fb.group({
      paymentDate: [this.today, Validators.required],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      reference: [''],
      note: ['']
    });
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
    
    if (this.isAdmin() || this.isAccount()) {
      this.loadUsers();
    }
    
    // Only load these if user has permissions
    if (this.isAdmin() || this.isAccount()) {
      this.loadPendingVerificationReport();
      this.loadOutstandingBalanceReport();
    }
  }

  handleReportError(err: any) {
    this.loading = false;
    let errorMessage = 'Unable to load report data.';
    
    if (err.status === 403 || err.status === 401) {
      errorMessage = 'Access denied.';
    } else if (err.name === 'HttpErrorResponse' && err.error instanceof SyntaxError) {
      errorMessage = 'Server returned an invalid response.';
    } else if (err.message && err.message.includes('Unexpected token')) {
      errorMessage = 'Server returned an invalid response.';
    } else if (err.error && typeof err.error.message === 'string') {
      errorMessage = err.error.message;
    }
    
    this.toastr.error(errorMessage, 'Error');
    if (err.name === 'HttpErrorResponse' && err.error instanceof SyntaxError) {
      console.error('Report API Error: Server returned an invalid response (likely HTML instead of JSON).');
    } else if (err.message && err.message.includes('Unexpected token')) {
      console.error('Report API Error: Server returned an invalid response (likely HTML instead of JSON).');
    } else {
      console.error('Report API Error:', err);
    }
  }

  selectReportType(type: string) {
    this.selectedReportType = type;
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
      error: (err) => this.handleReportError(err)
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
      error: (err) => this.handleReportError(err)
    });
  }

  loadPendingVerificationReport() {
    this.loading = true;
    this.reportService.getPendingVerificationReport().subscribe({
      next: (data) => {
        this.pendingVerificationData = data;
        this.loading = false;
      },
      error: (err) => this.handleReportError(err)
    });
  }

  loadOutstandingBalanceReport() {
    this.loading = true;
    this.reportService.getOutstandingBalanceReport().subscribe({
      next: (data) => {
        this.outstandingBalanceData = data;
        this.loading = false;
      },
      error: (err) => this.handleReportError(err)
    });
  }


  loadSupplierStatement() {
    const { supplier, dateFrom, dateTo } = this.supplierStatementForm.value;
    if (!supplier) {
      this.toastr.error('Choose a supplier first', 'Error');
      return;
    }
    this.loading = true;
    this.reportService.getSupplierStatement(supplier, dateFrom || undefined, dateTo || undefined).subscribe({
      next: (data) => {
        this.statementData = data;
        this.loading = false;
      },
      error: (err) => this.handleReportError(err)
    });
  }

  addSupplierPayment() {
    const supplier = this.supplierStatementForm.get('supplier')?.value;
    if (!supplier || this.supplierPaymentForm.invalid) return;
    this.savingSupplierPayment = true;
    this.reportService.addSupplierPayment({ supplier, ...this.supplierPaymentForm.value }).subscribe({
      next: () => {
        this.savingSupplierPayment = false;
        this.toastr.success('Payment recorded', 'Success');
        this.supplierPaymentForm.reset({ paymentDate: this.today, amount: null, reference: '', note: '' });
        if (this.statementData) this.loadSupplierStatement();
      },
      error: (err) => {
        this.savingSupplierPayment = false;
        this.handleReportError(err);
      }
    });
  }

  deleteSupplierPayment(paymentId: string) {
    if (!paymentId) return;
    if (!confirm('Delete this recorded payment? There is no edit; a wrong entry is deleted and re-entered.')) return;
    this.reportService.deleteSupplierPayment(paymentId).subscribe({
      next: () => {
        this.toastr.success('Payment deleted', 'Success');
        this.loadSupplierStatement();
      },
      error: (err) => this.handleReportError(err)
    });
  }

  /**
   * The browser's own print dialog produces the PDF. No PDF library is needed: a <thead> repeats
   * on every printed page natively, and the print dialog offers "Save as PDF". The one thing it
   * cannot do is render "Page N of M" inside the document — Chrome does not support CSS @page
   * counters for arbitrary content — so the page number comes from the browser's own footer.
   */
  printStatement() {
    window.print();
  }

  loadAgentMarginReport() {
    const { dateFrom, dateTo } = this.agentMarginForm.value;
    this.loading = true;
    this.reportService.getAgentMarginReport(dateFrom || undefined, dateTo || undefined).subscribe({
      next: (data) => {
        this.agentMarginData = data;
        this.loading = false;
      },
      error: (err) => this.handleReportError(err)
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
      error: (err) => this.handleReportError(err)
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
      error: (err) => this.handleReportError(err)
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
      error: (err) => this.handleReportError(err)
    });
  }

  /** True when the Verified Payments screen is showing the not-yet-verified side. */
  showingUnverified(): boolean {
    const t = this.verifiedPaymentsForm.get('verificationType')?.value;
    return t === 'unverified' || t === 'unverified-cancellation';
  }

  verifyPayment(bookingId: string) {
    if (!confirm('Are you sure you want to verify this payment?')) return;
    this.reportService.verifyBookingFromReport(bookingId).subscribe({
      next: () => {
        this.toastr.success('Payment verified', 'Success');
        // Reload whichever screen the action was taken from.
        this.loadVerifiedPayments();
      },
      error: (err) => this.handleReportError(err)
    });
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.toastr.success('Copied to clipboard', 'Success');
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  }


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

  loadVerifiedPayments() {
    const params = this.verifiedPaymentsForm.value;
    this.loading = true;
    
    this.http.get(`${environment.apiUrl}/reports/verified-payments`, { params }).subscribe({
      next: (data: any) => {
        this.verifiedPaymentsData = data;
        this.loading = false;
      },
      error: (err) => this.handleReportError(err)
    });
  }
}
