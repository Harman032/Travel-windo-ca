import re

with open('tests/cancellation.test.js', 'r', encoding='utf-8') as f:
    code = f.read()

scenarios_to_add = '''
  // Scenario 3B
  {
    name: 'SCENARIO 3B — Client Card Fully Paid — Refund Amount',
    booking: {
      ...baseBooking,
      totalPaidAmount: 1200,
      paymentFromCard: 1200,
      cardType: 'Client Card'
    },
    inputs: {
      airlineRefundAmount: 900,
      ourCancellationCharges: 50,
      cancellationMode: 'refundAmount'
    },
    cancellationType: 'clientCard',
    expected: {
      airlineDeducted: 300,    // 1200 - 900
      totalSupplierTook: 40,
      totalCharges: 340,       // 40 + 300
      supplierWillReturn: 900, // 1200 - 300
      upfrontNeeded: 280,      // 240 + 40
      refundCommittedToClientFinal: 620  // 1200 - (240+340)
    }
  },
  // Scenario 4B
  {
    name: 'SCENARIO 4B — Company Card — Refund Amount',
    booking: {
      ...baseBooking,
      totalPaidAmount: 1200,
      paymentFromCard: 1000,
      cardType: 'Company Card'
    },
    inputs: {
      airlineRefundAmount: 900,
      ourCancellationCharges: 50,
      cancellationMode: 'refundAmount'
    },
    cancellationType: 'companyCard',
    expected: {
      airlineDeducted: 100,    // 1000 - 900
      totalSupplierTook: 40,
      totalCharges: 140,       // 40 + 100
      supplierWillReturn: 870, // 1000 - 100 - 30
      refundCommittedToClientFinal: 820  // 1200 - (240+140)
    }
  },
  // Scenario 5B
  {
    name: 'SCENARIO 5B — Partial Paid Client Card — Refund Amount',
    booking: {
      ...baseBooking,
      totalPaidAmount: 600,
      paymentFromCard: 600,
      cardType: 'Client Card',
      billingStatus: 'Partial Paid'
    },
    inputs: {
      airlineRefundAmount: 500,
      ourCancellationCharges: 50,
      cancellationMode: 'refundAmount'
    },
    cancellationType: 'partialPaidClientCard',
    expected: {
      airlineDeducted: 100,    // 600 - 500
      totalSupplierTook: 40,
      totalCharges: 140,       // 40 + 100
      supplierWillReturn: 460, // 600 - 140
      upfrontNeeded: 280,      // 240 + 40
      refundCommittedToClientFinal: 220  // 600 - (240+140)
    }
  },
'''

# Find the end of scenarios list.
if '  // Scenario 5A' in code:
    # Just append before the closing `];` of `const testScenarios = [`
    target = '];\n\nconsole.log(\'----------------------------------------'
    code = code.replace(target, scenarios_to_add + target)

# Also, wait! In `calculateCancellation` helper in `cancellation.test.js`, we must parse `airlineRefundAmount`!
# Let's add that to `calculateCancellation` inside `cancellation.test.js`.
calc_start = '''  const {
    supplierCancellationCharges: scc,
    ourCancellationCharges: occ,
    chargeFromClient = 0
  } = inputs;'''

calc_new = '''  const {
    supplierCancellationCharges: scc,
    airlineRefundAmount: ara,
    cancellationMode = 'charges',
    ourCancellationCharges: occ,
    chargeFromClient = 0
  } = inputs;
  
  const isRefundAmount = cancellationMode === 'refundAmount';'''

code = code.replace(calc_start, calc_new)

# Modify case 'clientCard' logic to handle Refund Amount!
client_card = '''    case 'clientCard':
      result.newMargin = ourMargin;
      result.totalSupplierTook = totalSupplierTook;
      result.supplierWillReturn = round(salePrice - scc);
      result.upfrontNeeded = round(ourMargin + totalSupplierTook);
      const clientCardTotalCharges = round(totalSupplierTook + scc);
      result.totalCharges = clientCardTotalCharges;
      result.clientReceives = round(salePrice - (ourMargin + clientCardTotalCharges));
      result.refundCommittedToClientFinal = result.clientReceives;
      break;'''
