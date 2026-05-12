# Travel Window - MongoDB Schemas

**Analysis Date:** 2026-05-12

This document provides an **exhaustive** field-by-field map of the MongoDB schemas used in the Travel Window CRM.

---

## 1. User Model (`models/User.js`)
| Field | Type | Details |
| :--- | :--- | :--- |
| `email` | String | Unique, Required, Lowercase, Trimmed |
| `password` | String | Hashed using bcrypt |
| `role` | String | Enum: `['AGENT1', 'AGENT2', 'ACCOUNT', 'ADMIN']` |
| `name` | String | Required |
| `photo` | String | URL to profile photo |
| `isActive` | Boolean | Account status (default: true) |
| `createdAt` | Date | Auto-timestamp |
| `updatedAt` | Date | Auto-timestamp |

---

## 2. Supplier Model (`models/Supplier.js`)
| Field | Type | Details |
| :--- | :--- | :--- |
| `name` | String | Unique, Required |
| `isActive` | Boolean | Status (default: true) |
| `createdAt` | Date | Auto-timestamp |
| `updatedAt` | Date | Auto-timestamp |

---

## 3. Booking Model (`models/Booking.js`)

### A. System & Metadata
| Field | Type | Description |
| :--- | :--- | :--- |
| `dateOfSubmission` | Date | Submission timestamp |
| `submittedBy` | ObjectId | Ref: `User` |
| `submittedByName` | String | Cached name of the creator |
| `assignedTo` | ObjectId | Ref: `User` |
| `status` | String | Enum: `['Draft', 'Submitted', 'Pending Verification', 'Account Verified', 'Admin Verified', 'Billed', 'Paid', 'Unticketed', 'Ticked', 'Ticketed', 'Cancelled']` |
| `verifiedByAccount` | Boolean | Account team verification status |
| `verifiedByAccountDate`| Date | Timestamp of account verification |
| `verifiedByAccountUser`| ObjectId | Ref: `User` |
| `verifiedByAdmin` | Boolean | Admin team verification status |
| `verifiedByAdminDate` | Date | Timestamp of admin verification |
| `verifiedByAdminUser` | ObjectId | Ref: `User` |
| `accountVerified` | Boolean | Legacy/UI helper flag |
| `adminVerified` | Boolean | Legacy/UI helper flag |

### B. Passenger & Travel Details
| Field | Type | Description |
| :--- | :--- | :--- |
| `paxName` | String | Primary passenger name (Uppercase) |
| `contactPerson` | String | Secondary contact name |
| `contactNumber` | String | Primary contact phone |
| `pnr` | String | Unique PNR (Uppercase) |
| `sectorType` | String | Enum: `['One Way', 'Round Trip', 'Multiple']` |
| `from` | String | Departure city/airport |
| `to` | String | Arrival city/airport |
| `travelDate` | Date | Departure date |
| `returnDate` | Date | Return date (if Round Trip) |
| `multipleSectors` | Array | `[{ travelDate, from, to }]` |
| `airline` | String | Airline name/code |
| `note` | String | Agent notes/remarks |

### C. Commercials & Financials
| Field | Type | Description |
| :--- | :--- | :--- |
| `supplier` | ObjectId | Ref: `Supplier` |
| `supplierName` | String | Cached supplier name |
| `ourCost` | Number | Agency's purchase cost |
| `salePrice` | Number | Base selling price |
| `supplierCharges` | Number | Direct charges from supplier |
| `additionalService` | String | Name of primary addon service |
| `additionalServicePrice`| Number | Cost of primary addon service |
| `additionalServices` | Array | `[{ serviceName, serviceCost }]` |
| `totalSalePrice` | Number | Final price (Sale Price + Addons) |
| `paymentFromCard` | Number | Amount charged to card |
| `cardType` | String | Enum: `['Company Card', 'Client Card', '']` |
| `cardLast4Digits` | String | Last 4 digits of card |
| `paymentType` | String | Enum: `['Full', 'Installments']` |
| `totalPaidAmount` | Number | Total collected from client |
| `balanceAmount` | Number | Outstanding balance |
| `billingStatus` | String | Enum: `['Partial Paid', 'Fully Paid', 'Unpaid']` |

