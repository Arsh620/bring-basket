const { success } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const purchaseReturnsService = require('./purchase-returns.service');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

exports.getAll = run(async (req, res) => {
  const { returns, pagination } = await purchaseReturnsService.getAll(req.query);
  res.json({ success: true, data: returns, pagination });
});

exports.getBills = run(async (req, res) => {
  const bills = await purchaseReturnsService.getBills(req.query);
  res.json({ success: true, data: bills });
});

exports.getBillItems = run(async (req, res) => {
  const result = await purchaseReturnsService.getBillReturnableItemsById(req.params.id);
  success(res, result);
});

exports.getOne = run(async (req, res) => {
  const purchaseReturn = await purchaseReturnsService.getOne(req.params.id);
  success(res, purchaseReturn);
});

exports.create = run(async (req, res) => {
  const purchaseReturn = await purchaseReturnsService.create(req.body);
  success(res, purchaseReturn, 'Purchase return saved as draft', 201);
});

exports.approve = run(async (req, res) => {
  const purchaseReturn = await purchaseReturnsService.approve(req.params.id);
  success(res, purchaseReturn, 'Purchase return approved and stock deducted');
});

exports.void = run(async (req, res) => {
  const purchaseReturn = await purchaseReturnsService.voidReturn(req.params.id);
  success(res, purchaseReturn, 'Purchase return voided');
});

exports.exportBillItems = run(async (req, res) => {
  const file = await purchaseReturnsService.exportBillItems(req.params.id);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.content);
});

exports.importCsv = run(async (req, res) => {
  const billId = req.body.purchaseBillId ?? req.body.billId;
  if (!billId) throw new AppError('purchaseBillId is required', 400);
  const parsed = await purchaseReturnsService.importCsv(billId, req.body.csv);
  success(res, parsed, 'Return items imported');
});

exports.exportAll = run(async (req, res) => {
  const file = await purchaseReturnsService.exportReturns(req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.content);
});
