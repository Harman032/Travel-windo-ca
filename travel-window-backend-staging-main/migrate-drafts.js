require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = "mongodb://twsu:A7QszMxfHcUMa3D2@ac-ojbycph-shard-00-00.ia5scqz.mongodb.net:27017,ac-ojbycph-shard-00-01.ia5scqz.mongodb.net:27017,ac-ojbycph-shard-00-02.ia5scqz.mongodb.net:27017/travel_window_staging?ssl=true&authSource=admin&replicaSet=atlas-zxy2il-shard-0&w=majority";

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
