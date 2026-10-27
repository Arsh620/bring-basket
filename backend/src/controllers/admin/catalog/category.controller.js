const mongoose = require('mongoose');
const Category = require('../../../models/catalog/Category');

const normalizeStatus = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return null;
};

exports.getAll = async (req, res, next) => {
  try {
    const { moduleId, parentId, status } = req.query;
    const filter = {};

    if (moduleId) {
      if (!mongoose.isValidObjectId(moduleId)) {
        return res.status(400).json({ success: false, message: 'Invalid module ID' });
      }
      filter.moduleId = moduleId;
    }

    if (parentId === 'null') {
      filter.parentId = null;
    } else if (parentId) {
      if (!mongoose.isValidObjectId(parentId)) {
        return res.status(400).json({ success: false, message: 'Invalid parent category ID' });
      }
      filter.parentId = parentId;
    }

    if (status !== undefined) {
      filter.status = normalizeStatus(status) ?? false;
    }

    const categories = await Category.find(filter).sort({ priority: 1 });
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid category ID' });
    }

    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const category = await Category.create(req.body);
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid category ID' });
    }

    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid category ID' });
    }

    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid category ID' });
    }

    const status = normalizeStatus(req.body?.status);
    if (status === null) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const category = await Category.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!category) return res.status(404).json({ success: false, message: 'Not found' });

    res.json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
};
