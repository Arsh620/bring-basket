const mongoose = require('mongoose');
const Warehouse = require('../models/warehouse/Warehouse');
const WarehouseStockTransfer = require('../models/warehouse/WarehouseStockTransfer');
const StoreStockRequest = require('../models/warehouse/StoreStockRequest');
const { error } = require('../utils/response');

exports.requireWarehouseType = (...types) => (req, res, next) => {
  if (!req.warehouse || !types.includes(req.warehouse.type)) return error(res, 'Access denied', 403);
  return next();
};

exports.scopeTransfers = (req, res, next) => {
  const warehouse = req.warehouse;
  if (!warehouse?._id || !['mother', 'sub'].includes(warehouse.type)) return error(res, 'Access denied', 403);
  const scopeKey = warehouse.type === 'mother' ? 'motherWarehouseId' : 'subWarehouseId';
  req.warehouseQuery = { ...req.query, motherWarehouseId: undefined, subWarehouseId: undefined, [scopeKey]: String(warehouse._id) };
  return next();
};

exports.requireSubMother = async (req, res, next) => {
  try {
    const warehouse = req.warehouse;
    if (warehouse?.type !== 'sub' || !warehouse.parentId) return error(res, 'Access denied', 403);
    const mother = await Warehouse.findOne({ _id: warehouse.parentId, type: 'mother', status: 'active' });
    if (!mother) return error(res, 'Access denied', 403);
    req.body = req.body || {};
    req.body.motherWarehouseId = mother._id;
    req.body.subWarehouseId = warehouse._id;
    return next();
  } catch (err) { next(err); }
};

exports.requireTransferParty = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid transfer ID', 400);
    const transfer = await WarehouseStockTransfer.findById(req.params.id);
    if (!transfer) return error(res, 'Not found', 404);
    const id = String(req.warehouse?._id || '');
    if (id !== String(transfer.motherWarehouseId) && id !== String(transfer.subWarehouseId)) {
      return error(res, 'Not found', 404);
    }
    req.warehouseTransfer = transfer;
    return next();
  } catch (err) { next(err); }
};

exports.requireTransferDestination = (req, res, next) => {
  const transfer = req.warehouseTransfer;
  const destinationId = transfer?.type === 'return' ? transfer?.motherWarehouseId : transfer?.subWarehouseId;
  if (!transfer || String(destinationId) !== String(req.warehouse?._id)) return error(res, 'Access denied', 403);
  return next();
};

exports.scopeStoreRequests = (req, res, next) => {
  if (req.warehouse?.type !== 'mother') return error(res, 'Access denied', 403);
  req.warehouseQuery = { ...req.query, motherWarehouseId: String(req.warehouse._id) };
  return next();
};

exports.requireStoreRequestParty = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return error(res, 'Invalid request ID', 400);
    const stockRequest = await StoreStockRequest.findOne({ _id: req.params.id, motherWarehouseId: req.warehouse?._id });
    if (!stockRequest) return error(res, 'Not found', 404);
    return next();
  } catch (err) { next(err); }
};

exports.scopeStockMovements = async (req, res, next) => {
  try {
    const warehouse = req.warehouse;
    if (!warehouse?._id || !['mother', 'sub'].includes(warehouse.type)) return error(res, 'Access denied', 403);
    const requestedId = req.query.warehouseId;
    if (!requestedId || String(requestedId) === String(warehouse._id)) {
      req.warehouseQuery = { ...req.query, warehouseId: String(warehouse._id) };
      return next();
    }
    if (warehouse.type !== 'mother' || !mongoose.isValidObjectId(requestedId)) return error(res, 'Access denied', 403);
    const child = await Warehouse.exists({ _id: requestedId, parentId: warehouse._id, type: 'sub' });
    if (!child) return error(res, 'Access denied', 403);
    req.warehouseQuery = { ...req.query, warehouseId: String(requestedId) };
    return next();
  } catch (err) { next(err); }
};
