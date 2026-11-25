const mongoose = require('mongoose');
const Order = require('../orders/order.model');
const Item = require('../../models/catalog/Item');
const Brand = require('../../models/catalog/Brand');
const WarehouseItemStock = require('../../models/warehouse/WarehouseItemStock');
const { paginate } = require('../../utils/pagination');

const money = (v) => Number(Number(v || 0).toFixed(2));

// ── Date filter helper ────────────────────────────────────────────────────────
const buildDateFilter = (filter, from, to, field = 'createdAt') => {
  const now = new Date();
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (filter) {
    case 'today':
      return { [field]: { $gte: startOf(now), $lte: endOf(now) } };
    case 'this_week': {
      const day = now.getDay();
      const start = new Date(now); start.setDate(now.getDate() - day); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
      return { [field]: { $gte: start, $lte: end } };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { [field]: { $gte: start, $lte: end } };
    }
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { [field]: { $gte: start, $lte: end } };
    }
    case 'previous_year': {
      const y = now.getFullYear() - 1;
      return { [field]: { $gte: new Date(y, 0, 1), $lte: new Date(y, 11, 31, 23, 59, 59, 999) } };
    }
    case 'custom':
      if (from && to) return { [field]: { $gte: new Date(from + 'T00:00:00'), $lte: new Date(to + 'T23:59:59') } };
      return {};
    default:
      return {};
  }
};

// ── Order Report (day-wise transactions) ─────────────────────────────────────
const orderReport = async (query = {}) => {
  const { filter = 'this_month', from, to, storeId, moduleId, search } = query;
  const { skip, page, limit } = paginate(query);

  const match = {
    orderStatus: { $in: ['delivered', 'canceled', 'pending', 'confirmed', 'processing', 'handover', 'picked_up'] },
    ...buildDateFilter(filter, from, to),
  };
  if (storeId && mongoose.isValidObjectId(storeId)) match.storeId = storeId;
  if (moduleId) match.moduleId = moduleId;
  if (search?.trim()) match.orderNumber = { $regex: search.trim(), $options: 'i' };

  const [orders, total, summary] = await Promise.all([
    Order.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .select('orderNumber storeName orderType orderStatus paymentMethod paymentStatus orderAmount deliveryCharge itemSubtotal itemDiscount taxAmount createdAt deliveredAt').lean(),
    Order.countDocuments(match),
    Order.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalAmount: { $sum: '$orderAmount' },
        deliveredAmount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, '$orderAmount', 0] } },
        deliveredCount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] } },
        canceledCount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'canceled'] }, 1, 0] } },
        totalDeliveryCharge: { $sum: '$deliveryCharge' },
        totalDiscount: { $sum: '$itemDiscount' },
        totalTax: { $sum: '$taxAmount' },
      }},
    ]),
  ]);

  return { orders, total, page, limit, pages: Math.ceil(total / limit), summary: summary[0] || {} };
};

// ── Item-wise Sales Report ────────────────────────────────────────────────────
const itemWiseReport = async (query = {}) => {
  const { filter = 'this_month', from, to, storeId, categoryId, search } = query;
  const { skip, page, limit } = paginate(query);

  const dateFilter = buildDateFilter(filter, from, to);
  const orderMatch = { orderStatus: 'delivered', ...dateFilter };
  if (storeId && mongoose.isValidObjectId(storeId)) orderMatch.storeId = storeId;

  const deliveredOrders = await Order.find(orderMatch).select('items storeId').lean();

  // Aggregate item sales from order lines
  const itemSalesMap = {};
  for (const order of deliveredOrders) {
    for (const line of order.items || []) {
      const id = String(line.itemId);
      if (!itemSalesMap[id]) itemSalesMap[id] = { qty: 0, revenue: 0, orders: 0 };
      itemSalesMap[id].qty += line.quantity;
      itemSalesMap[id].revenue += line.lineTotal;
      itemSalesMap[id].orders += 1;
    }
  }

  const itemIds = Object.keys(itemSalesMap).filter((id) => mongoose.isValidObjectId(id));
  const itemFilter = { _id: { $in: itemIds } };
  if (categoryId && mongoose.isValidObjectId(categoryId)) itemFilter.categoryId = categoryId;
  if (search?.trim()) itemFilter.name = { $regex: search.trim(), $options: 'i' };

  const [items, total] = await Promise.all([
    Item.find(itemFilter).select('name sku barcode image price stock categoryId storeId').sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Item.countDocuments(itemFilter),
  ]);

  const result = items.map((item) => {
    const sales = itemSalesMap[String(item._id)] || { qty: 0, revenue: 0, orders: 0 };
    return { ...item, soldQty: sales.qty, revenue: money(sales.revenue), orderCount: sales.orders };
  }).sort((a, b) => b.soldQty - a.soldQty);

  return { items: result, total, page, limit, pages: Math.ceil(total / limit) };
};

