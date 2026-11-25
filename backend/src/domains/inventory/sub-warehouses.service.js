const mongoose = require('mongoose');
const Warehouse = require('../../models/warehouse/Warehouse');
const WarehouseItemStock = require('../../models/warehouse/WarehouseItemStock');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');
const { applyPortalCredentials, saveWarehouse } = require('./warehouses.service');

const WRITABLE = [
  'name', 'ownerName', 'gstin', 'phone', 'email',
  'address', 'city', 'state', 'zip', 'country',
  'latitude', 'longitude', 'serviceRadiusKm',
];

const pick = (body) => Object.fromEntries(
  WRITABLE.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]),
);

const validateId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid warehouse ID', 400);
};

// List all subs of a mother warehouse
const getAll = async (motherWarehouseId, query = {}) => {
  validateId(motherWarehouseId);
  const filter = { parentId: motherWarehouseId, type: 'sub' };
  if (query.status) filter.status = query.status;

  const { skip, page, limit } = paginate(query);
  const [subs, total] = await Promise.all([
    Warehouse.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Warehouse.countDocuments(filter),
  ]);
  return { subs, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
};

// Get one sub (must belong to this mother)
const getOne = async (motherWarehouseId, subId) => {
  validateId(motherWarehouseId);
  validateId(subId);
  const sub = await Warehouse.findOne({ _id: subId, parentId: motherWarehouseId, type: 'sub' });
  if (!sub) throw new AppError('Sub-warehouse not found', 404);
  return sub;
};

// Create a sub under this mother
const create = async (motherWarehouseId, body) => {
  validateId(motherWarehouseId);
  const mother = await Warehouse.findOne({ _id: motherWarehouseId, type: 'mother' });
  if (!mother) throw new AppError('Mother warehouse not found', 404);

  const fields = pick(body);
  if (!fields.name?.trim()) throw new AppError('name is required', 400);
  if (!fields.state?.trim()) throw new AppError('state is required', 400);

  // Auto-generate code: motherCode + sequential suffix
  const existingCount = await Warehouse.countDocuments({ parentId: motherWarehouseId, type: 'sub' });
  const code = `${mother.code}-S${String(existingCount + 1).padStart(2, '0')}`;

  const sub = await Warehouse.create({
    ...fields,
    code,
    type: 'sub',
    parentId: motherWarehouseId,
    status: 'active',
  });
  return sub;
};

// Update sub details
const update = async (motherWarehouseId, subId, body) => {
  validateId(motherWarehouseId);
  validateId(subId);
  const sub = await Warehouse.findOne({ _id: subId, parentId: motherWarehouseId, type: 'sub' });
  if (!sub) throw new AppError('Sub-warehouse not found', 404);

  const fields = pick(body);
  if (!Object.keys(fields).length) throw new AppError('No valid fields to update', 400);
  Object.assign(sub, fields);
  await sub.save();
  return sub;
};

// Toggle status active/inactive
const updateStatus = async (motherWarehouseId, subId, status) => {
  validateId(motherWarehouseId);
  validateId(subId);
  if (!['active', 'inactive'].includes(status)) throw new AppError('status must be active or inactive', 400);
  const sub = await Warehouse.findOne({ _id: subId, parentId: motherWarehouseId, type: 'sub' });
  if (!sub) throw new AppError('Sub-warehouse not found', 404);
  sub.status = status;
  await sub.save();
  return sub;
};

// Set/reset portal credentials for a sub
const setCredentials = async (motherWarehouseId, subId, { username, password }) => {
  validateId(motherWarehouseId);
  validateId(subId);
  const sub = await Warehouse.findOne({ _id: subId, parentId: motherWarehouseId, type: 'sub' });
  if (!sub) throw new AppError('Sub-warehouse not found', 404);

  await applyPortalCredentials(sub, { username, password });
  await saveWarehouse(() => sub.save());
  return sub;
};

// Get stock of a sub (mother can view)
const getStock = async (motherWarehouseId, subId, query = {}) => {
  validateId(motherWarehouseId);
  validateId(subId);
  const sub = await Warehouse.findOne({ _id: subId, parentId: motherWarehouseId, type: 'sub' });
  if (!sub) throw new AppError('Sub-warehouse not found', 404);

  const filter = { warehouseId: subId };
  if (query.itemId) filter.itemId = query.itemId;

  const { skip, page, limit } = paginate(query);
  const [stock, total] = await Promise.all([
    WarehouseItemStock.find(filter)
      .populate('itemId', 'name sku barcode')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    WarehouseItemStock.countDocuments(filter),
  ]);
  return { stock, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
};

module.exports = { getAll, getOne, create, update, updateStatus, setCredentials, getStock };