### D. Arrays & Sub-Schemas
#### Payments (`payments`)
- `paidAmount`: Number
- `paymentMode`: Enum (`Cash`, `UPI`, `Credit Card`, `Direct Paid to Supplier`, etc.)
- `paymentDate`: Date
- `referenceNo`: String

#### Progress History (`progressHistory`)
- `action`: String
- `performedBy`: ObjectId (Ref: User)
- `performedByName`: String
- `timestamp`: Date
- `changes`: Mixed
- `remarks`: String

#### Post-Booking Changes
- `dateChanges`: `[{ oldTravelDate, newTravelDate, oldReturnDate, newReturnDate, oldOurCost, newOurCost, oldSalePrice, newSalePrice, ourCostAddon, salePriceAddon, remarks, changedBy, changedAt }]`
- `flightChanges`: `[{ oldDetails, newDetails, ourCostAddon, salePriceAddon, remarks, changedBy, changedAt }]`
- `seatBookChanges`: `[{ oldOurCost, newOurCost, oldSalePrice, newSalePrice, oldSupplier, newSupplier, paymentMode, remarks, changedBy, changedAt }]`

### E. Cancellation Schema (`cancellation`)
| Field | Type | Description |
| :--- | :--- | :--- |
| `isCancelled` | Boolean | Cancellation status |
| `cancellationType` | String | Logical trigger for calculation |
| `paymentModeWas` | String | Mode at time of cancellation |
| `totalAmountPaidByClient`| Number | Amount collected pre-cancellation |
| `oldMargin` | Number | Margin pre-cancellation |
| `currentMargin` | Number | Calculation helper margin |
| `newMargin` | Number | Post-cancellation margin |
| `committedToClient` | Number | Refund promised to client |
| `chargeFromClient` | Number | Fee charged to client |
| `supplierCancellationCharges`| Number | Penalty from supplier |
| `supplierRefundAmount` | Number | Amount supplier will return |
| `supplierDeducted` | Number | Amount supplier kept |
| `ourCancellationCharges`| Number | Agency cancellation fee |
| `totalSupplierTook` | Number | Actual supplier cost |
| `totalCharges` | Number | Combined penalties |
| `totalCancellationCharges`| Number | Total agency + supplier fees |
| `supplierWillReturn` | Number | Expected return from supplier |
| `clientReceives` | Number | Total payout to client |
| `upfrontNeeded` | Number | Upfront cash if card refund is delayed |
| `refundToClient` | Number | Payout amount |
| `refundCommittedToClient`| Number | Confirmed refund total |
| `refundableAmount` | Number | Amount eligible for refund |
| `refundableAmountToClient`| Number | Client-specific refund eligibility |
| `refundableAmountCommittedToClient`| Number | Final committed amount |
| `refundProcessed` | Boolean | Payout status |
| `refundProcessedBy` | ObjectId | Ref: User |
| `refundProcessedDate` | Date | Payout timestamp |
| `cancelledBy` | ObjectId | Ref: User |
| `cancelledAt` | Date | Cancellation timestamp |
| `remarks` | String | Cancellation notes |
| `refundAwaitedFromSupplier`| Boolean | Supplier payment status |
| `refundReceivedFromSupplier`| Object | `{ date, remarks }` |
| `refundPaidToClient` | Object | `{ date, remarks }` |

---

## 4. Database Indexes
| Collection | Type | Fields |
| :--- | :--- | :--- |
| Bookings | Single | `pnr` (Unique), `contactNumber`, `status`, `supplier`, `submittedBy`, `dateOfSubmission` |
| Bookings | Compound | `{ supplier: 1, dateOfSubmission: -1 }` |
| Bookings | Compound | `{ submittedBy: 1, dateOfSubmission: -1 }` |
| Bookings | Compound | `{ status: 1, dateOfSubmission: -1 }` |
| Bookings | Compound | `{ balanceAmount: 1, status: 1 }` |
| Bookings | Compound | `{ dateOfSubmission: 1, status: 1 }` |
