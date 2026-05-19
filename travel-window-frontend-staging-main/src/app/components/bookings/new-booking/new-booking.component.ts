import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { BookingService } from '../../../services/booking.service';
import { SupplierService, Supplier } from '../../../services/supplier.service';
import { AuthService } from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-new-booking',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-6xl mx-auto">
      <div class="page-title-card">
        <h2 class="page-title">{{ isEditMode ? 'Edit Booking' : 'New Booking' }}</h2>
      </div>

      <form [formGroup]="bookingForm" (ngSubmit)="onSubmit()" class="space-y-6">
        <!-- Auto/System Fields -->
        <div class="card">
          <h3 class="text-xl font-semibold mb-4 text-gray-700">System Information</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Date of Submission</label>
              <input type="text" [value]="bookingForm.get('dateOfSubmission')?.value | date:'dd-MM-yyyy'" class="input bg-gray-100" readonly />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Submitted By</label>
              <input type="text" [value]="submittedByNameDisplay" class="input bg-gray-100" readonly />
            </div>
          </div>
        </div>

        <!-- Passenger & Contact Details -->
        <div class="card">
          <h3 class="text-xl font-semibold mb-4 text-gray-700">Passenger & Contact Details</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">PAX Name <span class="text-red-500">*</span></label>
              <input type="text" formControlName="paxName" class="input uppercase" placeholder="Enter passenger name" [class.border-red-500]="bookingForm.get('paxName')?.invalid && bookingForm.get('paxName')?.touched" />
              <p *ngIf="bookingForm.get('paxName')?.invalid && bookingForm.get('paxName')?.touched" class="text-red-500 text-xs mt-1">PAX name is required</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input type="text" formControlName="contactPerson" class="input" placeholder="Enter contact person (Title case)" (blur)="applyTitleCase('contactPerson')" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Contact Number <span class="text-red-500">*</span></label>
              <div class="flex gap-2">
                <div class="relative w-52 flex-shrink-0 country-selector-container">
                  <input
                    type="text"
                    [value]="countrySearchInput"
                    (input)="onCountryCodeInput($event)"
                    (focus)="onCountryInputFocus($event)"
                    placeholder="Search code..."
                    class="input w-full pr-10"
                    autocomplete="off"
                    [class.border-red-500]="bookingForm.get('countryCode')?.invalid && bookingForm.get('countryCode')?.touched"
                  />
                  <div 
                    (click)="toggleCountryDropdown(); $event.stopPropagation()"
                    class="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  
                  <!-- Dropdown -->
                  <div
                    *ngIf="showCountryDropdown"
                    class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
                  >
                    <div
                      *ngFor="let country of filteredCountryCodes"
                      (click)="selectCountryCode(country.code)"
                      class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                    >
                      <span class="font-semibold">{{ country.code }}</span>
                      <span class="text-gray-600 ml-2">{{ country.country }}</span>
                    </div>
                    
                    <div
                      *ngIf="filteredCountryCodes.length === 0"
                      class="px-3 py-2 text-gray-500 text-sm"
                    >
                      No countries found
                    </div>
                  </div>
                </div>

                <input
                  type="tel"
                  formControlName="contactNumber"
                  class="input flex-1"
                  placeholder="e.g. 9876543210 (10 digits)"
                  maxlength="10"
                  (input)="onContactNumberInput($event)"
                  [class.border-red-500]="bookingForm.get('contactNumber')?.invalid && bookingForm.get('contactNumber')?.touched"
                />
              </div>
              <p *ngIf="(bookingForm.get('contactNumber')?.invalid && bookingForm.get('contactNumber')?.touched) || (bookingForm.get('countryCode')?.invalid && bookingForm.get('countryCode')?.touched)" class="text-red-500 text-xs mt-1">
                {{ getContactNumberError() || (bookingForm.get('countryCode')?.invalid ? 'Country code is required' : '') }}
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">PNR <span class="text-red-500">*</span></label>
              <input type="text" formControlName="pnr" class="input uppercase" placeholder="Enter PNR" [class.border-red-500]="bookingForm.get('pnr')?.invalid && bookingForm.get('pnr')?.touched" />
              <p *ngIf="bookingForm.get('pnr')?.invalid && bookingForm.get('pnr')?.touched" class="text-red-500 text-xs mt-1">PNR is required</p>
            </div>
          </div>
        </div>

        <!-- Travel Details -->
        <div class="card">
          <h3 class="text-xl font-semibold mb-4 text-gray-700">Travel Details</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Sector Type <span class="text-red-500">*</span></label>
              <div class="flex space-x-4">
                <label class="flex items-center">
                  <input type="radio" formControlName="sectorType" value="One Way" class="mr-2" />
                  One Way
                </label>
                <label class="flex items-center">
                  <input type="radio" formControlName="sectorType" value="Round Trip" class="mr-2" />
                  Round Trip
                </label>
                <label class="flex items-center">
                  <input type="radio" formControlName="sectorType" value="Multiple" class="mr-2" />
                  Multiple
                </label>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4" *ngIf="bookingForm.get('sectorType')?.value === 'One Way'">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Travel Date <span class="text-red-500">*</span></label>
                <input type="date" formControlName="travelDate" class="input" [min]="minTravelDate" [class.border-red-500]="bookingForm.get('travelDate')?.invalid && bookingForm.get('travelDate')?.touched" />
                <p *ngIf="bookingForm.get('travelDate')?.invalid && bookingForm.get('travelDate')?.touched" class="text-red-500 text-xs mt-1">Travel date is required</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">From <span class="text-red-500">*</span></label>
                <input type="text" formControlName="from" class="input" placeholder="Enter origin" (blur)="applyCapitalize('from')" [class.border-red-500]="bookingForm.get('from')?.invalid && bookingForm.get('from')?.touched" />
                <p *ngIf="bookingForm.get('from')?.invalid && bookingForm.get('from')?.touched" class="text-red-500 text-xs mt-1">Origin is required</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">To <span class="text-red-500">*</span></label>
                <input type="text" formControlName="to" class="input" placeholder="Enter destination" (blur)="applyCapitalize('to')" [class.border-red-500]="bookingForm.get('to')?.invalid && bookingForm.get('to')?.touched" />
                <p *ngIf="bookingForm.get('to')?.invalid && bookingForm.get('to')?.touched" class="text-red-500 text-xs mt-1">Destination is required</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4" *ngIf="bookingForm.get('sectorType')?.value === 'Round Trip'">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Travel Date <span class="text-red-500">*</span></label>
                <input type="date" formControlName="travelDate" class="input" [min]="minTravelDate" [class.border-red-500]="bookingForm.get('travelDate')?.invalid && bookingForm.get('travelDate')?.touched" />
                <p *ngIf="bookingForm.get('travelDate')?.invalid && bookingForm.get('travelDate')?.touched" class="text-red-500 text-xs mt-1">Travel date is required</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Return Date <span class="text-red-500">*</span></label>
                <input type="date" formControlName="returnDate" class="input" [min]="minReturnDate" [class.border-red-500]="bookingForm.get('returnDate')?.invalid && bookingForm.get('returnDate')?.touched" />
                <p *ngIf="bookingForm.get('returnDate')?.invalid && bookingForm.get('returnDate')?.touched" class="text-red-500 text-xs mt-1">Return date is required</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">From <span class="text-red-500">*</span></label>
                <input type="text" formControlName="from" class="input" placeholder="Enter origin" (blur)="applyCapitalize('from')" [class.border-red-500]="bookingForm.get('from')?.invalid && bookingForm.get('from')?.touched" />
                <p *ngIf="bookingForm.get('from')?.invalid && bookingForm.get('from')?.touched" class="text-red-500 text-xs mt-1">Origin is required</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">To <span class="text-red-500">*</span></label>
                <input type="text" formControlName="to" class="input" placeholder="Enter destination" (blur)="applyCapitalize('to')" [class.border-red-500]="bookingForm.get('to')?.invalid && bookingForm.get('to')?.touched" />
                <p *ngIf="bookingForm.get('to')?.invalid && bookingForm.get('to')?.touched" class="text-red-500 text-xs mt-1">Destination is required</p>
              </div>
            </div>

            <div *ngIf="bookingForm.get('sectorType')?.value === 'Multiple'">
              <div class="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Travel Date <span class="text-red-500">*</span></label>
                  <input type="date" formControlName="travelDate" class="input" [min]="minTravelDate" [class.border-red-500]="bookingForm.get('travelDate')?.invalid && bookingForm.get('travelDate')?.touched" />
                  <p *ngIf="bookingForm.get('travelDate')?.invalid && bookingForm.get('travelDate')?.touched" class="text-red-500 text-xs mt-1">Travel date is required</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">From <span class="text-red-500">*</span></label>
                  <input type="text" formControlName="from" class="input" placeholder="Enter origin" (blur)="applyCapitalize('from')" [class.border-red-500]="bookingForm.get('from')?.invalid && bookingForm.get('from')?.touched" />
                  <p *ngIf="bookingForm.get('from')?.invalid && bookingForm.get('from')?.touched" class="text-red-500 text-xs mt-1">Origin is required</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">To <span class="text-red-500">*</span></label>
                  <input type="text" formControlName="to" class="input" placeholder="Enter destination" (blur)="applyCapitalize('to')" [class.border-red-500]="bookingForm.get('to')?.invalid && bookingForm.get('to')?.touched" />
                  <p *ngIf="bookingForm.get('to')?.invalid && bookingForm.get('to')?.touched" class="text-red-500 text-xs mt-1">Destination is required</p>
                </div>
              </div>
              <button type="button" (click)="addMultipleSector()" class="btn btn-secondary mb-4">Add More Sector</button>
              <div formArrayName="multipleSectors" class="space-y-4">
                <div *ngFor="let sector of multipleSectorsArray.controls; let i = index" [formGroupName]="i" class="card bg-gray-50">
                  <div class="grid grid-cols-4 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Travel Date</label>
                      <input type="date" formControlName="travelDate" class="input" [min]="minTravelDate" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">From</label>
                      <input type="text" formControlName="from" class="input" (blur)="applyCapitalizeSectorFromTo(i, 'from')" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">To</label>
                      <input type="text" formControlName="to" class="input" (blur)="applyCapitalizeSectorFromTo(i, 'to')" />
                    </div>
                    <div class="flex items-end">
                      <button type="button" (click)="removeMultipleSector(i)" class="btn btn-danger">Remove</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Airline</label>
              <input type="text" formControlName="airline" class="input" placeholder="Enter airline" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <textarea formControlName="note" class="input" rows="3" placeholder="Any date / remarks"></textarea>
            </div>
          </div>
        </div>

        <!-- Commercial Details -->
        <div class="card">
          <h3 class="text-xl font-semibold mb-4 text-gray-700">Commercial Details</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <select formControlName="supplier" class="input">
                <option value="">Select Supplier</option>
                <option *ngFor="let s of suppliers" [value]="s._id">{{ s.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Our Cost</label>
              <input type="number" formControlName="ourCost" class="input" placeholder="0" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Sale Price</label>
              <input type="number" formControlName="salePrice" class="input" placeholder="0" />
            </div>
            <div class="col-span-full py-2 mb-2">
              <label class="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" formControlName="isCardPayment" class="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                <span class="text-xl font-semibold text-gray-700">Payment Through Cards</span>
              </label>
            </div>

            <ng-container *ngIf="bookingForm.get('isCardPayment')?.value">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Supplier Charges/Service charges</label>
                <input type="number" formControlName="supplierCharges" class="input" placeholder="0" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Payment From Card</label>
                <input type="number" formControlName="paymentFromCard" class="input" placeholder="0" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Card Type</label>
                <select formControlName="cardType" class="input">
                  <option value="">Select Card Type</option>
                  <option value="Company Card">Company Card</option>
                  <option value="Client Card">Client Card</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Card Last 4 Digits</label>
                <input type="text" formControlName="cardLast4Digits" class="input" placeholder="e.g. 1234" maxlength="4" />
              </div>
            </ng-container>
            <div class="col-span-full border-t border-gray-200 my-4"></div>
            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-2">Additional Service</label>
              <button type="button" (click)="addAdditionalService()" class="btn btn-secondary mb-3">Add Additional Service</button>
              <div formArrayName="additionalServices" class="space-y-3">
                <div *ngFor="let row of additionalServicesArray.controls; let i = index" [formGroupName]="i" class="flex flex-wrap items-end gap-3 p-3 bg-gray-50 rounded-lg">
                  <div class="flex-1 min-w-[120px]">
                    <label class="block text-xs font-medium text-gray-600 mb-1">Service Name</label>
                    <input type="text" formControlName="serviceName" class="input" placeholder="Service name" />
                  </div>
                  <div class="w-32">
                    <label class="block text-xs font-medium text-gray-600 mb-1">Service Cost</label>
                    <input type="number" formControlName="serviceCost" class="input" min="0" step="0.01" placeholder="0" />
                  </div>
                  <button type="button" (click)="removeAdditionalService(i)" class="btn btn-danger">Remove</button>
                </div>
              </div>
            </div>
            <div class="col-span-2 grid grid-cols-2 gap-4 mt-2">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Our Margin</label>
                <input type="text" [value]="ourMarginPreview | number:'1.2-2'" class="input bg-green-50 text-green-700 font-medium" readonly />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Total Sale Price</label>
                <input type="text" [value]="totalSalePrice | number:'1.2-2'" class="input bg-gray-100 font-medium" readonly />
              </div>
            </div>
          </div>
        </div>

        <!-- Payment Details (Agent1, Agent2, Account, Admin can collect payments per spec) -->
        <div class="card">
          <h3 class="text-xl font-semibold mb-4 text-gray-700">Payment Details</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Payment Type</label>
              <div class="flex space-x-4">
                <label class="flex items-center">
                  <input type="radio" formControlName="paymentType" value="Full" class="mr-2" />
                  Full
                </label>
                <label class="flex items-center">
                  <input type="radio" formControlName="paymentType" value="Installments" class="mr-2" />
                  Installments
                </label>
              </div>
            </div>

            <div>
              <p class="text-sm text-gray-600 mb-2" *ngIf="bookingForm.get('paymentType')?.value === 'Full'">Enter full payment details below.</p>
              <button type="button" (click)="addPayment()" class="btn btn-secondary mb-4" *ngIf="bookingForm.get('paymentType')?.value === 'Installments'">Add Payment</button>
              <div formArrayName="payments" class="space-y-4">
                <div *ngFor="let payment of paymentsArray.controls; let i = index" [formGroupName]="i" class="card bg-gray-50">
                  <div class="grid grid-cols-4 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Paid Amount <span class="text-red-500">*</span></label>
                      <input type="number" formControlName="paidAmount" class="input" step="0.01" [class.border-red-500]="payment.get('paidAmount')?.invalid && payment.get('paidAmount')?.touched" />
                      <p *ngIf="payment.get('paidAmount')?.invalid && payment.get('paidAmount')?.touched" class="text-red-500 text-xs mt-1">Paid amount is required</p>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Payment Mode <span class="text-red-500">*</span></label>
                      <select formControlName="paymentMode" class="input" [class.border-red-500]="payment.get('paymentMode')?.invalid && payment.get('paymentMode')?.touched">
                        <option value="Cash">Cash</option>
                        <option value="Machine Charge">Machine Charge</option>
                        <option value="UPI">UPI</option>
                        <option value="E-Transfer">E-Transfer</option>
                        <option value="Kotak Bank">Kotak Bank</option>
                        <option value="Kotak Bank UPI">Kotak Bank UPI</option>
                        <option value="Travobirds">Travobirds</option>
                        <option value="Credit Card">Credit Card</option>
                      </select>
                      <p *ngIf="payment.get('paymentMode')?.invalid && payment.get('paymentMode')?.touched" class="text-red-500 text-xs mt-1">Payment mode is required</p>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Payment Date <span class="text-red-500">*</span></label>
                      <input type="date" formControlName="paymentDate" class="input" [class.border-red-500]="payment.get('paymentDate')?.invalid && payment.get('paymentDate')?.touched" />
                      <p *ngIf="payment.get('paymentDate')?.invalid && payment.get('paymentDate')?.touched" class="text-red-500 text-xs mt-1">Payment date is required</p>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Reference No</label>
                      <input type="text" formControlName="referenceNo" class="input" />
                    </div>
                  </div>
                  <button type="button" (click)="removePayment(i)" class="btn btn-danger mt-2" *ngIf="bookingForm.get('paymentType')?.value === 'Installments' && paymentsArray.controls.length > 1">Remove</button>
                </div>
              </div>
              <div class="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Total Paid Amount</label>
                  <input type="text" [value]="totalPaidAmount | number:'1.2-2'" class="input bg-gray-100" readonly />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Balance Amount</label>
                  <input type="text" [value]="balanceAmount | number:'1.2-2'" class="input bg-gray-100" readonly />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-4">
          <button type="button" (click)="cancel()" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary">
            {{ isEditMode ? 'Update Booking' : 'Create Booking' }}
          </button>
        </div>
      </form>
    </div>
  `
})
export class NewBookingComponent implements OnInit {
  bookingForm: FormGroup;
  suppliers: Supplier[] = [];
  isEditMode = false;
  bookingId: string | null = null;
  currentUserName = '';
  /** In edit mode: original submitter name; in create mode: same as currentUserName */
  submittedByNameDisplay = '';

  countryCodes: any[] = [];
  filteredCountryCodes: any[] = [];
  showCountryDropdown = false;
  countrySearchInput = '+91';

  constructor(
    private fb: FormBuilder,
    private bookingService: BookingService,
    private supplierService: SupplierService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private http: HttpClient,
    private el: ElementRef
  ) {
    this.bookingForm = this.createForm();
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUserName = user.name;
        this.submittedByNameDisplay = user.name;
      }
    });
  }

  ngOnInit() {
    this.loadCountryCodes();
    this.loadSuppliers();
    this.ensurePaymentRowWhenFull();

    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.bookingId = params['id'];
        this.loadBooking(params['id']);
      } else {
        this.ensurePaymentRowWhenFull();
      }
    });

    this.bookingForm.get('paymentType')?.valueChanges.subscribe(() => {
      this.ensurePaymentRowWhenFull();
    });

    this.bookingForm.valueChanges.subscribe(() => {
      this.calculateTotals();
    });

    this.bookingForm.get('isCardPayment')?.valueChanges.subscribe(checked => {
      if (!checked) {
        this.bookingForm.patchValue({
          supplierCharges: 0,
          paymentFromCard: 0,
          cardType: '',
          cardLast4Digits: ''
        }, { emitEvent: false });
      }
    });
  }
  loadCountryCodes(): void {
    this.http.get<any>('assets/data/country-codes.json').subscribe({
      next: (data) => {
        this.countryCodes = data.countries.sort((a: any, b: any) => 
          a.code.localeCompare(b.code)
        );
        this.filteredCountryCodes = this.countryCodes;
        
        // If we are in edit mode and booking already loaded, update the display name
        const currentCode = this.bookingForm.get('countryCode')?.value;
        if (currentCode && this.countrySearchInput === currentCode) {
          const country = this.countryCodes.find(c => c.code === currentCode);
          if (country) {
            this.countrySearchInput = `${country.code} ${country.country}`;
          }
        }
      },
      error: (err) => console.error('Failed to load country codes:', err)
    });
  }

  onCountryCodeInput(event: any): void {
    const input = event.target.value.toLowerCase();
    this.countrySearchInput = input;

    if (!input) {
      this.filteredCountryCodes = this.countryCodes;
    } else {
      this.filteredCountryCodes = this.countryCodes.filter(c =>
        c.code.toLowerCase().includes(input) ||
        c.country.toLowerCase().includes(input)
      );
    }
    this.showCountryDropdown = true;
  }


  onCountryInputFocus(event: any): void {
    this.showCountryDropdown = true;
    event.target.select();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const isInside = target.closest('.country-selector-container');
    
    if (!isInside) {
      this.showCountryDropdown = false;
      
      // Restore full display name if they clicked away without selecting
      const currentCode = this.bookingForm.get('countryCode')?.value;
      if (currentCode) {
        const country = this.countryCodes.find(c => c.code === currentCode);
        if (country) {
          this.countrySearchInput = `${country.code} ${country.country}`;
        }
      }
    }
  }

  selectCountryCode(code: string): void {
    const country = this.countryCodes.find(c => c.code === code);
    const displayName = country ? `${country.code} ${country.country}` : code;
    this.bookingForm.patchValue({ countryCode: code });
    this.countrySearchInput = displayName;
    this.showCountryDropdown = false;
  }

  toggleCountryDropdown(): void {
    this.showCountryDropdown = !this.showCountryDropdown;
    if (this.showCountryDropdown) {
      this.filteredCountryCodes = this.countryCodes;
    }
  }

  /** When Full payment is selected, ensure at least one payment row exists */
  ensurePaymentRowWhenFull() {
    if (this.bookingForm.get('paymentType')?.value === 'Full' && this.paymentsArray.length === 0) {
      this.addPayment();
    }
  }

  createForm(): FormGroup {
    return this.fb.group({
      dateOfSubmission: [new Date()],
      paxName: ['', Validators.required],
      contactPerson: [''],
      countryCode: ['+91'],
      contactNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      pnr: ['', Validators.required],
      sectorType: ['One Way', Validators.required],
      travelDate: ['', Validators.required],
      from: ['', Validators.required],
      to: ['', Validators.required],
      returnDate: [''],
      multipleSectors: this.fb.array([]),
      note: [''],
      airline: [''],
      supplier: [''],
      ourCost: [0],
      salePrice: [0],
      supplierCharges: [0],
      paymentFromCard: [0],
      cardType: [''],
      cardLast4Digits: [''],
      isCardPayment: [false],
      additionalServices: this.fb.array([]),
      paymentType: ['Full'],
      payments: this.fb.array([])
    });
  }

  get multipleSectorsArray() {
    return this.bookingForm.get('multipleSectors') as FormArray;
  }

  get paymentsArray() {
    return this.bookingForm.get('payments') as FormArray;
  }

  get additionalServicesArray() {
    return this.bookingForm.get('additionalServices') as FormArray;
  }

  addAdditionalService() {
    this.additionalServicesArray.push(this.fb.group({
      serviceName: [''],
      serviceCost: [0]
    }));
  }

  removeAdditionalService(index: number) {
    this.additionalServicesArray.removeAt(index);
  }

  addMultipleSector() {
    const sectorGroup = this.fb.group({
      travelDate: [''],
      from: [''],
      to: ['']
    });
    this.multipleSectorsArray.push(sectorGroup);
  }

  removeMultipleSector(index: number) {
    this.multipleSectorsArray.removeAt(index);
  }

  addPayment() {
    const paymentGroup = this.fb.group({
      paidAmount: [0, Validators.required],
      paymentMode: ['Cash', Validators.required],
      paymentDate: [this.toDateInputValue(new Date()), Validators.required],
      referenceNo: ['']
    });
    this.paymentsArray.push(paymentGroup);
  }

  removePayment(index: number) {
    this.paymentsArray.removeAt(index);
  }

  loadSuppliers() {
    this.supplierService.getSuppliers().subscribe({
      next: (suppliers) => {
        this.suppliers = suppliers;
      }
    });
  }

  loadBooking(id: string) {
    this.bookingService.getBooking(id).subscribe({
      next: (booking) => {
        this.submittedByNameDisplay = booking.submittedByName || (booking.submittedBy && (booking.submittedBy as any).name) || this.currentUserName;
        const { countryCode, localNumber } = this.parseContactNumber(booking.contactNumber || '');
        const { payments: _p, multipleSectors: _s, additionalServices: _as, additionalService: _as1, additionalServicePrice: _as2, ...restBooking } = booking as any;
        this.bookingForm.patchValue({
          ...restBooking,
          countryCode,
          contactNumber: (localNumber || '').replace(/\D/g, ''),
          travelDate: this.toDateInputValue(booking.travelDate),
          returnDate: this.toDateInputValue(booking.returnDate),
          supplier: booking.supplier?._id || booking.supplier || '',
          isCardPayment: !!(booking.cardType || (booking.paymentFromCard && booking.paymentFromCard > 0))
        });
        
        // Find country name for display
        if (this.countryCodes.length > 0) {
          const country = this.countryCodes.find(c => c.code === countryCode);
          this.countrySearchInput = country ? `${country.code} ${country.country}` : countryCode;
        } else {
          // Fallback if countryCodes not loaded yet (shouldn't happen with ngOnInit sequence but safe)
          this.countrySearchInput = countryCode;
          // Retry logic or wait for codes to load
          const checkInterval = setInterval(() => {
            if (this.countryCodes.length > 0) {
              const c = this.countryCodes.find(cx => cx.code === countryCode);
              this.countrySearchInput = c ? `${c.code} ${c.country}` : countryCode;
              clearInterval(checkInterval);
            }
          }, 100);
          setTimeout(() => clearInterval(checkInterval), 3000);
        }

        // Clear and repopulate multipleSectors so we don't get duplicate/wrong rows
        while (this.multipleSectorsArray.length) {
          this.multipleSectorsArray.removeAt(0);
        }
        if (booking.multipleSectors && booking.multipleSectors.length > 0) {
          booking.multipleSectors.forEach(sector => {
            const sectorGroup = this.fb.group({
              travelDate: this.toDateInputValue(sector.travelDate),
              from: sector.from || '',
              to: sector.to || ''
            });
            this.multipleSectorsArray.push(sectorGroup);
          });
        }

        // Clear and repopulate payments so saved values show correctly on first edit load
        while (this.paymentsArray.length) {
          this.paymentsArray.removeAt(0);
        }
        if (booking.payments && booking.payments.length > 0) {
          booking.payments.forEach((payment: any) => {
            const dateStr = this.toDateInputValue(payment.paymentDate) || this.toDateInputValue(new Date());
            this.paymentsArray.push(this.fb.group({
              paidAmount: [payment.paidAmount ?? 0, Validators.required],
              paymentMode: [payment.paymentMode || 'Cash', Validators.required],
              paymentDate: [dateStr, Validators.required],
              referenceNo: [payment.referenceNo || '']
            }));
          });
        } else if (this.bookingForm.get('paymentType')?.value === 'Full') {
          this.addPayment();
        }

        if ((booking as any).additionalServices && (booking as any).additionalServices.length > 0) {
          while (this.additionalServicesArray.length) this.additionalServicesArray.removeAt(0);
          (booking as any).additionalServices.forEach((row: any) => {
            this.additionalServicesArray.push(this.fb.group({
              serviceName: [row.serviceName || ''],
              serviceCost: [row.serviceCost ?? 0]
            }));
          });
        } else if ((booking as any).additionalService) {
          while (this.additionalServicesArray.length) this.additionalServicesArray.removeAt(0);
          this.additionalServicesArray.push(this.fb.group({
            serviceName: [(booking as any).additionalService || ''],
            serviceCost: [(booking as any).additionalServicePrice ?? 0]
          }));
        }
      }
    });
  }

  calculateTotals() {
    // This will be handled by the backend, but we can show preview
  }

  get totalSalePrice(): number {
    const salePrice = this.bookingForm.get('salePrice')?.value || 0;
    const arr = this.additionalServicesArray?.controls || [];
    const additionalTotal = arr.reduce((sum, c) => sum + (c.get('serviceCost')?.value || 0), 0);
    return salePrice + additionalTotal;
  }

  get ourMarginPreview(): number {
    const salePrice = this.bookingForm.get('salePrice')?.value || 0;
    const ourCost = this.bookingForm.get('ourCost')?.value || 0;
    const supplierCharges = this.bookingForm.get('supplierCharges')?.value || 0;
    return salePrice - ourCost - supplierCharges;
  }

  get totalPaidAmount(): number {
    return this.paymentsArray.controls.reduce((sum, control) => {
      return sum + (control.get('paidAmount')?.value || 0);
    }, 0);
  }

  get balanceAmount(): number {
    return this.totalSalePrice - this.totalPaidAmount;
  }

  /** Min date for Travel Date = today in local timezone (cannot select past date in new booking) */
  get minTravelDate(): string {
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /** Min date for Return Date = selected travel date or today (local) */
  get minReturnDate(): string {
    const t = this.bookingForm.get('travelDate')?.value;
    if (t) {
      const s = typeof t === 'string' ? t : (t instanceof Date ? `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` : '');
      return s || this.minTravelDate;
    }
    return this.minTravelDate;
  }

  onSubmit() {
    if (this.bookingForm.get('sectorType')?.value === 'Round Trip' && !this.bookingForm.get('returnDate')?.value) {
      this.bookingForm.get('returnDate')?.setErrors({ required: true });
      this.bookingForm.get('returnDate')?.markAsTouched();
    }
    this.bookingForm.markAllAsTouched();
    if (this.bookingForm.invalid) {
      const messages: string[] = [];
      const map: Record<string, string> = {
        paxName: 'PAX name is required',
        contactNumber: this.getContactNumberError(),
        pnr: 'PNR is required',
        travelDate: 'Travel date is required',
        from: 'From (origin) is required',
        to: 'To (destination) is required',
        returnDate: 'Return date is required for Round Trip'
      };
      ['paxName', 'contactNumber', 'pnr', 'travelDate', 'from', 'to', 'returnDate'].forEach(key => {
        const c = this.bookingForm.get(key);
        if (c?.invalid && c?.errors && map[key]) messages.push(map[key]);
      });
      this.toastr.error(messages.length ? messages.join('. ') : 'Please fill all required fields.', 'Validation Error');
      return;
    }
    const formValue = this.bookingForm.value;
    const fullContactNumber = (formValue.countryCode || '').replace(/\s/g, '') + ' ' + (formValue.contactNumber || '').trim();

    // Transform form data (exclude countryCode from payload; use combined contactNumber)
    const { countryCode, ...rest } = formValue;
    const paymentsPayload = (formValue.payments || []).map((p: any) => {
      const paidAmount = typeof p.paidAmount === 'number' ? p.paidAmount : parseFloat(p.paidAmount) || 0;
      const rawDate = p.paymentDate;
      const paymentDate = rawDate ? new Date(rawDate) : new Date();
      const validDate = paymentDate instanceof Date && !isNaN(paymentDate.getTime()) ? paymentDate : new Date();
      return {
        paidAmount,
        paymentMode: p.paymentMode || 'Cash',
        paymentDate: validDate,
        referenceNo: p.referenceNo || ''
      };
    });

    const bookingData: any = {
      ...rest,
      contactNumber: fullContactNumber.trim(),
      travelDate: formValue.travelDate || null,
      returnDate: formValue.returnDate || null,
      multipleSectors: (formValue.multipleSectors || []).map((s: any) => ({
        ...s,
        travelDate: s.travelDate || null
      })),
      payments: paymentsPayload
    };

    if (this.isEditMode && this.bookingId) {
      delete bookingData.dateOfSubmission;
      delete bookingData.submittedBy;
      delete bookingData.submittedByName;
      this.bookingService.updateBooking(this.bookingId, bookingData).subscribe({
        next: () => {
          this.toastr.success('Booking updated successfully', 'Success');
          this.router.navigate(['/dashboard/bookings']);
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Failed to update booking', 'Error');
        }
      });
    } else {
      this.bookingService.createBooking(bookingData).subscribe({
        next: () => {
          this.toastr.success('Booking created successfully', 'Success');
          this.router.navigate(['/dashboard/bookings']);
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Failed to create booking', 'Error');
        }
      });
    }
  }

  cancel() {
    if (this.isEditMode && this.bookingId) {
      this.router.navigate(['/dashboard/bookings', this.bookingId]);
    } else {
      this.router.navigate(['/dashboard/bookings']);
    }
  }

  /** Auto convert to Title case (Contact Person) per spec */
  applyTitleCase(controlName: string) {
    const c = this.bookingForm.get(controlName);
    if (!c) return;
    const v = (c.value || '').toString().trim();
    if (!v) return;
    const titleCase = v.replace(/\w\S*/g, (t: string) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
    if (titleCase !== v) c.setValue(titleCase, { emitEvent: false });
  }

  /** Auto Capital for From/To per spec */
  applyCapitalize(controlName: string) {
    const c = this.bookingForm.get(controlName);
    if (!c) return;
    const v = (c.value || '').toString().trim();
    if (!v) return;
    const cap = v.charAt(0).toUpperCase() + v.slice(1);
    if (cap !== v) c.setValue(cap, { emitEvent: false });
  }

  /** Auto Capital for From/To in multiple sectors rows */
  applyCapitalizeSectorFromTo(index: number, field: 'from' | 'to') {
    const row = this.multipleSectorsArray.at(index);
    if (!row) return;
    const c = row.get(field);
    if (!c) return;
    const v = (c.value || '').toString().trim();
    if (!v) return;
    const cap = v.charAt(0).toUpperCase() + v.slice(1);
    if (cap !== v) c.setValue(cap, { emitEvent: false });
  }

  /** Allow only digits in contact number input */
  onContactNumberInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const digitsOnly = (input.value || '').replace(/\D/g, '');
    if (input.value !== digitsOnly) {
      input.value = digitsOnly;
      this.bookingForm.get('contactNumber')?.setValue(digitsOnly, { emitEvent: false });
    }
  }

  getContactNumberError(): string {
    const c = this.bookingForm.get('contactNumber');
    if (!c?.errors) return 'Contact number is required';
    if (c.errors['required']) return 'Contact number is required';
    if (c.errors['pattern']) return 'Contact number must be 10 digits';
    return 'Invalid contact number';
  }

  /** Parse stored contact number into country code and local number for edit form */
  parseContactNumber(full: string): { countryCode: string; localNumber: string } {
    const trimmed = (full || '').trim();
    if (!trimmed) return { countryCode: '+91', localNumber: '' };
    const plusMatch = trimmed.match(/^(\+\d{1,4})\s*(.*)$/);
    if (plusMatch) {
      return { countryCode: plusMatch[1], localNumber: (plusMatch[2] || '').trim() };
    }
    return { countryCode: '+91', localNumber: trimmed };
  }

  /** Convert Date/ISO/date-string to yyyy-mm-dd for date inputs without local timezone shifts. */
  toDateInputValue(value: any): string {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '';
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
