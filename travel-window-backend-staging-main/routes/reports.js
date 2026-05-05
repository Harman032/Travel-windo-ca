const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Booking = require('../models/Booking');

const router = express.Router();

// Date-wise report
router.get('/date-wise', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ message: 'Date range is required' });
    }
    
    const bookings = await Booking.find({
      dateOfSubmission: {
        $gte: new Date(dateFrom),
        $lte: new Date(dateTo)
      }
    })
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .sort({ dateOfSubmission: -1 });
    
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
      if (dateTo) query.dateOfSubmission.$lte = new Date(dateTo);
    }
    
    const bookings = await Booking.find(query)
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .sort({ dateOfSubmission: -1 });
    
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
      if (dateTo) query.dateOfSubmission.$lte = new Date(dateTo);
    }
    
    const bookings = await Booking.find(query)
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .sort({ dateOfSubmission: -1 });
    
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
    const bookings = await Booking.find({
      status: { $in: ['Pending Verification', 'Unticketed'] }
    })
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .sort({ dateOfSubmission: -1 });
    
    res.json({ bookings, count: bookings.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Outstanding Balance report
router.get('/outstanding-balance', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const bookings = await Booking.find({
      balanceAmount: { $gt: 0 },
      status: { $ne: 'Cancelled' }
    })
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .sort({ balanceAmount: -1 });
    
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
      if (dateTo) query.dateOfSubmission.$lte = new Date(dateTo);
    }
    
    const bookings = await Booking.find(query).populate('supplier', 'name').sort({ dateOfSubmission: -1 });
    
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

// Report B: Unverified Payments
router.get('/unverified-payments', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const bookings = await Booking.find({ verifiedByAccount: false, status: { $ne: 'Cancelled' } }).sort({ dateOfSubmission: -1 });
    const unverifiedPayments = [];
    
    bookings.forEach(b => {
      if (b.payments && b.payments.length > 0) {
        b.payments.forEach(p => {
          unverifiedPayments.push({
            bookingId: b.pnr,
            passengerName: b.paxName,
            paymentAmount: p.paidAmount,
            paymentMode: p.paymentMode,
            status: b.status
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
      if (dateTo) query.dateOfSubmission.$lte = new Date(dateTo);
    }
    
    const bookings = await Booking.find(query).populate('submittedBy', 'name');
    
    const agentMap = {};
    bookings.forEach(b => {
      const agentName = b.submittedByName || (b.submittedBy ? b.submittedBy.name : 'Unknown');
      if (!agentMap[agentName]) {
        agentMap[agentName] = { agentName, totalBookings: 0, totalSalePrice: 0, totalMargin: 0 };
      }
      agentMap[agentName].totalBookings += 1;
      agentMap[agentName].totalSalePrice += (b.totalSalePrice || 0);
      agentMap[agentName].totalMargin += ((b.salePrice || 0) - (b.ourCost || 0));
    });
    
    res.json(Object.values(agentMap));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
