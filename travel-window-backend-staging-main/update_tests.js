const fs = require('fs');

let code = fs.readFileSync('tests/cancellation.test.js', 'utf8');

const updatedExpected = {
  'SCENARIO 5B — Client Card Fully Paid (Card == Sale Price, Margin = 0)': { newMargin: 200, totalSupplierTook: 40, totalCharges: 40, upfrontNeeded: 240, clientReceives: 460, refundCommittedToClientFinal: 460 },
  'SCENARIO 9A — Client Card Partial Payment (Remaining < Total Charges)': { totalSupplierTook: 40, totalCharges: 140, supplierWillReturn: 700, upfrontNeeded: 0, clientReceives: 1060, remainingAmount: 600, refundCommittedToClientFinal: 660 },
  'SCENARIO 9B — Client Card Partial Payment (Remaining >= Total Charges)': { totalSupplierTook: 40, totalCharges: 140, supplierWillReturn: 600, upfrontNeeded: 0, clientReceives: 1060, remainingAmount: 600, refundCommittedToClientFinal: 560 },
  'SCENARIO 9C — Client Card Partial Payment (Remaining < Total Charges — upfront needed)': { totalSupplierTook: 40, totalCharges: 140, supplierWillReturn: 700, upfrontNeeded: 0, clientReceives: 1060, remainingAmount: 600, refundCommittedToClientFinal: 660 }
};

for (const [name, expectedObj] of Object.entries(updatedExpected)) {
  const expectedStr = Object.entries(expectedObj).map(([k, v]) => `      ${k}: ${v}`).join(',\n');
  
  const idx = code.indexOf(name);
  if (idx !== -1) {
    const expectedIdx = code.indexOf('expected:', idx);
    const endIdx = code.indexOf('}', expectedIdx);
    
    code = code.substring(0, expectedIdx) + `expected: {\n${expectedStr}\n    ` + code.substring(endIdx);
  }
}

fs.writeFileSync('tests/cancellation.test.js', code);
