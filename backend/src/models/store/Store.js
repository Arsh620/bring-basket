const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  day:         { type: Number, required: true }, // 0=Sun, 6=Sat
  openingTime: { type: String },
  closingTime: { type: String },
}, { _id: false });

const storeConfigSchema = new mongoose.Schema({
  isRecommended:          { type: Boolean, default: false },
  halalTagStatus:         { type: Boolean, default: false },
  extraPackagingStatus:   { type: Boolean, default: false },
  extraPackagingAmount:   { type: Number, default: 0 },
  minimumStockForWarning: { type: Number, default: 0 },
  pineLabsEnabled:        { type: Boolean, default: false },
  pineLabsMerchantId:     { type: String },
  pineLabsStoreId:        { type: String },
  pineLabsClientId:       { type: String },
  pineLabsSecurityToken:  { type: String },
  pineLabsDeviceSerial:   { type: String },
  pineLabsBaseUrl:        { type: String },
}, { _id: false });

const storeSchema = new mongoose.Schema({
  name:                       { type: String, required: true, trim: true },
  phone:                      { type: String, required: true, unique: true, trim: true },
  email:                      { type: String, lowercase: true, trim: true },
  logo:                       { type: String },
  coverPhoto:                 { type: String },
  address:                    { type: String },
  latitude:                   { type: String },
  longitude:                  { type: String },
  footerText:                 { type: String },
  gst:                        { type: String },
  slug:                       { type: String },
  vendorId:                   { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  moduleId:                   { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
  zoneId:                     { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
  packageId:                  { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPackage' },
  minimumOrder:               { type: Number, default: 0 },
  comission:                  { type: Number },
  tax:                        { type: Number, default: 0 },
  minimumShippingCharge:      { type: Number, default: 0 },
  maximumShippingCharge:      { type: Number },
  perKmShippingCharge:        { type: Number, default: 0 },
  deliveryTime:               { type: String, default: '30-40' },
  status:                     { type: Boolean, default: true },
  active:                     { type: Boolean, default: true },
  featured:                   { type: Boolean, default: false },
  delivery:                   { type: Boolean, default: true },
  takeAway:                   { type: Boolean, default: true },
  freeDelivery:               { type: Boolean, default: false },
  scheduleOrder:              { type: Boolean, default: false },
  selfDeliverySystem:         { type: Boolean, default: false },
  posSystem:                  { type: Boolean, default: false },
  prescriptionOrder:          { type: Boolean, default: false },
  veg:                        { type: Boolean, default: true },
  nonVeg:                     { type: Boolean, default: true },
  cutlery:                    { type: Boolean, default: false },
  announcement:               { type: Boolean, default: false },
  announcementMessage:        { type: String },
  orderCount:                 { type: Number, default: 0 },
  totalOrder:                 { type: Number, default: 0 },
  rating:                     { type: String },
  offDay:                     { type: String, default: '' },
  storeBusinessModel:         { type: String, enum: ['none', 'commission', 'subscription', 'unsubscribed'], default: 'commission' },
  metaTitle:                  { type: String },
  metaDescription:            { type: String },
  metaImage:                  { type: String },
  comment:                    { type: String },
  orderPlaceToScheduleInterval: { type: Number, default: 0 },
  // Embedded
  schedule:                   [scheduleSchema],
  config:                     { type: storeConfigSchema, default: () => ({}) },
  expiryMarkdownRules: [{
    daysBeforeExpiry: { type: Number },
    discountPercent:  { type: Number },
    isActive:         { type: Boolean, default: true },
  }],
}, { timestamps: true });

storeSchema.index({ moduleId: 1 });
storeSchema.index({ zoneId: 1 });
storeSchema.index({ vendorId: 1 });

module.exports = mongoose.models.Store || mongoose.model('Store', storeSchema);
