const express = require('express');
const mongoose = require('mongoose');
const { auth, authorize } = require('../middleware/auth');
const Booking = require('../models/Booking');
const Supplier = require('../models/Supplier');
const SupplierPayment = require('../models/SupplierPayment');
const { inRange, changeRangeConditions, getSplitSummary } = require('../utils/margin-split');
const { buildRange, TZ } = require('../utils/tz');
const { effectiveDate, effectiveRangeConditions } = require('../utils/effective-date');
const { isUnrecordedAccount, RECEIVING_ACCOUNTS } = require('../utils/payment-rows');
const { buildStatement } = require('../utils/supplier-statement');
const { COMPANY } = require('../utils/company');

function getPaginationParams(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 500);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

const round2 = n => Math.round(n * 100) / 100;

function getCRDR(booking) {
  const salePrice = Number(booking.salePrice ?? 0);
  const ourCost = Number(booking.ourCost ?? 0);
  const supplierCharges = Number(booking.supplierCharges ?? 0);
  const paymentFromCard = Number(booking.paymentFromCard ?? 0);

  if (booking.cancellation?.isCancelled) {
    const drValue = Math.round(Number(booking.cancellation.totalSupplierTook || 0) * 100) / 100;
    return {
      type: 'DR',
      value: drValue,
      label: 'DR'
    };
  }

  // Universal formula for active bookings:
  // Net = paymentFromCard - (Our Cost + Supplier Charges)
  // Net > 0 → CR (supplier owes us)
  // Net < 0 → DR (we owe supplier)
  // Net = 0 → NIL

  const totalOwedToSupplier = Math.round((ourCost + supplierCharges) * 100) / 100;
  const net = Math.round((paymentFromCard - totalOwedToSupplier) * 100) / 100;

  if (net > 0) {
    return { type: 'CR', value: net, label: 'CR' };
  } else if (net < 0) {
    return { type: 'DR', value: Math.abs(net), label: 'DR' };
  } else {
    return { type: 'NIL', value: 0, label: 'NIL' };
  }
}


