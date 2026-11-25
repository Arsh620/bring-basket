const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
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

const applyPortalCredentials = async (warehouse, { username, password }) => {
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(username.trim())) {
    throw new AppError('Use 1–100 letters, numbers, hyphens or underscores for the username', 400);
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 50 || Buffer.byteLength(password) > 72) {
    throw new AppError('Use a password between 6 and 50 characters and no more than 72 bytes', 400);
  }

  warehouse.username = username.trim();
  warehouse.passwordHash = await bcrypt.hash(password, 10);
};

const saveWarehouse = async (persist) => {
  try {
    return await persist();
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.username) throw new AppError('Username already taken', 409);
    throw error;
  }
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
  if (body?.password) await applyPortalCredentials(fields, { username: fields.username, password: body.password });
  return saveWarehouse(() => Warehouse.create(fields));
};

const update = async (id, body) => {
  validateId(id);
  const fields = pick(body);
  if (!Object.keys(fields).length && !body?.password) throw new AppError('No valid fields to update', 400);
  if (fields.parentId) {
    validateId(fields.parentId, 'parent warehouse');
    if (fields.parentId.toString() === id) throw new AppError('A warehouse cannot be its own parent', 400);
  }
  const warehouse = await Warehouse.findById(id);
  if (!warehouse) throw new AppError('Not found', 404);
  Object.assign(warehouse, fields);
  if (body?.password) await applyPortalCredentials(warehouse, { username: warehouse.username, password: body.password });
  await saveWarehouse(() => warehouse.save());
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

module.exports = { getAll, getOne, create, update, updateStatus, remove, applyPortalCredentials, saveWarehouse };
