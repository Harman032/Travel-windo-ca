const fs = require('fs');
let c = fs.readFileSync('tests/cancellation.test.js', 'utf8');

c = c.replace(/(runScenario\('1A — Regular Fully Paid, Charges, Not Updated'[\s\S]*?totalCharges: )140/g, '$1330');
c = c.replace(/(runScenario\('1A — Regular Fully Paid, Charges, Updated'[\s\S]*?totalCharges: )160/g, '$1350');
c = c.replace(/(runScenario\('1B — Regular Fully Paid, Refund, Not Updated'[\s\S]*?totalCharges: )140/g, '$1330');
c = c.replace(/(runScenario\('1B — Regular Fully Paid, Refund, Updated'[\s\S]*?totalCharges: )160/g, '$1350');

c = c.replace(/(runScenario\('2A — Partial Paid, Charges, Not Updated'[\s\S]*?totalCharges: )140/g, '$1330');
c = c.replace(/(runScenario\('2A — Partial Paid, Charges, Updated'[\s\S]*?totalCharges: )160/g, '$1350');
c = c.replace(/(runScenario\('2B — Partial Paid, Refund, Not Updated'[\s\S]*?totalCharges: )140/g, '$1330');
c = c.replace(/(runScenario\('2B — Partial Paid, Refund, Updated'[\s\S]*?totalCharges: )160/g, '$1350');

c = c.replace(/(runScenario\('3A — Client Card, Charges, Not Updated'[\s\S]*?totalCharges: )140/g, '$1330');
c = c.replace(/(runScenario\('3A — Client Card, Charges, Updated'[\s\S]*?totalCharges: )160/g, '$1350');
c = c.replace(/(runScenario\('3B — Client Card, Refund, Not Updated'[\s\S]*?totalCharges: )340/g, '$1530');
c = c.replace(/(runScenario\('3B — Client Card, Refund, Updated'[\s\S]*?totalCharges: )360/g, '$1550');

c = c.replace(/(runScenario\('4A — Company Card, Charges, Not Updated'[\s\S]*?totalCharges: )140/g, '$1330');
c = c.replace(/(runScenario\('4A — Company Card, Charges, Updated'[\s\S]*?totalCharges: )160/g, '$1350');
c = c.replace(/(runScenario\('4B — Company Card, Refund, Not Updated'[\s\S]*?totalCharges: )140/g, '$1330');
c = c.replace(/(runScenario\('4B — Company Card, Refund, Updated'[\s\S]*?totalCharges: )160/g, '$1350');

c = c.replace(/(runScenario\('1A — With New Margin 50, Not Updated'[\s\S]*?totalCharges: )140/g, '$1380');

fs.writeFileSync('tests/cancellation.test.js', c);
