const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Order = require('./order.model');
const Cart = require('./cart.model');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');
const { zoneContains } = require('../../utils/geospatial');

const ADMIN_ORDER_STATUSES = [
  'stock_pending',
  'pending',
  'confirmed',
  'processing',
  'handover',
  'picked_up',
  'delivered',
  'canceling',
  'canceled',
  'failed',
];
const serviceUrl = (name, fallback) => (process.env[name] || fallback).replace(/\/$/, '');
const money = (value) => Number(Number(value).toFixed(2));
const refMatches = (left, right) => left !== undefined && left !== null
  && right !== undefined && right !== null
  && String(left) === String(right);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const requestJson = async (url, options = {}) => {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
  } catch (error) {
    throw new AppError(`Required service is unavailable: ${error.message}`, 503);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AppError(payload?.message || 'Required service request failed', response.status >= 500 ? 503 : response.status);
  }
  if (!payload?.success) throw new AppError('Required service returned an invalid response', 502);
  return payload.data;
};

const getStore = (storeId) => requestJson(
  `${serviceUrl('STORE_SERVICE_URL', 'http://localhost:5003')}/api/v1/customer/stores/${encodeURIComponent(storeId)}`,
);

const getItem = (itemId) => requestJson(
  `${serviceUrl('CATALOG_SERVICE_URL', 'http://localhost:5002')}/api/v1/customer/items/${encodeURIComponent(itemId)}`,
);