client_card_new = '''    case 'clientCard':
      result.newMargin = ourMargin;
      result.totalSupplierTook = totalSupplierTook;
      if (isRefundAmount) {
         result.airlineDeducted = round(salePrice - ara);
         result.supplierWillReturn = round(salePrice - result.airlineDeducted);
         result.totalCharges = round(totalSupplierTook + result.airlineDeducted);
      } else {
         result.supplierWillReturn = round(salePrice - scc);
         result.totalCharges = round(totalSupplierTook + scc);
      }
      result.upfrontNeeded = round(ourMargin + totalSupplierTook);
      result.clientReceives = round(salePrice - (ourMargin + result.totalCharges));
      result.refundCommittedToClientFinal = result.clientReceives;
      break;'''
code = code.replace(client_card, client_card_new)

company_card = '''    case 'companyCard':
      const isCardEqualToSalePrice = paymentFromCard === salePrice;
      result.supplierWillReturn = isCardEqualToSalePrice
        ? round(salePrice - totalSupplierTook)
        : round(ourCost - totalSupplierTook);
      result.clientReceives = round(salePrice - totalCharges);
      result.refundCommittedToClientFinal = round(totalPaidAmount - totalCharges);
      break;'''
company_card_new = '''    case 'companyCard':
      const isCardEqualToSalePrice = paymentFromCard === salePrice;
      if (isRefundAmount) {
         result.airlineDeducted = round(ourCost - ara);
         result.totalCharges = round(totalSupplierTook + result.airlineDeducted);
      } else {
         result.totalCharges = round(totalSupplierTook + scc);
      }
      result.supplierWillReturn = isCardEqualToSalePrice
        ? round(salePrice - totalSupplierTook)
        : (isRefundAmount ? round(ourCost - result.airlineDeducted - autoSupplierCancellationCharge) : round(ourCost - scc - autoSupplierCancellationCharge));
      result.clientReceives = round(salePrice - result.totalCharges);
      result.refundCommittedToClientFinal = round(totalPaidAmount - result.totalCharges);
      break;'''
code = code.replace(company_card, company_card_new)

partial_client_card = '''    case 'partialPaidClientCard':
      result.totalSupplierTook = totalSupplierTook;
      result.supplierWillReturn = round(paymentFromCard - totalSupplierTook);
      result.upfrontNeeded = newMargin;
      result.clientReceives = result.supplierWillReturn;
      result.remainingAmount = round(salePrice - paymentFromCard);
      result.refundCommittedToClientFinal = round(totalPaidAmount - totalCharges);
      break;'''
partial_client_card_new = '''    case 'partialPaidClientCard':
      result.totalSupplierTook = totalSupplierTook;
      if (isRefundAmount) {
         result.airlineDeducted = round(totalPaidAmount - ara);
         result.totalCharges = round(totalSupplierTook + result.airlineDeducted);
         result.supplierWillReturn = round(totalPaidAmount - result.totalCharges);
      } else {
         result.totalCharges = round(totalSupplierTook + scc);
         result.supplierWillReturn = round(totalPaidAmount - result.totalCharges);
      }
      result.upfrontNeeded = round(ourMargin + totalSupplierTook);
      result.clientReceives = round(totalPaidAmount - (ourMargin + result.totalCharges));
      result.remainingAmount = round(salePrice - paymentFromCard);
      result.refundCommittedToClientFinal = round(totalPaidAmount - result.totalCharges);
      break;'''
code = code.replace(partial_client_card, partial_client_card_new)

with open('tests/cancellation.test.js', 'w', encoding='utf-8') as f:
    f.write(code)
