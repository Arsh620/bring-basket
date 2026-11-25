const h = '$2b$10$4pIob/jGTrfp5Sirlmh.Ie/Fd0L3yGE6B527LhVCRCofgxqdakAdq';
const db2 = db.getSiblingDB('bring_basket');

// Warehouse uses passwordHash field
const wh = db2.warehouses.updateMany({}, { $set: { passwordHash: h } });
print('warehouses passwordHash updated:', wh.modifiedCount);

// Check supplier password field name
const sup = db2.purchasevendors.findOne({}, { password: 1, passwordHash: 1, _id: 0 });
print('supplier fields:', JSON.stringify(sup));

// Deliveryman check
const dm = db2.deliverymen.findOne({ status: 1 }, { email: 1, password: 1, _id: 0 });
print('deliveryman:', JSON.stringify(dm));

// Customer check
const usr = db2.users.findOne({ status: 1 }, { email: 1, password: 1, _id: 0 });
print('customer:', JSON.stringify(usr));
