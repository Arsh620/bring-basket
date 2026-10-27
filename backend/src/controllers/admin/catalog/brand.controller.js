const Brand = require('../../../models/catalog/Brand');

exports.getAll = async (req, res, next) => {
  try {
    const brands = await Brand.find({ status: true });
    res.json({ success: true, data: brands });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const brand = await Brand.create(req.body);
    res.status(201).json({ success: true, data: brand });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const brand = await Brand.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!brand) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: brand });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await Brand.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const brand = await Brand.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json({ success: true, data: brand });
  } catch (err) { next(err); }
};
