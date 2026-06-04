__Travel Window CRM__

__Supplier Charges & Cancellation Logic__

Complete Implementation Document ΓÇö v2

Prepared: 28 May 2026

# __1\. Overview__

This document covers all changes required for the Travel Window CRM to support per\-supplier charge configuration and updated cancellation logic across all booking scenarios\.

__Feature__

__Description__

__Supplier Charges Config__

Add booking, updation & cancellation charges per supplier in admin panel

__Auto\-pick Charges__

Charges auto\-populate on new booking, update and cancellation forms

__Field Rename__

'Supplier Cancellation Charges' renamed to 'Airline Cancellation Charges'

__Margin Recalculation__

Our Margin = Sale Price \- \(Our Cost \+ Supplier Booking Charges\)

__Radio Buttons__

All cancellation forms get radio buttons: Cancellation Charges / Refund Amount

__Reports Update__

All affected reports updated to reflect new fields and formulas

# __2\. Supplier Charges ΓÇö Admin Panel__

## __2\.1 New Fields in /dashboard/admin/suppliers__

Each supplier record needs three new charge fields\. Admin has full access to view and edit these charges per supplier:

__Field Name__

__Description__

__Example__

__Booking Charge__

Charge applied when a new booking is created

10\.00

__Updation Charge__

Charge applied when a booking is updated/changed

20\.00

__Cancellation Charge__

Charge applied when a booking is cancelled

30\.00

## __2\.2 Schema Changes ΓÇö models/Supplier\.js__

__New Fields in Supplier Schema__

bookingCharge

Number, default: 0 ΓÇö charge applied on new booking creation

updationCharge

Number, default: 0 ΓÇö charge applied on date/flight change

cancellationCharge

Number, default: 0 ΓÇö charge applied on cancellation

## __2\.3 Cumulative Supplier Charges Logic__

Supplier Charges accumulate based on what actions have been performed on a booking:

__Booking State__

__Supplier Charges__

__Calculation__

__New Booking Only__

10\.00

Booking Charge \(10\)

__Booking \+ Updated__

30\.00

Booking \(10\) \+ Updation \(20\)

__Booking \+ Cancelled \(no update\)__

40\.00

Booking \(10\) \+ Cancellation \(30\)

__Booking \+ Updated \+ Cancelled__

60\.00

Booking \(10\) \+ Updation \(20\) \+ Cancellation \(30\)

*ΓÜá Supplier Charges field in reports always shows the cumulative total based on current booking state\.*

## __2\.4 Auto\-pick Logic__

__Trigger__

__Field Used__

__Auto\-filled In__

__New Booking Created__

supplier\.bookingCharge

supplierCharges field on booking

__Booking Updated / Date Change / Flight Change__

supplier\.updationCharge added to supplierCharges

supplierCharges \+= updationCharge \(cumulative\)

__Booking Cancelled__

supplier\.cancellationCharge added to supplierCharges

supplierCharges \+= cancellationCharge \(cumulative\)

__Cancellation Form ΓÇö show breakdown__

Show each charge component separately

Booking / Updation \(if updated\) / Cancellation charges shown

# __3\. Our Margin ΓÇö Recalculation__

__Old Formula__

__New Formula__

__Our Margin__

Sale Price \- Our Cost \- Supplier Charges

Sale Price \- \(Our Cost \+ Supplier Booking Charge at time of booking\)

__Example: Margin Calculation__

__Field__

__Formula__

__Example Value__

__Our Cost__

*\(given\)*

__1,000\.00__

__Sale Price__

*\(given\)*

__1,200\.00__

__Supplier Booking Charge__

*auto\-picked from supplier*

__10\.00__

__Our Margin__

*Sale Price \- \(Our Cost \+ Supplier Booking Charge\)*

__190\.00__

# __4\. Field Rename__

'Supplier Cancellation Charges' is renamed to 'Airline Cancellation Charges' across the entire application\.

__File / Area__

__Change Required__

__Details__

__models/Booking\.js__

Rename field in cancellation schema

*airlineCancellationCharges \(was supplierCancellationCharges\)*

