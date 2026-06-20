require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = "<uri>";

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const res = await db.collection('bookings').updateMany({status: 'Draft'}, {$set: {status: 'Pending Verification'}});
    console.log('Migrated Draft:', res.modifiedCount);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
