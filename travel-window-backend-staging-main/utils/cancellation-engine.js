/**
 * Single-source cancellation calculation engine.
 * ALL cancellation math flows through this one function.
 *
 * Scenarios:
 *   1A/1B  Regular Fully Paid  (charges / refund)
 *   2A/2B  Partial Paid        (charges / refund)
 *   3A/3B  Client Card Fully Paid (charges / refund)
 *   4A/4B  Company Card        (charges / refund)
 *   5A/5B  Partial Paid Client Card (charges / refund)
 *   Machine Charge → treated as Scenario 1
 *
 * Business Rules:
 *   ourMargin          = baseSalePrice - (baseOurCost + supplierBookingCharge)
 *   currentMargin      = ourMargin + newMarginInput
 *   totalSupplierTook  = supplierBookingCharge + supplierUpdationCharge + autoSupplierCancellationCharge
 *   supplierWillReturn = baseAmount - airlineCharge - totalSupplierTook
 */

'use strict';

const round = (v) => Math.round(v * 100) / 100;

/**
 * @param {Object} p
 * @param {number} p.baseSalePrice
 * @param {number} p.baseOurCost
 * @param {number} p.paidAmount
 * @param {number} p.supplierBookingCharge
 * @param {number} p.supplierUpdationCharge
 * @param {number} p.autoSupplierCancellationCharge
 * @param {boolean} p.isChargesMode
 * @param {number} p.airlineCancellationCharges
 * @param {number} p.airlineRefundAmount
 * @param {number} p.newMarginInput
 * @param {boolean} p.isPartialPaid
 * @param {boolean} p.isClientCard
 * @param {boolean} p.isCompanyCard
 * @param {boolean} p.isMachineCharge
 * @returns {{ scenario, ourMargin, currentMargin, totalSupplierTook, airlineDeducted, totalCharges, supplierWillReturn, refundCommittedToClient, refundableAmount, upfrontNeeded }}
 */
