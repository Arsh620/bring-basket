const mongoose = require('mongoose');
const Unit = require('../../../models/catalog/Unit');

exports.getAll = async (req, res, next) => {
  try {
    const units = await Unit.find().sort({ unit: 1 });
    res.json({ success: true, data: units });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid unit ID' });
    }

    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: unit });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const unitName = typeof req.body?.unit === 'string' ? req.body.unit.trim() : '';
    if (!unitName) {
      return res.status(400).json({ success: false, message: 'Unit name is required' });
    }

    const unit = await Unit.create({ unit: unitName });
    res.status(201).json({ success: true, data: unit });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid unit ID' });
    }

    const unitName = typeof req.body?.unit === 'string' ? req.body.unit.trim() : '';
    if (!unitName) {
      return res.status(400).json({ success: false, message: 'Unit name is required' });
    }

    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ success: false, message: 'Not found' });
    unit.unit = unitName;
    await unit.save();
    res.json({ success: true, data: unit });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid unit ID' });
    }

    const unit = await Unit.findByIdAndDelete(req.params.id);
    if (!unit) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};
