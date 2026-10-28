const categoryService = require('./categories.service');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};

exports.getAll = run(async (req, res) => {
  const categories = await categoryService.getAll(req.query);
  res.json({ success: true, data: categories });
});

exports.getOne = run(async (req, res) => {
  const category = await categoryService.getOne(req.params.id);
  res.json({ success: true, data: category });
});

exports.create = run(async (req, res) => {
  const category = await categoryService.create(req.body);
  res.status(201).json({ success: true, data: category });
});

exports.update = run(async (req, res) => {
  const category = await categoryService.update(req.params.id, req.body);
  res.json({ success: true, data: category });
});

exports.remove = run(async (req, res) => {
  await categoryService.remove(req.params.id);
  res.json({ success: true, message: 'Deleted' });
});

exports.updateStatus = run(async (req, res) => {
  const category = await categoryService.updateStatus(req.params.id, req.body?.status);
  res.json({ success: true, data: category });
});