function calculateCancellationScenario(p) {
  const baseSalePrice              = Number(p.baseSalePrice)              || 0;
  const baseOurCost                = Number(p.baseOurCost)                || 0;
  const paidAmount                 = Number(p.paidAmount)                 || 0;
  const supplierBookingCharge      = Number(p.supplierBookingCharge)      || 0;
  const supplierUpdationCharge     = Number(p.supplierUpdationCharge)     || 0;
  const autoSupplierCancCharge     = Number(p.autoSupplierCancellationCharge) || 0;
  const isChargesMode              = !!p.isChargesMode;
  const acc                        = Number(p.airlineCancellationCharges) || 0;
  const ara                        = Number(p.airlineRefundAmount)        || 0;
  const newMarginInput             = Number(p.newMarginInput)             || 0;

  // ── Core derived values ──────────────────────────────────────────────
  const totalSupplierTook = round(supplierBookingCharge + supplierUpdationCharge + autoSupplierCancCharge);
  const ourMargin         = round(baseSalePrice - (baseOurCost + supplierBookingCharge));
  const currentMargin     = round(ourMargin + newMarginInput);

  // ── Outputs ──────────────────────────────────────────────────────────
  let scenario              = '';
  let airlineDeducted       = 0;
  let totalCharges          = 0;
  let supplierWillReturn    = 0;
  let refundCommittedToClient = 0;
  let refundableAmount      = 0;
  let upfrontNeeded         = 0;

  // ── Scenario detection ───────────────────────────────────────────────
  const isPP = !!p.isPartialPaid;
  const isCC = !!p.isClientCard;
  const isCO = !!p.isCompanyCard;
  const isMC = !!p.isMachineCharge;

  if (isMC || (!isPP && !isCC && !isCO)) {
    // ── Scenario 1: Regular Fully Paid (+ Machine Charge) ──────────
    if (isChargesMode) {
      scenario            = '1A';
      airlineDeducted     = acc;
      totalCharges        = round(acc + totalSupplierTook);
      supplierWillReturn  = round(baseOurCost - acc - totalSupplierTook);
      refundCommittedToClient = round(baseSalePrice - (currentMargin + totalCharges));
    } else {
      scenario            = '1B';
      airlineDeducted     = round(baseOurCost - ara);
      totalCharges        = round(airlineDeducted + totalSupplierTook);
      supplierWillReturn  = round(baseOurCost - airlineDeducted - totalSupplierTook);
      refundCommittedToClient = round(baseSalePrice - (currentMargin + totalCharges));
    }
    refundableAmount = refundCommittedToClient;

  } else if (isPP && !isCC && !isCO) {
    // ── Scenario 2: Partial Paid ───────────────────────────────────
    if (isChargesMode) {
      scenario            = '2A';
      airlineDeducted     = acc;
      totalCharges        = round(acc + totalSupplierTook);
      supplierWillReturn  = round(paidAmount - acc - totalSupplierTook);
      refundCommittedToClient = round(paidAmount - (totalCharges + currentMargin));
    } else {
      scenario            = '2B';
      airlineDeducted     = round(paidAmount - ara);
      totalCharges        = round(airlineDeducted + totalSupplierTook);
      supplierWillReturn  = round(paidAmount - airlineDeducted - totalSupplierTook);
      refundCommittedToClient = round(paidAmount - (totalCharges + currentMargin));
    }
    refundableAmount = refundCommittedToClient;

  } else if (!isPP && isCC) {
    // ── Scenario 3: Client Card Fully Paid ─────────────────────────
    if (isChargesMode) {
      scenario            = '3A';
      airlineDeducted     = acc;
      totalCharges        = round(totalSupplierTook + acc);
      supplierWillReturn  = round(baseSalePrice - acc);
      upfrontNeeded       = round(currentMargin + totalSupplierTook);
      refundCommittedToClient = round(baseSalePrice - (currentMargin + totalCharges));
    } else {
      scenario            = '3B';
      airlineDeducted     = round(baseSalePrice - ara);
      totalCharges        = round(totalSupplierTook + airlineDeducted);
      supplierWillReturn  = round(baseSalePrice - airlineDeducted);
      upfrontNeeded       = round(currentMargin + totalSupplierTook);
      refundCommittedToClient = round(baseSalePrice - (currentMargin + totalCharges));
    }
    refundableAmount = supplierWillReturn;

  } else if (!isPP && isCO) {
    // ── Scenario 4: Company Card ───────────────────────────────────
    if (isChargesMode) {
      scenario            = '4A';
      airlineDeducted     = acc;
      totalCharges        = round(totalSupplierTook + acc);
      supplierWillReturn  = round(baseOurCost - totalSupplierTook - acc);
      refundCommittedToClient = round(baseSalePrice - (currentMargin + totalCharges));
    } else {
      scenario            = '4B';
      airlineDeducted     = round(baseOurCost - ara);
      totalCharges        = round(totalSupplierTook + airlineDeducted);
      supplierWillReturn  = round(baseOurCost - totalSupplierTook - airlineDeducted);
      refundCommittedToClient = round(baseSalePrice - (currentMargin + totalCharges));
    }
    refundableAmount = refundCommittedToClient;

  } else if (isPP && isCC) {
    // ── Scenario 5: Partial Paid Client Card ───────────────────────
    if (isChargesMode) {
      scenario            = '5A';
      airlineDeducted     = acc;
      totalCharges        = round(totalSupplierTook + acc);
      supplierWillReturn  = round(paidAmount - totalCharges);
      upfrontNeeded       = currentMargin;
      refundCommittedToClient = supplierWillReturn;
    } else {
      scenario            = '5B';
      airlineDeducted     = round(paidAmount - ara);
      totalCharges        = round(totalSupplierTook + airlineDeducted);
      supplierWillReturn  = round(paidAmount - totalCharges);
      upfrontNeeded       = currentMargin;
      refundCommittedToClient = supplierWillReturn;
    }
    refundableAmount = refundCommittedToClient;

  } else {
    // ── Fallback → Scenario 1 ──────────────────────────────────────
    if (isChargesMode) {
      scenario            = '1A';
      airlineDeducted     = acc;
      totalCharges        = round(acc + totalSupplierTook);
      supplierWillReturn  = round(baseOurCost - acc - totalSupplierTook);
      refundCommittedToClient = round(baseSalePrice - (currentMargin + totalCharges));
    } else {
      scenario            = '1B';
      airlineDeducted     = round(baseOurCost - ara);
      totalCharges        = round(airlineDeducted + totalSupplierTook);
      supplierWillReturn  = round(baseOurCost - airlineDeducted - totalSupplierTook);
      refundCommittedToClient = round(baseSalePrice - (currentMargin + totalCharges));
    }
    refundableAmount = refundCommittedToClient;
  }

  return {
    scenario,
    ourMargin,
    currentMargin,
    totalSupplierTook,
    airlineDeducted,
    totalCharges,
    supplierWillReturn,
    refundCommittedToClient,
    refundableAmount,
    upfrontNeeded
  };
}

module.exports = { calculateCancellationScenario };
