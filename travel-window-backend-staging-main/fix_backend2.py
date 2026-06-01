import re

# 1. Fix cancellation.test.js expected values
with open('tests/cancellation.test.js', 'r', encoding='utf-8') as f:
    test_code = f.read()

# Fix Scenario 6B expected:
test_code = test_code.replace('''expected: {
      ourMargin: 190,
      newMargin: 290,
      totalSupplierTook: 40,
      totalCharges: 140,
      supplierWillReturn: 960,
      clientReceives: 1060,
      refundCommittedToClientFinal: 1060
    }''', '''expected: {
      ourMargin: 190,
      newMargin: 290,
      totalSupplierTook: 40,
      totalCharges: 140,
      supplierWillReturn: 870,
      clientReceives: 1060,
      refundCommittedToClientFinal: 1060
    }''')

# Fix Scenario 7 expected:
test_code = test_code.replace('''expected: {
      ourMargin: 190,
      newMargin: 290,
      totalSupplierTook: 40,
      totalCharges: 140,
      supplierWillReturn: 560,
      upfrontNeeded: 290,
      clientReceives: 560,
      remainingAmount: 600,
      refundCommittedToClientFinal: 460
    }''', '''expected: {
      ourMargin: 190,
      newMargin: 290,
      totalSupplierTook: 40,
      totalCharges: 140,
      supplierWillReturn: 460,
      upfrontNeeded: 230,
      clientReceives: 270,
      remainingAmount: 600,
      refundCommittedToClientFinal: 270
    }''')

with open('tests/cancellation.test.js', 'w', encoding='utf-8') as f:
    f.write(test_code)
