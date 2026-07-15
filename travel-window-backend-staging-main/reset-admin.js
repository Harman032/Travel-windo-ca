require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGODB_URI || "mongodb://twsu:A7QszMxfHcUMa3D2@ac-ojbycph-shard-00-00.ia5scqz.mongodb.net:27017,ac-ojbycph-shard-00-01.ia5scqz.mongodb.net:27017,ac-ojbycph-shard-00-02.ia5scqz.mongodb.net:27017/travel_window_staging?ssl=true&authSource=admin&replicaSet=atlas-zxy2il-shard-0&w=majority";

async function resetAdminPassword() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to database.');

    const admin = await User.findOne({ email: 'admin@travel.com' });
    if (!admin) {
      console.log('Error: admin@travel.com not found in the database.');
      process.exit(1);
    }

    // Set new password (the User model pre-save hook will hash this)
    admin.password = '123456789';
    await admin.save();
    
    console.log('Success: admin@travel.com password has been reset to "123456789".');
    process.exit(0);
  } catch (err) {
    console.error('Error resetting password:', err);
    process.exit(1);
  }
}

resetAdminPassword();
