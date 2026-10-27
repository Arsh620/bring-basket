const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  legacyId: { type: Number },
  name: { type: String, required: true },
  brand: { type: String },
  description: { type: String },
  image: { type: String },
  images: [{ type: String }],
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  promotionCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
  unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit' },
  unitGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'UnitGroup' },
  stockUnit: { type: String, maxlength: 32 },
  price: { type: Number, default: 0 },
  mrp: { type: Number },
  purchasePrice: { type: Number, default: 0 },
  offerBuyQty: { type: Number, min: 0 },
  offerGetQty: { type: Number, min: 0 },
  offerGetDiscount: { type: Number, min: 0, max: 100, default: 100 },
  offerAllowSingle: { type: Boolean, default: true },
  margin: { type: Number, default: 0 },
  trackBatch: { type: Boolean, default: false },
  isPerishable: { type: Boolean, default: false },
  defaultShelfLifeDays: { type: Number, min: 0 },
  tax: { type: Number, default: 0 },
  taxType: { type: String, enum: ['percent', 'flat'], default: 'percent' },
  discount: { type: Number, default: 0 },
  discountType: { type: String, enum: ['percent', 'flat'], default: 'percent' },
  stock: { type: Number, default: 0 },
  barcode: { type: String },
  sku: { type: String },
  slug: { type: String },
  attributes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attribute' }],
  availableTimeStarts: { type: String },
  availableTimeEnds: { type: String },
  status: { type: Boolean, default: true },
  isApproved: { type: Boolean, default: true },
  isHalal: { type: Boolean, default: false },
  organic: { type: Boolean, default: false },
  recommended: { type: Boolean, default: false },
  veg: { type: Boolean, default: false },
  maximumCartQuantity: { type: Number },
  rating: { type: String },
  orderCount: { type: Number, default: 0 },
  avgRating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  nutritions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Nutrition' }],
  allergies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Allergy' }],
  tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
  genericNames: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GenericName' }],
  variations: { type: mongoose.Schema.Types.Mixed },
  foodVariations: { type: mongoose.Schema.Types.Mixed },
  choiceOptions: { type: mongoose.Schema.Types.Mixed },
  addOns: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AddOn' }],
}, { timestamps: true });

itemSchema.index(
  { storeId: 1, barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: 'string', $gt: '' } } }
);
itemSchema.index(
  { storeId: 1, sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $type: 'string', $gt: '' } } }
);
itemSchema.index({ categoryId: 1 });
itemSchema.index({ status: 1, isApproved: 1, storeId: 1 });
itemSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Item', itemSchema);
