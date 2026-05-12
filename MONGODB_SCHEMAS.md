# Travel Window - MongoDB Schemas

**Analysis Date:** 2026-05-12

This document provides a comprehensive overview of the MongoDB schemas used in the Travel Window CRM application.

---

## 1. User Model (`models/User.js`)
Stores user accounts and authentication details.

| Field | Type | Details |
| :--- | :--- | :--- |
| `email` | String | Unique, Required, Lowercase, Trimmed |
| `password` | String | Hashed using bcrypt |
| `role` | String | Enum: `['AGENT1', 'AGENT2', 'ACCOUNT', 'ADMIN']` |
| `name` | String | Required |
| `photo` | String | URL to profile photo (default: '') |
| `isActive` | Boolean | Account status (default: true) |
| `createdAt` | Date | Timestamp |
| `updatedAt` | Date | Timestamp |

---

## 2. Supplier Model (`models/Supplier.js`)
Stores third-party suppliers used for bookings.

| Field | Type | Details |
| :--- | :--- | :--- |
| `name` | String | Unique, Required |
| `isActive` | Boolean | Status (default: true) |
| `createdAt` | Date | Timestamp |
| `updatedAt` | Date | Timestamp |

---

## 3. Booking Model (`models/Booking.js`)
The core model of the application, containing complex nesting for payments, history, and cancellations.

### Main Fields
| Field | Type | Details |
| :--- | :--- | :--- |
| `dateOfSubmission` | Date | Default: `Date.now` |
| `submittedBy` | ObjectId | Ref: `User` |
| `submittedByName` | String | Cached name for display |
| `paxName` | String | Passenger name (Uppercase) |
| `contactPerson` | String | Optional contact |
| `contactNumber` | String | Required |
| `pnr` | String | Unique, Uppercase |
| `sectorType` | String | Enum: `['One Way', 'Round Trip', 'Multiple']` |
| `travelDate` | Date | Required |
| `returnDate` | Date | Optional |
| `status` | String | Enum: `['Draft', 'Submitted', 'Pending Verification', ... 'Cancelled']` |
| `assignedTo` | ObjectId | Ref: `User` |

### Commercial & Financials
| Field | Type | Details |
| :--- | :--- | :--- |
| `supplier` | ObjectId | Ref: `Supplier` |
| `supplierName` | String | Cached supplier name |
| `ourCost` | Number | Purchase price from supplier |
| `salePrice` | Number | Base sale price to client |
| `supplierCharges` | Number | Additional charges (Markup/Service) |
| `totalSalePrice` | Number | Final price to client (incl. addons) |
| `paymentFromCard` | Number | Amount paid via card |
| `cardType` | String | Enum: `['Company Card', 'Client Card', '']` |
| `cardLast4Digits` | String | Last 4 digits of the card |
| `totalPaidAmount` | Number | Total amount collected from client |
| `balanceAmount` | Number | Outstanding balance |
| `billingStatus` | String | Enum: `['Partial Paid', 'Fully Paid', 'Unpaid']` |

### Nested Schemas

#### Payment Schema (`payments`)
- `paidAmount`: Number
- `paymentMode`: Enum (Cash, UPI, Card, etc.)
- `paymentDate`: Date
- `referenceNo`: String

#### Progress History (`progressHistory`)
- `action`: String (e.g., 'Status Changed')
- `performedBy`: ObjectId (Ref: User)
- `performedByName`: String
- `timestamp`: Date
- `changes`: Mixed (Key-Value changes)
- `remarks`: String

#### Cancellation Schema (`cancellation`)
- `isCancelled`: Boolean
- `totalAmountPaidByClient`: Number
- `refundableAmount`: Number
- `committedToClient`: Number
- `chargeFromClient`: Number
- `newMargin`: Number
- `totalSupplierTook`: Number
- `totalCharges`: Number
- `supplierWillReturn`: Number
- `refundCommittedToClient`: Number
- `refundAwaitedFromSupplier`: Boolean (Default: true)
- `refundReceivedFromSupplier`: `{ date: Date, remarks: String }`

---

## 4. Database Indexes
Optimized for high-performance reporting and dashboard filtering.

| Collection | Type | Fields |
| :--- | :--- | :--- |
| Bookings | Single | `pnr` (Unique), `contactNumber`, `status`, `supplier`, `submittedBy`, `dateOfSubmission` |
| Bookings | Compound | `{ supplier: 1, dateOfSubmission: -1 }` |
| Bookings | Compound | `{ submittedBy: 1, dateOfSubmission: -1 }` |
| Bookings | Compound | `{ status: 1, dateOfSubmission: -1 }` |
| Bookings | Compound | `{ balanceAmount: 1, status: 1 }` |
| Bookings | Compound | `{ dateOfSubmission: 1, status: 1 }` |

---
