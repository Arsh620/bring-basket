const Brand = require('../../models/catalog/Brand');

exports.getAll = () => Brand.find({ status: true });

exports.create = (body) => Brand.create(body);

exports.update = (id, body) => Brand.findByIdAndUpdate(id, body, { new: true });

exports.remove = (id) => Brand.findByIdAndDelete(id);

exports.updateStatus = (id, status) => Brand.findByIdAndUpdate(id, { status }, { new: true });