__new\-booking\.component\.html__

Rename form label

*Label: 'Airline Cancellation Charges'*

__booking\-detail\.component\.html__

Rename all labels and form controls

*All instances of 'Supplier Cancellation Charges'*

__booking\-detail\.component\.ts__

Rename all getter references

*cancelForm\.get\('airlineCancellationCharges'\)*

__routes/bookings\.js__

Rename variable references

*airlineCancellationCharges throughout*

__routes/reports\.js__

Rename column references

*Report columns updated*

__cancellation\.test\.js__

Rename test variables

*acc \(airline cancellation charges\)*

# __5\. Radio Buttons ΓÇö All Cancellation Forms__

All cancellation scenarios must now show radio button selection at the top of the form:

__Option 1 ΓÇö Default__

__Option 2__

__ΓùÅ Cancellation Charges__

__Γùï Refund Amount__

User enters Airline Cancellation Charges

User enters Airline Refund Amount

# __6\. Cancellation Logic ΓÇö All Scenarios__

Base data for all examples below:

__Base Example Data__

Our Cost

1,000\.00

Sale Price

1,200\.00

Supplier Booking Charge \(auto\-picked\)

__10\.00__

Supplier Cancellation Charge \(auto\-picked\)

__30\.00__

Our Margin

190\.00  =  Sale Price \- \(Our Cost \+ Booking Charge\)

New Margin input \(user\)

50\.00

Current Margin

240\.00  =  Our Margin \+ New Margin

Airline Cancellation Charges \(user\)

100\.00

Airline Refund Amount \(user\)

900\.00

Paid Amount \(partial paid\)

600\.00

## __Scenario 1 ΓÇö Regular Fully Paid \(Cash/E\-Transfer\)__

Trigger: billingStatus = Paid, cardType = null/empty

### __1A ΓÇö Cancellation Charges \(radio = Cancellation Charges\)__

__ΓùÅ Cancellation Charges   Γùï Refund Amount__

__Scenario 1A ΓÇö Cancellation Charges__

__Field__

__Formula__

__Example Value__

__Our Margin__

*Sale Price \- \(Our Cost \+ Supplier Booking Charge at time of booking\)*

__190\.00__

__Supplier Charges \(auto\)__

*Booking\(10\) \+ Cancellation\(30\) \[\+Updation\(20\) if updated\]*

__40\.00 / 60\.00__

__Airline Cancellation Charges__

*user input*

__100\.00__

__New Margin__

*user input*

__50\.00__

__Current Margin__

*Our Margin \+ New Margin*

__240\.00__

__Total Charges__

*Airline Cancellation \+ Supplier Charges*

__140\.00 / 160\.00__

__Refund to Client__

*Sale Price \- \(Current Margin \+ Total Charges\)*

__820\.00__

__Supplier Will Return__

*Our Cost \- Supplier Charges \- Airline Cancellation*

__870\.00__

### __1B ΓÇö Refund Amount \(radio = Refund Amount\)__

__Γùï Cancellation Charges   ΓùÅ Refund Amount__

__Scenario 1B ΓÇö Refund Amount__

__Field__

__Formula__

__Example Value__

__Our Margin__

*Sale Price \- \(Our Cost \+ Supplier Booking Charge at time of booking\)*

__190\.00__

__Supplier Charges \(auto\)__

*Booking\(10\) \+ Cancellation\(30\) \[\+Updation\(20\) if updated\]*

__40\.00 / 60\.00__

__Airline Refund Amount__

*user input*

__900\.00__

__New Margin__

*user input*

__50\.00__

__Current Margin__

*Our Margin \+ New Margin*

__240\.00__

__Airline Deducted__

*Our Cost \- Airline Refund Amount*

__100\.00__

__Total Charges__

*Airline Deducted \+ Supplier Charges*

__140\.00 / 160\.00__

__Refund to Client__

*Sale Price \- \(Current Margin \+ Total Charges\)*

__820\.00__

__Supplier Will Return__

*Our Cost \- Supplier Charges \- Airline Deducted*

__870\.00__