// Slices already-built report rows. With no page/limit the full list is returned (the UI renders
// every row and has no paging controls); an explicit page/limit pages over the same stable order.
function paginateRows(rows, req) {
  const total = rows.length;
  if (req.query.page === undefined && req.query.limit === undefined) return { rows, meta: { total } };
  const { page, limit, skip } = getPaginationParams(req);
  return { rows: rows.slice(skip, skip + limit), meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } };
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
    const bookings = await Booking.find({ dateOfSubmission: buildRange(dateFrom, dateTo) })
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
    
    const bookingsWithCRDR = bookings.map(b => ({ ...(b.toObject ? b.toObject() : b), crdr: getCRDR(b) }));
    res.json({ bookings: bookingsWithCRDR, summary });
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
    const employeeRange = buildRange(dateFrom, dateTo);
    if (employeeRange) query.dateOfSubmission = employeeRange;

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
    
    const bookingsWithCRDR = bookings.map(b => ({ ...(b.toObject ? b.toObject() : b), crdr: getCRDR(b) }));
    res.json({ bookings: bookingsWithCRDR, count: bookingsWithCRDR.length });
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
    const bookingsWithCRDR = bookings.map(b => ({ ...(b.toObject ? b.toObject() : b), crdr: getCRDR(b) }));
    
    res.json({ 
      bookings: bookingsWithCRDR, 
      totalOutstanding,
      count: bookingsWithCRDR.length 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Report B: Payment to Suppliers — a per-supplier statement of what we owe.
//
// Replaces the old Unverified Payments report and the old Payment to Supplier report.
//
// VERIFICATION: shown, NOT filtered on. The client has asked for a Verified column on this
// statement, on screen and in print, reading Account / Admin / Both / —. That reverses c844446,
// which dropped the computation as unused; the decision is the client's and it is recorded here
// rather than argued with.
//
// The distinction that still holds is between showing and filtering. We owe a supplier from the
// moment a ticket is issued, not from the moment our own accounts team ticks a box, so filtering
// by verification would make our statement disagree with the supplier's own for reasons they
// cannot see. Inclusion therefore remains purely date-based. The column is informational.
//
// Note that this does put our internal verification state on a document we hand to a supplier.
// That was the original objection and it has been answered by the client, who wants it; it is a
// disclosure decision, not a technical one. It does NOT widen to anything else: `note` still
// never reaches supplier-facing output (see the standing constraint beside paymentLine in
// utils/supplier-statement.js), because that field carries internal commercial data.
//
// Included: EVERY non-Draft booking for this supplier, with no date filter on the query at all.
// That is deliberate -- lines before the range opens become the opening balance, so the
// statement's arithmetic closes without a second mechanism. The period split happens in
// buildStatement, which filters each LINE on its own date, and that date is now the EFFECTIVE
// date (issueDate when set, dateOfSubmission otherwise).
//
// Every line is returned; there is no paging, because a statement that stops at 50 rows is wrong.
router.get('/payment-to-suppliers', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { supplier, dateFrom, dateTo } = req.query;

    if (!supplier || supplier === 'all') {
      return res.status(400).json({ message: 'A single supplier is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(supplier)) {
      return res.status(400).json({ message: 'Invalid supplier id' });
    }

    const supplierDoc = await Supplier.findById(supplier).select('name').lean();
    if (!supplierDoc) return res.status(404).json({ message: 'Supplier not found' });

    const range = buildRange(dateFrom, dateTo);

    // Everything for this supplier, not just the range: lines before the range open become the
    // opening balance, so the statement's arithmetic closes without a second mechanism.
    const bookings = await Booking.find({
      supplier,
      status: { $ne: 'Draft' }
    })
      // Every field buildStatement reads must be listed here. paymentFromCard drives the fare
      // basis and the cancellation-credit cap; supplierCharges drives the derived cancellation
      // charge. Leaving them out does not error — Mongoose returns undefined and the arithmetic
      // quietly falls back to the pre-fix behaviour.
      .select('pnr paxName dateOfSubmission issueDate travelDate from to sectorType multipleSectors airline ' +
              'status ourCost paymentFromCard supplierCharges adminVerified accountVerified ' +
              'supplierBookingCharge supplierUpdationCharge cancellation ' +
              'dateChanges flightChanges')
      .lean();

    const payments = await SupplierPayment.find({ supplier }).lean();

    const statement = buildStatement(bookings, payments, range);

    res.json({
      company: COMPANY,
      supplierName: (supplierDoc.name || '').trim(),
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      generatedAt: new Date().toISOString(),
      timezone: TZ,
      ...statement
    });
  } catch (error) {
    console.error(`[${req.id}] GET /api/reports/payment-to-suppliers failed:`, error.message);
    res.status(500).json({ message: 'Server error' });
  }
});


// Report C: Agent Margin Report (summary by agent)
router.get('/agent-margin', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const query = { status: { $ne: 'Cancelled' } };
    // A booking is in scope when its EFFECTIVE date is in range OR any modification was made in
    // range. Effective rather than entry date: this is a margin report, so a ticket issued on the
    // 31st and keyed in on the 2nd belongs to the month it was issued -- the month the supplier
    // bills it in and the month the margin was actually earned.
    const range = buildRange(dateFrom, dateTo);
    if (range) {
      query.$or = [...effectiveRangeConditions(range), ...changeRangeConditions(range)];
    }

    // Agent totals must cover every matching booking, so this query is deliberately unpaginated.
    const bookings = await Booking.find(query).populate('submittedBy', 'name').sort({ _id: 1 }).lean();

    const newAgent = (agentName) => ({ agentName, totalBookings: 0, totalSalePrice: 0, totalMargin: 0, supplierCharges: 0 });
    const agentMap = {};
    bookings.forEach(b => {
      const split = getSplitSummary(b, range);
      // The SAME date the query above filtered on. If these two disagree a booking is either
      // fetched and then silently dropped, or counted without having been fetched.
      const bookingInRange = inRange(effectiveDate(b), range);
      if (!bookingInRange && !split.hasInRange) return;

      const agentName = b.submittedByName || (b.submittedBy ? b.submittedBy.name : 'Unknown');
      if (!agentMap[agentName]) agentMap[agentName] = newAgent(agentName);

      if (bookingInRange) {
        agentMap[agentName].totalBookings += 1;
        agentMap[agentName].totalSalePrice += (b.totalSalePrice || 0);
        agentMap[agentName].supplierCharges += (b.supplierCharges || 0);
        const baseMargin = (b.salePrice || 0) - (b.ourCost || 0) - (b.supplierCharges || 0);
        agentMap[agentName].totalMargin += baseMargin - split.netAll;
      }
      agentMap[agentName].totalMargin += split.creatorInRange;

      for (const { amount, name } of Object.values(split.modifiers)) {
        const modName = name || 'Unknown';
        if (!agentMap[modName]) agentMap[modName] = newAgent(modName);
        agentMap[modName].totalMargin += amount;
      }
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

    // Role-based visibility
    const filterId = req.user.role === 'AGENT1' ? req.user._id.toString() : (employee ? employee.toString() : null);

    const conds = [];
    if (filterId) {
      conds.push({
        $or: [
          { submittedBy: filterId },
          { assignedTo: filterId },
          { 'dateChanges.marginSplit.modifierId': filterId },
          { 'flightChanges.marginSplit.modifierId': filterId },
          { 'seatBookChanges.marginSplit.modifierId': filterId }
        ]
      });
    }

    // This list is by travel/return date; a booking is also in scope when a modification was made in range.
    const range = buildRange(dateFrom, dateTo);
    if (range) {
      conds.push({ $or: [{ travelDate: range }, { returnDate: range }, ...changeRangeConditions(range)] });
    }
    if (conds.length) query.$and = conds;

    // Rows are built for every matching booking (stable order: travel date, then _id) and paged afterwards.
    const bookings = await Booking.find(query)
      .populate('submittedBy', 'name')
      .sort({ travelDate: -1, _id: -1 })
      .lean();

    const result = [];
    bookings.forEach(b => {
      const split = getSplitSummary(b, range);
      const bookingInRange = inRange(b.travelDate, range) || inRange(b.returnDate, range);
      if (!bookingInRange && !split.hasInRange) return;

      const baseMargin = Math.round(((b.salePrice || 0) - (b.ourCost || 0) - (b.supplierBookingCharge || 0)) * 100) / 100;

      for (const [modId, modSplit] of Object.entries(split.modifiers)) {
        result.push({
          _id: b._id + '_' + modId,
          pnr: b.pnr + ' (Mod: ' + modSplit.name + ')',
          paxName: b.paxName,
          dateOfSubmission: b.dateOfSubmission,
          travelDate: b.travelDate,
          returnDate: b.returnDate,
          supplierCharges: 0,
          ourMargin: modSplit.amount,
          submittedByName: modSplit.name,
          crdr: { type: 'NIL', value: 0, label: 'NIL' },
          isModifierRow: true,
          modifierId: modId
        });
      }

      const creatorMargin = (bookingInRange ? baseMargin - split.netAll : 0) + split.creatorInRange;
      result.push({
        _id: b._id,
        pnr: b.pnr,
        paxName: b.paxName,
        dateOfSubmission: b.dateOfSubmission,
        travelDate: b.travelDate,
        returnDate: b.returnDate,
        supplierCharges: b.supplierCharges || 0,
        ourMargin: creatorMargin,
        submittedByName: b.submittedByName || (b.submittedBy ? b.submittedBy.name : 'Unknown'),
        crdr: getCRDR(b),
        creatorId: b.submittedBy ? b.submittedBy._id?.toString() : null,
        assignedToId: b.assignedTo ? b.assignedTo?.toString() : null
      });
    });

    let filteredResult = result;
    if (filterId) {
      filteredResult = result.filter(r => 
        (r.isModifierRow && r.modifierId === filterId) || 
        (!r.isModifierRow && (r.creatorId === filterId || r.assignedToId === filterId))
      );
    }

    const totalMargin = round2(filteredResult.reduce((sum, r) => sum + r.ourMargin, 0));
    const { rows, meta } = paginateRows(filteredResult, req);
    res.json({ bookings: rows, totalMargin, ...meta });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Report E: Agent Margin Report (per-booking, accessible by all roles)
router.get('/agent-margin-report', auth, async (req, res) => {
  try {
    const { dateFrom, dateTo, employee } = req.query;
    const query = {};

    // Role-based visibility
    const filterId = req.user.role === 'AGENT1' ? req.user._id.toString() : (employee ? employee.toString() : null);

    const conds = [];
    if (filterId) {
      conds.push({
        $or: [
          { submittedBy: filterId },
          { assignedTo: filterId },
          { 'dateChanges.marginSplit.modifierId': filterId },
          { 'flightChanges.marginSplit.modifierId': filterId },
          { 'seatBookChanges.marginSplit.modifierId': filterId }
        ]
      });
    }

    // Effective date, for the same reason as Report C: this is the per-booking view of the same
    // margin figures and the two must agree, or an agent's total stops equalling the sum of their
    // rows.
    const range = buildRange(dateFrom, dateTo);
    if (range) {
      conds.push({ $or: [...effectiveRangeConditions(range), ...changeRangeConditions(range)] });
    }
    if (conds.length) query.$and = conds;

    // Rows are built for every matching booking (stable order: submission date, then _id) and paged afterwards.
    const bookings = await Booking.find(query)
      .populate('submittedBy', 'name')
      .sort({ dateOfSubmission: -1, _id: -1 })
      .lean();

    const result = [];
    bookings.forEach(b => {
      const split = getSplitSummary(b, range);
      // The SAME date the query above filtered on. If these two disagree a booking is either
      // fetched and then silently dropped, or counted without having been fetched.
      const bookingInRange = inRange(effectiveDate(b), range);
      if (!bookingInRange && !split.hasInRange) return;

      const baseSalePrice = b.salePrice || 0;
      const baseOurCost = b.ourCost || 0;
      const baseSupplierCharges = b.supplierCharges || 0;
      let baseMargin = baseSalePrice - baseOurCost - baseSupplierCharges;
      let currentMarginBase = b.status === 'Cancelled' ? (b.cancellation?.currentMargin || baseMargin) : baseMargin;

      let modifierTotal = 0;
      for (const [modId, modSplit] of Object.entries(split.modifiers)) {
        modifierTotal += modSplit.amount;
        result.push({
          _id: b._id + '_' + modId,
          pnr: b.pnr + ' (Mod: ' + modSplit.name + ')',
          paxName: b.paxName,
          ourCost: 0,
          salePrice: 0,
          margin: modSplit.amount,
          supplierCharges: 0,
          ourMargin: modSplit.amount,
          status: b.status,
          currentMargin: modSplit.amount,
          newMargin: 0,
          submittedByName: modSplit.name,
          crdr: { type: 'NIL', value: 0, label: 'NIL' },
          isModifierRow: true,
          modifierId: modId
        });
      }

      const creatorMargin = (bookingInRange ? baseMargin - split.netAll : 0) + split.creatorInRange;
      // Cancelled bookings keep the cancellation engine's currentMargin (which already excludes
      // add-ons) minus the modifier shares, as before; active bookings track creatorMargin.
      const creatorCurrentMargin = b.status === 'Cancelled'
        ? (bookingInRange ? currentMarginBase : 0) - modifierTotal
        : creatorMargin;

      result.push({
        _id: b._id,
        pnr: b.pnr,
        paxName: b.paxName,
        ourCost: baseOurCost,
        salePrice: baseSalePrice,
        margin: creatorMargin,
        supplierCharges: baseSupplierCharges,
        ourMargin: creatorMargin,
        status: b.status,
        currentMargin: creatorCurrentMargin,
        newMargin: b.cancellation?.newMargin || 0,
        submittedByName: b.submittedByName || (b.submittedBy ? b.submittedBy.name : 'Unknown'),
        crdr: getCRDR(b),
        creatorId: b.submittedBy ? b.submittedBy._id?.toString() : null,
        assignedToId: b.assignedTo ? b.assignedTo?.toString() : null
      });
    });

    let filteredResult = result;
    if (filterId) {
      filteredResult = result.filter(r => 
        (r.isModifierRow && r.modifierId === filterId) || 
        (!r.isModifierRow && (r.creatorId === filterId || r.assignedToId === filterId))
      );
    }
    
    // totalMargin is the sum over ALL matching rows, not just the returned page
    const totalMargin = filteredResult.reduce((sum, r) => sum + r.margin, 0);
    const { rows, meta } = paginateRows(filteredResult, req);

    res.json({ bookings: rows, totalMargin, ...meta });
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
    // Include all statuses including Cancelled.
    //
    // FILTERED on the effective date, SORTED still on dateOfSubmission, deliberately.
    //
    // The filter has to be the effective date: this is the financial summary and it must agree
    // with Reports C and E about which month a booking falls in. The sort cannot follow it,
    // because `issueDate ?? dateOfSubmission` is a computed value and Mongo cannot sort on one
    // without an aggregation. Sorting on { issueDate: -1 } instead is worse than leaving it: null
    // is the lowest BSON value, so every legacy booking -- which is all of them until agents
    // start filling the field -- would collect at the end of the last page.
    //
    // The consequence is bounded and visible: the row SET is correct, and the order within it is
    // by entry date rather than strictly by issue date, which can only differ for rows where the
    // two dates straddle a sort position. Rewriting this route as an aggregation with $ifNull
    // would fix the order, and is not worth doing in the same release that introduces the field.
    // buildRange always returns a range here: both dates are required and 400 above.
    const range = buildRange(dateFrom, dateTo);
    //
    // UNPAGINATED on purpose, then sliced below.
    //
    // The summary tiles are RANGE totals and have to be reduced over every matching booking. The
    // query used to carry .skip().limit() and the summary was reduced over whatever came back,
    // so with the UI sending neither page nor limit -- getFinancialSummary in
    // report.service.ts sets only dateFrom and dateTo -- getPaginationParams defaulted to
    // page 1, limit 50 and the tiles described the first 50 bookings of the month. On the staging
    // copy, September 2026: 386 bookings in range, 50 counted. Total Sale read 96,910.61 against
    // a real 838,667.72 -- understated by 88.4%. Total Margin read 10,796.36 against 73,043.86.
    //
    // Reductions over a month are cheap (a few hundred documents; Reports C and E are
    // deliberately unpaginated over the same data for the same reason), so one query serves both
    // and the totals cannot drift from the rows the way two queries could.
    //
    // The sort carries an _id tie-break so the page boundary is stable: without it, two bookings
    // sharing a dateOfSubmission millisecond have no defined order between them and a row can
    // repeat on one page and vanish from the next. Zero such pairs exist on the copy today, which
    // is exactly why this would have gone unnoticed.
    const matching = await Booking.find({ $or: effectiveRangeConditions(range) })
      .sort({ dateOfSubmission: -1, _id: -1 });

    // Rows are paged as before; the summary below is NOT.
    const bookings = matching.slice(skip, skip + limit);

    const rows = bookings.map(b => ({
      _id: b._id,
      pnr: b.pnr,
      paxName: b.paxName,
      ourCost: b.ourCost || 0,
      salePrice: b.salePrice || 0,
      margin: (b.salePrice || 0) - (b.ourCost || 0) - (b.supplierCharges || 0),
      totalPaidAmount: b.totalPaidAmount || 0,
      balanceAmount: b.balanceAmount || 0,
      crdr: getCRDR(b)
    }));

    // Every figure below reduces over `matching`, the whole range -- never over `bookings`,
    // which is one page of it.
    const totalSupplierCharges = matching.reduce((sum, b) => sum + (b.supplierCharges || 0), 0);
    const totalAirlineCharges = matching
      .filter(b => b.status === 'Cancelled')
      .reduce((sum, b) => sum + (b.cancellation?.airlineCancellationCharges || 0), 0);
    const totalCurrentMargin = matching.reduce((sum, b) => {
      if (b.status === 'Cancelled') return sum + (b.cancellation?.currentMargin || 0);
      return sum + ((b.salePrice || 0) - (b.ourCost || 0) - (b.supplierCharges || 0));
    }, 0);

    const summary = {
      totalBookings: matching.length,
      totalSale: matching.reduce((s, b) => s + (b.salePrice || 0), 0),
      totalPaid: matching.reduce((s, b) => s + (b.totalPaidAmount || 0), 0),
      totalMargin: matching.reduce((s, b) => s + ((b.salePrice || 0) - (b.ourCost || 0) - (b.supplierCharges || 0)), 0),
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
    const { dateFrom, dateTo, agent, verificationType = 'original', receivingAccount } = req.query;

    const matchQuery = {};

    // BANK FILTER, option (i): it filters the BOOKING LIST and leaves the summary alone.
    //
    // This screen is booking-level -- its rows are bookings and its summary is sale price, our
    // cost and margin, not payment amounts. So "RBC 6336" here can only mean "bookings with at
    // least one E-Transfer received into RBC 6336", and a payment-amount total would be a second,
    // different kind of total on a screen that has one. The Payments screen owns payment-amount
    // totals; this one answers "which bookings involved that account".
    const bankFilter = (receivingAccount || '').trim();
    if (bankFilter && bankFilter !== 'All' && bankFilter !== 'Not recorded'
        && !RECEIVING_ACCOUNTS.includes(bankFilter)) {
      return res.status(400).json({ message: `Unknown receivingAccount "${bankFilter}"` });
    }

    // 'unverified' is the other side of the same population, so this one screen owns the whole
    // verification workflow: it lists what still needs verifying and the verify action acts here.
    if (verificationType === 'unverified') {
      matchQuery.status = { $ne: 'Cancelled' };
      matchQuery.adminVerified = { $ne: true };
      matchQuery.accountVerified = { $ne: true };
    } else if (verificationType === 'unverified-cancellation') {
      matchQuery.status = 'Cancelled';
      matchQuery.cancellationVerified = { $ne: true };
    } else if (verificationType === 'cancellation') {
      matchQuery.status = 'Cancelled';
      matchQuery.cancellationVerified = true;
    } else if (verificationType === 'original') {
      matchQuery.status = { $ne: 'Cancelled' };
      matchQuery.$or = [
        { adminVerified: true },
        { accountVerified: true }
      ];
    } else {
      matchQuery.$or = [
        { status: 'Cancelled', cancellationVerified: true },
        { status: { $ne: 'Cancelled' }, adminVerified: true },
        { status: { $ne: 'Cancelled' }, accountVerified: true }
      ];
    }

    const verifiedRange = buildRange(dateFrom, dateTo);
    if (verifiedRange) matchQuery.dateOfSubmission = verifiedRange;

    if (agent && agent !== 'all') {
      try {
        matchQuery.submittedBy = new mongoose.Types.ObjectId(agent);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid agent ID' });
      }
    }

    const bookings = await Booking.find(matchQuery)
      .populate('submittedBy', 'name email')
      .populate('verifiedByAdminUser', 'name')
      .populate('cancellationVerifiedBy', 'name')
      .sort({ dateOfSubmission: -1 })
      .lean();

    // Filtered BEFORE the summary, so the figures describe the rows on screen. A booking matches
    // when any of its payment rows does; 'Not recorded' means it has a BANK-DEPOSIT row
    // (E-Transfer, or legacy Cheque or Bank Transfer) with no account named. A booking paid only
    // in cash names no account either, but it is not missing one, so it is not listed here.
    const shown = (bankFilter && bankFilter !== 'All')
      ? bookings.filter(b => (b.payments || []).some(p => (bankFilter === 'Not recorded'
          ? isUnrecordedAccount(p)
          : (p.receivingAccount || '').trim() === bankFilter)))
      : bookings;

    const summary = {
      totalBookings: shown.length,
      totalSalePrice: shown.reduce((sum, b) => sum + (b.totalSalePrice ?? 0), 0),
      totalOurCost: shown.reduce((sum, b) => sum + (b.ourCost ?? 0), 0),
      totalMargin: shown.reduce((sum, b) => sum + ((b.totalSalePrice ?? 0) - (b.ourCost ?? 0) - (b.supplierCharges ?? 0)), 0)
    };

    const bookingsWithCRDR = shown.map(b => ({ ...b, crdr: getCRDR(b) }));
    res.json({ bookings: bookingsWithCRDR, summary });
  } catch (error) {
    console.error('Verified payments report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
