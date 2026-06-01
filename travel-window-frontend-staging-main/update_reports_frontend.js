const fs = require('fs');
let tsContent = fs.readFileSync('src/app/components/reports/reports.component.ts', 'utf8');

// 1. Add getCRDRClass and showCancelledColumns to the class
const classMethods = `
  getCRDRClass(type: string): string {
    return type === 'CR' ? 'px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700' :
                           'px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700';
  }

  showCancelledColumns(bookings: any[]): boolean {
    return bookings && bookings.some(b => b.status === 'Cancelled');
  }
`;

// Insert the methods before the closing bracket of the class
tsContent = tsContent.replace(/}\s*$/, classMethods + '\n}\n');

// 2. Unverified Payments changes
// Replace Unverified payments th
tsContent = tsContent.replace(
  /<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supplier Charges<\/th>[\s\S]*?<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Supplier Took \(Cancelled\)<\/th>/,
  `<!-- Replace starts here -->
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supplier Charges</th>
                <th *ngIf="showCancelledColumns(unverifiedPaymentsData)" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Airline Cancellation Charges</th>
                <th *ngIf="showCancelledColumns(unverifiedPaymentsData)" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Current Margin</th>
                <th *ngIf="showCancelledColumns(unverifiedPaymentsData)" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Charges</th>
  <!-- Replace ends here -->`
);

// We also need to add CR/DR columns if they don't exist, wait, the table already has "CR / DR". Let's check existing table:
// <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">CR / DR</th>
// Add "CR/DR Value" 
tsContent = tsContent.replace(
  /<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">CR \/ DR<\/th>/,
  `<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">CR/DR</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">CR/DR Value</th>`
);

// Unverified Payments row
tsContent = tsContent.replace(
  /<td class="px-4 py-2 text-sm">{{ item\.supplierCharges \|\| 0 \| number:'1\.2-2' }}<\/td>[\s\S]*?<span \*ngIf="item\.status !== 'Cancelled'">-<\/span>[\s\S]*?<\/td>/,
  `<td class="px-4 py-2 text-sm">{{ item.supplierCharges || 0 | number:'1.2-2' }}</td>
                <td *ngIf="showCancelledColumns(unverifiedPaymentsData)" class="px-4 py-2 text-sm text-red-600">
                  <span *ngIf="item.status === 'Cancelled'">{{ item.cancellation?.airlineCancellationCharges || 0 | number:'1.2-2' }}</span>
                </td>
                <td *ngIf="showCancelledColumns(unverifiedPaymentsData)" class="px-4 py-2 text-sm">
                  <span *ngIf="item.status === 'Cancelled'">{{ item.cancellation?.currentMargin || 0 | number:'1.2-2' }}</span>
                </td>
                <td *ngIf="showCancelledColumns(unverifiedPaymentsData)" class="px-4 py-2 text-sm">
                  <span *ngIf="item.status === 'Cancelled'">{{ item.cancellation?.totalCharges || 0 | number:'1.2-2' }}</span>
                </td>`
);

// Replace CR/DR td
tsContent = tsContent.replace(
  /<td class="px-4 py-2 text-sm font-bold">\s*<ng-container \*ngIf="getCRDRValue\(item\) as res">\s*<span \*ngIf="res\.type === 'CR'" class="text-green-600">CR: {{ res\.value \| number:'1\.2-2' }}<\/span>\s*<span \*ngIf="res\.type === 'DR'" class="text-red-600">DR: {{ res\.value \| number:'1\.2-2' }}<\/span>\s*<span \*ngIf="!res\.type" class="text-gray-400">NIL<\/span>\s*<\/ng-container>\s*<\/td>/,
  `<td>
                  <span [class]="getCRDRClass(item.crdr?.type)">
                    {{ item.crdr?.label }}
                  </span>
                </td>
                <td>
                  <span class="text-sm font-bold" [ngClass]="item.crdr?.type === 'CR' ? 'text-green-600' : 'text-red-600'">{{ item.crdr?.value | number:'1.2-2' }}</span>
                </td>`
);


// 3. Agent Margin Report
tsContent = tsContent.replace(
  /<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Sale Price<\/th>/,
  `<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Sale Price</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supplier Charges</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Current Margin (If Cancelled)</th>`
);

tsContent = tsContent.replace(
  /<td class="px-4 py-2 text-sm">{{ item\.totalSalePrice \| number:'1\.2-2' }}<\/td>/,
  `<td class="px-4 py-2 text-sm">{{ item.totalSalePrice | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm">{{ item.supplierCharges || 0 | number:'1.2-2' }}</td>
                <td class="px-4 py-2 text-sm">
                   <span *ngIf="item.status === 'Cancelled'">{{ item.cancellation?.currentMargin || 0 | number:'1.2-2' }}</span>
                   <span *ngIf="item.status !== 'Cancelled'">-</span>
                </td>`
);

// 4. Financial Summary
// Headers
tsContent = tsContent.replace(
  /<div class="bg-orange-50 p-4 rounded-lg">\s*<p class="text-sm text-gray-600">Total Margin<\/p>\s*<p class="text-2xl font-bold text-orange-900">{{ financialSummaryData\.summary\?\.totalMargin \| number:'1\.2-2' }}<\/p>\s*<\/div>/,
  `<div class="bg-orange-50 p-4 rounded-lg">
             <p class="text-sm text-gray-600">Total Margin</p>
             <p class="text-2xl font-bold text-orange-900">{{ financialSummaryData.summary?.totalMargin | number:'1.2-2' }}</p>
           </div>
           <div class="bg-yellow-50 p-4 rounded-lg">
             <p class="text-sm text-gray-600">Total Supplier Charges</p>
             <p class="text-2xl font-bold text-yellow-900">{{ financialSummaryData.summary?.totalSupplierCharges | number:'1.2-2' }}</p>
           </div>
           <div class="bg-red-50 p-4 rounded-lg">
             <p class="text-sm text-gray-600">Total Airline Charges</p>
             <p class="text-2xl font-bold text-red-900">{{ financialSummaryData.summary?.totalAirlineCharges | number:'1.2-2' }}</p>
           </div>
           <div class="bg-blue-50 p-4 rounded-lg">
             <p class="text-sm text-gray-600">Total Current Margin</p>
             <p class="text-2xl font-bold text-blue-900">{{ financialSummaryData.summary?.totalCurrentMargin | number:'1.2-2' }}</p>
           </div>`
);

fs.writeFileSync('frontend_updates.js', '/* will process next script */');
