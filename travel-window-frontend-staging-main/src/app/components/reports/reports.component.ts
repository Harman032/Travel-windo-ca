import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ReportService } from '../../services/report.service';
import { SupplierService, Supplier } from '../../services/supplier.service';
import { UserService, User } from '../../services/user.service';
import { Booking } from '../../services/booking.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-7xl mx-auto">
      <div class="page-title-card">
        <h2 class="page-title">Reports</h2>
      </div>

      <!-- Report Type Selection -->
      <div class="card mb-6">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Select Report Type</h3>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
          <button 
            (click)="selectReportType('date-wise')" 
            class="btn" 
            [ngClass]="selectedReportType === 'date-wise' ? 'btn-primary' : 'btn-secondary'"
          >
            Date-wise
          </button>
          <button 
            (click)="selectReportType('supplier-wise')" 
            class="btn" 
            [ngClass]="selectedReportType === 'supplier-wise' ? 'btn-primary' : 'btn-secondary'"
          >
            Supplier-wise
          </button>
          <button 
            (click)="selectReportType('employee-wise')" 
            class="btn" 
            [ngClass]="selectedReportType === 'employee-wise' ? 'btn-primary' : 'btn-secondary'"
          >
            Employee-wise
          </button>
          <button 
            (click)="selectReportType('pending-verification')" 
            class="btn" 
            [ngClass]="selectedReportType === 'pending-verification' ? 'btn-primary' : 'btn-secondary'"
          >
            Pending Verification
          </button>
          <button 
            (click)="selectReportType('outstanding-balance')" 
            class="btn" 
            [ngClass]="selectedReportType === 'outstanding-balance' ? 'btn-primary' : 'btn-secondary'"
          >
            Outstanding Balance
          </button>
        </div>
      </div>

      <!-- Date-wise Report -->
      <div *ngIf="selectedReportType === 'date-wise'" class="card mb-6">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Date-wise Report</h3>
        <form [formGroup]="dateWiseForm" (ngSubmit)="loadDateWiseReport()" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input type="date" formControlName="dateFrom" class="input" required />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input type="date" formControlName="dateTo" class="input" required />
          </div>
          <div class="flex items-end">
            <button type="submit" class="btn btn-primary w-full">Generate Report</button>
          </div>
        </form>
      </div>

      <!-- Supplier-wise Report -->
      <div *ngIf="selectedReportType === 'supplier-wise'" class="card mb-6">
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
            <input type="date" formControlName="dateFrom" class="input" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input type="date" formControlName="dateTo" class="input" />
          </div>
          <div class="flex items-end">
            <button type="submit" class="btn btn-primary w-full">Generate Report</button>
          </div>
        </form>
      </div>

      <!-- Employee-wise Report -->
      <div *ngIf="selectedReportType === 'employee-wise'" class="card mb-6">
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
            <input type="date" formControlName="dateFrom" class="input" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input type="date" formControlName="dateTo" class="input" />
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
                <td class="px-4 py-2 text-sm">{{ booking.pnr }}</td>
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
                <td class="px-4 py-2 text-sm">{{ booking.dateOfSubmission | date:'shortDate' }}</td>
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
    </div>
  `
})
export class ReportsComponent implements OnInit {
  selectedReportType: string = 'date-wise';
  loading = false;
  suppliers: Supplier[] = [];
  users: User[] = [];

  dateWiseForm: FormGroup;
  supplierWiseForm: FormGroup;
  employeeWiseForm: FormGroup;

  dateWiseData: any = null;
  supplierWiseData: any = null;
  employeeWiseData: any = null;
  pendingVerificationData: any = null;
  outstandingBalanceData: any = null;

  constructor(
    private reportService: ReportService,
    private supplierService: SupplierService,
    private userService: UserService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.dateWiseForm = this.fb.group({
      dateFrom: ['', []],
      dateTo: ['', []]
    });

    this.supplierWiseForm = this.fb.group({
      supplier: [''],
      dateFrom: [''],
      dateTo: ['']
    });

    this.employeeWiseForm = this.fb.group({
      employee: [''],
      dateFrom: [''],
      dateTo: ['']
    });
  }

  ngOnInit() {
    this.loadSuppliers();
    this.loadUsers();
    
    // Auto-load reports that don't need filters
    this.loadPendingVerificationReport();
    this.loadOutstandingBalanceReport();
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
      'Ticked': 'bg-green-100 text-green-800',
      'Unticketed': 'bg-orange-100 text-orange-800'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  }
}
