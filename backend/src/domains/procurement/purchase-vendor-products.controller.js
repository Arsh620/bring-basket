const svc = require('./purchase-vendor-products.service');
const { success } = require('../../utils/response');

const run = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

// vendorId comes from route param (admin) or req.supplier._id (supplier portal)
const resolveVendorId = (req) => req.params.vendorId || req.supplier?._id?.toString();

exports.getAll  = run(async (req, res) => {
  const result = await svc.getAll(resolveVendorId(req), req.query);
  res.json({ success: true, data: result.products, pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages } });
});
exports.getOne  = run(async (req, res) => success(res, await svc.getById(req.params.id, resolveVendorId(req))));
exports.create  = run(async (req, res) => success(res, await svc.create(resolveVendorId(req), req.body), 'Product created', 201));
exports.update  = run(async (req, res) => success(res, await svc.update(req.params.id, resolveVendorId(req), req.body), 'Product updated'));
exports.toggle  = run(async (req, res) => success(res, await svc.toggle(req.params.id, resolveVendorId(req)), 'Status toggled'));
exports.remove  = run(async (req, res) => { await svc.remove(req.params.id, resolveVendorId(req)); success(res, null, 'Deleted'); });
