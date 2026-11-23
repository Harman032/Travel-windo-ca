const mongoose = require('mongoose');

// Single source of truth for payment modes, used by both payments[].paymentMode and
// cancellation.paymentModeWas so the two cannot drift apart.
// Cheque and Bank Transfer are legacy values: ~450 stored bookings still carry them (they were
// dropped from the schema in May without a data migration) and Mongoose re-validates every loaded
// field on save, so rejecting them blocks every edit/cancel/verify on those bookings. They are
// intentionally not offered in the UI dropdowns.
const PAYMENT_MODES = [
  'Cash', 'Machine Charge', 'UPI', 'E-Transfer', 'Kotak Bank', 'Kotak Bank UPI', 'Travobirds', 'Credit Card',
  'Cheque', 'Bank Transfer', 'SkyLight'
];

// Single definition, in utils/receiving-accounts.js, so utils/payment-rows.js can validate
// against it without a util importing a model. Re-exported below as Booking.RECEIVING_ACCOUNTS,
// alongside PAYMENT_MODES.
const { RECEIVING_ACCOUNTS } = require('../utils/receiving-accounts');

const paymentSchema = new mongoose.Schema({
  paidAmount: {
    type: Number,
    required: true
  },
  paymentMode: {
    type: String,
    enum: PAYMENT_MODES,
    required: true
  },
  paymentDate: {
    type: Date,
    required: true
  },
  referenceNo: {
    type: String,
    default: ''
  },
  // E-Transfer only: which of our accounts received it, and who sent it.
  //
  // NO `required`, and NO enum, deliberately. Mongoose re-validates every loaded path on save, so
  // either one would make the ~500 stored Cheque / Bank Transfer / bare E-Transfer rows block
  // every edit, date change, cancellation and verification on their bookings -- the Cheque
  // incident, which took out 440 bookings. The requirement is enforced in the route layer
  // instead, and only for a row that is new or whose mode, amount or date has changed:
  // see utils/payment-rows.js.
  receivingAccount: {
    type: String,
    default: ''
  },
  senderName: {
    type: String,
    default: ''
  }
});

