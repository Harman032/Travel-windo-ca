const express = require('express');
const mongoose = require('mongoose');
const { auth, authorize } = require('../middleware/auth');
const SupplierPayment = require('../models/SupplierPayment');
const Supplier = require('../models/Supplier');
const { parseDateInput, validateDateOnly } = require('../utils/date-only');
const { buildRange } = require('../utils/tz');
const { parseStrictNumber } = require('../utils/validate-financial');

const router = express.Router();

const isObjectId = id => mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);

// List payments recorded against a supplier. Account and Admin only.
router.get('/', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { supplier, dateFrom, dateTo } = req.query;

    const query = {};
    if (supplier && supplier !== 'all') {
      if (!isObjectId(supplier)) return res.status(400).json({ message: 'Invalid supplier id' });
      query.supplier = supplier;
    }
    const range = buildRange(dateFrom, dateTo);
    if (range) query.paymentDate = range;

    const payments = await SupplierPayment.find(query)
      .populate('supplier', 'name')
      .sort({ paymentDate: -1, _id: -1 })
      .lean();

    const total = Math.round(payments.reduce((s, p) => s + (p.amount || 0), 0) * 100) / 100;
    res.json({ payments, total, count: payments.length });
  } catch (error) {
    console.error(`[${req.id}] GET /api/supplier-payments failed:`, error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Record a payment to a supplier. Account and Admin only.
router.post('/', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { supplier, paymentDate, amount, reference, note } = req.body;

    if (!isObjectId(supplier)) return res.status(400).json({ message: 'Invalid supplier id' });
    const exists = await Supplier.exists({ _id: supplier });
    if (!exists) return res.status(404).json({ message: 'Supplier not found' });

    const parsedAmount = parseStrictNumber(amount);
    if (!parsedAmount.ok || parsedAmount.value <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }

    // Date-only: noon UTC, so the recorded day is the same day for every reader.
    //
    // Year-guarded like every other date-only input, and this one earns it twice over: the
    // statement decides opening balance vs period purely on this date (utils/supplier-statement.js
    // filters every line on inRange(l.date, range)). A payment typed as year 22026 would sit
    // outside every range anyone ever selects -- neither in the opening balance nor in any
    // period -- so the money would simply vanish from the statement rather than look wrong.
    const invalidDate = validateDateOnly(paymentDate, 'paymentDate');
    if (invalidDate) return res.status(400).json({ message: invalidDate });

    const date = parseDateInput(paymentDate);
    if (!date) return res.status(400).json({ message: 'paymentDate is required (YYYY-MM-DD)' });

    const payment = await SupplierPayment.create({
      supplier,
      paymentDate: date,
      amount: parsedAmount.value,
      reference: (reference || '').toString().trim(),
      note: (note || '').toString().trim(),
      createdBy: req.user._id,
      createdByName: req.user.name || ''
    });

    res.status(201).json(await SupplierPayment.findById(payment._id).populate('supplier', 'name'));
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    console.error(`[${req.id}] POST /api/supplier-payments failed:`, error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a recorded payment. There is no update route on purpose: a wrong entry is deleted and
// re-entered, which leaves a clearer trail than a mutable amount on a financial record.
router.delete('/:id', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid payment id' });
    const deleted = await SupplierPayment.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Payment not found' });
    res.json({ message: 'Payment deleted', _id: deleted._id });
  } catch (error) {
    console.error(`[${req.id}] DELETE /api/supplier-payments/:id failed:`, error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
