const { success } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const purchaseBillsService = require('./purchase-bills.service');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};

exports.getAll = run(async (req, res) => {
  const { bills, pagination } = await purchaseBillsService.getAll(req.query);
  res.json({ success: true, data: bills, pagination });
});

exports.getOne = run(async (req, res) => {
  const bill = await purchaseBillsService.getOne(req.params.id);
  success(res, bill);
});

exports.update = run(async (req, res) => {
  const bill = await purchaseBillsService.updateBill(req.params.id, req.body);
  success(res, bill, 'Purchase bill updated');
});

exports.void = run(async (req, res) => {
  const bill = await purchaseBillsService.voidBill(req.params.id);
  success(res, bill, 'Purchase bill voided');
});

exports.downloadGrnInvoice = async (req, res, next) => {
  try {
    const invoice = await purchaseBillsService.getInvoiceFile(req.params.id);
    const filename = (invoice.originalName || 'grn-invoice')
      .replace(/[\r\n"]/g, '_')
      .replace(/[^\w.-]/g, '_');
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    res.setHeader(
      'Content-Type',
      allowedMimeTypes.includes(invoice.mimeType) ? invoice.mimeType : 'application/octet-stream',
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(invoice.filePath, filename, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
};

exports.convertFromOrder = run(async (req, res) => {
  const bill = await purchaseBillsService.createFromPurchaseOrder(req.params.id, req.body);
  success(res, bill, 'Purchase bill created from order', 201);
});

exports.receiveStock = run(async (req, res) => {
  let body = req.body;
  if (typeof body.items === 'string') {
    try {
      body = { ...body, items: JSON.parse(body.items) };
    } catch {
      throw new AppError('items must be valid JSON', 400);
    }
  }
  const { bill, alreadyReceived } = await purchaseBillsService.receiveStock(
    req.params.id,
    body,
    req.user,
    req.file,
  );
  success(
    res,
    bill,
    alreadyReceived
      ? 'Stock was already received; invoice details were updated'
      : 'Stock received into warehouse',
  );
});
