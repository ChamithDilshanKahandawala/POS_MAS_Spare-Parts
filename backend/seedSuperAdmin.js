const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');

    const email = 'superadmin@mas.com';
    const exists = await User.findOne({ email });

    if (exists) {
      console.log('⚠️ Super Admin already exists in the database.');
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('superadmin123', salt);

    const superAdmin = new User({
      name: 'Master Control',
      email,
      password: hashedPassword,
      role: 'super_admin',
      isActive: true,
      status: 'active',
      shop: 'Headquarters'
    });

    await superAdmin.save();
    console.log('🎉 Super Admin created successfully!');
    console.log('-----------------------------------');
    console.log('✉️  Email:    ' + email);
    console.log('🔑 Password: superadmin123');
    console.log('-----------------------------------');
    console.log('You can now log in to the POS system using these credentials.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating Super Admin:', error);
    process.exit(1);
  }
};

seedSuperAdmin();
