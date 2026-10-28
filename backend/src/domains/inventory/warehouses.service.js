const mongoose = require('mongoose');
const Warehouse = require('../../models/warehouse/Warehouse');
const AppError = require('../../utils/AppError');

const WRITABLE = [
  'name', 'ownerName', 'gstin', 'code', 'username', 'type', 'parentId',
  'phone', 'email', 'address', 'city', 'state', 'zip', 'country',
  'latitude', 'longitude', 'serviceRadiusKm', 'status', 'isDefault',
];

const pick = (body) => {
  const src = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  return Object.fromEntries(
    WRITABLE.filter((f) => Object.prototype.hasOwnProperty.call(src, f)).map((f) => [f, src[f]]),
  );
};

const validateId = (id, label = 'warehouse') => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${label} ID`, 400);
};

const getAll = async ({ type, parentId, status, state }) => {
  const filter = {};
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (state) filter.state = state;
  if (parentId === 'null') filter.parentId = null;
  else if (parentId) {
    validateId(parentId, 'parent warehouse');
    filter.parentId = parentId;
  }
  return Warehouse.find(filter).sort({ name: 1 });
};

const getOne = async (id) => {
  validateId(id);
  const warehouse = await Warehouse.findById(id);
  if (!warehouse) throw new AppError('Not found', 404);
  return warehouse;
};

const create = async (body) => {
  const fields = pick(body);
  if (!fields.name || !fields.code || !fields.state)
    throw new AppError('Name, code and state are required', 400);
  if (fields.parentId) validateId(fields.parentId, 'parent warehouse');
  return Warehouse.create(fields);
};

const update = async (id, body) => {
  validateId(id);
  const fields = pick(body);
  if (!Object.keys(fields).length) throw new AppError('No valid fields to update', 400);
  if (fields.parentId) {
    validateId(fields.parentId, 'parent warehouse');
    if (fields.parentId.toString() === id) throw new AppError('A warehouse cannot be its own parent', 400);
  }
  const warehouse = await Warehouse.findById(id);
  if (!warehouse) throw new AppError('Not found', 404);
  Object.assign(warehouse, fields);
  await warehouse.save();
  return warehouse;
};

const updateStatus = async (id, status) => {
  validateId(id);
  if (typeof status !== 'string' || !status.trim()) throw new AppError('Status is required', 400);
  const warehouse = await Warehouse.findById(id);
  if (!warehouse) throw new AppError('Not found', 404);
  warehouse.status = status.trim();
  await warehouse.save();
  return warehouse;
};

const remove = async (id) => {
  validateId(id);
  const warehouse = await Warehouse.findByIdAndDelete(id);
  if (!warehouse) throw new AppError('Not found', 404);
};

module.exports = { getAll, getOne, create, update, updateStatus, remove };
