const { success } = require('../../utils/response');
const storeService = require('./stores.service');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};

exports.getAll = run(async (req, res) => {
  const { stores, pagination } = await storeService.getAll(req.query);
  res.json({ success: true, data: stores, pagination });
});

exports.getOne = run(async (req, res) => {
  const store = await storeService.getOne(req.params.id);
  success(res, store);
});

exports.create = run(async (req, res) => {
  const store = await storeService.create(req.body);
  success(res, store, 'Store created', 201);
});

exports.update = run(async (req, res) => {
  const store = await storeService.update(req.params.id, req.body);
  success(res, store);
});

exports.updateStatus = run(async (req, res) => {
  const store = await storeService.updateStatus(req.params.id, req.body.status);
  success(res, store);
});

exports.remove = run(async (req, res) => {
  await storeService.remove(req.params.id);
  success(res, null, 'Deleted');
});

exports.getSchedule = run(async (req, res) => {
  const schedule = await storeService.getSchedule(req.params.id);
  success(res, schedule);
});

exports.updateSchedule = run(async (req, res) => {
  const schedule = await storeService.updateSchedule(req.params.id, req.body.schedule);
  success(res, schedule);
});
