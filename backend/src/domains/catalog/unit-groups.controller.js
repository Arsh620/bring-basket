const { success } = require('../../utils/response');
const unitGroupService = require('./unit-groups.service');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};

exports.getAll = run(async (req, res) => {
  const groups = await unitGroupService.getAll(req.query);
  success(res, groups);
});

exports.getOne = run(async (req, res) => {
  const group = await unitGroupService.getOne(req.params.id);
  success(res, group);
});

exports.create = run(async (req, res) => {
  const group = await unitGroupService.create(req.body);
  success(res, group, 'Unit group created', 201);
});

exports.update = run(async (req, res) => {
  const group = await unitGroupService.update(req.params.id, req.body);
  success(res, group);
});

exports.updateStatus = run(async (req, res) => {
  const group = await unitGroupService.updateStatus(req.params.id, req.body.status);
  success(res, group);
});

exports.remove = run(async (req, res) => {
  await unitGroupService.remove(req.params.id);
  success(res, null, 'Deleted');
});

exports.getConversions = run(async (req, res) => {
  const conversions = await unitGroupService.getConversions(req.params.id);
  success(res, conversions);
});

exports.addConversion = run(async (req, res) => {
  const conversion = await unitGroupService.addConversion(req.params.id, req.body);
  success(res, conversion, 'Conversion added', 201);
});

exports.updateConversion = run(async (req, res) => {
  const conversion = await unitGroupService.updateConversion(
    req.params.conversionId,
    req.body,
  );
  success(res, conversion);
});

exports.removeConversion = run(async (req, res) => {
  await unitGroupService.removeConversion(req.params.conversionId);
  success(res, null, 'Deleted');
});
