const fs = require('fs');
let content = fs.readFileSync('routes/reports.js', 'utf8');

const getCRDRStr = `
function getCRDR(booking) {
  const salePrice = booking.salePrice ?? 0;
  const ourCost = booking.ourCost ?? 0;
  const supplierCharges = booking.supplierCharges ?? 0;
  const paymentFromCard = booking.paymentFromCard ?? 0;
  const cardType = booking.cardType ?? null;

  if (cardType === 'Client Card' && paymentFromCard === salePrice) {
    return {
      type: 'CR',
      value: Math.round((salePrice - ourCost - supplierCharges) * 100) / 100,
      label: 'CR'
    };
  }

  if (!paymentFromCard || paymentFromCard === 0) {
    return {
      type: 'DR',
      value: Math.round((ourCost + supplierCharges) * 100) / 100,
      label: 'DR'
    };
  }

  return {
    type: 'DR',
    value: Math.round((ourCost + supplierCharges - paymentFromCard) * 100) / 100,
    label: 'DR'
  };
}
`;

content = content.replace('const router = express.Router();', getCRDRStr + '\nconst router = express.Router();');

const addCRDR = 'const bookingsWithCRDR = bookings.map(b => ({ ...(b.toObject ? b.toObject() : b), crdr: getCRDR(b) }));';

// Replace all exact instances of "res.json({ bookings, summary });"
content = content.replaceAll('res.json({ bookings, summary });', addCRDR + '\n    res.json({ bookings: bookingsWithCRDR, summary });');

content = content.replace('res.json({ bookings, count: bookings.length });', addCRDR + '\n    res.json({ bookings: bookingsWithCRDR, count: bookingsWithCRDR.length });');

content = content.replace('res.json({ \n      bookings, \n      totalOutstanding,\n      count: bookings.length \n    });', addCRDR + '\n    res.json({ \n      bookings: bookingsWithCRDR, \n      totalOutstanding,\n      count: bookingsWithCRDR.length \n    });');

content = content.replace(
  'unverifiedPayments.push({',
  'const crdr = getCRDR(b);\n          unverifiedPayments.push({\n            crdr,'
);

content = content.replace(
  'const result = bookings.map(b => ({',
  'const result = bookings.map(b => ({\n      crdr: getCRDR(b),'
);

// agent-margin-report has another map
const countResultMaps = (content.match(/const result = bookings\.map\(b => \(\{/g) || []).length;
// if there are 2, we should use replaceAll
content = content.replaceAll(
  'const result = bookings.map(b => ({',
  'const result = bookings.map(b => ({\n      crdr: getCRDR(b),'
);

content = content.replace(
  'const rows = bookings.map(b => ({',
  'const rows = bookings.map(b => ({\n      crdr: getCRDR(b),'
);

fs.writeFileSync('routes/reports.js', content);
console.log('updated routes/reports.js');
