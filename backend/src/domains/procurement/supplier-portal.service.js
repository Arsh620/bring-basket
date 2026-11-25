const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const PDFDocument = require('pdfkit');
const XLSX = require('@e965/xlsx');
const AppError = require('../../utils/AppError');
const { parseCsv } = require('../../utils/csv');
const { paginate } = require('../../utils/pagination');
const PurchaseOrder = require('../../models/purchase/PurchaseOrder');
const PurchaseBill = require('../../models/purchase/PurchaseBill');
const PurchasePayment = require('../../models/purchase/PurchasePayment');
const PurchaseVendor = require('../../models/purchase/PurchaseVendor');
const BusinessSetting = require('../../models/store/BusinessSetting');
const purchaseBillsService = require('./purchase-bills.service');

const orderStatuses = new Set(['open', 'partially_billed', 'billed', 'cancelled']);
const billStatuses = new Set(['draft', 'open', 'partially_paid', 'paid', 'void']);
const supplierInvoiceDirectory = path.resolve(
  __dirname,
  '../../../storage/supplier-registration/supplier-invoices',
);
const invoiceMimeTypes = {
  'application/pdf': { extension: '.pdf', signature: (buffer) => buffer.subarray(0, 5).toString() === '%PDF-' },
  'image/jpeg': { extension: '.jpg', signature: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  'image/png': { extension: '.png', signature: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/webp': { extension: '.webp', signature: (buffer) => buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP' },
};

const validateInvoiceFile = (file) => {
  const type = invoiceMimeTypes[file?.mimetype];
  if (!file?.buffer || !type || !type.signature(file.buffer)) {
    throw new AppError('Invoice must be a valid PDF, JPEG, PNG, or WebP file', 400);
  }
  const originalExtension = path.extname(file.originalname || '').toLowerCase();
  const acceptedExtensions = file.mimetype === 'image/jpeg' ? ['.jpg', '.jpeg'] : [type.extension];
  if (!acceptedExtensions.includes(originalExtension)) {
    throw new AppError('Invoice file contents do not match its file type', 400);
  }
  return type;
};

const removeSupplierInvoice = async (filename) => {
  if (!filename || path.basename(filename) !== filename) return;
  try {
    await fs.unlink(path.join(supplierInvoiceDirectory, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

const normalizeHeader = (value) => {
  const header = String(value ?? '').toLowerCase().trim().replace(/[\s-]/g, '_');
  const aliases = {
    line_id: 'item_id',
    po_item_id: 'item_id',
    id: 'item_id',
    item: 'item_name',
    product: 'item_name',
    product_name: 'item_name',
    name: 'item_name',
    qty_ordered: 'ordered',
    order_qty: 'ordered',
    qty_remaining: 'remaining',
    process_now: 'processing_now',
    qty: 'processing_now',
    quantity: 'processing_now',
    processing_qty: 'processing_now',
    send_qty: 'processing_now',
  };
  return aliases[header] || header;
};

const normalizeName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

const normalizeSpreadsheetRows = (matrix) => {
  if (!matrix.length) return [];
  const headers = matrix[0].map(normalizeHeader);
  return matrix.slice(1).map((cells) => {
    const row = {};
    headers.forEach((header, index) => {
      if (header) row[header] = String(cells[index] ?? '').trim();
    });
    return row;
  }).filter((row) => Object.values(row).some((value) => value !== ''));
};

const readProcessUpload = (file) => {
  if (!file?.buffer) throw new AppError('A CSV or Excel file is required', 400);
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (['.csv', '.txt'].includes(extension)) {
    return normalizeSpreadsheetRows(parseCsv(file.buffer.toString('utf8')));
  }
  if (!['.xls', '.xlsx'].includes(extension)) {
    throw new AppError('Upload a CSV, TXT, XLS, or XLSX file', 400);
  }
  const isXlsx = file.buffer.subarray(0, 2).toString() === 'PK';
  const isXls = file.buffer.subarray(0, 8).equals(
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  );
  if ((extension === '.xlsx' && !isXlsx) || (extension === '.xls' && !isXls)) {
    throw new AppError('Uploaded file contents do not match its extension', 400);
  }
  try {
    const workbook = XLSX.read(file.buffer, { type: 'buffer', sheetRows: 10001 });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: '',
    });
    if (matrix.length > 10000) throw new AppError('Spreadsheet cannot exceed 10,000 rows', 400);
    return normalizeSpreadsheetRows(matrix);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Could not read the uploaded spreadsheet', 400);
  }
};

const getOrderProcessRows = async (supplierId, orderId, processable = false) => {
  if (!mongoose.isValidObjectId(orderId)) throw new AppError('Invalid purchase order ID', 400);
  const filter = {
    _id: orderId,
    purchaseVendorId: supplierId,
    status: processable ? { $in: ['open', 'partially_billed'] } : { $ne: 'draft' },
  };
  const order = await PurchaseOrder.findOne(filter).lean();
  if (!order) throw new AppError('Not found', 404);
  return order;
};

const templateRows = (order) => order.items.map((item) => {
  const remaining = Math.max(0, Number(item.qty) - Number(item.qtyBilled || 0));
  return [
    String(item._id),
    item.itemName || '',
    Number(item.qty || 0),
    remaining,
    0,
  ];
});

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const toCsv = (rows) => rows.map((row) => row.map(csvCell).join(',')).join('\r\n');

const xlsxContent = (rows) => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 28 }, { wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, sheet, 'PO Processing');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const downloadOrderProcessTemplate = async (supplierId, orderId, format) => {
  const order = await getOrderProcessRows(supplierId, orderId);
  const rows = [
    ['item_id', 'item_name', 'ordered', 'remaining', 'processing_now'],
    ...templateRows(order),
  ];
  const base = String(order.poNumber || 'po').replace(/[^A-Za-z0-9_-]+/g, '-') || 'po';
  const wantsXlsx = String(format || '').toLowerCase() === 'xlsx';
  return {
    content: wantsXlsx ? xlsxContent(rows) : Buffer.from(`\uFEFF${toCsv(rows)}`, 'utf8'),
    contentType: wantsXlsx
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv; charset=utf-8',
    filename: `${base}-process-template.${wantsXlsx ? 'xlsx' : 'csv'}`,
  };
};

const parseOrderProcessUpload = async (supplierId, orderId, file) => {
  const order = await getOrderProcessRows(supplierId, orderId, true);
  const rows = readProcessUpload(file);
  if (!rows.length) throw new AppError('Uploaded file has no data rows', 400);

  const byId = new Map(order.items.map((item) => [String(item._id), item]));
  const byName = new Map();
  order.items.forEach((item) => {
    const name = normalizeName(item.itemName);
    if (name) byName.set(name, item);
  });
  const quantities = Object.fromEntries(order.items.map((item) => [String(item._id), 0]));
  let matched = 0;
  for (const row of rows) {
    const item = byId.get(String(row.item_id || '')) || byName.get(normalizeName(row.item_name));
    if (!item) continue;
    const quantity = row.processing_now === undefined || row.processing_now === ''
      ? 0
      : Number(row.processing_now);
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new AppError(`Invalid processing quantity for ${item.itemName}`, 400);
    }
    const remaining = Math.max(0, Number(item.qty) - Number(item.qtyBilled || 0));
    if (quantity - remaining > 0.0001) {
      throw new AppError(`Processing quantity exceeds the remaining quantity for ${item.itemName}`, 400);
    }
    quantities[String(item._id)] = quantity;
    matched += 1;
  }
  if (!matched) throw new AppError('No matching purchase order items found in file', 400);
  return quantities;
};

const cleanPdfText = (value) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();

const createOrderChallan = async (supplierId, orderId) => {
  if (!mongoose.isValidObjectId(orderId)) throw new AppError('Invalid purchase order ID', 400);
  const order = await PurchaseOrder.findOne({
    _id: orderId,
    purchaseVendorId: supplierId,
    status: { $ne: 'draft' },
  })
    .populate('purchaseVendorId', 'displayName legalName gstin mobile addresses')
    .populate('warehouseId', 'name address city state zip country gstin')
    .lean();
  if (!order) throw new AppError('Not found', 404);

  const settings = await BusinessSetting.find({
    key: { $in: ['app_name', 'business_name', 'business_address', 'business_phone', 'business_gstin'] },
  }).lean();
  const company = Object.fromEntries(settings.map(({ key, value }) => [key, value]));
  const companyName = cleanPdfText(company.business_name || company.app_name || 'BringBasket');
  const vendor = order.purchaseVendorId || {};
  const address = (vendor.addresses || []).find((entry) => entry.type === 'billing')
    || (vendor.addresses || []).find((entry) => entry.type === 'shipping');
  const filenameBase = String(order.poNumber || order._id).replace(/[^\w.-]/g, '-');
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Challan ${order.poNumber}` } });
  const chunks = [];
  const content = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const left = 48;
  const right = 547;
  doc.fillColor('#039d55').fontSize(18).font('Helvetica-Bold').text(companyName, left, 48, { width: 250 });
  doc.fillColor('#222222').fontSize(17).text('DELIVERY CHALLAN', 330, 48, { width: 217, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#555555');
  if (company.business_address) doc.text(cleanPdfText(company.business_address), left, 73, { width: 250 });
  if (company.business_phone) doc.text(`Phone: ${cleanPdfText(company.business_phone)}`, left, doc.y + 2, { width: 250 });
  if (company.business_gstin) doc.text(`GSTIN: ${cleanPdfText(company.business_gstin)}`, left, doc.y + 2, { width: 250 });
  doc.text(`CH-${cleanPdfText(order.poNumber)}`, 330, 73, { width: 217, align: 'right' });
  doc.text(`Date: ${new Date(order.poDate).toLocaleDateString('en-GB')}`, 330, 88, { width: 217, align: 'right' });

  let y = Math.max(doc.y, 112) + 18;
  const vendorName = cleanPdfText(vendor.legalName || vendor.displayName);
  const warehouse = order.warehouseId || {};
  doc.fillColor('#666666').fontSize(9).text('SHIP TO', left, y);
  doc.text('VENDOR', 305, y);
  y += 14;
  doc.fillColor('#222222').font('Helvetica-Bold').fontSize(10).text(cleanPdfText(warehouse.name || companyName), left, y, { width: 235 });
  doc.text(vendorName, 305, y, { width: 242 });
  doc.font('Helvetica').fontSize(9);
  const shipAddress = [warehouse.address, warehouse.city, warehouse.state, warehouse.zip, warehouse.country]
    .filter(Boolean).map(cleanPdfText).join(', ');
  const vendorAddress = address
    ? [address.addressLine1, address.addressLine2, address.city, address.state, address.zip, address.country]
      .filter(Boolean).map(cleanPdfText).join(', ')
    : '';
  y += 15;
  if (shipAddress) doc.text(shipAddress, left, y, { width: 235 });
  if (vendorAddress) doc.text(vendorAddress, 305, y, { width: 242 });
  y = Math.max(doc.y, y + 15);
  if (warehouse.gstin) doc.text(`GSTIN: ${cleanPdfText(warehouse.gstin)}`, left, y, { width: 235 });
  if (vendor.gstin) doc.text(`GSTIN: ${cleanPdfText(vendor.gstin)}`, 305, y, { width: 242 });
  if (vendor.mobile) doc.text(`Phone: ${cleanPdfText(vendor.mobile)}`, 305, doc.y + 2, { width: 242 });
  y = doc.y + 22;

  const columns = { number: left, item: 76, qty: 430, unit: 490 };
  const drawHeader = () => {
    doc.rect(left, y, right - left, 22).fill('#1f2937');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    doc.text('#', columns.number + 6, y + 7);
    doc.text('ITEM', columns.item, y + 7);
    doc.text('QTY', columns.qty, y + 7, { width: 45, align: 'right' });
    doc.text('UNIT', columns.unit, y + 7, { width: 50 });
    y += 22;
  };
  drawHeader();
  doc.font('Helvetica').fontSize(9).fillColor('#222222');
  for (const [index, item] of order.items.entries()) {
    const name = cleanPdfText(item.itemName);
    const itemHeight = Math.max(20, doc.heightOfString(name, { width: 340 }) + 10);
    if (y + itemHeight > 740) {
      doc.addPage();
      y = 48;
      drawHeader();
    }
    doc.text(String(index + 1), columns.number + 6, y + 6);
    doc.text(name, columns.item, y + 5, { width: 340 });
    doc.text(Number(item.qty || 0).toFixed(2), columns.qty, y + 6, { width: 45, align: 'right' });
    doc.text(cleanPdfText(item.unit || 'pcs'), columns.unit, y + 6, { width: 50 });
    doc.moveTo(left, y + itemHeight).lineTo(right, y + itemHeight).strokeColor('#e5e7eb').stroke();
    y += itemHeight;
  }
  y += 42;
  if (y > 740) {
    doc.addPage();
    y = 70;
  }
  doc.fontSize(9).fillColor('#555555');
  doc.text('Prepared by', left, y);
  doc.text('Received by', 220, y);
  doc.text('Authorized signatory', 390, y);
  doc.moveTo(left, y + 38).lineTo(left + 130, y + 38).strokeColor('#999999').stroke();
  doc.moveTo(220, y + 38).lineTo(350, y + 38).stroke();
  doc.moveTo(390, y + 38).lineTo(right, y + 38).stroke();
  doc.end();
  return {
    content: await content,
    filename: `challan-${filenameBase}.pdf`,
  };
};

const paginatedList = async (Model, supplierId, query, allowedStatuses) => {
  const { skip, page, limit } = paginate(query);
  const filter = { purchaseVendorId: supplierId };
  if (Model === PurchaseOrder) filter.status = { $ne: 'draft' };
  if (query.status) {
    const status = String(query.status);
    if (!allowedStatuses.has(status)) throw new AppError('Invalid status filter', 400);
    filter.status = status;
  }

  const listQuery = Model.find(filter);
  if (Model === PurchaseBill) listQuery.select('-vendorInvoicePath');
  const [data, total] = await Promise.all([
    listQuery.sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Model.countDocuments(filter),
  ]);
  return { data, total, page, limit };
};

exports.getDashboard = async (supplierId) => {
  const [pendingOrders, recentBills, openPoCount, openBillBalance, lastPayment] = await Promise.all([
    PurchaseOrder.find({
      purchaseVendorId: supplierId,
      status: { $in: ['open', 'partially_billed'] },
    }).sort({ createdAt: -1 }).limit(5).lean(),
    PurchaseBill.find({ purchaseVendorId: supplierId }).select('-vendorInvoicePath')
      .sort({ createdAt: -1 }).limit(5).lean(),
    PurchaseOrder.countDocuments({
      purchaseVendorId: supplierId,
      status: { $in: ['open', 'partially_billed'] },
    }),
    PurchaseBill.aggregate([
      {
        $match: {
          purchaseVendorId: new mongoose.Types.ObjectId(supplierId),
          status: { $in: ['open', 'partially_paid'] },
        },
      },
      { $group: { _id: null, balance: { $sum: '$balanceDue' } } },
    ]),
    PurchasePayment.findOne({ purchaseVendorId: supplierId })
      .sort({ paymentDate: -1, _id: -1 }).lean(),
  ]);
  return {
    pendingOrders,
    recentBills,
    openPoCount,
    openBillsBalance: openBillBalance[0]?.balance || 0,
    lastPayment,
  };
};

exports.getOrders = (supplierId, query) => paginatedList(
  PurchaseOrder,
  supplierId,
  query,
  orderStatuses,
);

exports.getOrder = async (supplierId, orderId) => {
  const order = await PurchaseOrder.findOne({
    _id: orderId,
    purchaseVendorId: supplierId,
    status: { $ne: 'draft' },
  }).lean();
  if (!order) throw new AppError('Not found', 404);
  return order;
};

exports.downloadOrderProcessTemplate = downloadOrderProcessTemplate;
exports.parseOrderProcessUpload = parseOrderProcessUpload;
exports.processOrder = (supplierId, orderId, quantities) => purchaseBillsService.createFromPurchaseOrder(
  orderId,
  { quantities },
  { supplierId, fromVendorPortal: true },
);
exports.createOrderChallan = createOrderChallan;

exports.getInvoices = (supplierId, query) => paginatedList(
  PurchaseBill,
  supplierId,
  query,
  billStatuses,
);

exports.getInvoice = async (supplierId, invoiceId) => {
  const invoice = await PurchaseBill.findOne({
    _id: invoiceId,
    purchaseVendorId: supplierId,
  }).lean();
  if (!invoice) throw new AppError('Not found', 404);
  delete invoice.vendorInvoicePath;
  return invoice;
};

exports.uploadInvoice = async (supplierId, invoiceId, file) => {
  if (!mongoose.isValidObjectId(invoiceId)) throw new AppError('Invalid invoice ID', 400);
  validateInvoiceFile(file);
  const bill = await PurchaseBill.findOne({
    _id: invoiceId,
    purchaseVendorId: supplierId,
  });
  if (!bill) throw new AppError('Not found', 404);

  const extension = invoiceMimeTypes[file.mimetype].extension;
  const filename = `${crypto.randomUUID()}${extension}`;
  await fs.mkdir(supplierInvoiceDirectory, { recursive: true });
  await fs.writeFile(path.join(supplierInvoiceDirectory, filename), file.buffer, { flag: 'wx' });

  const oldFilename = bill.vendorInvoicePath;
  try {
    bill.vendorInvoicePath = filename;
    bill.vendorInvoiceOriginalName = path.basename(file.originalname).slice(0, 255);
    bill.vendorInvoiceMimeType = file.mimetype;
    bill.vendorInvoiceUploadedAt = new Date();
    await bill.save();
  } catch (error) {
    await removeSupplierInvoice(filename);
    throw error;
  }
  if (oldFilename && oldFilename !== filename) await removeSupplierInvoice(oldFilename);
  return {
    originalName: bill.vendorInvoiceOriginalName,
    uploadedAt: bill.vendorInvoiceUploadedAt,
  };
};

exports.getInvoiceAttachment = async (supplierId, invoiceId) => {
  if (!mongoose.isValidObjectId(invoiceId)) throw new AppError('Invalid invoice ID', 400);
  const bill = await PurchaseBill.findOne({
    _id: invoiceId,
    purchaseVendorId: supplierId,
  }).select('vendorInvoicePath vendorInvoiceOriginalName vendorInvoiceMimeType');
  if (!bill) throw new AppError('Not found', 404);
  if (!bill.vendorInvoicePath || path.basename(bill.vendorInvoicePath) !== bill.vendorInvoicePath) {
    throw new AppError('Supplier invoice attachment not found', 404);
  }
  const filePath = path.join(supplierInvoiceDirectory, bill.vendorInvoicePath);
  try {
    await fs.access(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') throw new AppError('Supplier invoice file is missing', 404);
    throw error;
  }
  return {
    filePath,
    originalName: bill.vendorInvoiceOriginalName,
    mimeType: bill.vendorInvoiceMimeType,
  };
};

exports.getPayments = (supplierId, query) => paginatedList(
  PurchasePayment,
  supplierId,
  query,
  new Set(),
);

exports.getProfile = async (supplierId) => {
  const supplier = await PurchaseVendor.findById(supplierId)
    .select('-password')
    .lean();
  if (!supplier) throw new AppError('Not found', 404);
  return supplier;
};
