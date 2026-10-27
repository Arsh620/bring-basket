const mongoose = require('mongoose');
const Warehouse = require('../../../models/warehouse/Warehouse');

const writableFields = [
  'name',
  'ownerName',
  'gstin',
  'code',
  'username',
  'type',
  'parentId',
  'phone',
  'email',
  'address',
  'city',
  'state',
  'zip',
  'country',
  'latitude',
  'longitude',
  'serviceRadiusKm',
  'status',
  'isDefault',
];

const pickWritableFields = (body) => {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  return Object.fromEntries(
    writableFields
      .filter((field) => Object.prototype.hasOwnProperty.call(source, field))
      .map((field) => [field, source[field]])
  );
};

const invalidId = (res) => res.status(400).json({
  success: false,
  message: 'Invalid warehouse ID',
});

exports.getAll = async (req, res, next) => {
  try {
    const filter = {};
    const { type, parentId, status, state } = req.query;
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (state) filter.state = state;
    if (parentId === 'null') filter.parentId = null;
    else if (parentId) {
      if (!mongoose.isValidObjectId(parentId)) {
        return res.status(400).json({ success: false, message: 'Invalid parent warehouse ID' });
      }
      filter.parentId = parentId;
    }

    const warehouses = await Warehouse.find(filter).sort({ name: 1 });
    res.json({ success: true, data: warehouses });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);

    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: warehouse });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const fields = pickWritableFields(req.body);
    if (!fields.name || !fields.code || !fields.state) {
      return res.status(400).json({
        success: false,
        message: 'Name, code and state are required',
      });
    }

    if (fields.parentId && !mongoose.isValidObjectId(fields.parentId)) {
      return res.status(400).json({ success: false, message: 'Invalid parent warehouse ID' });
    }

    const warehouse = await Warehouse.create(fields);
    res.status(201).json({ success: true, data: warehouse });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);

    const fields = pickWritableFields(req.body);
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }
    if (fields.parentId && !mongoose.isValidObjectId(fields.parentId)) {
      return res.status(400).json({ success: false, message: 'Invalid parent warehouse ID' });
    }
    if (fields.parentId && fields.parentId.toString() === req.params.id) {
      return res.status(400).json({ success: false, message: 'A warehouse cannot be its own parent' });
    }

    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) return res.status(404).json({ success: false, message: 'Not found' });

    Object.assign(warehouse, fields);
    await warehouse.save();
    res.json({ success: true, data: warehouse });
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
    if (typeof req.body?.status !== 'string' || !req.body.status.trim()) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) return res.status(404).json({ success: false, message: 'Not found' });
    warehouse.status = req.body.status.trim();
    await warehouse.save();
    res.json({ success: true, data: warehouse });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);

    const warehouse = await Warehouse.findByIdAndDelete(req.params.id);
    if (!warehouse) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};