## __Scenario 2 ΓÇö Partial Paid \(Cash/E\-Transfer\)__

Trigger: billingStatus = Partial Paid, cardType = null/empty\. Paid Amount = 600

### __2A ΓÇö Cancellation Charges__

__ΓùÅ Cancellation Charges   Γùï Refund Amount__

__Scenario 2A ΓÇö Partial Paid Cancellation Charges__

__Field__

__Formula__

__Example Value__

__Our Margin__

*Sale Price \- \(Our Cost \+ Supplier Booking Charge at time of booking\)*

__190\.00__

__Supplier Charges \(auto\)__

*Booking\(10\) \+ Cancellation\(30\) \[\+Updation\(20\) if updated\]*

__40\.00 / 60\.00__

__Airline Cancellation Charges__

*user input*

__100\.00__

__New Margin__

*user input*

__50\.00__

__Current Margin__

*Our Margin \+ New Margin*

__240\.00__

__Total Charges__

*Airline Cancellation \+ Supplier Charges*

__140\.00 / 160\.00__

__Refund to Client__

*Paid Amount \- \(Total Charges \+ Current Margin\)*

__220\.00__

__Supplier Will Return__

*Paid Amount \- Supplier Charges \- Airline Cancellation*

__470\.00__

*ΓÜá Refund to Client = Paid Amount \- \(Total Charges \+ Current Margin\) applies to ALL partial paid and card scenarios\.*

### __2B ΓÇö Refund Amount__

__Γùï Cancellation Charges   ΓùÅ Refund Amount__

__Scenario 2B ΓÇö Partial Paid Refund Amount__

__Field__

__Formula__

__Example Value__

__Our Margin__

*Sale Price \- \(Our Cost \+ Supplier Booking Charge at time of booking\)*

__190\.00__

__Supplier Charges \(auto\)__

*Booking\(10\) \+ Cancellation\(30\) \[\+Updation\(20\) if updated\]*

__40\.00 / 60\.00__

__Airline Refund Amount__

*user input*

__500\.00__

__New Margin__

*user input*

__50\.00__

__Current Margin__

*Our Margin \+ New Margin*

__240\.00__

__Airline Deducted__

*Paid Amount \- Airline Refund Amount*

__100\.00__

__Total Charges__

*Airline Deducted \+ Supplier Charges*

__140\.00 / 160\.00__

__Refund to Client__

*Paid Amount \- \(Total Charges \+ Current Margin\)*

__220\.00__

__Supplier Will Return__

*Paid Amount \- Supplier Charges \- Airline Deducted*

__470\.00__

## __Scenario 3 ΓÇö Client Card Fully Paid__

Trigger: billingStatus = Paid, cardType = Client Card\. Paid Amount = Sale Price = 1200

### __3A ΓÇö Cancellation Charges__

__ΓùÅ Cancellation Charges   Γùï Refund Amount__

__Scenario 3A ΓÇö Client Card Cancellation Charges__

__Field__

__Formula__

__Example Value__

__Our Margin__

*Sale Price \- \(Our Cost \+ Supplier Booking Charge at time of booking\)*

__190\.00__

__Supplier Charges \(auto\)__

*Booking\(10\) \+ Cancellation\(30\) \[\+Updation\(20\) if updated\]*

__40\.00 / 60\.00__

__Airline Cancellation Charges__

*user input*

__100\.00__

__New Margin__

*user input*

__50\.00__

__Current Margin__

*Our Margin \+ New Margin*

__240\.00__

__Total Supplier Took__

*Supplier Charges \(cumulative\)*

__40\.00 / 60\.00__

__Total Charges__

*Total Supplier Took \+ Airline Cancellation Charges*

__140\.00 / 160\.00__

__Supplier Will Return__

*Sale Price \- Airline Cancellation Charges*

__1,100\.00__

__Upfront Needed__

*Current Margin \+ Total Supplier Took*

__280\.00 / 300\.00__

__Refund Committed to Client__

*Sale Price \- \(Current Margin \+ Total Charges\)*

__820\.00__

__Refundable Amount To Client__

