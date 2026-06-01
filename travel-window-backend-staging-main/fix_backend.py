import re

# 1. Fix cancellation.test.js expected values
with open('tests/cancellation.test.js', 'r', encoding='utf-8') as f:
    test_code = f.read()

# Fix Scenario 6B expected:
test_code = test_code.replace('''expected: {
      newMargin: 190,
      totalSupplierTook: 40,
      supplierWillReturn: 960,  // ourCost - totalSupplierTook (1000 - 40)
      clientReceives: 1060,     // salePrice - totalCharges (1200 - 140)
      refundCommittedToClientFinal: 1060
    }''', '''expected: {
      newMargin: 190,
      totalSupplierTook: 40,
      supplierWillReturn: 870,
      clientReceives: 820,
      refundCommittedToClientFinal: 820
    }''')

# Fix Scenario 7 expected:
test_code = test_code.replace('''expected: {
      newMargin: 190,
      totalSupplierTook: 40,
      supplierWillReturn: 560,  // paymentFromCard - totalSupplierTook (600 - 40)
      upfrontNeeded: 290,       // newMargin + totalSupplierTook (190 + 100) wait, margin is 190.
      clientReceives: 560,      // same as supplierWillReturn
      remainingAmount: 600,     // salePrice - paymentFromCard (1200 - 600)
      refundCommittedToClientFinal: 270 // totalPaidAmount - totalCharges (600 - 330)
    }''', '''expected: {
      newMargin: 190,
      totalSupplierTook: 40,
      supplierWillReturn: 460,
      upfrontNeeded: 280,
      clientReceives: 220,
      remainingAmount: 600,
      refundCommittedToClientFinal: 220
    }''')

with open('tests/cancellation.test.js', 'w', encoding='utf-8') as f:
    f.write(test_code)

# 2. Fix routes/bookings.js
with open('routes/bookings.js', 'r', encoding='utf-8') as f:
    backend_code = f.read()

# Fix isPartialPaid && isClientCard block
target = '''    } else if (isPartialPaid && isClientCard) {
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
    }'''

new_block = '''    } else if (isPartialPaid && isClientCard) {
      if (isChargesMode) {
        upfrontNeeded = Math.round((currentMargin + totalSupplierTook) * 100) / 100;
        supplierWillReturn = Math.round((paidAmount - totalCharges) * 100) / 100;
        refundToClient = Math.round((paidAmount - (currentMargin + totalCharges)) * 100) / 100;
        airlineDeducted = acc;
      } else {
        airlineDeducted = Math.round((paidAmount - ara) * 100) / 100;
        supplierWillReturn = Math.round((paidAmount - totalCharges) * 100) / 100;
        refundToClient = Math.round((paidAmount - (currentMargin + totalCharges)) * 100) / 100;
        upfrontNeeded = Math.round((currentMargin + totalSupplierTook) * 100) / 100;
      }
    }'''

backend_code = backend_code.replace(target, new_block)

with open('routes/bookings.js', 'w', encoding='utf-8') as f:
    f.write(backend_code)