// ── Store Summary Report ──────────────────────────────────────────────────────
const storeSummaryReport = async (query = {}) => {
  const { filter = 'this_month', from, to } = query;
  const dateFilter = buildDateFilter(filter, from, to);

  const [summary] = await Order.aggregate([
    { $match: { ...dateFilter } },
    { $group: {
      _id: '$storeId',
      storeName: { $first: '$storeName' },
      totalOrders: { $sum: 1 },
      deliveredOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] } },
      canceledOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'canceled'] }, 1, 0] } },
      totalAmount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, '$orderAmount', 0] } },
      cashOrders: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash_on_delivery'] }, 1, 0] } },
      walletOrders: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'wallet'] }, 1, 0] } },
      digitalOrders: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'digital_payment'] }, 1, 0] } },
    }},
    { $sort: { totalOrders: -1 } },
  ]);

  const overallStats = await Order.aggregate([
    { $match: dateFilter },
    { $group: {
      _id: null,
      totalOrders: { $sum: 1 },
      deliveredOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] } },
      canceledOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'canceled'] }, 1, 0] } },
      totalSales: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, '$orderAmount', 0] } },
    }},
  ]);

  // Daily/monthly sales chart data
  const bucketFormat = ['this_week', 'today'].includes(filter) ? '%Y-%m-%d' : (filter === 'this_year' || filter === 'previous_year' ? '%Y-%m' : '%Y-%m-%d');
  const chartData = await Order.aggregate([
    { $match: { orderStatus: 'delivered', ...dateFilter } },
    { $group: {
      _id: { $dateToString: { format: bucketFormat, date: '$deliveredAt', timezone: 'Asia/Kolkata' } },
      sales: { $sum: '$orderAmount' },
      orders: { $sum: 1 },
    }},
    { $sort: { _id: 1 } },
  ]);

  return { stores: summary || [], overall: overallStats[0] || {}, chartData };
};

// ── Stock Report (low stock items) ───────────────────────────────────────────
const stockReport = async (query = {}) => {
  const { storeId, search, lowStockThreshold = 10 } = query;
  const { skip, page, limit } = paginate(query);

  const filter = { stock: { $lte: Number(lowStockThreshold) } };
  if (storeId && mongoose.isValidObjectId(storeId)) filter.storeId = storeId;
  if (search?.trim()) filter.name = { $regex: search.trim(), $options: 'i' };

  const [items, total] = await Promise.all([
    Item.find(filter).select('name sku barcode stock image storeId categoryId').sort({ stock: 1 }).skip(skip).limit(limit).lean(),
    Item.countDocuments(filter),
  ]);

  return { items, total, page, limit, pages: Math.ceil(total / limit) };
};

// ── Warehouse Stock Report ────────────────────────────────────────────────────
const warehouseStockReport = async (query = {}) => {
  const { warehouseId, search } = query;
  const { skip, page, limit } = paginate(query);

  const filter = {};
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) filter.warehouseId = warehouseId;

  const [stocks, total] = await Promise.all([
    WarehouseItemStock.find(filter)
      .populate('itemId', 'name sku barcode image')
      .populate('warehouseId', 'name type')
      .sort({ qty: 1 }).skip(skip).limit(limit),
    WarehouseItemStock.countDocuments(filter),
  ]);

  return { stocks, total, page, limit, pages: Math.ceil(total / limit) };
};

