const fs = require('fs');
let content = fs.readFileSync('routes/reports.js', 'utf8');

// 1. Update Financial Summary to include Cancelled bookings
content = content.replace(
  "      status: { $ne: 'Cancelled' }",
  "      // status: { $ne: 'Cancelled' } // Include cancelled"
);

// Update financial-summary summary calculations
content = content.replace(
  /const summary = {[\s\S]*?totalMargin: rows\.reduce\(\(s, r\) => s \+ r\.margin, 0\)[\s\S]*?};/,
  `const totalSupplierCharges = bookings.reduce((sum, b) => sum + (b.supplierCharges || 0), 0);
    const totalAirlineCharges = bookings
      .filter(b => b.status === 'Cancelled')
      .reduce((sum, b) => sum + (b.cancellation?.airlineCancellationCharges || 0), 0);
    const totalCurrentMargin = bookings.reduce((sum, b) => {
      if (b.status === 'Cancelled') return sum + (b.cancellation?.currentMargin || 0);
      return sum + ((b.salePrice || 0) - (b.ourCost || 0) - (b.supplierCharges || 0));
    }, 0);

    const summary = {
      totalBookings: rows.length,
      totalSale: rows.reduce((s, r) => s + r.salePrice, 0),
      totalPaid: rows.reduce((s, r) => s + r.totalPaidAmount, 0),
      totalMargin: rows.reduce((s, r) => s + r.margin, 0),
      totalSupplierCharges,
      totalAirlineCharges,
      totalCurrentMargin
    };`
);

// 2. Add properties for Payment to Supplier Report
// We need supplierBookingCharge, updation, cancellation
content = content.replace(
  /existing\.paymentPaid \+= \(b\.ourCost \|\| 0\);[\s\S]*?existing\.totalBookingCost \+= \(b\.totalSalePrice \|\| 0\);/,
  `existing.paymentPaid += (b.ourCost || 0);
      existing.totalBookingCost += (b.totalSalePrice || 0);
      existing.supplierBookingCharge = (existing.supplierBookingCharge || 0) + (b.supplierBookingCharge || 0);
      existing.supplierUpdationCharge = (existing.supplierUpdationCharge || 0) + (b.supplierUpdationCharge || 0);
      existing.supplierCancellationCharge = (existing.supplierCancellationCharge || 0) + (b.autoSupplierCancellationCharge || 0);
      existing.totalSupplierCharges = (existing.totalSupplierCharges || 0) + (b.supplierCharges || 0);`
);

// 3. Date Wise Booking List
// Add Supplier Charges and Our Margin
content = content.replace(
  /returnDate: b\.returnDate,[\s\S]*?submittedByName: b\.submittedByName \|\| \(b\.submittedBy \? b\.submittedBy\.name : 'Unknown'\)\s*\}\)\);/,
  `returnDate: b.returnDate,
      supplierCharges: b.supplierCharges || 0,
      ourMargin: Math.round(((b.salePrice || 0) - (b.ourCost || 0) - (b.supplierBookingCharge || 0)) * 100) / 100,
      submittedByName: b.submittedByName || (b.submittedBy ? b.submittedBy.name : 'Unknown')
    }));`
);

// 4. Date Wise Margin Report (agent-margin-report)
content = content.replace(
  "const query = { status: { $ne: 'Cancelled' } };",
  "const query = { /* Include all statuses so we can show cancelled margins */ };"
);

content = content.replace(
  /margin: \(b\.salePrice \|\| 0\) - \(b\.ourCost \|\| 0\) - \(b\.supplierCharges \|\| 0\),/,
  `margin: (b.salePrice || 0) - (b.ourCost || 0) - (b.supplierCharges || 0),
      supplierCharges: b.supplierCharges || 0,
      ourMargin: (b.salePrice || 0) - (b.ourCost || 0) - (b.supplierCharges || 0),
      status: b.status,
      currentMargin: b.cancellation?.currentMargin || ((b.salePrice || 0) - (b.ourCost || 0) - (b.supplierCharges || 0)),
      newMargin: b.cancellation?.newMargin || 0,`
);

// Verified Payments
content = content.replace(
  "totalOurCost: bookings.reduce((sum, b) => sum + (b.ourCost ?? 0), 0),",
  `totalOurCost: bookings.reduce((sum, b) => sum + (b.ourCost ?? 0), 0),
      // For Verified Payments, we also need to pass currentMargin or refundCommitted
      `
);
content = content.replace(
  "const bookings = await Booking.find(matchQuery)",
  "const bookings = await Booking.find(matchQuery)"
);


fs.writeFileSync('routes/reports.js', content);
