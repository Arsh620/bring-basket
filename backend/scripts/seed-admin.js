require('dotenv').config();
const mongoose = require('mongoose');
const AdminRole = require('../src/models/auth/AdminRole');
const Admin = require('../src/models/auth/Admin');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Reuse the Laravel primary role so the admin login portal can identify it.
  let role = await AdminRole.findOne({ legacyId: 1 });
  if (!role) {
    role = await AdminRole.findOne({ name: /^Super Admin$/i });
    if (role) {
      role.legacyId = 1;
      await role.save();
    } else {
      role = await AdminRole.create({ legacyId: 1, name: 'Master admin', modules: '[]', status: true });
    }
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
    let assignedRole = admin.roleId;
    if (typeof assignedRole === 'number' || (typeof assignedRole === 'string' && /^\d+$/.test(assignedRole))) {
      assignedRole = await AdminRole.findOne({ legacyId: Number(assignedRole) });
    } else if (mongoose.isValidObjectId(assignedRole)) {
      assignedRole = await AdminRole.findById(assignedRole);
    } else {
      assignedRole = null;
    }
    if (Number(assignedRole?.legacyId) !== 1) {
      admin.roleId = role._id;
      await admin.save();
      console.log('Existing admin linked to primary role:', admin._id);
    }
    console.log('Admin already exists:', admin._id);
  }

  console.log('\n✅ Done!');
  console.log('Email    : admin@bringbasket.com');
  console.log('Password : Admin@123');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
