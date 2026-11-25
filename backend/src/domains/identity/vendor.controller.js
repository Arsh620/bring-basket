const mongoose = require('mongoose');
const Vendor = require('../../models/auth/Vendor');
const VendorEmployee = require('../../models/auth/VendorEmployee');
const Store = require('../../models/store/Store');
const Item = require('../../models/catalog/Item');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');
const { normalizeModules } = require('./employee-role-permissions');

// GET /vendor/profile
exports.getProfile = async (req, res, next) => {
  try {
    const context = req.vendorContext;
    const profile = context.isEmployee
      ? context.employee.toObject()
      : await Vendor.findById(context.vendorId).lean();
    if (!profile) return error(res, 'Not found', 404);
    delete profile.password;
    if (context.isEmployee) {
      profile.isEmployee = true;
      profile.modules = normalizeModules(context.role.modules);
    }
    const stores = await Store.find({ _id: { $in: context.storeIds }, status: true })
      .select('_id name logo orderCount rating')
      .lean();
    return success(res, { ...profile, stores });
  } catch (err) { next(err); }
};

// PUT /vendor/update-profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { fName, lName, image, firebaseToken, bankName, branch, holderName, accountNo } = req.body;
    if (req.vendorContext.isEmployee) {
      const employee = await VendorEmployee.findByIdAndUpdate(
        req.user.id,
        { fName, lName, image },
        { new: true },
      ).select('-password');
      return success(res, employee);
    }
    const vendor = await Vendor.findByIdAndUpdate(
      req.vendorContext.vendorId,
      { fName, lName, image, firebaseToken, bankName, branch, holderName, accountNo },
      { new: true },
    );
    return success(res, vendor);
  } catch (err) { next(err); }
};

// GET /vendor/items?storeId=&limit=&page=
exports.getItems = async (req, res, next) => {
  try {
    const storeIds = req.vendorContext.storeIds;
    const filter = { storeId: { $in: storeIds } };
    if (req.query.storeId) {
      if (!mongoose.isValidObjectId(req.query.storeId)) return error(res, 'Invalid store ID', 400);
      if (!storeIds.some((id) => String(id) === String(req.query.storeId))) return error(res, 'Store not found', 403);
      filter.storeId = new mongoose.Types.ObjectId(req.query.storeId);
    }
    const search = String(req.query.search || '').trim().slice(0, 100);
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matcher = new RegExp(escaped, 'i');
      filter.$or = [{ name: matcher }, { sku: matcher }, { barcode: matcher }];
    }
    const { skip, page, limit } = paginate(req.query);
    const [items, total] = await Promise.all([
      Item.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Item.countDocuments(filter),
    ]);
    return paginated(res, items, total, page, limit);
  } catch (err) { next(err); }
};

// POST /vendor/items
exports.createItem = async (req, res, next) => {
  try {
    const storeIds = req.vendorContext.storeIds.map(String);
    if (!storeIds.includes(String(req.body.storeId))) return error(res, 'Store not found', 403);
    const item = await Item.create({ ...req.body, storeId: String(req.body.storeId) });
    return success(res, item, 'Item created', 201);
  } catch (err) { next(err); }
};

// PUT /vendor/items/:id
exports.updateItem = async (req, res, next) => {
  try {
    const storeIds = req.vendorContext.storeIds;
    const item = await Item.findOne({ _id: req.params.id, storeId: { $in: storeIds } });
    if (!item) return error(res, 'Item not found', 404);
    const updates = { ...req.body };
    delete updates.storeId;
    delete updates.vendorId;
    Object.assign(item, updates);
    await item.save();
    return success(res, item);
  } catch (err) { next(err); }
};

// PATCH /vendor/items/:id/status
exports.updateItemStatus = async (req, res, next) => {
  try {
    if (typeof req.body.status !== 'boolean') return error(res, 'status must be a boolean', 400);
    const storeIds = req.vendorContext.storeIds;
    const item = await Item.findOneAndUpdate({ _id: req.params.id, storeId: { $in: storeIds } }, { status: req.body.status }, { new: true });
    if (!item) return error(res, 'Item not found', 404);
    return success(res, item);
  } catch (err) { next(err); }
};

// DELETE /vendor/items/:id
exports.deleteItem = async (req, res, next) => {
  try {
    const storeIds = req.vendorContext.storeIds;
    const item = await Item.findOneAndDelete({ _id: req.params.id, storeId: { $in: storeIds } });
    if (!item) return error(res, 'Item not found', 404);
    return success(res, null, 'Item deleted');
  } catch (err) { next(err); }
};

// GET /vendor/stores
exports.getStores = async (req, res, next) => {
  try {
    const stores = await Store.find({ _id: { $in: req.vendorContext.storeIds } }).lean();
    return success(res, stores);
  } catch (err) { next(err); }
};

// PUT /vendor/update-fcm-token
exports.updateFcmToken = async (req, res, next) => {
  try {
    if (!req.body.fcm_token) return error(res, 'fcm_token required', 400);
    if (req.vendorContext.isEmployee) {
      await VendorEmployee.findByIdAndUpdate(req.user.id, { firebaseToken: req.body.fcm_token });
    } else {
      await Vendor.findByIdAndUpdate(req.vendorContext.vendorId, { firebaseToken: req.body.fcm_token });
    }
    return success(res, null, 'Token updated');
  } catch (err) { next(err); }
};