*Supplier Will Return*

__1,100\.00__

### __3B ΓÇö Refund Amount__

__Γùï Cancellation Charges   ΓùÅ Refund Amount__

__Scenario 3B ΓÇö Client Card Refund Amount__

__Field__

__Formula__

__Example Value__

__Our Margin__

*Sale Price \- \(Our Cost \+ Supplier Booking Charge at time of booking\)*

__190\.00__

__Supplier Charges \(auto\)__

*Booking\(10\) \+ Cancellation\(30\) \[\+Updation\(20\) if updated\]*

__40\.00 / 60\.00__

__Airline Refund Amount__

*user input*

__900\.00__

__New Margin__

*user input*

__50\.00__

__Current Margin__

*Our Margin \+ New Margin*

__240\.00__

__Airline Deducted__

*Sale Price \- Airline Refund Amount*

__300\.00__

__Total Supplier Took__

*Supplier Charges \(cumulative\)*

__40\.00 / 60\.00__

__Total Charges__

*Total Supplier Took \+ Airline Deducted*

__340\.00 / 360\.00__

__Supplier Will Return__

*Sale Price \- Airline Deducted*

__900\.00__

__Upfront Needed__

*Current Margin \+ Total Supplier Took*

__280\.00 / 300\.00__

__Refund Committed to Client__

*Sale Price \- \(Current Margin \+ Total Charges\)*

__620\.00__

__Refundable Amount To Client__

*Supplier Will Return*

__900\.00__

## __Scenario 4 ΓÇö Company Card Fully Paid \(Card = Our Cost\)__

Trigger: billingStatus = Paid, cardType = Company Card, paymentFromCard = ourCost = 1000

### __4A ΓÇö Cancellation Charges__

__ΓùÅ Cancellation Charges   Γùï Refund Amount__

__Scenario 4A ΓÇö Company Card \(Card=Our Cost\) Cancellation Charges__

__Field__

__Formula__

__Example Value__

__Our Margin__

*Sale Price \- \(Our Cost \+ Supplier Booking Charge at time of booking\)*

__190\.00__

__Supplier Charges \(auto\)__

*Booking\(10\) \+ Cancellation\(30\) \[\+Updation\(20\) if updated\]*

__40\.00 / 60\.00__

__Airline Cancellation Charges__

*user input*

__100\.00__

__New Margin__

*user input*

__50\.00__

__Current Margin__

*Our Margin \+ New Margin*

__240\.00__

__Total Supplier Took__

*Supplier Charges \(cumulative\)*

__40\.00 / 60\.00__

__Total Charges__

*Total Supplier Took \+ Airline Cancellation Charges*

__140\.00 / 160\.00__

__Supplier Will Return__

*Our Cost \- Supplier Charges \- Airline Cancellation*

__870\.00__

__Refund Committed to Client__

*Sale Price \- \(Current Margin \+ Total Charges\)*

__820\.00__

### __4B ΓÇö Refund Amount__

__Γùï Cancellation Charges   ΓùÅ Refund Amount__

__Scenario 4B ΓÇö Company Card \(Card=Our Cost\) Refund Amount__

__Field__

__Formula__

__Example Value__

__Our Margin__

*Sale Price \- \(Our Cost \+ Supplier Booking Charge at time of booking\)*

__190\.00__

__Supplier Charges \(auto\)__

*Booking\(10\) \+ Cancellation\(30\) \[\+Updation\(20\) if updated\]*

__40\.00 / 60\.00__

__Airline Refund Amount__

*user input*

__900\.00__

__New Margin__

*user input*

__50\.00__

__Current Margin__

*Our Margin \+ New Margin*

__240\.00__

__Airline Deducted__

*Our Cost \- Airline Refund Amount*

__100\.00__

__Total Supplier Took__

*Supplier Charges \(cumulative\)*

__40\.00 / 60\.00__

__Total Charges__

*Total Supplier Took \+ Airline Deducted*

__140\.00 / 160\.00__

__Supplier Will Return__

*Our Cost \- Supplier Charges \- Airline Deducted*

__870\.00__

