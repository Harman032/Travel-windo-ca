require('dotenv').config();
const mongoose = require('mongoose');

// IMPORTANT: Replace this placeholder string with your ACTUAL MongoDB URI
const MONGO_URI = "<uri>";
async function runMigration() {
  try {
    console.log('Connecting to Database...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected successfully!');

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');

    console.log('Starting migration on legacy bookings...');

    // 1. Backfill default Cancellation object if missing
    const cancellationUpdate = await bookingsCollection.updateMany(
      { cancellation: { $exists: false } },
      {
        $set: {
          cancellation: {
            isCancelled: false,
            totalAmountPaidByClient: 0,
            totalAmountPaid: 0,
            refundableAmount: 0,
            oldMargin: 0,
            newMargin: 0,
            airlineCancellationCharges: 0,
            supplierCancellationCharge: 0,
            totalSupplierTook: 0,
            totalCharges: 0,
            clientReceives: 0,
            upfrontNeeded: 0,
            refundProcessed: false,
            refundAwaitedFromSupplier: true,
            upfrontCollection: { amountCollected: 0, paymentMode: '', remarks: '' }
          }
        }
      }
    );
    console.log(`Initialized missing cancellation objects: ${cancellationUpdate.modifiedCount} documents.`);

    // 2. Backfill Verification flags if missing
    const verificationUpdate = await bookingsCollection.updateMany(
      { verifiedByAdmin: { $exists: false } },
      {
        $set: {
          verifiedByAdmin: false,
          verifiedByAccount: false,
          adminVerified: false,
          accountVerified: false
        }
      }
    );
    console.log(`Initialized missing verification flags: ${verificationUpdate.modifiedCount} documents.`);

    // 3. Optional: Fix Legacy Payment Modes
    // If your old database had "Credit Card" where it should now be "Machine Charge", uncomment this block:
    /*
    const paymentModeUpdate = await bookingsCollection.updateMany(
      { "payments.paymentMode": "Credit Card" },
      { $set: { "payments.$[elem].paymentMode": "Machine Charge" } },
      { arrayFilters: [{ "elem.paymentMode": "Credit Card" }] }
    );
    console.log(`Migrated legacy payment modes: ${paymentModeUpdate.modifiedCount} documents.`);
    */

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
