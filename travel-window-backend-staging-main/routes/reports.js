const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Booking = require('../models/Booking');

function getPaginationParams(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 500);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
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
    
    const summary = {
      totalBookings: bookings.length,
      totalSalePrice: bookings.reduce((sum, b) => sum + b.totalSalePrice, 0),
      totalPaidAmount: bookings.reduce((sum, b) => sum + b.totalPaidAmount, 0),
      totalBalance: bookings.reduce((sum, b) => sum + b.balanceAmount, 0)
    };
    
    res.json({ bookings, summary });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Supplier-wise report
router.get('/supplier-wise', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { supplier, dateFrom, dateTo } = req.query;
    
    const query = {};
    if (supplier && supplier !== 'all') {
      query.supplier = supplier;
    }
    if (dateFrom || dateTo) {
      query.dateOfSubmission = {};
      if (dateFrom) query.dateOfSubmission.$gte = new Date(dateFrom);
      if (dateTo) query.dateOfSubmission.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }
    
    const { skip, limit } = getPaginationParams(req);
    const bookings = await Booking.find(query)
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .sort({ dateOfSubmission: -1 })
      .skip(skip)
      .limit(limit);
    
    // Group by supplier
    const supplierGroups = {};
    bookings.forEach(booking => {
      const supplierName = booking.supplierName || 'No Supplier';
      if (!supplierGroups[supplierName]) {
        supplierGroups[supplierName] = {
          supplier: supplierName,
          bookings: [],
          totalSalePrice: 0,
          totalPaidAmount: 0,
          totalBalance: 0
        };
      }
      supplierGroups[supplierName].bookings.push(booking);
      supplierGroups[supplierName].totalSalePrice += booking.totalSalePrice;
      supplierGroups[supplierName].totalPaidAmount += booking.totalPaidAmount;
      supplierGroups[supplierName].totalBalance += booking.balanceAmount;
    });
    
    res.json({ groups: Object.values(supplierGroups) });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Employee-wise report
router.get('/employee-wise', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { employee, dateFrom, dateTo } = req.query;
    
    const query = {};
    if (employee && employee !== 'all') {
      query.submittedBy = employee;
    }
    if (dateFrom || dateTo) {
      query.dateOfSubmission = {};
      if (dateFrom) query.dateOfSubmission.$gte = new Date(dateFrom);
      if (dateTo) query.dateOfSubmission.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }
    
    const { skip, limit } = getPaginationParams(req);
    const bookings = await Booking.find(query)
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .sort({ dateOfSubmission: -1 })
      .skip(skip)
      .limit(limit);
    
    // Group by employee
    const employeeGroups = {};
    bookings.forEach(booking => {
      const employeeName = booking.submittedByName || 'Unknown';
      if (!employeeGroups[employeeName]) {
        employeeGroups[employeeName] = {
          employee: employeeName,
          bookings: [],
          totalSalePrice: 0,
          totalPaidAmount: 0,
          totalBalance: 0
        };
      }
      employeeGroups[employeeName].bookings.push(booking);
      employeeGroups[employeeName].totalSalePrice += booking.totalSalePrice;
      employeeGroups[employeeName].totalPaidAmount += booking.totalPaidAmount;
      employeeGroups[employeeName].totalBalance += booking.balanceAmount;
    });
    
    res.json({ groups: Object.values(employeeGroups) });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Pending Verification report
router.get('/pending-verification', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { skip, limit } = getPaginationParams(req);
    const bookings = await Booking.find({
      status: { $in: ['Pending Verification', 'Unticketed'] }
    })
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .sort({ dateOfSubmission: -1 })
      .skip(skip)
      .limit(limit);
    
    res.json({ bookings, count: bookings.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Outstanding Balance report
router.get('/outstanding-balance', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { skip, limit } = getPaginationParams(req);
    const bookings = await Booking.find({
      balanceAmount: { $gt: 0 },
      status: { $ne: 'Cancelled' }
    })
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .sort({ balanceAmount: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalOutstanding = bookings.reduce((sum, b) => sum + b.balanceAmount, 0);
    
    res.json({ 
      bookings, 
      totalOutstanding,
      count: bookings.length 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Report A: Date-wise Payment to Supplier
router.get('/payment-to-supplier', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const query = {};
    if (dateFrom || dateTo) {
      query.dateOfSubmission = {};
      if (dateFrom) query.dateOfSubmission.$gte = new Date(dateFrom);
      if (dateTo) query.dateOfSubmission.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }
    
    const { skip, limit } = getPaginationParams(req);
    const bookings = await Booking.find(query).populate('supplier', 'name').sort({ dateOfSubmission: -1 }).skip(skip).limit(limit);
    
    const reportData = [];
    bookings.forEach(b => {
      if (!b.supplier) return;
      const dateStr = new Date(b.dateOfSubmission).toISOString().split('T')[0];
      const supplierName = b.supplier.name || 'Unknown';
      
      let existing = reportData.find(r => r.date === dateStr && r.supplierName === supplierName);
      if (!existing) {
        existing = { date: dateStr, supplierName, paymentPaid: 0, totalBookingCost: 0 };
        reportData.push(existing);
      }
      
      existing.paymentPaid += (b.ourCost || 0); // Assuming ourCost is what we pay supplier
      existing.totalBookingCost += (b.totalSalePrice || 0);
    });
    
    reportData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(reportData);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Report B: Unverified Payments (updated with supplier + card fields)
router.get('/unverified-payments', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { paymentType } = req.query;
    
    const { skip, limit } = getPaginationParams(req);
    const bookings = await Booking.find({
      adminVerified: { $ne: true },
      accountVerified: { $ne: true }
    }).sort({ dateOfSubmission: -1 }).skip(skip).limit(limit);
    const unverifiedPayments = [];
    
    bookings.forEach(b => {
      if (paymentType === 'card') {
        if (!b.cardType || b.cardType.trim() === '') return;
      } else if (paymentType === 'other') {
        if (b.cardType && b.cardType.trim() !== '') return;
      }

      if (b.payments && b.payments.length > 0) {
        b.payments.forEach(p => {
          unverifiedPayments.push({
            bookingId: b.pnr,
            _id: b._id,
            passengerName: b.paxName,
            salePrice: b.salePrice || 0,
            paymentAmount: p.paidAmount,
            paymentMode: p.paymentMode,
            status: b.status,
            supplierName: b.supplierName || 'N/A',
            paymentFromCard: b.paymentFromCard || 0,
            cardType: b.cardType || '',
            cardLast4Digits: b.cardLast4Digits || '',
            supplierCharges: b.supplierCharges || 0,
            ourCost: b.ourCost || 0,
            totalSupplierTook: b.cancellation?.totalSupplierTook || 0
          });
        });
      }
    });
    
    res.json(unverifiedPayments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Report C: Agent Margin Report
router.get('/agent-margin', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const query = { status: { $ne: 'Cancelled' } };
    if (dateFrom || dateTo) {
      query.dateOfSubmission = {};
      if (dateFrom) query.dateOfSubmission.$gte = new Date(dateFrom);
      if (dateTo) query.dateOfSubmission.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }
    
    const { skip, limit } = getPaginationParams(req);
    const bookings = await Booking.find(query).populate('submittedBy', 'name').skip(skip).limit(limit);
    
    const agentMap = {};
    bookings.forEach(b => {
      const agentName = b.submittedByName || (b.submittedBy ? b.submittedBy.name : 'Unknown');
      if (!agentMap[agentName]) {
        agentMap[agentName] = { agentName, totalBookings: 0, totalSalePrice: 0, totalMargin: 0 };
      }
      agentMap[agentName].totalBookings += 1;
      agentMap[agentName].totalSalePrice += (b.totalSalePrice || 0);
      agentMap[agentName].totalMargin += ((b.salePrice || 0) - (b.ourCost || 0) - (b.supplierCharges || 0));
    });
    
    res.json(Object.values(agentMap));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Report D: Agent Booking List (date-wise, accessible by all roles)
router.get('/agent-booking-list', auth, async (req, res) => {
  try {
    const { dateFrom, dateTo, employee } = req.query;
    const query = { status: { $ne: 'Cancelled' } };

    // Agents see only their own bookings
    if (req.user.role === 'AGENT1' || req.user.role === 'AGENT2') {
      query.submittedBy = req.user._id;
    } else if (employee) {
      query.submittedBy = employee;
    }

    if (dateFrom || dateTo) {
      query.$or = [];
      const dateRange = {};
      if (dateFrom) dateRange.$gte = new Date(dateFrom);
      if (dateTo) dateRange.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
      query.$or.push({ travelDate: dateRange });
      query.$or.push({ returnDate: dateRange });
    }

    const { skip, limit } = getPaginationParams(req);
    const bookings = await Booking.find(query)
      .populate('submittedBy', 'name')
      .sort({ travelDate: -1 })
      .skip(skip)
      .limit(limit);

    const result = bookings.map(b => ({
      _id: b._id,
      pnr: b.pnr,
      paxName: b.paxName,
      dateOfSubmission: b.dateOfSubmission,
      travelDate: b.travelDate,
      returnDate: b.returnDate,
      submittedByName: b.submittedByName || (b.submittedBy ? b.submittedBy.name : 'Unknown')
    }));

    res.json({ bookings: result });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Report E: Agent Margin Report (per-booking, accessible by all roles)
router.get('/agent-margin-report', auth, async (req, res) => {
  try {
    const { dateFrom, dateTo, employee } = req.query;
    const query = { status: { $ne: 'Cancelled' } };

    // Agents see only their own bookings
    if (req.user.role === 'AGENT1' || req.user.role === 'AGENT2') {
      query.submittedBy = req.user._id;
    } else if (employee) {
      query.submittedBy = employee;
    }

    if (dateFrom || dateTo) {
      query.dateOfSubmission = {};
      if (dateFrom) query.dateOfSubmission.$gte = new Date(dateFrom);
      if (dateTo) query.dateOfSubmission.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    const { skip, limit } = getPaginationParams(req);
    const bookings = await Booking.find(query)
      .populate('submittedBy', 'name')
      .sort({ dateOfSubmission: -1 })
      .skip(skip)
      .limit(limit);

    const result = bookings.map(b => ({
      _id: b._id,
      pnr: b.pnr,
      paxName: b.paxName,
      ourCost: b.ourCost || 0,
      salePrice: b.salePrice || 0,
      margin: (b.salePrice || 0) - (b.ourCost || 0) - (b.supplierCharges || 0),
      submittedByName: b.submittedByName || (b.submittedBy ? b.submittedBy.name : 'Unknown')
    }));

    const totalMargin = result.reduce((sum, r) => sum + r.margin, 0);

    res.json({ bookings: result, totalMargin });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Report F: Date Wise Financial Summary (Admin/Account only)
router.get('/financial-summary', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
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
      },
      status: { $ne: 'Cancelled' }
    }).sort({ dateOfSubmission: -1 }).skip(skip).limit(limit);

    const rows = bookings.map(b => ({
      _id: b._id,
      pnr: b.pnr,
      paxName: b.paxName,
      ourCost: b.ourCost || 0,
      salePrice: b.salePrice || 0,
      margin: (b.salePrice || 0) - (b.ourCost || 0) - (b.supplierCharges || 0),
      totalPaidAmount: b.totalPaidAmount || 0,
      balanceAmount: b.balanceAmount || 0
    }));

    const summary = {
      totalBookings: rows.length,
      totalSale: rows.reduce((s, r) => s + r.salePrice, 0),
      totalPaid: rows.reduce((s, r) => s + r.totalPaidAmount, 0),
      totalMargin: rows.reduce((s, r) => s + r.margin, 0)
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
      totalMargin: bookings.reduce((sum, b) => sum + ((b.totalSalePrice ?? 0) - (b.ourCost ?? 0) - (b.supplierCharges ?? 0)), 0)
    };

    res.json({ bookings, summary });
  } catch (error) {
    console.error('Verified payments report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

