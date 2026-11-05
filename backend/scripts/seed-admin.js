require('dotenv').config();
const mongoose = require('mongoose');
const AdminRole = require('../src/models/auth/AdminRole');
const Admin = require('../src/models/auth/Admin');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Create role
  let role = await AdminRole.findOne({ name: 'Super Admin' });
  if (!role) {
    role = await AdminRole.create({ name: 'Super Admin', modules: '[]', status: true });
    console.log('Role created:', role._id);
  } else {
    console.log('Role already exists:', role._id);
  }

  // Create admin
  let admin = await Admin.findOne({ email: 'admin@bringbasket.com' });
  if (!admin) {
    admin = await Admin.create({
      fName: 'Super',
      lName: 'Admin',
      email: 'admin@bringbasket.com',
      password: 'Admin@123',
      roleId: role._id,
      status: true,
      isLoggedIn: false,
    });
    console.log('Admin created:', admin._id);
  } else {
    console.log('Admin already exists:', admin._id);
  }

  console.log('\n✅ Done!');
  console.log('Email    : admin@bringbasket.com');
  console.log('Password : Admin@123');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
