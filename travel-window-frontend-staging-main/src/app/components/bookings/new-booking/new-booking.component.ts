import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { BookingService, Booking, Payment } from '../../../services/booking.service';
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
              <input type="text" [value]="bookingForm.get('dateOfSubmission')?.value | date" class="input bg-gray-100" readonly />
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
                <select formControlName="countryCode" class="input w-32 flex-shrink-0" [class.border-red-500]="bookingForm.get('contactNumber')?.invalid && bookingForm.get('contactNumber')?.touched">
                  <option *ngFor="let c of countryOptions" [value]="c.code">{{ c.code }} {{ c.name }}</option>
                </select>
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
              <p *ngIf="bookingForm.get('contactNumber')?.invalid && bookingForm.get('contactNumber')?.touched" class="text-red-500 text-xs mt-1">
                {{ getContactNumberError() }}
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
              <label class="block text-sm font-medium text-gray-700 mb-1">Airline</label>
              <input type="text" formControlName="airline" class="input" placeholder="Enter airline" />
            </div>
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
            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Total Sale Price</label>
              <input type="text" [value]="totalSalePrice | number:'1.2-2'" class="input bg-gray-100" readonly />
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
                        <option value="Cheque">Cheque</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="UPI">UPI</option>
                        <option value="Bank Transfer">Bank Transfer</option>
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

  countryOptions: { code: string; name: string }[] = [
    { code: '+91', name: 'India' },
    { code: '+1', name: 'US/Canada' },
    { code: '+44', name: 'UK' },
    { code: '+971', name: 'UAE' },
    { code: '+966', name: 'Saudi Arabia' },
    { code: '+968', name: 'Oman' },
    { code: '+973', name: 'Bahrain' },
    { code: '+974', name: 'Qatar' },
    { code: '+965', name: 'Kuwait' },
    { code: '+61', name: 'Australia' },
    { code: '+64', name: 'New Zealand' },
    { code: '+81', name: 'Japan' },
    { code: '+86', name: 'China' },
    { code: '+82', name: 'South Korea' },
    { code: '+65', name: 'Singapore' },
    { code: '+60', name: 'Malaysia' },
    { code: '+66', name: 'Thailand' },
    { code: '+84', name: 'Vietnam' },
    { code: '+62', name: 'Indonesia' },
    { code: '+63', name: 'Philippines' },
    { code: '+92', name: 'Pakistan' },
    { code: '+880', name: 'Bangladesh' },
    { code: '+94', name: 'Sri Lanka' },
    { code: '+977', name: 'Nepal' },
    { code: '+960', name: 'Maldives' },
    { code: '+20', name: 'Egypt' },
    { code: '+27', name: 'South Africa' },
    { code: '+234', name: 'Nigeria' },
    { code: '+254', name: 'Kenya' },
    { code: '+233', name: 'Ghana' },
    { code: '+55', name: 'Brazil' },
    { code: '+52', name: 'Mexico' },
    { code: '+7', name: 'Russia/Kazakhstan' },
    { code: '+49', name: 'Germany' },
    { code: '+33', name: 'France' },
    { code: '+39', name: 'Italy' },
    { code: '+34', name: 'Spain' },
    { code: '+31', name: 'Netherlands' },
    { code: '+353', name: 'Ireland' },
    { code: '+46', name: 'Sweden' },
    { code: '+47', name: 'Norway' },
    { code: '+45', name: 'Denmark' },
    { code: '+358', name: 'Finland' },
    { code: '+48', name: 'Poland' },
    { code: '+43', name: 'Austria' },
    { code: '+41', name: 'Switzerland' },
    { code: '+32', name: 'Belgium' },
    { code: '+351', name: 'Portugal' },
    { code: '+30', name: 'Greece' },
    { code: '+90', name: 'Turkey' },
    { code: '+972', name: 'Israel' },
    { code: '+962', name: 'Jordan' },
    { code: '+961', name: 'Lebanon' },
    { code: '+98', name: 'Iran' },
    { code: '+964', name: 'Iraq' },
    { code: '+967', name: 'Yemen' },
    { code: '+212', name: 'Morocco' },
    { code: '+213', name: 'Algeria' },
    { code: '+251', name: 'Ethiopia' },
    { code: '+255', name: 'Tanzania' },
    { code: '+256', name: 'Uganda' },
    { code: '+260', name: 'Zambia' },
    { code: '+852', name: 'Hong Kong' },
    { code: '+853', name: 'Macau' },
    { code: '+886', name: 'Taiwan' },
    { code: '+855', name: 'Cambodia' },
    { code: '+856', name: 'Laos' },
    { code: '+95', name: 'Myanmar' },
    { code: '+673', name: 'Brunei' },
    { code: '+420', name: 'Czech Republic' },
    { code: '+36', name: 'Hungary' },
    { code: '+40', name: 'Romania' },
    { code: '+381', name: 'Serbia' },
    { code: '+380', name: 'Ukraine' },
  ];

  constructor(
    private fb: FormBuilder,
    private bookingService: BookingService,
    private supplierService: SupplierService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService
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
          supplier: booking.supplier?._id || booking.supplier || ''
        });

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
