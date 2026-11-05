const { success } = require('../../utils/response');
const purchaseVendorsService = require('./purchase-vendors.service');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};

exports.getAll = run(async (req, res) => {
  const { vendors, pagination } = await purchaseVendorsService.getAll(req.query);
  res.json({ success: true, data: vendors, pagination });
});

exports.getOne = run(async (req, res) => {
  const vendor = await purchaseVendorsService.getOne(req.params.id);
  success(res, vendor);
});

exports.create = run(async (req, res) => {
  const vendor = await purchaseVendorsService.create(req.body);
  success(res, vendor, 'Purchase vendor created', 201);
});

exports.update = run(async (req, res) => {
  const vendor = await purchaseVendorsService.update(req.params.id, req.body);
  success(res, vendor, 'Purchase vendor updated');
});

exports.updateStatus = run(async (req, res) => {
  const vendor = await purchaseVendorsService.updateStatus(req.params.id, req.body.status);
  success(res, vendor, 'Purchase vendor status updated');
});

exports.updateApproval = run(async (req, res) => {
  const vendor = await purchaseVendorsService.updateApproval(
    req.params.id,
    req.body.approvalStatus,
  );
  success(res, vendor, 'Purchase vendor approval updated');
});

exports.remove = run(async (req, res) => {
  await purchaseVendorsService.remove(req.params.id);
  success(res, null, 'Purchase vendor deleted');
});