__Refund Committed to Client__

*Sale Price \- \(Current Margin \+ Total Charges\)*

__820\.00__

## __Scenario 5 ΓÇö Partial Paid Client Card__

Trigger: billingStatus = Partial Paid, cardType = Client Card\. Paid Amount = 600

### __5A ΓÇö Cancellation Charges__

__ΓùÅ Cancellation Charges   Γùï Refund Amount__

__Scenario 5A ΓÇö Partial Paid Client Card Cancellation Charges__

__Field__

__Formula__

__Example Value__

__Our Margin__

*Sale Price \- \(Our Cost \+ Supplier Booking Charge\)*

__190\.00__

__Supplier Booking Charge \(auto\)__

*supplier\.bookingCharge*

__10\.00__

__Supplier Cancellation Charge \(auto\)__

*supplier\.cancellationCharge*

__30\.00__

__Airline Cancellation Charges__

*user input*

__100\.00__

__New Margin__

*user input*

__50\.00__

__Current Margin__

*Our Margin \+ New Margin*

__240\.00__

__Total Supplier Took__

*Supplier Booking \+ Supplier Cancellation*

__40\.00__

__Total Charges__

*Total Supplier Took \+ Airline Cancellation Charges*

__140\.00__

__Supplier Will Return__

*Paid Amount \- Total Charges*

__460\.00__

__Upfront Needed__

*Current Margin*

__240\.00__

__Refund Committed to Client__

*Supplier Will Return*

__460\.00__

### __5B ΓÇö Refund Amount__

__Γùï Cancellation Charges   ΓùÅ Refund Amount__

__Scenario 5B ΓÇö Partial Paid Client Card Refund Amount__

__Field__

__Formula__

__Example Value__

__Our Margin__

*Sale Price \- \(Our Cost \+ Supplier Booking Charge\)*

__190\.00__

__Supplier Booking Charge \(auto\)__

*supplier\.bookingCharge*

__10\.00__

__Supplier Cancellation Charge \(auto\)__

*supplier\.cancellationCharge*

__30\.00__

__Airline Refund Amount__

*user input*

__500\.00__

__New Margin__

*user input*

__50\.00__

__Current Margin__

*Our Margin \+ New Margin*

__240\.00__

__Airline Deducted__

*Paid Amount \- Airline Refund Amount*

__100\.00__

__Total Supplier Took__

*Supplier Booking \+ Supplier Cancellation*

__40\.00__

__Total Charges__

*Total Supplier Took \+ Airline Deducted*

__140\.00__

__Supplier Will Return__

*Paid Amount \- Total Charges*

__460\.00__

__Upfront Needed__

*Current Margin*

__240\.00__

__Refund Committed to Client__

*Supplier Will Return*

__460\.00__

## __Note ΓÇö Machine Charge Payment Mode__

Machine Charge payment mode \(no card type\) follows the same cancellation logic as Scenario 1 ΓÇö Regular Fully Paid\. No separate scenario needed\. Apply Scenario 1A formulas for Cancellation Charges and Scenario 1B formulas for Refund Amount\.

# __7\. Scenario Summary ΓÇö Quick Reference__

__\#__

__Scenario__

__Billing__

__Card Type__

__Radio__

__Key Formula__

__1A__

Regular Fully Paid

Paid

None

Charges

Supplier Will Return = Our Cost \- \(Airline \+ Supplier Cancellation\)

__1B__

Regular Fully Paid

Paid

None

Refund Amt

Airline Deducted = Our Cost \- Refund Amt

__2A__

Partial Paid

Partial Paid

None

Charges

Refund = Paid \- \(Total Charges \+ Current Margin\)

__2B__

Partial Paid

Partial Paid

None

Refund Amt

Airline Deducted = Paid \- Refund Amt

__3A__

Client Card Fully Paid

Paid

Client Card

Charges

Refund = Sale Price \- \(Current Margin \+ Total Charges\)

__3B__

Client Card Fully Paid

Paid

Client Card

Refund Amt

Airline Deducted = Sale Price \- Refund Amt, Supplier Will Return = Sale Price \- Airline Deducted