const progressHistorySchema = new mongoose.Schema({
  action: {
    type: String,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  performedByName: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  changes: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  remarks: {
    type: String,
    default: ''
  }
});

const bookingSchema = new mongoose.Schema({
  // Auto/System Fields
  dateOfSubmission: {
    type: Date,
    default: Date.now
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submittedByName: {
    type: String,
    required: true
  },
  
  // Passenger & Contact Details
  paxName: {
    type: String,
    required: true,
    uppercase: true
  },
  contactPerson: {
    type: String,
    default: ''
  },
  contactNumber: {
    type: String,
    required: true
  },
  pnr: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  
  // Travel Details
  sectorType: {
    type: String,
    enum: ['One Way', 'Round Trip', 'Multiple'],
    required: true
  },
  travelDate: {
    type: Date,
    required: true
  },
  // The day the ticket was actually issued, as opposed to dateOfSubmission, the instant it was
  // keyed in. Date-only, stored at noon UTC via parseDateInput, same as travelDate.
  //
  // Optional and NOT backfilled. Every legacy booking leaves it unset and falls back to
  // dateOfSubmission through effectiveDate(), so no figure in any closed month moves.
  //
  // No schema validator on the date bounds: the "not in the future, not more than 3 days back"
  // rule lives in the route layer (utils/effective-date.js validateIssueDate), because Mongoose
  // re-validates every loaded path on save and a schema rule would make an out-of-bounds stored
  // value block every later edit, cancellation and verification on that booking.
  issueDate: {
    type: Date
  },
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  returnDate: {
    type: Date
  },
  multipleSectors: [{
    travelDate: Date,
    from: String,
    to: String
  }],
  note: {
    type: String,
    default: ''
  },
  
  // Commercial Details
  airline: {
    type: String,
    default: ''
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  supplierName: {
    type: String,
    default: ''
  },
  ourCost: {
    type: Number,
    default: 0
  },
  salePrice: {
    type: Number,
    default: 0
  },
  supplierCharges: {
    type: Number,
    default: 0
  },
  supplierBookingCharge: {
    type: Number,
    default: 0
  },
  supplierUpdationCharge: {
    type: Number,
    default: 0
  },
  additionalService: {
    type: String,
    default: ''
  },
  additionalServicePrice: {
    type: Number,
    default: 0
  },
  additionalServices: [{
    serviceName: { type: String, default: '' },
    serviceCost: { type: Number, default: 0 }
  }],
  totalSalePrice: {
    type: Number,
    default: 0
  },
  paymentFromCard: { type: Number, default: 0 },
  cardType: { type: String, enum: ['Company Card', 'Client Card', ''], default: '' },
  cardLast4Digits: { type: String, default: '' },
  
  // Payment Details
  paymentType: {
    type: String,
    enum: ['Full', 'Installments'],
    default: 'Full'
  },
  payments: [paymentSchema],
  totalPaidAmount: {
    type: Number,
    default: 0
  },
  balanceAmount: {
    type: Number,
    default: 0
  },
  billingStatus: {
    type: String,
    enum: ['Partial Paid', 'Fully Paid', 'Unpaid'],
    default: 'Unpaid'
  },
  
  // Status & Verification
  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Pending Verification', 'Account Verified', 'Admin Verified', 'Billed', 'Paid', 'Unticketed', 'Ticked', 'Ticketed', 'Cancelled'],
    default: 'Pending Verification'
  },
  verifiedByAccount: {
    type: Boolean,
    default: false
  },
  verifiedByAccountDate: {
    type: Date
  },
  verifiedByAccountUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedByAdmin: {
    type: Boolean,
    default: false
  },
  verifiedByAdminDate: {
    type: Date
  },
  verifiedByAdminUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminVerified: {
    type: Boolean,
    default: false
  },
  accountVerified: {
    type: Boolean,
    default: false
  },
  
  // Cancellation Verification Tracking
  cancellationVerified: { type: Boolean, default: false },
  cancellationVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancellationVerifiedAt: { type: Date },
  
  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Progress History
  progressHistory: [progressHistorySchema],
  
  // Post-Booking Changes
  dateChanges: [{
    oldTravelDate: Date,
    newTravelDate: Date,
    oldReturnDate: Date,
    newReturnDate: Date,
    oldOurCost: Number,
    newOurCost: Number,
    oldSalePrice: Number,
    newSalePrice: Number,
    ourCostAddon: { type: Number, default: 0 },
    salePriceAddon: { type: Number, default: 0 },
    remarks: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    marginSplit: {
      originalUserAmount: { type: Number, default: 0 },
      modifierUserAmount: { type: Number, default: 0 },
      modifierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      modifierName: { type: String, default: '' }
    }
  }],
  
  flightChanges: [{
    oldDetails: mongoose.Schema.Types.Mixed,
    newDetails: mongoose.Schema.Types.Mixed,
    ourCostAddon: { type: Number, default: 0 },
    salePriceAddon: { type: Number, default: 0 },
    remarks: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    marginSplit: {
      originalUserAmount: { type: Number, default: 0 },
      modifierUserAmount: { type: Number, default: 0 },
      modifierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      modifierName: { type: String, default: '' }
    }
  }],
  
  seatBookChanges: [{
    oldOurCost: Number,
    newOurCost: Number,
    oldSalePrice: Number,
    newSalePrice: Number,
    oldSupplier: mongoose.Schema.Types.ObjectId,
    newSupplier: mongoose.Schema.Types.ObjectId,
    paymentMode: String,
    remarks: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    marginSplit: {
      originalUserAmount: { type: Number, default: 0 },
      modifierUserAmount: { type: Number, default: 0 },
      modifierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      modifierName: { type: String, default: '' }
    }
  }],
  
  // Cancellation
  cancellation: {
    isCancelled: {
      type: Boolean,
      default: false
    },
    paymentModeWas: {
      type: String,
      enum: PAYMENT_MODES
    },
    // These three are the INPUTS the cancellation engine was given, and they were missing from
    // this schema while the cancel route wrote them. Mongoose silently drops unknown paths, so
    // every cancellation lost them: 0 of 26 cancelled bookings in the staging copy has
    // cancellationMode or airlineRefundAmount stored.
    //
    // The damage is not just a blank field. recalculateCancellationValues reads
    // `c.cancellationMode === 'charges'` to pick which formula to run, so without it every
    // recalculation silently falls into refund-amount mode with a refund of 0 — a different
    // scenario family than the one the booking was cancelled under. Storing them makes a
    // recalculation reproduce the original decision instead of inventing a new one.
    cancellationMode: {
      type: String,
      enum: ['charges', 'refundAmount']
    },
    airlineRefundAmount: { type: Number, default: 0 },
    // Engine output, kept so the stored figures can be audited without re-running the engine.
    airlineDeducted: { type: Number, default: 0 },
    totalAmountPaidByClient: {
      type: Number,
      default: 0
    },
    totalAmountPaid: {
      type: Number,
      default: 0
    },
    refundableAmount: {
      type: Number,
      default: 0
    },
    oldMargin: {
      type: Number,
      default: 0
    },
    oldMarginRow2: {
      type: Number,
      default: 0
    },
    committedToClient: {
      type: Number,
      default: 0
    },
    chargeFromClient: {
      type: Number,
      default: 0
    },
    newMargin: {
      type: Number,
      default: 0
    },
    airlineCancellationCharges: { type: Number, default: 0 },
    supplierCancellationCharge: { type: Number, default: 0 },
    supplierRefundAmount: { type: Number, default: 0 },
    supplierDeducted: { type: Number, default: 0 },
    ourCancellationCharges: { type: Number, default: 0 },
    totalSupplierTook: { type: Number, default: 0 },
    totalCharges: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    clientReceives: { type: Number, default: 0 },
    upfrontNeeded: { type: Number, default: 0 },
    refundToClient: { type: Number, default: 0 },
    supplierWillReturn: { type: Number, default: 0 },
    refundableAmount: { type: Number, default: 0 },
    cancellationType: { type: String },
    currentMargin: { type: Number, default: 0 },
    totalCancellationCharges: { type: Number, default: 0 },
    refundableAmountToClient: { type: Number, default: 0 },
    refundableAmountCommittedToClient: { type: Number, default: 0 },
    refundCommittedToClient: { type: Number, default: 0 },
    refundProcessed: {
      type: Boolean,
      default: false
    },
    refundProcessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    refundProcessedDate: {
      type: Date
    },
    remarks: {
      type: String,
      default: ''
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancelledAt: {
      type: Date
    },
    refundAwaitedFromSupplier: { type: Boolean, default: true },
    refundReceivedFromSupplier: {
      date: { type: Date },
      remarks: { type: String, default: '' }
    },
    refundPaidToClient: {
      date: { type: Date },
      remarks: { type: String, default: '' }
    },
    upfrontCollection: {
      amountCollected: { type: Number, default: 0 },
      collectionDate: { type: Date, default: null },
      paymentMode: { type: String, default: '' },
      remarks: { type: String, default: '' },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      updatedAt: {
        type: Date,
        default: null
      }
    }
  }
}, {
  timestamps: true
});

// Indexes
bookingSchema.index({ pnr: 1 });
bookingSchema.index({ contactNumber: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ supplier: 1 });
bookingSchema.index({ submittedBy: 1 });
bookingSchema.index({ dateOfSubmission: 1 });
// The effective-date range filter is two clauses -- { issueDate: range } and
// { issueDate: null, dateOfSubmission: range } -- so the first needs its own index. A sparse
// index would be smaller, but the second clause matches on issueDate: null, and a sparse index
// cannot serve that, so a plain index is the one that keeps both clauses index-eligible.
bookingSchema.index({ issueDate: 1 });
bookingSchema.index({ supplier: 1, dateOfSubmission: -1 });
bookingSchema.index({ submittedBy: 1, dateOfSubmission: -1 });
bookingSchema.index({ status: 1, dateOfSubmission: -1 });
bookingSchema.index({ balanceAmount: 1, status: 1 });
bookingSchema.index({ dateOfSubmission: 1, status: 1 });

const Booking = mongoose.model('Booking', bookingSchema);
Booking.PAYMENT_MODES = PAYMENT_MODES;
Booking.RECEIVING_ACCOUNTS = RECEIVING_ACCOUNTS;

module.exports = Booking;
