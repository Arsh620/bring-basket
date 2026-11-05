const mongoose = require('mongoose');
const PurchaseVendor = require('../../models/purchase/PurchaseVendor');
const PurchaseOrder = require('../../models/purchase/PurchaseOrder');
const PurchaseBill = require('../../models/purchase/PurchaseBill');
const PurchasePayment = require('../../models/purchase/PurchasePayment');
const PurchaseReturn = require('../../models/purchase/PurchaseReturn');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');

const WRITABLE_FIELDS = [
  'salutation', 'firstName', 'lastName', 'displayName', 'legalName', 'email',
  'mobile', 'workPhone', 'currency', 'gstTreatment', 'gstin', 'pan',
  'sourceOfSupply', 'state', 'warehouseId', 'language', 'paymentTerms',
  'msmeRegistered', 'tds', 'photo', 'openingBalance', 'openingBalanceType',
  'notes', 'addresses', 'banks', 'contacts',
];

const pick = (body, fields) => Object.fromEntries(
  fields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]),
);

const validateId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid purchase vendor ID', 400);
};

const validateProfile = (fields, { requireName = false } = {}) => {
  if (requireName && (typeof fields.displayName !== 'string' || !fields.displayName.trim())) {
    throw new AppError('displayName is required', 400);
  }
  if (fields.displayName !== undefined
    && (typeof fields.displayName !== 'string' || !fields.displayName.trim())) {
    throw new AppError('displayName must be a non-empty string', 400);
  }
  if (fields.email !== undefined
    && (typeof fields.email !== 'string' || (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)))) {
    throw new AppError('email must be valid', 400);
  }
  if (fields.state !== undefined
    && (typeof fields.state !== 'string' || !fields.state.trim())) {
    throw new AppError('state must be a non-empty string', 400);
  }
  if (fields.warehouseId && !mongoose.isValidObjectId(fields.warehouseId)) {
    throw new AppError('warehouseId must be a valid ID', 400);
  }
  if (fields.openingBalance !== undefined
    && (!Number.isFinite(Number(fields.openingBalance)) || Number(fields.openingBalance) < 0)) {
    throw new AppError('openingBalance must be a non-negative number', 400);
  }
  if (fields.openingBalanceType !== undefined
    && !['cr', 'dr'].includes(fields.openingBalanceType)) {
    throw new AppError('openingBalanceType must be cr or dr', 400);
  }
  if (fields.addresses !== undefined && !Array.isArray(fields.addresses)) {
    throw new AppError('addresses must be an array', 400);
  }
  if (fields.banks !== undefined && !Array.isArray(fields.banks)) {
    throw new AppError('banks must be an array', 400);
  }
  if (fields.contacts !== undefined && !Array.isArray(fields.contacts)) {
    throw new AppError('contacts must be an array', 400);
  }
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getAll = async (query) => {
  const { page, limit, skip } = paginate(query);
  const filter = {};
  const approval = query.approval || query.approvalStatus;
  const search = query.search || query.searchValue;

  if (approval && approval !== 'all') {
    if (!['pending', 'approved', 'rejected'].includes(approval)) {
      throw new AppError('approval must be pending, approved, rejected, or all', 400);
    }
    filter.approvalStatus = approval;
  }
  if (query.status !== undefined) {
    if (!['true', 'false'].includes(query.status)) {
      throw new AppError('status must be true or false', 400);
    }
    filter.status = query.status === 'true';
  }
  if (query.warehouseId) {
    if (!mongoose.isValidObjectId(query.warehouseId)) {
      throw new AppError('Invalid warehouse ID', 400);
    }
    filter.warehouseId = query.warehouseId;
  }
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = ['displayName', 'legalName', 'email', 'gstin', 'mobile']
      .map((field) => ({ [field]: pattern }));
  }

  const [vendors, total] = await Promise.all([
    PurchaseVendor.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ approvalStatus: 1, displayName: 1 }),
    PurchaseVendor.countDocuments(filter),
  ]);
  return {
    vendors,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

const getOne = async (id) => {
  validateId(id);
  const vendor = await PurchaseVendor.findById(id);
  if (!vendor) throw new AppError('Purchase vendor not found', 404);
  return vendor;
};

const create = async (body) => {
  const fields = pick(body, WRITABLE_FIELDS);
  if (typeof fields.state !== 'string' || !fields.state.trim()) {
    throw new AppError('state is required', 400);
  }
  validateProfile(fields, { requireName: true });
  return PurchaseVendor.create(fields);
};

const update = async (id, body) => {
  validateId(id);
  const fields = pick(body, WRITABLE_FIELDS);
  if (!Object.keys(fields).length) throw new AppError('No valid fields to update', 400);
  validateProfile(fields);
  const vendor = await PurchaseVendor.findByIdAndUpdate(id, fields, {
    new: true,
    runValidators: true,
  });
  if (!vendor) throw new AppError('Purchase vendor not found', 404);
  return vendor;
};

const updateStatus = async (id, status) => {
  validateId(id);
  if (typeof status !== 'boolean') throw new AppError('status (boolean) is required', 400);
  const vendor = await PurchaseVendor.findByIdAndUpdate(id, { status }, { new: true });
  if (!vendor) throw new AppError('Purchase vendor not found', 404);
  return vendor;
};

const updateApproval = async (id, approvalStatus) => {
  validateId(id);
  if (!['approved', 'rejected'].includes(approvalStatus)) {
    throw new AppError('approvalStatus must be approved or rejected', 400);
  }
  const updateFields = { approvalStatus };
  if (approvalStatus === 'approved') {
    updateFields.portalStatus = 'enabled';
    updateFields.status = true;
  }
  const vendor = await PurchaseVendor.findByIdAndUpdate(id, updateFields, { new: true });
  if (!vendor) throw new AppError('Purchase vendor not found', 404);
  return vendor;
};

const remove = async (id) => {
  validateId(id);
  const vendor = await PurchaseVendor.findById(id);
  if (!vendor) throw new AppError('Purchase vendor not found', 404);

  const [hasOrders, hasBills, hasPayments, hasReturns] = await Promise.all([
    PurchaseOrder.exists({ purchaseVendorId: id }),
    PurchaseBill.exists({ purchaseVendorId: id }),
    PurchasePayment.exists({ purchaseVendorId: id }),
    PurchaseReturn.exists({ purchaseVendorId: id }),
  ]);
  if (hasOrders || hasBills || hasPayments || hasReturns) {
    throw new AppError('Cannot delete a purchase vendor with purchase records', 409);
  }

  await vendor.deleteOne();
};

module.exports = {
  getAll,
  getOne,
  create,
  update,
  updateStatus,
  updateApproval,
  remove,
};
