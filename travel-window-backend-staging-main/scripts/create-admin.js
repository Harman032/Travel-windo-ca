const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const uri = process.env.travel_window_MONGODB_URI || process.env.MONGODB_URI;
const adminEmail = 'admin@travel.com';
const adminPassword = '123456789';

async function createAdmin() {
  if (!uri) {
    console.error('❌ Error: MONGODB_URI is not set in your .env file');
    console.log('Please ensure you have a .env file in the backend folder with MONGODB_URI=your_mongodb_connection_string');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB...');

    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
      console.log(`User ${adminEmail} already exists. Updating password...`);
      existing.password = adminPassword; // This will be automatically hashed by the pre-save hook in User.js
      await existing.save();
      console.log('✅ Admin user updated successfully.');
    } else {
      const admin = new User({
        email: adminEmail,
        password: adminPassword,
        role: 'ADMIN',
        name: 'Super Admin'
      });
      await admin.save();
      console.log('✅ Admin user created successfully.');
    }

    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();
