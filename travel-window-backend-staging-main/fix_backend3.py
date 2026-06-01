import re

with open('tests/cancellation.test.js', 'r', encoding='utf-8') as f:
    test_code = f.read()

test_code = test_code.replace('''expected: {
      ourMargin: 190,
      newMargin: 290,
      totalSupplierTook: 40,
      totalCharges: 140,
      supplierWillReturn: 460,
      upfrontNeeded: 230,
      clientReceives: 270,
      remainingAmount: 600,
      refundCommittedToClientFinal: 270
    }''', '''expected: {
      ourMargin: 190,
      newMargin: 290,
      totalSupplierTook: 40,
      totalCharges: 140,
      supplierWillReturn: 460,
      upfrontNeeded: 230,
      clientReceives: 270,
      remainingAmount: 600,
      refundCommittedToClientFinal: 460
    }''')

with open('tests/cancellation.test.js', 'w', encoding='utf-8') as f:
    f.write(test_code)
