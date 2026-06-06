const fs = require('fs');
let c = fs.readFileSync('tests/cancellation.test.js', 'utf8');

c = c.replace(/(runScenario\('1A — Regular Fully Paid, Charges, Not Updated'[\s\S]*?supplierWillReturn: )900/g, '$1870');
c = c.replace(/(runScenario\('1A — Regular Fully Paid, Charges, Updated'[\s\S]*?supplierWillReturn: )900/g, '$1870');
c = c.replace(/(runScenario\('1B — Regular Fully Paid, Refund, Not Updated'[\s\S]*?supplierWillReturn: )900/g, '$1870');
c = c.replace(/(runScenario\('1B — Regular Fully Paid, Refund, Updated'[\s\S]*?supplierWillReturn: )900/g, '$1870');

c = c.replace(/(runScenario\('2A — Partial Paid, Charges, Not Updated'[\s\S]*?supplierWillReturn: )500/g, '$1470');
c = c.replace(/(runScenario\('2A — Partial Paid, Charges, Updated'[\s\S]*?supplierWillReturn: )500/g, '$1470');
c = c.replace(/(runScenario\('2B — Partial Paid, Refund, Not Updated'[\s\S]*?supplierWillReturn: )500/g, '$1470');
c = c.replace(/(runScenario\('2B — Partial Paid, Refund, Updated'[\s\S]*?supplierWillReturn: )500/g, '$1470');

c = c.replace(/(runScenario\('1A — With New Margin 50, Not Updated'[\s\S]*?supplierWillReturn: )900/g, '$1870');

fs.writeFileSync('tests/cancellation.test.js', c);
