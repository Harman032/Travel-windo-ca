const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Booking = require('../models/Booking');
const { buildRange, inRange } = require('../utils/tz');
const { isUnrecordedAccount, RECEIVING_ACCOUNTS } = require('../utils/payment-rows');

const router = express.Router();

/**
 * GET /api/payments - List all payments (flattened from bookings). Admin only.
 * Query: pnr, paymentMode, startDate, endDate, receivingAccount
 *
 * receivingAccount: 'All' (or absent) | one of RECEIVING_ACCOUNTS | 'Not recorded'.
 * 'Not recorded' means an E-Transfer saved before the two fields existed, plus every legacy
 * Cheque and Bank Transfer row -- written as "has no receivingAccount" rather than as a list of
 * modes, so there is no mode list to keep in step.
 */
router.get('/', auth, authorize('ADMIN'), async (req, res) => {
  try {
    const { pnr, paymentMode, startDate, endDate, receivingAccount } = req.query;
    const bankFilter = (receivingAccount || '').trim();
    if (bankFilter && bankFilter !== 'All' && bankFilter !== 'Not recorded'
        && !RECEIVING_ACCOUNTS.includes(bankFilter)) {
      return res.status(400).json({ message: `Unknown receivingAccount "${bankFilter}"` });
    }

    const filter = {};
    if (pnr && pnr.trim()) {
      filter.pnr = new RegExp(pnr.trim(), 'i');
    }
    // Toronto whole days, same boundaries as the in-memory re-filter below.
    const range = buildRange(startDate, endDate);
    if (range) filter['payments.paymentDate'] = range;
    if (paymentMode && paymentMode !== 'All Modes' && paymentMode.trim()) {
      filter['payments.paymentMode'] = paymentMode.trim();
    }

    const bookings = await Booking.find(filter)
      .select('pnr paxName submittedByName payments')  // payments carries receivingAccount + senderName
      .lean();

    const rows = [];
    for (const b of bookings) {
      if (!b.payments || !b.payments.length) continue;
      const addedBy = b.submittedByName || '—';
      for (const p of b.payments) {
        if (paymentMode && paymentMode !== 'All Modes' && paymentMode.trim() && p.paymentMode !== paymentMode.trim()) continue;
        // The Mongo filter above matches a BOOKING that has any payment in range; each payment
        // row still has to be tested individually, against the same range.
        if (!inRange(p.paymentDate, range)) continue;
        // Applied HERE, before rows are pushed, so the summary below is the total of the filtered
        // set rather than of everything. This route has no paging at all -- it returns every
        // matching row and totals the array it built -- so there is no truncation to get wrong.
        if (bankFilter && bankFilter !== 'All') {
          const matchesBank = bankFilter === 'Not recorded'
            ? isUnrecordedAccount(p)
            : (p.receivingAccount || '').trim() === bankFilter;
          if (!matchesBank) continue;
        }
        rows.push({
          date: p.paymentDate,
          bookingPnr: b.pnr,
          passenger: b.paxName,
          amount: p.paidAmount,
          mode: p.paymentMode,
          reference: p.referenceNo || '—',
          receivingAccount: p.receivingAccount || '',
          senderName: p.senderName || '',
          addedBy,
          bookingId: b._id.toString(),
        });
      }
    }

    // Sort by date descending (Newest First)
    rows.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    const totalPayments = rows.length;
    const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);
    const averagePayment = totalPayments > 0 ? totalAmount / totalPayments : 0;

    return res.json({
      payments: rows,
      summary: {
        totalPayments,
        totalAmount,
        averagePayment: Math.round(averagePayment * 1000) / 1000,
      },
    });
  } catch (err) {
    console.error('Payments list error:', err);
    return res.status(500).json({ message: 'Failed to fetch payments' });
  }
});

module.exports = router;
