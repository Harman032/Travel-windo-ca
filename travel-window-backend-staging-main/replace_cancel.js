const fs = require('fs');
const file = 'routes/bookings.js';
let content = fs.readFileSync(file, 'utf8');

const startMatch = content.match(/\/\/ Cancel booking[\s\S]*?router\.post\('\/:id\/cancel'/);
if(!startMatch) { console.error('Start index not found'); process.exit(1); }
const startIndex = startMatch.index;

const saveStr = '    await booking.save();';
const endIndex = content.indexOf(saveStr, startIndex) + saveStr.length;
if(endIndex < startIndex) { console.error('End index not found'); process.exit(1); }

const newLogic = `// Cancel booking (Agent1, Agent2, Account, Admin per spec)
router.post('/:id/cancel', auth, authorize('AGENT1', 'AGENT2', 'ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    const {
      paymentModeWas,
      cancellationMode,
      cancellationType,
      airlineCancellationCharges,
      airlineRefundAmount,
      newMargin,
      remarks,
      chargeFromClient
    } = req.body;
    
    if (!paymentModeWas || !remarks) {
      return res.status(400).json({ message: 'Payment mode and remarks are required' });
    }

    const dateChangeSaleAddon = (booking.dateChanges || []).reduce((sum, d) => sum + (Number(d?.salePriceAddon) || 0), 0);
    const flightChangeSaleAddon = (booking.flightChanges || []).reduce((sum, d) => sum + (Number(d?.salePriceAddon) || 0), 0);
    const dateChangeOurAddon = (booking.dateChanges || []).reduce((sum, d) => sum + (Number(d?.ourCostAddon) || 0), 0);
    const flightChangeOurAddon = (booking.flightChanges || []).reduce((sum, d) => sum + (Number(d?.ourCostAddon) || 0), 0);

    const baseSalePrice = Math.max(0, (Number(booking.salePrice) || 0) - dateChangeSaleAddon - flightChangeSaleAddon);
    const baseOurCost = Math.max(0, (Number(booking.ourCost) || 0) - dateChangeOurAddon - flightChangeOurAddon);
    
    const Supplier = require('../models/Supplier');
    let sccAuto = 0;
    if (booking.supplier) {
      const supplierDoc = await Supplier.findById(booking.supplier);
      if (supplierDoc) {
        sccAuto = supplierDoc.cancellationCharge || 0;
      }
    }
    
    booking.supplierCancellationCharge = sccAuto;
    // ensure we accumulate the charge correctly if not already added. We will just set it as part of totals.
    const supplierCharges = (Number(booking.supplierCharges) || 0) + sccAuto;
    booking.supplierCharges = supplierCharges;
    
    const ourMargin = Math.round((baseSalePrice - (baseOurCost + (booking.supplierBookingCharge || 0))) * 100) / 100;
    
    const acc = Number(airlineCancellationCharges) || 0;
    const ara = Number(airlineRefundAmount) || 0;
    const nm = Number(newMargin) || 0;
    
    const currentMargin = Math.round((ourMargin + nm) * 100) / 100;
    const totalCharges = Math.round((acc + supplierCharges) * 100) / 100;
    
    const paidAmount = Number(booking.totalPaidAmount) || 0;
    const isChargesMode = cancellationMode === 'charges';
    
    let refundToClient = 0;
    let supplierWillReturn = 0;
    let airlineDeducted = 0;
    let upfrontNeeded = 0;
    
    const isMachineCharge = paymentModeWas === 'Machine Charge';
    const isPartialPaid = booking.paymentType === 'Partial';
    const isClientCard = booking.cardType === 'Client Card';
    const isCompanyCard = booking.cardType === 'Company Card';
    
    if (isMachineCharge || (!isPartialPaid && !isClientCard && !isCompanyCard)) {
      if (isChargesMode) {
        supplierWillReturn = Math.round((baseOurCost - (acc + booking.supplierCancellationCharge)) * 100) / 100;
        refundToClient = Math.round((baseSalePrice - (currentMargin + totalCharges)) * 100) / 100;
        airlineDeducted = acc;
      } else {
        airlineDeducted = Math.round((baseOurCost - ara) * 100) / 100;
        supplierWillReturn = Math.round((ara - booking.supplierCancellationCharge) * 100) / 100;
        refundToClient = Math.round((baseSalePrice - (currentMargin + airlineDeducted + supplierCharges)) * 100) / 100;
      }
    } else if (isPartialPaid && !isClientCard && !isCompanyCard) {
      if (isChargesMode) {
        refundToClient = Math.round((paidAmount - (totalCharges + currentMargin)) * 100) / 100;
        supplierWillReturn = Math.round((baseOurCost - (acc + booking.supplierCancellationCharge)) * 100) / 100;
        airlineDeducted = acc;
      } else {
        airlineDeducted = Math.round((paidAmount - ara) * 100) / 100;
        supplierWillReturn = Math.round((ara - booking.supplierCancellationCharge) * 100) / 100;
        refundToClient = Math.round((paidAmount - (currentMargin + airlineDeducted + supplierCharges)) * 100) / 100;
      }
    } else if (!isPartialPaid && isClientCard) {
      if (isChargesMode) {
        refundToClient = Math.round((baseSalePrice - (currentMargin + totalCharges)) * 100) / 100;
        supplierWillReturn = Math.round((baseSalePrice - (acc + booking.supplierCancellationCharge)) * 100) / 100;
        airlineDeducted = acc;
      } else {
        airlineDeducted = Math.round((baseSalePrice - ara) * 100) / 100;
        supplierWillReturn = Math.round((baseSalePrice - airlineDeducted) * 100) / 100; 
        refundToClient = Math.round((baseSalePrice - (currentMargin + airlineDeducted + supplierCharges)) * 100) / 100;
      }
    } else if (!isPartialPaid && isCompanyCard) {
      if (isChargesMode) {
        supplierWillReturn = Math.round((baseOurCost - (acc + booking.supplierCancellationCharge)) * 100) / 100;
        refundToClient = Math.round((baseSalePrice - (currentMargin + totalCharges)) * 100) / 100;
        airlineDeducted = acc;
      } else {
        airlineDeducted = Math.round((baseOurCost - ara) * 100) / 100;
        supplierWillReturn = Math.round((ara - booking.supplierCancellationCharge) * 100) / 100;
        refundToClient = Math.round((baseSalePrice - (currentMargin + airlineDeducted + supplierCharges)) * 100) / 100;
      }
    } else if (isPartialPaid && isClientCard) {
      if (isChargesMode) {
        upfrontNeeded = currentMargin;
        supplierWillReturn = Math.round((paidAmount - (acc + booking.supplierCancellationCharge)) * 100) / 100;
        refundToClient = supplierWillReturn;
        airlineDeducted = acc;
      } else {
        airlineDeducted = Math.round((paidAmount - ara) * 100) / 100;
        supplierWillReturn = Math.round((ara - booking.supplierCancellationCharge) * 100) / 100;
        refundToClient = supplierWillReturn;
        upfrontNeeded = currentMargin;
      }
    } else {
      // Default to Scenario 1 if unmatched
      if (isChargesMode) {
        supplierWillReturn = Math.round((baseOurCost - (acc + booking.supplierCancellationCharge)) * 100) / 100;
        refundToClient = Math.round((baseSalePrice - (currentMargin + totalCharges)) * 100) / 100;
        airlineDeducted = acc;
      } else {
        airlineDeducted = Math.round((baseOurCost - ara) * 100) / 100;
        supplierWillReturn = Math.round((ara - booking.supplierCancellationCharge) * 100) / 100;
        refundToClient = Math.round((baseSalePrice - (currentMargin + airlineDeducted + supplierCharges)) * 100) / 100;
      }
    }

    let cfc = 0;
    let oldMarginRow2 = 0;
    let refundCommittedToClientVal = refundToClient;
    if (isMachineCharge) {
       cfc = Number(chargeFromClient) || 0;
       
       oldMarginRow2 = Math.round(Math.min(cfc, ourMargin) * 100) / 100;
       const userNewMargin = Math.round(Math.max(0, cfc - ourMargin) * 100) / 100;
       
       refundCommittedToClientVal = Math.round((refundToClient - cfc) * 100) / 100;
    }

    booking.cancellation = {
      isCancelled: true,
      paymentModeWas,
      cancellationMode: isChargesMode ? 'charges' : 'refundAmount',
      cancellationType: cancellationType || '',
      airlineCancellationCharges: isChargesMode ? acc : 0,
      airlineRefundAmount: isChargesMode ? 0 : ara,
      oldMargin: ourMargin,
      newMargin: isMachineCharge ? Math.round(Math.max(0, cfc - ourMargin) * 100) / 100 : nm,
      oldMarginRow2: isMachineCharge ? oldMarginRow2 : 0,
      currentMargin: currentMargin,
      totalCharges: isChargesMode ? totalCharges : Math.round((airlineDeducted + supplierCharges)*100)/100,
      supplierWillReturn,
      refundCommittedToClient: refundCommittedToClientVal,
      refundableAmount: refundToClient,
      upfrontNeeded,
      chargeFromClient: cfc,
      refundProcessed: false,
      remarks,
      cancelledBy: req.user._id,
      cancelledAt: new Date(),
      refundReceivedFromSupplier: { date: null, remarks: '' },
      refundPaidToClient: { date: null, remarks: '' }
    };
    
    if (typeof addProgressHistory === 'function') {
      addProgressHistory(booking, 'Cancellation', req.user, booking.cancellation, remarks);
    }
    
    await booking.save();`;

content = content.slice(0, startIndex) + newLogic + content.slice(endIndex);
fs.writeFileSync(file, content);
console.log('Script ran successfully');