const inventoryRequest = async (orderId, action, body = {}) => {
  const token = jwt.sign(
    { sub: 'order-service', role: 'service' },
    process.env.JWT_SECRET,
    { audience: 'inventory-service', expiresIn: '30s' },
  );
  return requestJson(
    `${serviceUrl('INVENTORY_SERVICE_URL', 'http://localhost:5004')}/internal/order-stock/${orderId}/${action}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
};

const distanceBetween = (a, b) => {
  const radians = (value) => (value * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const validateAddress = (address) => {
  if (!address || typeof address !== 'object' || Array.isArray(address)) {
    throw new AppError('address is required for delivery', 400);
  }
  const fields = ['contact_person_name', 'contact_person_number', 'address'];
  for (const field of fields) {
    if (typeof address[field] !== 'string' || !address[field].trim()) {
      throw new AppError(`${field} is required`, 400);
    }
    if (address[field].length > 500) throw new AppError(`${field} is too long`, 400);
  }
  const latitude = Number(address.latitude);
  const longitude = Number(address.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new AppError('address.latitude must be between -90 and 90', 400);
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new AppError('address.longitude must be between -180 and 180', 400);
  }
  return {
    contact_person_name: address.contact_person_name.trim(),
    contact_person_number: address.contact_person_number.trim(),
    address: address.address.trim(),
    latitude,
    longitude,
  };
};

const inSchedule = (schedule) => {
  if (!Array.isArray(schedule) || schedule.length === 0) return true;
  const localNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const today = schedule.find((entry) => Number(entry.day) === localNow.getDay());
  if (!today?.openingTime || !today?.closingTime) return false;
  const current = `${String(localNow.getHours()).padStart(2, '0')}:${String(localNow.getMinutes()).padStart(2, '0')}`;
  return current >= today.openingTime.slice(0, 5) && current < today.closingTime.slice(0, 5);
};

const itemDiscount = (item, unitPrice, quantity) => {
  const discount = Math.max(0, Number(item.discount) || 0);
  let value = (item.discountType === 'percent' ? unitPrice * discount / 100 : discount) * quantity;
  const buy = Number(item.offerBuyQty) || 0;
  const get = Number(item.offerGetQty) || 0;
  const getDiscount = Math.max(0, Math.min(100, Number(item.offerGetDiscount ?? 100)));
  if (buy > 0 && get > 0) {
    value += Math.floor(quantity / (buy + get)) * get * unitPrice * getDiscount / 100;
  }
  return Math.min(unitPrice * quantity, value);
};

const priceCart = async (carts, store, moduleId) => {
  if (!carts.length) throw new AppError('You cannot place an empty order', 400);
  const lines = [];
  for (const cart of carts) {
    if (cart.itemType !== 'Item') throw new AppError('Only catalog items are supported for grocery checkout', 400);
    if (cart.addOnIds.length || cart.addOnQtys.length) throw new AppError('Add-ons are not supported for grocery checkout yet', 400);
    if ((Array.isArray(cart.variation) && cart.variation.length)
      || (cart.variation && !Array.isArray(cart.variation) && Object.keys(cart.variation).length)) {
      throw new AppError('Item variations are not supported for grocery checkout yet', 400);
    }
    const item = await getItem(cart.itemId);
    const storeMatches = refMatches(item.storeId, store._id) || refMatches(item.storeId, store.legacyId);
    if (!storeMatches) throw new AppError('All cart items must belong to the selected store', 409);
    if (!refMatches(item.moduleId, moduleId)) throw new AppError('Cart item module does not match the request', 409);
    if (item.maximumCartQuantity && cart.quantity > item.maximumCartQuantity) {
      throw new AppError(`${item.name}: maximum cart quantity exceeded`, 409);
    }
    if (item.offerBuyQty && item.offerGetQty && !item.offerAllowSingle
      && cart.quantity < item.offerBuyQty + item.offerGetQty) {
      throw new AppError(`${item.name}: minimum quantity for this offer is ${item.offerBuyQty + item.offerGetQty}`, 409);
    }
    const unitPrice = Number(item.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new AppError(`${item.name}: invalid catalog price`, 502);
    const discountAmount = money(itemDiscount(item, unitPrice, cart.quantity));
    const lineTotal = money(Math.max(0, unitPrice * cart.quantity - discountAmount));
    lines.push({
      itemId: String(item._id),
      itemName: item.name,
      image: item.image,
      quantity: cart.quantity,
      unitPrice: money(unitPrice),
      discountAmount,
      taxAmount: 0,
      lineTotal,
    });
  }
  const itemSubtotal = money(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
  const discountTotal = money(lines.reduce((sum, line) => sum + line.discountAmount, 0));
  return { lines, itemSubtotal, itemDiscount: discountTotal };
};

const getOrder = async (orderId, actor) => {
  if (!orderId) throw new AppError('order_id is required', 400);
  const query = mongoose.isValidObjectId(orderId)
    ? { _id: orderId }
    : { orderNumber: String(orderId) };
  const order = await Order.findOne({ ...query, ownerId: actor.ownerId, isGuest: actor.isGuest }).lean();
  if (!order) throw new AppError('Order not found', 404);
  return order;
};

const existingIdempotentOrder = (order, body) => {
  const requestedAddress = body.order_type === 'delivery' ? validateAddress(body.address) : null;
  const savedAddress = order.deliveryAddress;
  const fields = [
    'contact_person_name',
    'contact_person_number',
    'address',
    'latitude',
    'longitude',
  ];
  const sameAddress = fields.every((field) => savedAddress?.[field] === requestedAddress?.[field]);
  if (order.requestedStoreId !== String(body.store_id)
    || order.orderType !== body.order_type
    || !sameAddress) {
    throw new AppError('Idempotency-Key was already used for a different order request', 409);
  }
  if (order.orderStatus === 'stock_pending' || order.orderStatus === 'canceling') {
    throw new AppError('A matching order request is still in progress', 409);
  }
  if (order.orderStatus === 'failed') {
    throw new AppError(order.failedReason || 'The previous order attempt failed', 409);
  }
  return order;
};

const placeOrder = async (actor, moduleId, body = {}, idempotencyKey) => {
  if (!moduleId) throw new AppError('moduleId header is required', 400);
  if (body.order_type !== 'delivery' && body.order_type !== 'take_away') {
    throw new AppError('order_type must be delivery or take_away', 400);
  }
  if (body.payment_method !== 'cash_on_delivery' && body.payment_method !== 'digital_payment' && body.payment_method !== 'wallet') {
    throw new AppError('payment_method must be cash_on_delivery, digital_payment, or wallet', 400);
  }
  if (!body.store_id) throw new AppError('store_id is required', 400);
  if (body.order_note !== undefined && (typeof body.order_note !== 'string' || body.order_note.length > 1000)) {
    throw new AppError('order_note must be a string no longer than 1000 characters', 400);
  }
  if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 128)) {
    throw new AppError('Idempotency-Key must be 8-128 characters', 400);
  }

  if (idempotencyKey) {
    const existing = await Order.findOne({
      ownerId: actor.ownerId,
      isGuest: actor.isGuest,
      moduleId: String(moduleId),
      idempotencyKey,
    });
    if (existing) return existingIdempotentOrder(existing, body);
  }

  const store = await getStore(body.store_id);
  if (String(store.moduleId) !== String(moduleId)) throw new AppError('Store does not belong to the requested module', 400);
  if (body.order_type === 'delivery' && !store.delivery) throw new AppError('Home delivery is not available for this store', 409);
  if (body.order_type === 'take_away' && !store.takeAway) throw new AppError('Takeaway is not available for this store', 409);
  if (store.zone && (!(store.zone.status === true || store.zone.status === 1 || store.zone.status === '1')
    || !store.zone.cashOnDelivery)) {
    throw new AppError('Cash on delivery is not available in this store zone', 409);
  }
  if (!inSchedule(store.schedule)) throw new AppError('The store is closed at this time', 409);

  const carts = await Cart.find({
    ownerId: actor.ownerId,
    isGuest: actor.isGuest,
    moduleId: String(moduleId),
  }).sort({ createdAt: 1, _id: 1 }).lean();
  const { lines, itemSubtotal, itemDiscount } = await priceCart(carts, store, moduleId);
  if (itemSubtotal < Number(store.minimumOrder || 0)) {
    throw new AppError(`Minimum order amount is ${Number(store.minimumOrder)}`, 409);
  }

  let deliveryAddress = null;
  let distanceKm = 0;
  let deliveryCharge = 0;
  if (body.order_type === 'delivery') {
    deliveryAddress = validateAddress(body.address);
    const storePoint = { latitude: Number(store.latitude), longitude: Number(store.longitude) };
    if (!Number.isFinite(storePoint.latitude) || !Number.isFinite(storePoint.longitude)) {
      throw new AppError('The store delivery location is not configured', 409);
    }
    if (!store.zone?.coordinates || !zoneContains(store.zone.coordinates, deliveryAddress)) {
      throw new AppError('Delivery address is outside the store coverage area', 409);
    }
    distanceKm = distanceBetween(storePoint, deliveryAddress);
    const minCharge = Number(store.minimumShippingCharge) || 0;
    const perKm = Number(store.perKmShippingCharge) || 0;
    deliveryCharge = Math.max(minCharge, perKm * distanceKm);
    const maxCharge = Number(store.maximumShippingCharge) || 0;
    if (maxCharge > 0) deliveryCharge = Math.min(deliveryCharge, maxCharge);
    if (store.zone.increasedDeliveryFeeStatus) {
      deliveryCharge *= 1 + Number(store.zone.increasedDeliveryFee || 0) / 100;
    }
    if (store.freeDelivery) deliveryCharge = 0;
    deliveryCharge = money(deliveryCharge);
  }

  const orderAmount = money(Math.max(0, itemSubtotal - itemDiscount + deliveryCharge));

  // Wallet payment — check balance upfront
  if (body.payment_method === 'wallet') {
    const User = require('../../models/auth/User');
    const user = await User.findById(actor.ownerId).select('walletBalance').lean();
    if (!user || user.walletBalance < orderAmount) {
      throw new AppError('Insufficient wallet balance', 400);
    }
  }
  const orderId = new mongoose.Types.ObjectId();
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({
    storeId: String(store._id),
    orderType: body.order_type,
    cartIds: carts.map((cart) => String(cart._id)).sort(),
    deliveryAddress,
  })).digest('hex');
  const order = new Order({
    _id: orderId,
    orderNumber: `BB-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    ownerId: actor.ownerId,
    isGuest: actor.isGuest,
    idempotencyKey,
    requestHash,
    requestedStoreId: String(body.store_id),
    moduleId: String(moduleId),
    storeId: String(store._id),
    storeName: store.name,
    orderType: body.order_type,
    orderStatus: 'stock_pending',
    paymentMethod: 'cash_on_delivery',
    paymentStatus: 'unpaid',
    items: lines,
    itemSubtotal,
    itemDiscount,
    taxAmount: 0,
    deliveryCharge,
    distanceKm: Number(distanceKm.toFixed(3)),
    orderAmount,
    deliveryAddress,
    orderNote: body.order_note?.trim(),
  });

  let stockReserved = false;
  try {
    await order.save();
    await inventoryRequest(orderId.toString(), 'reserve', {
      storeId: store._id,
      items: lines.map((line) => ({ itemId: line.itemId, qty: line.quantity })),
    });
    stockReserved = true;
    order.stockReserved = true;
    await order.save();
    await inventoryRequest(orderId.toString(), 'commit');
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        order.orderStatus = 'pending';
        order.pendingAt = new Date();
        await order.save({ session });
        await Cart.deleteMany({
          _id: { $in: carts.map((cart) => cart._id) },
          ownerId: actor.ownerId,
          isGuest: actor.isGuest,
          moduleId: String(moduleId),
        }, { session });
        // Debit wallet if payment method is wallet
        if (body.payment_method === 'wallet') {
          const User = require('../../models/auth/User');
          const WalletTransaction = require('../../models/auth/WalletTransaction');
          const user = await User.findById(actor.ownerId).session(session);
          if (!user || user.walletBalance < orderAmount) throw new AppError('Insufficient wallet balance', 400);
          user.walletBalance = money(user.walletBalance - orderAmount);
          await user.save({ session });
          await WalletTransaction.create([{
            userId: user._id, type: 'debit', amount: orderAmount,
            balance: user.walletBalance, referenceType: 'order',
            reference: order._id, note: `Order ${order.orderNumber}`,
          }], { session });
          order.paymentStatus = 'paid';
          await order.save({ session });
        }
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    if (stockReserved) {
      try {
        await inventoryRequest(orderId.toString(), 'release');
        order.stockReserved = false;
      } catch (releaseError) {
        error.message = `${error.message}; stock rollback also failed: ${releaseError.message}`;
      }
    }
    if (!order.isNew) {
      order.orderStatus = 'failed';
      order.failedReason = error.message.slice(0, 500);
      await order.save();
    }
    if (order.isNew && error.code === 11000 && idempotencyKey) {
      const existing = await Order.findOne({
        ownerId: actor.ownerId,
        isGuest: actor.isGuest,
        moduleId: String(moduleId),
        idempotencyKey,
      });
      if (existing) return existingIdempotentOrder(existing, body);
    }
    throw error;
  }

  return order;
};

