const mongoose = require('mongoose');

/**
 * Money actually sent to a supplier.
 *
 * Nothing in the system recorded this before. The old Payment to Supplier report showed `ourCost`
 * under the heading "Payment Paid", which is what we OWE, not what we have paid — so there was no
 * way to compute what is still open with a supplier. These rows are the credit side of the
 * supplier statement.
 *
 * There is deliberately no update route. A wrong entry is deleted and re-entered: that leaves a
 * clearer trail than a mutable amount on a financial record.
 *
 * An opening balance for a supplier is one of these rows, dated before the first statement period
 * and noted "Opening balance" — the system has no history of earlier settlements, so the client
 * states it once per supplier and the arithmetic is exact from then on.
 */
const supplierPaymentSchema = new mongoose.Schema({
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  // Date-only, stored at noon UTC via parseDateInput — see utils/date-only.js.
  paymentDate: {
    type: Date,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    validate: {
      validator: v => typeof v === 'number' && isFinite(v) && v > 0,
      message: 'amount must be a positive number'
    }
  },
  reference: {
    type: String,
    default: ''
  },
  note: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdByName: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

supplierPaymentSchema.index({ supplier: 1, paymentDate: 1 });

module.exports = mongoose.model('SupplierPayment', supplierPaymentSchema);