__4A__

Company Card \(Card=Our Cost\)

Paid

Company Card

Charges

Supplier Will Return = Our Cost \- \(Airline \+ Supplier Cancellation\)

__4B__

Company Card \(Card=Our Cost\)

Paid

Company Card

Refund Amt

Airline Deducted = Our Cost \- Refund Amt

__5A__

Partial Paid Client Card

Partial Paid

Client Card

Charges

Upfront = Current Margin, Refund = Supplier Will Return

__5B__

Partial Paid Client Card

Partial Paid

Client Card

Refund Amt

Airline Deducted = Paid \- Refund Amt

__Note__

Machine Charge ΓÇö same as Scenario 1A/1B

Paid

None

Both

Apply Scenario 1 formulas

# __8\. Complete Changes List__

## __8\.1 Backend Changes__

__File / Area__

__Change Required__

__Details__

__models/Supplier\.js__

Add 3 new fields

*bookingCharge, updationCharge, cancellationCharge \(Number, default: 0\)*

__models/Booking\.js__

Rename field

*supplierCancellationCharges ΓåÆ airlineCancellationCharges in cancellation schema*

__models/Booking\.js__

Add supplierBookingCharge

*Store auto\-picked booking charge on booking record*

__models/Booking\.js__

Add supplierCancellationCharge

*Store auto\-picked cancellation charge on cancellation record*

__routes/suppliers\.js__

Update CRUD

*Include bookingCharge, updationCharge, cancellationCharge in GET/POST/PUT*

__routes/bookings\.js__

Auto\-pick on create

*supplierCharges = bookingCharge; save to booking*

__routes/bookings\.js__

Accumulate on update

*supplierCharges \+= updationCharge; update booking*

__routes/bookings\.js__

Accumulate on cancel

*supplierCharges \+= cancellationCharge; show breakdown in cancellation form*

__routes/bookings\.js__

Show updation charge in cancel form

*If booking was updated, show updation charge in cancellation form breakdown*

__routes/bookings\.js__

Update margin formula

*Our Margin = Sale Price \- \(Our Cost \+ Supplier Booking Charge\)*

__routes/bookings\.js__

Update all cancellation formulas

*All 7 scenarios \(14 paths\) updated with new formulas*

__routes/bookings\.js__

Add radio button support

*Handle cancellationMode: charges | refundAmount for all scenarios*

__routes/reports\.js__

Update column names

*supplierCancellationCharges ΓåÆ airlineCancellationCharges in all queries*

__tests/cancellation\.test\.js__

Rename \+ update all tests

*scc ΓåÆ acc, update all formulas, add refund amount variants*

## __8\.2 Frontend Changes__

__File / Area__

__Change Required__

__Details__

__admin/suppliers component__

Add 3 new input fields

*Booking Charge, Updation Charge, Cancellation Charge inputs per supplier*

__new\-booking\.component\.html__

Auto\-populate supplierCharges

*On supplier selection, fetch and populate booking charge*

__new\-booking\.component\.ts__

Add auto\-pick logic

*On supplier change: call supplier API and set supplierCharges*

__new\-booking\.component\.html__

Update margin formula display

*Show Our Margin = Sale Price \- \(Our Cost \+ Supplier Booking Charge\)*

__booking\-detail\.component\.html__

Rename all labels

*All 'Supplier Cancellation Charges' ΓåÆ 'Airline Cancellation Charges'*

__booking\-detail\.component\.html__

Add radio buttons to ALL forms

*Cancellation Charges / Refund Amount on all 6 scenario forms*

__booking\-detail\.component\.html__

Show auto\-picked charges

*Display Supplier Booking Charge and Supplier Cancellation Charge \(read\-only\)*

__booking\-detail\.component\.ts__

Update all getters

*All cancellation getters use new field names and formulas*

__booking\-detail\.component\.ts__

Add cancellationMode handling

*React to radio: 'charges' vs 'refundAmount' for all scenarios*

__reports\.component\.html__

Rename column headers