const listOrders = async (actor, query = {}, running = false) => {
  const { skip, page, limit } = paginate({ page: query.offset, limit: query.limit });
  const filter = { ownerId: actor.ownerId, isGuest: actor.isGuest };
  const terminalStatuses = ['delivered', 'canceled', 'failed'];
  filter.orderStatus = running
    ? { $nin: [...terminalStatuses, 'stock_pending', 'canceling'] }
    : { $nin: ['stock_pending', 'canceling'] };
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  return { total_size: total, limit, offset: page, orders };
};

const listAdminOrders = async (query = {}) => {
  const status = query.status || 'all';
  if (status !== 'all' && !ADMIN_ORDER_STATUSES.includes(status)) {
    throw new AppError('Unsupported order status filter', 400);
  }
  if (query.search !== undefined
    && (typeof query.search !== 'string' || query.search.length > 100)) {
    throw new AppError('search must be a string no longer than 100 characters', 400);
  }
  for (const field of ['moduleId', 'storeId']) {
    if (query[field] !== undefined && (typeof query[field] !== 'string' || query[field].length > 128)) {
      throw new AppError(`${field} must be a string no longer than 128 characters`, 400);
    }
  }

  const filter = {};
  if (status !== 'all') filter.orderStatus = status;
  if (query.moduleId) filter.moduleId = query.moduleId;
  if (query.storeId) filter.storeId = query.storeId;
  if (query.search?.trim()) {
    const search = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [{ orderNumber: search }, { storeName: search }];
  }

  const { skip, page, limit } = paginate(query);
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .select('_id orderNumber storeName moduleId orderType orderStatus paymentMethod paymentStatus orderAmount items createdAt updatedAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { total_size: total, limit, offset: page, orders };
};

const getAdminOrder = async (orderId) => {
  if (typeof orderId !== 'string' || !orderId.trim() || orderId.length > 128) {
    throw new AppError('Valid order id is required', 400);
  }
  const query = mongoose.isValidObjectId(orderId)
    ? { _id: orderId }
    : { orderNumber: orderId };
  const order = await Order.findOne(query).lean();
  if (!order) throw new AppError('Order not found', 404);
  return order;
};

const cancelOrder = async (actor, body = {}) => {
  if (!body.order_id) throw new AppError('order_id is required', 400);
  if (typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 255) {
    throw new AppError('reason is required and must be at most 255 characters', 400);
  }
  const idFilter = mongoose.isValidObjectId(body.order_id)
    ? { _id: body.order_id }
    : { orderNumber: String(body.order_id) };
  const priorOrder = await Order.findOne({
    ...idFilter,
    ownerId: actor.ownerId,
    isGuest: actor.isGuest,
  }).select('orderStatus');
  if (!priorOrder) throw new AppError('Order not found', 404);
  if (!['pending', 'failed'].includes(priorOrder.orderStatus)) {
    throw new AppError('You can only cancel an order before it is confirmed', 409);
  }
  const order = await Order.findOneAndUpdate(
    {
      ...idFilter,
      ownerId: actor.ownerId,
      isGuest: actor.isGuest,
      orderStatus: { $in: ['pending', 'failed'] },
    },
    { $set: { orderStatus: 'canceling', cancellationReason: body.reason.trim() } },
    { new: true },
  );
  if (!order) {
    throw new AppError('Order status changed; refresh and try again', 409);
  }

  try {
    if (order.stockReserved) await inventoryRequest(order._id.toString(), 'release');
    order.orderStatus = 'canceled';
    order.stockReserved = false;
    order.canceledAt = new Date();
    await order.save();
    return order;
  } catch (error) {
    await Order.updateOne(
      { _id: order._id, orderStatus: 'canceling' },
      { $set: { orderStatus: priorOrder.orderStatus }, $unset: { cancellationReason: 1 } },
    );
    throw error;
  }
};

module.exports = {
  placeOrder,
  listOrders,
  listAdminOrders,
  getAdminOrder,
  getOrder,
  cancelOrder,
};
