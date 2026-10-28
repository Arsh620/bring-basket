const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  type:         { type: String, default: 'billing' }, // billing | shipping
  attention:    { type: String },
  addressLine1: { type: String },
  addressLine2: { type: String },
  city:         { type: String },
  state:        { type: String },
  zip:          { type: String },
  country:      { type: String, default: 'India' },
  phone:        { type: String },
  isDefault:    { type: Boolean, default: false },
}, { _id: true });

const bankSchema = new mongoose.Schema({
  accountHolderName: { type: String },
  bankName:          { type: String },
  accountNumber:     { type: String },
  ifsc:              { type: String },
  branch:            { type: String },
  isPrimary:         { type: Boolean, default: false },
}, { _id: true });

const contactSchema = new mongoose.Schema({
  salutation: { type: String },
  firstName:  { type: String },
  lastName:   { type: String },
  email:      { type: String },
  workPhone:  { type: String },
  mobile:     { type: String },
}, { _id: true });

const purchaseVendorSchema = new mongoose.Schema({
  legacyId:           { type: Number },
  salutation:         { type: String },
  firstName:          { type: String },
  lastName:           { type: String },
  displayName:        { type: String, required: true, trim: true },
  legalName:          { type: String },
  email:              { type: String, lowercase: true, trim: true },
  mobile:             { type: String, maxlength: 30 },
  workPhone:          { type: String, maxlength: 30 },
  currency:           { type: String, default: 'INR', maxlength: 10 },
  gstTreatment:       { type: String },
  gstin:              { type: String, maxlength: 20 },
  pan:                { type: String, maxlength: 20 },
  sourceOfSupply:     { type: String },
  state:              { type: String, maxlength: 100 },
  warehouseId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
  language:           { type: String, default: 'English' },
  paymentTerms:       { type: String },
  msmeRegistered:     { type: Boolean, default: false },
  tds:                { type: String },
  portalStatus:       { type: String, enum: ['enabled', 'disabled'], default: 'disabled' },
  approvalStatus:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  photo:              { type: String },
  openingBalance:     { type: Number, default: 0 },
  openingBalanceType: { type: String, enum: ['cr', 'dr'], default: 'cr' },
  status:             { type: Boolean, default: true },
  notes:              { type: String },
  password:           { type: String, select: false },
  passwordSetAt:      { type: Date },
  // Embedded
  addresses:  [addressSchema],
  banks:      [bankSchema],
  contacts:   [contactSchema],
}, { timestamps: true });

purchaseVendorSchema.index({ legacyId: 1 }, { unique: true, sparse: true });
purchaseVendorSchema.index({ email: 1 }, { sparse: true });
purchaseVendorSchema.index({ state: 1 });
purchaseVendorSchema.index({ warehouseId: 1 });
purchaseVendorSchema.index({ approvalStatus: 1, status: 1 });

module.exports = mongoose.models.PurchaseVendor || mongoose.model('PurchaseVendor', purchaseVendorSchema);
