const PurchaseVendorProduct = require('../../models/purchase/PurchaseVendorProduct');
const PurchaseVendor = require('../../models/purchase/PurchaseVendor');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

const ALLOWED = ['itemId', 'itemName', 'sku', 'barcode', 'hsnSac', 'description', 'unit', 'rate', 'taxPercent', 'isActive'];

const getAll = async (vendorId, { search, isActive, page, limit: lim } = {}) => {
  const filter = { purchaseVendorId: vendorId };
  if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;
  if (search) filter.$or = [
    { itemName: { $regex: search, $options: 'i' } },
    { sku: { $regex: search, $options: 'i' } },
    { barcode: { $regex: search, $options: 'i' } },
  ];

  const { skip, page: pg, limit } = paginate({ page, limit: lim });
  const [products, total] = await Promise.all([
    PurchaseVendorProduct.find(filter).populate('itemId', 'name sku').sort({ createdAt: -1 }).skip(skip).limit(limit),
    PurchaseVendorProduct.countDocuments(filter),
  ]);
  return { products, total, page: pg, limit, pages: Math.ceil(total / limit) };
};

const getById = async (id, vendorId) => {
  const product = await PurchaseVendorProduct.findOne({ _id: id, purchaseVendorId: vendorId }).populate('itemId', 'name sku');
  if (!product) throw new AppError('Product not found', 404);
  return product;
};

const create = async (vendorId, body) => {
  if (!body.itemName && !body.itemId) throw new AppError('itemName or itemId is required', 400);
  const fields = Object.fromEntries(ALLOWED.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
  return PurchaseVendorProduct.create({ ...fields, purchaseVendorId: vendorId });
};

const update = async (id, vendorId, body) => {
  const fields = Object.fromEntries(ALLOWED.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
  if (!Object.keys(fields).length) throw new AppError('No valid fields to update', 400);
  const product = await PurchaseVendorProduct.findOneAndUpdate(
    { _id: id, purchaseVendorId: vendorId }, fields, { new: true }
  );
  if (!product) throw new AppError('Product not found', 404);
  return product;
};

const toggle = async (id, vendorId) => {
  const product = await PurchaseVendorProduct.findOne({ _id: id, purchaseVendorId: vendorId });
  if (!product) throw new AppError('Product not found', 404);
  product.isActive = !product.isActive;
  await product.save();
  return product;
};

const remove = async (id, vendorId) => {
  const product = await PurchaseVendorProduct.findOneAndDelete({ _id: id, purchaseVendorId: vendorId });
  if (!product) throw new AppError('Product not found', 404);
};

/** Bulk upsert by SKU — used by supplier CSV upload */
const bulkUpsert = async (vendorId, rows) => {
  const ops = rows.map((row) => ({
    updateOne: {
      filter: { purchaseVendorId: vendorId, sku: row.sku },
      update: { $set: { ...row, purchaseVendorId: vendorId } },
      upsert: true,
    },
  }));
  return PurchaseVendorProduct.bulkWrite(ops);
};

module.exports = { getAll, getById, create, update, toggle, remove, bulkUpsert };