// ── Brand Sales Report ────────────────────────────────────────────────────────
const brandSalesReport = async (query = {}) => {
  const { filter = 'this_month', from, to, brandName, storeId } = query;
  const dateFilter = buildDateFilter(filter, from, to);

  const orderMatch = { orderStatus: 'delivered', ...dateFilter };
  if (storeId && mongoose.isValidObjectId(storeId)) orderMatch.storeId = storeId;

  const deliveredOrders = await Order.find(orderMatch).select('items storeId').lean();

  // Get all item IDs from delivered orders
  const allItemIds = [...new Set(deliveredOrders.flatMap((o) => (o.items || []).map((l) => l.itemId)))];

  // Find items matching brand
  const brandFilter = { _id: { $in: allItemIds.filter((id) => mongoose.isValidObjectId(id)) } };
  if (brandName) brandFilter.brand = { $regex: `^${brandName}$`, $options: 'i' };

  const brandItems = await Item.find(brandFilter).select('_id name brand sku price stock').lean();
  const brandItemIds = new Set(brandItems.map((i) => String(i._id)));

  // Aggregate sales for brand items
  const salesMap = {};
  for (const order of deliveredOrders) {
    for (const line of order.items || []) {
      if (!brandItemIds.has(String(line.itemId))) continue;
      const id = String(line.itemId);
      if (!salesMap[id]) salesMap[id] = { qty: 0, revenue: 0, orders: 0 };
      salesMap[id].qty += line.quantity;
      salesMap[id].revenue += line.lineTotal;
      salesMap[id].orders += 1;
    }
  }

  const result = brandItems.map((item) => {
    const s = salesMap[String(item._id)] || { qty: 0, revenue: 0, orders: 0 };
    return { ...item, soldQty: s.qty, revenue: money(s.revenue), orderCount: s.orders };
  });

  const summary = {
    totalProducts: result.length,
    totalSoldQty: result.reduce((a, r) => a + r.soldQty, 0),
    totalRevenue: money(result.reduce((a, r) => a + r.revenue, 0)),
    totalOrders: result.reduce((a, r) => a + r.orderCount, 0),
  };

  // Get distinct brands for filter options
  const brands = await Item.distinct('brand', { brand: { $ne: null, $ne: '' } });

  return { items: result, summary, brands };
};

// ── Customer Report ───────────────────────────────────────────────────────────
const customerReport = async (query = {}) => {
  const { filter = 'this_month', from, to } = query;
  const { skip, page, limit } = paginate(query);
  const dateFilter = buildDateFilter(filter, from, to);

  const [topCustomers, total] = await Promise.all([
    Order.aggregate([
      { $match: { orderStatus: 'delivered', isGuest: false, ...dateFilter } },
      { $group: {
        _id: '$ownerId',
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: '$orderAmount' },
        lastOrderAt: { $max: '$createdAt' },
      }},
      { $sort: { totalSpent: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]),
    Order.aggregate([
      { $match: { orderStatus: 'delivered', isGuest: false, ...dateFilter } },
      { $group: { _id: '$ownerId' } },
      { $count: 'total' },
    ]),
  ]);

  return { customers: topCustomers, total: total[0]?.total || 0, page, limit, pages: Math.ceil((total[0]?.total || 0) / limit) };
};

// ── Disbursement Report ───────────────────────────────────────────────────────
const disbursementReport = async (query = {}) => {
  const { filter = 'this_month', from, to, status } = query;
  const { skip, page, limit } = paginate(query);
  const { DisbursementDetail } = require('../../models/store/StoreDisbursement');

  const match = { ...buildDateFilter(filter, from, to) };
  if (status && status !== 'all') match.status = status;

  const [details, total, summary] = await Promise.all([
    DisbursementDetail.find(match)
      .populate('storeId', 'name phone')
      .populate('vendorId', 'fName lName')
      .populate('paymentMethodId', 'methodName')
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    DisbursementDetail.countDocuments(match),
    DisbursementDetail.aggregate([
      { $match: match },
      { $group: {
        _id: '$status',
        total: { $sum: '$disbursementAmount' },
        count: { $sum: 1 },
      }},
    ]),
  ]);

  const summaryMap = summary.reduce((a, s) => { a[s._id] = { total: money(s.total), count: s.count }; return a; }, {});

  return {
    details, total, page, limit, pages: Math.ceil(total / limit),
    pending: summaryMap.pending || { total: 0, count: 0 },
    completed: summaryMap.completed || { total: 0, count: 0 },
    canceled: summaryMap.canceled || { total: 0, count: 0 },
  };
};

module.exports = {
  orderReport,
  itemWiseReport,
  storeSummaryReport,
  stockReport,
  warehouseStockReport,
  brandSalesReport,
  customerReport,
  disbursementReport,
};
