import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { BookingService, Booking } from '../../../services/booking.service';

@Component({
  selector: 'app-search-booking',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="max-w-7xl mx-auto">
      <div class="page-title-card">
        <h2 class="page-title">Search Booking</h2>
      </div>

      <div class="card mb-6">
        <form [formGroup]="searchForm" (ngSubmit)="onSearch()">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Search by PNR</label>
              <input 
                type="text" 
                formControlName="pnr" 
                class="input uppercase" 
                placeholder="Enter PNR"
                (input)="onSearchTypeChange('pnr')"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Search by Contact Number</label>
              <input 
                type="text" 
                formControlName="contactNumber" 
                class="input" 
                placeholder="Enter contact number"
                (input)="onSearchTypeChange('contact')"
              />
            </div>
          </div>
          <p *ngIf="searchForm.hasError('atLeastOneRequired') && (searchForm.get('pnr')?.touched || searchForm.get('contactNumber')?.touched)" class="text-red-500 text-xs mt-1">Enter PNR or contact number to search</p>
          <div class="mt-4 flex justify-end">
            <button type="submit" class="btn btn-primary" [disabled]="searchForm.invalid">Search</button>
          </div>
        </form>
      </div>

      <!-- Search Results -->
      <div *ngIf="searching" class="text-center py-8">
        <p class="text-gray-600">Searching...</p>
      </div>

      <div *ngIf="bookings.length > 0 && !searching" class="card overflow-x-auto -mx-3 sm:mx-0">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Search Results ({{ bookings.length }})</h3>
        <div class="inline-block min-w-full align-middle">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PNR</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Passenger</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr *ngFor="let booking of bookings" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ booking.pnr }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ booking.paxName }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ booking.contactNumber }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="badge" [ngClass]="getStatusClass(booking.status || 'Draft')">
                    {{ getStatusDisplay(booking.status || 'Draft') }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ booking.balanceAmount | number:'1.2-2' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    [routerLink]="['/dashboard/bookings', booking._id]" 
                    class="text-primary-600 hover:text-primary-900"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div *ngIf="bookings.length === 0 && !searching && hasSearched" class="card">
        <p class="text-center text-gray-500 py-8">No bookings found</p>
      </div>
    </div>
  `
})
export class SearchBookingComponent implements OnInit {
  searchForm: FormGroup;
  bookings: Booking[] = [];
  searching = false;
  hasSearched = false;

  constructor(
    private fb: FormBuilder,
    private bookingService: BookingService,
    private router: Router
  ) {
    this.searchForm = this.fb.group({
      pnr: [''],
      contactNumber: ['']
    }, { validators: this.atLeastOneRequired });
  }

  ngOnInit() {
    // Check if there's a query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const pnr = urlParams.get('pnr');
    const contact = urlParams.get('contact');
    
    if (pnr) {
      this.searchForm.patchValue({ pnr });
      this.onSearch();
    } else if (contact) {
      this.searchForm.patchValue({ contactNumber: contact });
      this.onSearch();
    }
  }

  atLeastOneRequired(group: FormGroup) {
    const pnr = group.get('pnr')?.value;
    const contactNumber = group.get('contactNumber')?.value;
    
    if (!pnr && !contactNumber) {
      return { atLeastOneRequired: true };
    }
    return null;
  }

  onSearchTypeChange(type: 'pnr' | 'contact') {
    if (type === 'pnr') {
      this.searchForm.patchValue({ contactNumber: '' });
    } else {
      this.searchForm.patchValue({ pnr: '' });
    }
  }

  onSearch() {
    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      return;
    }

    const formValue = this.searchForm.value;
    const query = formValue.pnr || formValue.contactNumber;

    if (!query) return;

    this.searching = true;
    this.hasSearched = true;

    this.bookingService.searchBookings(query).subscribe({
      next: (bookings) => {
        this.bookings = bookings;
        this.searching = false;
      },
      error: () => {
        this.searching = false;
        this.bookings = [];
      }
    });
  }

  getStatusDisplay(status: string): string {
    if (status === 'Unticketed') return 'Unticketed';
    if (status === 'Ticked') return 'Ticked';
    return status || 'Draft';
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
