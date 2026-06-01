const express = require('express');
const mongoose = require('mongoose');
const { auth, authorize } = require('../middleware/auth');
const Booking = require('../models/Booking');

function getPaginationParams(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 500);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}


function getCRDR(booking) {
  const salePrice = booking.salePrice ?? 0;
  const ourCost = booking.ourCost ?? 0;
  const supplierCharges = booking.supplierCharges ?? 0;
  const paymentFromCard = booking.paymentFromCard ?? 0;
  const cardType = booking.cardType ?? null;

  if (cardType === 'Client Card' && paymentFromCard === salePrice) {
    return {
      type: 'CR',
      value: Math.round((salePrice - ourCost - supplierCharges) * 100) / 100,
      label: 'CR'
    };
  }

  if (!paymentFromCard || paymentFromCard === 0) {
    return {
      type: 'DR',
      value: Math.round((ourCost + supplierCharges) * 100) / 100,
      label: 'DR'
    };
  }

  return {
    type: 'DR',
    value: Math.round((ourCost + supplierCharges - paymentFromCard) * 100) / 100,
    label: 'DR'
  };
}

const router = express.Router();

// Date-wise report
router.get('/date-wise', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ message: 'Date range is required' });
    }
    
    const { skip, limit } = getPaginationParams(req);
    const bookings = await Booking.find({
      dateOfSubmission: {
        $gte: new Date(dateFrom),
        $lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999))
      }
    })
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .sort({ dateOfSubmission: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalSupplierCharges = bookings.reduce((sum, b) => sum + (b.supplierCharges || 0), 0);
    const totalAirlineCharges = bookings
      .filter(b => b.status === 'Cancelled')
      .reduce((sum, b) => sum + (b.cancellation?.airlineCancellationCharges || 0), 0);
    const totalCurrentMargin = bookings.reduce((sum, b) => {
      if (b.status === 'Cancelled') return sum + (b.cancellation?.currentMargin || 0);
      return sum + ((b.salePrice || 0) - (b.ourCost || 0) - (b.supplierCharges || 0));
    }, 0);

    const summary = {
      totalBookings: rows.length,
      totalSale: rows.reduce((s, r) => s + r.salePrice, 0),
      totalPaid: rows.reduce((s, r) => s + r.totalPaidAmount, 0),
      totalMargin: rows.reduce((s, r) => s + r.margin, 0),
      totalSupplierCharges,
      totalAirlineCharges,
      totalCurrentMargin
    };

    res.json({ bookings: rows, summary });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/verified-payments', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { dateFrom, dateTo, agent, cancellationVerified } = req.query;

    const matchQuery = {};

    // Use correct verified fields — check both admin and account verification
    matchQuery.$or = [
      { adminVerified: true },
      { accountVerified: true }
    ];

    if (dateFrom || dateTo) {
      matchQuery.dateOfSubmission = {};
      if (dateFrom) matchQuery.dateOfSubmission.$gte = new Date(dateFrom);
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        matchQuery.dateOfSubmission.$lte = endOfDay;
      }
    }

    if (agent && agent !== 'all') {
      try {
        matchQuery.submittedBy = new mongoose.Types.ObjectId(agent);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid agent ID' });
      }
    }

    if (cancellationVerified === 'true') {
      matchQuery.cancellationVerified = true;
    }

    const bookings = await Booking.find(matchQuery)
      .populate('submittedBy', 'name email')
      .populate('verifiedByAdminUser', 'name')
      .populate('cancellationVerifiedBy', 'name')
      .sort({ dateOfSubmission: -1 })
      .lean();

    const summary = {
      totalBookings: bookings.length,
      totalSalePrice: bookings.reduce((sum, b) => sum + (b.totalSalePrice ?? 0), 0),
      totalOurCost: bookings.reduce((sum, b) => sum + (b.ourCost ?? 0), 0),
      // For Verified Payments, we also need to pass currentMargin or refundCommitted
      
      totalMargin: bookings.reduce((sum, b) => sum + ((b.totalSalePrice ?? 0) - (b.ourCost ?? 0) - (b.supplierCharges ?? 0)), 0)
    };

    const bookingsWithCRDR = bookings.map(b => ({ ...(b.toObject ? b.toObject() : b), crdr: getCRDR(b) }));
    res.json({ bookings: bookingsWithCRDR, summary });
  } catch (error) {
    console.error('Verified payments report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