*All 'Supplier Cancellation Charges' ΓåÆ 'Airline Cancellation Charges'*

__reports\.component\.ts__

Update field references

*All report data mappings updated to new field name*

__booking\.service\.ts__

Update interface

*Add airlineCancellationCharges, supplierBookingCharge fields to Booking interface*

# __9\. Database Migration__

After deploying, run these migration steps in order:

__Migration Steps__

Step 1

Rename supplierCancellationCharges ΓåÆ airlineCancellationCharges in all cancellation records

Step 2

Set supplierBookingCharge = supplierCharges on all existing bookings

Step 3

Recalculate Our Margin for all bookings using new formula

Step 4

Run POST /api/bookings/recalculate\-all\-cancellations

*ΓÜá Take a MongoDB Atlas backup BEFORE running any migration\.*

# __10\. Reports Impact__

__Report__

__Change Required__

__Details__

__Unverified Payments__

Rename column

'Airline Cancellation Charges' column

__Agent Margin Report__

Update margin formula

Margin = Sale Price \- \(Our Cost \+ Supplier Booking Charge\)

__Financial Summary__

Update margin formula

Same margin formula update

__Payment to Supplier__

Add supplier charge columns

Show Booking/Cancellation charges per row

__Verified Payments__

Rename column

'Airline Cancellation Charges' in output

__Date Wise Margin Report__

Update margin formula

Ensure new margin formula used

# __10\. Reports ΓÇö Detailed View__

All reports should display the following additional fields per booking row to provide full financial visibility \(as discussed for the Machine Charge scenario\):

__Report__

__New Columns To Add__

__Details__

__Unverified Payments__

Supplier Charges \(cumulative\), Airline Cancellation Charges, Current Margin, Total Charges

Supplier Charges shows cumulative total based on booking state

__Verified Payments__

Supplier Charges \(cumulative\), Current Margin, Refund Committed To Client

Supplier Charges shows cumulative total for the booking

__Agent Margin Report__

Supplier Charges, Current Margin, New Margin

Use new margin formula: Sale Price \- \(Our Cost \+ Booking Charge\)

__Financial Summary__

Total Supplier Booking Charges, Total Supplier Cancellation Charges, Total Airline Charges

Add to summary cards at top of report

__Payment to Supplier__

Booking Charge, Updation Charge, Cancellation Charge per supplier

Show configured charges alongside actual charges

__Date Wise Booking List__

Supplier Charges, Our Margin, Current Margin

Supplier Charges = cumulative at time of report

__Date Wise Margin Report__

New Margin, Current Margin, Supplier Charges

Full margin breakdown per booking

*ΓÜá Detailed view means each report row shows all charge components separately ΓÇö Supplier Booking Charge, Supplier Cancellation Charge, Airline Cancellation Charges, New Margin, Current Margin ΓÇö so accounting can reconcile each booking fully\.*

# __11\. Implementation Order__

__Step__

__Task__

__Files__

__1__

Add supplier charge fields to schema and admin UI

models/Supplier\.js, admin suppliers component

__2__

Update Booking model ΓÇö rename field, add new fields

models/Booking\.js

__3__

Update backend routes ΓÇö auto\-pick and formulas

routes/bookings\.js, routes/suppliers\.js

__4__

Update reports backend

routes/reports\.js

__5__

Update TypeScript interfaces

booking\.service\.ts

__6__

Update new booking form ΓÇö auto\-pick and margin

new\-booking\.component\.ts/html

__7__

Update booking detail ΓÇö rename, radio buttons, all getters

booking\-detail\.component\.ts/html

__8__

Update reports frontend

reports\.component\.ts/html

__9__

Update and run test suite ΓÇö all 14 scenarios \+ refund variants

tests/cancellation\.test\.js

__10__

Build verification and push

npm run vercel\-build, npm run test:cancellation

__11__

Run database migrations

MongoDB Atlas ΓÇö run migration endpoints in order

*ΓÜá Do NOT push to main until npm run vercel\-build and npm run test:cancellation both pass with 0 errors\.*

*Travel Window CRM ΓÇö Implementation Document v2*

