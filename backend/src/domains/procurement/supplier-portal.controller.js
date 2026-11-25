const { success, paginated } = require('../../utils/response');
const supplierPortal = require('./supplier-portal.service');

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

exports.getDashboard = run(async (req, res) => {
  const data = await supplierPortal.getDashboard(req.supplier._id);
  success(res, data);
});

exports.getOrders = run(async (req, res) => {
  const result = await supplierPortal.getOrders(req.supplier._id, req.query);
  paginated(res, result.data, result.total, result.page, result.limit);
});

exports.getOrder = run(async (req, res) => {
  const order = await supplierPortal.getOrder(req.supplier._id, req.params.id);
  success(res, order);
});

exports.downloadOrderProcessTemplate = run(async (req, res) => {
  const file = await supplierPortal.downloadOrderProcessTemplate(
    req.supplier._id,
    req.params.id,
    req.query.format,
  );
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(file.content);
});

exports.parseOrderProcessUpload = run(async (req, res) => {
  const quantities = await supplierPortal.parseOrderProcessUpload(
    req.supplier._id,
    req.params.id,
    req.file,
  );
  success(res, { quantities }, 'Quantities loaded from file');
});

exports.processOrder = run(async (req, res) => {
  const bill = await supplierPortal.processOrder(
    req.supplier._id,
    req.params.id,
    req.body?.quantities,
  );
  success(res, bill, 'Purchase order processed', 201);
});

exports.downloadOrderChallan = run(async (req, res) => {
  const file = await supplierPortal.createOrderChallan(req.supplier._id, req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(file.content);
});

exports.getInvoices = run(async (req, res) => {
  const result = await supplierPortal.getInvoices(req.supplier._id, req.query);
  paginated(res, result.data, result.total, result.page, result.limit);
});

exports.getInvoice = run(async (req, res) => {
  const invoice = await supplierPortal.getInvoice(req.supplier._id, req.params.id);
  success(res, invoice);
});

exports.uploadInvoice = run(async (req, res) => {
  const invoice = await supplierPortal.uploadInvoice(
    req.supplier._id,
    req.params.id,
    req.file,
  );
  success(res, invoice, 'Supplier invoice uploaded');
});

exports.downloadInvoiceAttachment = async (req, res, next) => {
  try {
    const invoice = await supplierPortal.getInvoiceAttachment(req.supplier._id, req.params.id);
    const filename = (invoice.originalName || 'supplier-invoice')
      .replace(/[\r\n"]/g, '_')
      .replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Type', invoice.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(invoice.filePath, filename, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
};

exports.getPayments = run(async (req, res) => {
  const result = await supplierPortal.getPayments(req.supplier._id, req.query);
  paginated(res, result.data, result.total, result.page, result.limit);
});

exports.getProfile = run(async (req, res) => {
  const supplier = await supplierPortal.getProfile(req.supplier._id);
  success(res, supplier);
});
