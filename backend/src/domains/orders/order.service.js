const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Order = require('./order.model');
const { orderModel, operationsModel } = require('./order-data');
const Cart = require('./cart.model');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');
const { zoneContains } = require('../../utils/geospatial');
const { getDashboardPeriod, TIME_ZONE } = require('./dashboard-period');
const benefits = require('./checkout-benefits.service');
const eventBus = require('../../services/event-bus');

const ADMIN_ORDER_STATUSES = [
  'stock_pending',
  'pending',
  'accepted',
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

const reserveOrderStock = (orderId, storeId, items) => inventoryRequest(orderId, 'reserve', { storeId, items });
const commitOrderStock = (orderId) => inventoryRequest(orderId, 'commit');
const releaseOrderStock = (orderId) => inventoryRequest(orderId, 'release');

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

const calculateDeliveryQuote = (store, addressInput) => {
  const deliveryAddress = validateAddress(addressInput);
  const storePoint = { latitude: Number(store.latitude), longitude: Number(store.longitude) };
  if (!Number.isFinite(storePoint.latitude) || !Number.isFinite(storePoint.longitude)) {
    throw new AppError('The store delivery location is not configured', 409);
  }
  if (!store.zone?.coordinates || !zoneContains(store.zone.coordinates, deliveryAddress)) {
    throw new AppError('Delivery address is outside the store coverage area', 409);
  }

  const distanceKm = distanceBetween(storePoint, deliveryAddress);
  const minCharge = Number(store.minimumShippingCharge) || 0;
  const perKm = Number(store.perKmShippingCharge) || 0;
  let deliveryCharge = Math.max(minCharge, perKm * distanceKm);
  const maxCharge = Number(store.maximumShippingCharge) || 0;
  if (maxCharge > 0) deliveryCharge = Math.min(deliveryCharge, maxCharge);
  if (store.zone.increasedDeliveryFeeStatus) {
    deliveryCharge *= 1 + Number(store.zone.increasedDeliveryFee || 0) / 100;
  }
  if (store.freeDelivery) deliveryCharge = 0;
  deliveryCharge = money(deliveryCharge);

  return {
    deliveryAddress: {
      ...deliveryAddress,
      address_type: 'delivery',
      floor: String(addressInput.floor || '').trim(),
      road: String(addressInput.road || '').trim(),
      house: String(addressInput.house || '').trim(),
      distance: Number(distanceKm.toFixed(3)),
      delivery_fee: deliveryCharge,
    },
    deliveryCharge,
    distanceKm: Number(distanceKm.toFixed(3)),
  };
};

const quoteDeliveryAddress = async (storeId, address) => {
  const store = await getStore(storeId);
  if (!store.delivery) throw new AppError('Home delivery is not available for this store', 409);
  return calculateDeliveryQuote(store, address);
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
  if (actor.isGuest && body.payment_method === 'wallet') throw new AppError('Sign in to pay with your wallet', 403);
  const loyaltyPointsToRedeem = body.loyalty_points_to_redeem ? Number(body.loyalty_points_to_redeem) : 0;
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
    const quote = calculateDeliveryQuote(store, body.address);
    deliveryAddress = quote.deliveryAddress;
    distanceKm = quote.distanceKm;
    deliveryCharge = quote.deliveryCharge;
  }

  const orderAmount = money(Math.max(0, itemSubtotal - itemDiscount + deliveryCharge));

  // Loyalty redemption — compute discount before final orderAmount
  let loyaltyDiscount = 0;
  let loyaltyPointsActuallyRedeemed = 0;
  if (loyaltyPointsToRedeem > 0 && !actor.isGuest) {
    const User = operationsModel(require('../../models/auth/User'));
    const user = await User.findById(actor.ownerId).select('loyaltyPoint').lean();
    const { pointsToRedeem, discountAmount } = benefits.computeLoyaltyRedemption(
      user?.loyaltyPoint || 0, orderAmount, loyaltyPointsToRedeem,
    );
    loyaltyDiscount = discountAmount;
    loyaltyPointsActuallyRedeemed = pointsToRedeem;
  }
  const finalOrderAmount = money(Math.max(0, orderAmount - loyaltyDiscount));

  // Wallet payment — check balance upfront
  if (body.payment_method === 'wallet') {
    const User = operationsModel(require('../../models/auth/User'));
    const user = await User.findById(actor.ownerId).select('walletBalance').lean();
    if (!user || user.walletBalance < finalOrderAmount) {
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
    ...(store.zone?._id ? { zoneId: String(store.zone._id) } : {}),
    orderType: body.order_type,
    orderStatus: 'stock_pending',
    paymentMethod: body.payment_method,
    paymentStatus: 'unpaid',
    items: lines,
    itemSubtotal,
    itemDiscount,
    taxAmount: 0,
    deliveryCharge,
    distanceKm: Number(distanceKm.toFixed(3)),
    orderAmount: finalOrderAmount,
    loyaltyDiscount,
    loyaltyPointsRedeemed: loyaltyPointsActuallyRedeemed,
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
        // Debit loyalty points if redeemed
        if (loyaltyPointsActuallyRedeemed > 0 && !actor.isGuest) {
          await benefits.redeemLoyaltyPoints(actor.ownerId, order._id, loyaltyPointsActuallyRedeemed, session);
        }
        // Debit wallet if payment method is wallet
        if (body.payment_method === 'wallet') {
          const User = operationsModel(require('../../models/auth/User'));
          const WalletTransaction = operationsModel(require('../../models/auth/WalletTransaction'));
          const user = await User.findById(actor.ownerId).session(session);
          if (!user || user.walletBalance < finalOrderAmount) throw new AppError('Insufficient wallet balance', 400);
          user.walletBalance = money(user.walletBalance - finalOrderAmount);
          await user.save({ session });
          await WalletTransaction.create([{
            userId: user._id, type: 'debit', amount: finalOrderAmount,
            balance: user.walletBalance, referenceType: 'order',
            reference: order._id, note: `Order ${order.orderNumber}`,
          }], { session });
          order.paymentStatus = 'paid';
          await order.save({ session });
        }
        // Credit cashback (best-effort, non-blocking)
        if (!actor.isGuest) {
          benefits.creditCashback(actor.ownerId, order._id, finalOrderAmount, session).catch(() => {});
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

  eventBus.publish('order.placed', { orderId: String(order._id), orderNumber: order.orderNumber, userId: String(actor.ownerId), storeId: order.storeId, amount: order.orderAmount }).catch(() => {});
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

const listVendorOrders = async (vendorContext, query = {}) => {
  const storeIds = (vendorContext?.storeIds || []).map(String);
  if (storeIds.length === 0) throw new AppError('No store access', 403);
  if (query.status && query.status !== 'all' && !ADMIN_ORDER_STATUSES.includes(query.status)) {
    throw new AppError('Unsupported order status filter', 400);
  }
  const filter = { storeId: { $in: storeIds } };
  if (query.status && query.status !== 'all') filter.orderStatus = query.status;
  const { skip, page, limit } = paginate(query);
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  const confirmationModel = vendorContext.orderConfirmationModel || 'deliveryman';
  const canCancel = vendorContext.canStoreCancel === true;
  const pendingStoreIds = [...new Set(orders
    .filter((order) => order.orderStatus === 'pending' && confirmationModel !== 'store')
    .map((order) => order.storeId))];
  const storeDeliveryModes = new Map(await Promise.all(pendingStoreIds.map(async (storeId) => {
    const store = await getStore(storeId);
    return [String(storeId), Boolean(store.selfDeliverySystem)];
  })));
  const ordersWithActions = orders.map((order) => ({
    ...order,
    canVendorConfirm: order.orderStatus === 'pending'
      && (confirmationModel === 'store' || storeDeliveryModes.get(String(order.storeId)) === true),
    canVendorCancel: order.orderStatus === 'pending' && order.paymentStatus === 'unpaid' && canCancel,
  }));
  return { total_size: total, limit, offset: page, orders: ordersWithActions };
};

const getVendorDashboard = async (vendorContext) => {
  const storeIds = (vendorContext?.storeIds || []).map(String);
  if (!storeIds.length) throw new AppError('No store access', 403);
  const [totalOrders, pendingOrders] = await Promise.all([
    Order.countDocuments({ storeId: { $in: storeIds } }),
    Order.countDocuments({ storeId: { $in: storeIds }, orderStatus: 'pending' }),
  ]);
  return { totalOrders, pendingOrders };
};

const updateVendorOrderStatus = async (vendorContext, { order_id: orderId, status, reason } = {}) => {
  const storeIds = (vendorContext?.storeIds || []).map(String);
  if (!storeIds.length) throw new AppError('No store access', 403);
  if (!mongoose.isValidObjectId(orderId)) throw new AppError('Valid order_id is required', 400);
  if (!['confirmed', 'processing', 'handover', 'canceled'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }
  if (status === 'canceled' && (typeof reason !== 'string' || !reason.trim() || reason.length > 255)) {
    throw new AppError('A cancellation reason of at most 255 characters is required', 400);
  }

  const order = await Order.findOne({ _id: orderId, storeId: { $in: storeIds } });
  if (!order) throw new AppError('Order not found', 404);
  const transition = {
    pending: ['confirmed', 'canceled'],
    accepted: ['processing'],
    confirmed: ['processing'],
    processing: ['handover'],
  };
  if (!transition[order.orderStatus]?.includes(status)) {
    throw new AppError(`Cannot change order from ${order.orderStatus} to ${status}`, 409);
  }

  if (status === 'confirmed') {
    const store = await getStore(order.storeId);
    const confirmationModel = vendorContext.orderConfirmationModel || 'deliveryman';
    if (confirmationModel !== 'store' && !store.selfDeliverySystem) {
      throw new AppError('Order confirmation is assigned to the delivery team', 409);
    }
  }

  if (status === 'canceled') {
    const canStoreCancel = vendorContext.canStoreCancel === true;
    if (!canStoreCancel) throw new AppError('Store cancellation is disabled', 403);
    if (order.paymentStatus !== 'unpaid') throw new AppError('Paid orders require payment reconciliation before cancellation', 409);
    const priorStatus = order.orderStatus;
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, storeId: { $in: storeIds }, orderStatus: priorStatus, paymentStatus: 'unpaid' },
      { $set: { orderStatus: 'canceling', cancellationReason: reason.trim() } },
      { new: true },
    );
    if (!claimed) throw new AppError('Order status changed; refresh and try again', 409);
    try {
      if (claimed.stockReserved) await inventoryRequest(claimed._id.toString(), 'release');
      claimed.orderStatus = 'canceled';
      claimed.stockReserved = false;
      claimed.canceledAt = new Date();
      await claimed.save();
      return claimed;
    } catch (error) {
      await Order.updateOne(
        { _id: claimed._id, orderStatus: 'canceling' },
        { $set: { orderStatus: priorStatus }, $unset: { cancellationReason: 1 } },
      );
      throw error;
    }
  }

  const timestampField = { confirmed: 'confirmedAt', processing: 'processingAt', handover: 'handoverAt' }[status];
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, storeId: { $in: storeIds }, orderStatus: order.orderStatus },
    { $set: { orderStatus: status, [timestampField]: new Date() } },
    { new: true, runValidators: true },
  );
  if (!updated) throw new AppError('Order status changed; refresh and try again', 409);
    if (status === 'delivered' && updated.ownerId && !updated.isGuest) {
    benefits.earnLoyaltyPoints(updated.ownerId, updated._id, updated.orderAmount).catch(() => {});
    eventBus.publish('order.delivered', { orderId: String(updated._id), orderNumber: updated.orderNumber, userId: String(updated.ownerId), amount: updated.orderAmount }).catch(() => {});
  }
  return updated;
};
const adminZoneFilter = async ({ zoneId } = {}) => {
  if (!zoneId) return {};
  const Store = operationsModel(require('../../models/store/Store'));
  const stores = await Store.find({ zoneId }).select('_id legacyId').lean();
  const storeIds = stores.flatMap((store) => [store._id, store.legacyId].filter((id) => id != null).map(String));
  return { $and: [{ $or: [{ zoneId: String(zoneId) }, { zoneId: null, storeId: { $in: storeIds } }] }] };
};

const listAdminOrders = async (query = {}, scope) => {
  const Orders = orderModel();
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

  if (query.queue && !['dispatch', 'unassigned'].includes(query.queue)) throw new AppError('Invalid dispatch queue', 400);
  const filter = await adminZoneFilter(scope);
  if (status !== 'all') filter.orderStatus = status;
  if (query.moduleId) filter.moduleId = query.moduleId;
  if (query.storeId) filter.storeId = query.storeId;
  if (query.queue) {
    filter.orderType = 'delivery';
    if (status === 'all') filter.orderStatus = { $in: ['pending', 'accepted', 'confirmed', 'processing', 'handover', 'picked_up'] };
    if (query.queue === 'unassigned') filter.deliverymanId = null;
  }
  if (query.search?.trim()) {
    const search = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [{ orderNumber: search }, { storeName: search }];
  }

  const { skip, page, limit } = paginate(query);
  const [orders, total] = await Promise.all([
    Orders.find(filter)
      .select('_id orderNumber storeName moduleId orderType orderStatus deliverymanId paymentMethod paymentStatus orderAmount items createdAt updatedAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Orders.countDocuments(filter),
  ]);
  return { total_size: total, limit, offset: page, orders };
};

const getAdminOrder = async (orderId, scope) => {
  if (typeof orderId !== 'string' || !orderId.trim() || orderId.length > 128) {
    throw new AppError('Valid order id is required', 400);
  }
  const query = mongoose.isValidObjectId(orderId)
    ? { _id: orderId }
    : { orderNumber: orderId };
  const order = await orderModel().findOne({ ...query, ...await adminZoneFilter(scope) }).lean();
  if (!order) throw new AppError('Order not found', 404);
  return order;
};

const getDashboardStoreIds = async ({ moduleId, zoneId }) => {
  const token = jwt.sign(
    { sub: 'backend', role: 'service' },
    process.env.JWT_SECRET,
    { audience: 'store-service', expiresIn: '30s' },
  );
  const query = new URLSearchParams({ moduleId: moduleId || 'all', zoneId });
  const data = await requestJson(
    `${serviceUrl('STORE_SERVICE_URL', 'http://localhost:5003')}/internal/admin/dashboard-store-ids?${query}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!Array.isArray(data?.storeIds) || data.storeIds.some((id) => typeof id !== 'string')) {
    throw new AppError('Store service returned invalid dashboard scope data', 502);
  }
  return data.storeIds;
};

const getAdminDashboardStats = async (filters = {}) => {
  const period = getDashboardPeriod(filters.period || 'this_year');
  const moduleId = filters.moduleId || 'all';
  const zoneId = filters.zoneId || 'all';
  const isObjectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
  if (moduleId !== 'all' && !isObjectId(moduleId) && !/^\d+$/.test(String(moduleId))) {
    throw new AppError('moduleId must be a valid module ID or all', 400);
  }
  if (zoneId !== 'all' && !isObjectId(zoneId) && !/^\d+$/.test(String(zoneId))) {
    throw new AppError('zoneId must be a valid zone ID or all', 400);
  }

  const filter = {};
  const compatibleIds = (ids) => ids.flatMap((id) => {
    const stringId = String(id);
    const values = [stringId];
    if (/^\d+$/.test(stringId) && Number.isSafeInteger(Number(stringId))) {
      values.push(Number(stringId));
    }
    if (/^[a-f\d]{24}$/i.test(stringId)) {
      values.push(new mongoose.Types.ObjectId(stringId));
    }
    return values;
  });
  if (moduleId !== 'all') filter.moduleId = { $in: compatibleIds([moduleId]) };
  if (zoneId !== 'all') {
    const storeIds = await getDashboardStoreIds({ moduleId, zoneId });
    filter.storeId = { $in: compatibleIds(storeIds) };
  }

  const summaryGroup = {
    _id: null,
    totalOrders: { $sum: 1 },
    deliveredOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] } },
    pendingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'pending'] }, 1, 0] } },
    canceledOrders: { $sum: { $cond: [{ $in: ['$orderStatus', ['canceling', 'canceled', 'failed']] }, 1, 0] } },
    unassignedOrders: {
      $sum: {
        $cond: [
          {
            $and: [
              { $eq: ['$orderType', 'delivery'] },
              { $eq: [{ $ifNull: ['$deliverymanId', null] }, null] },
              { $in: ['$orderStatus', ['stock_pending', 'pending', 'confirmed', 'processing', 'handover', 'picked_up']] },
            ],
          },
          1,
          0,
        ],
      },
    },
    refundRequests: { $sum: { $cond: [{ $eq: ['$refundStatus', 'pending'] }, 1, 0] } },
    approvedRefunds: { $sum: { $cond: [{ $eq: ['$refundStatus', 'approved'] }, 1, 0] } },
    deliveredSales: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, '$orderAmount', 0] } },
    newOrders: {
      $sum: {
        $cond: [
          { $and: [{ $gte: ['$createdAt', period.start] }, { $lte: ['$createdAt', period.end] }] },
          1,
          0,
        ],
      },
    },
  };
  const [summary, salesByBucket, statusRows] = await Promise.all([
    Order.aggregate([{ $match: filter }, { $group: summaryGroup }]),
    Order.aggregate([
      {
        $addFields: {
          dashboardDeliveredAt: {
            $convert: {
              input: { $ifNull: ['$deliveredAt', '$delivered'] },
              to: 'date',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $match: {
          ...filter,
          orderStatus: 'delivered',
          dashboardDeliveredAt: { $gte: period.start, $lte: period.end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: period.bucketFormat,
              date: '$dashboardDeliveredAt',
              timezone: TIME_ZONE,
            },
          },
          sales: { $sum: '$orderAmount' },
          orders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: filter },
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]),
  ]);
  const summaryRow = summary[0] || {};
  const salesMap = new Map(salesByBucket.map((entry) => [entry._id, entry]));
  const dailySales = period.buckets.map(({ key, label }) => {
    const entry = salesMap.get(key);
    return {
      date: key,
      label,
      sales: money(entry?.sales || 0),
      orders: entry?.orders || 0,
    };
  });
  const statusCounts = Object.fromEntries(statusRows.map(({ _id, count }) => [_id, count]));

  return {
    period: period.period,
    totalOrders: summaryRow.totalOrders || 0,
    newOrders: summaryRow.newOrders || 0,
    deliveredOrders: summaryRow.deliveredOrders || 0,
    pendingOrders: summaryRow.pendingOrders || 0,
    canceledOrders: summaryRow.canceledOrders || 0,
    unassignedOrders: summaryRow.unassignedOrders || 0,
    refundRequests: summaryRow.refundRequests || 0,
    approvedRefunds: summaryRow.approvedRefunds || 0,
    deliveredSales: money(summaryRow.deliveredSales || 0),
    periodDeliveredSales: money(dailySales.reduce((total, entry) => total + entry.sales, 0)),
    statusCounts,
    dailySales,
  };
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
  }).select('orderStatus paymentStatus');
  if (!priorOrder) throw new AppError('Order not found', 404);
  if (priorOrder.paymentStatus !== 'unpaid') {
    throw new AppError('Contact support to cancel an order that has already been paid', 409);
  }
  if (!['pending', 'failed'].includes(priorOrder.orderStatus)) {
    throw new AppError('You can only cancel an order before it is confirmed', 409);
  }
  const order = await Order.findOneAndUpdate(
    {
      ...idFilter,
      ownerId: actor.ownerId,
      isGuest: actor.isGuest,
      orderStatus: { $in: ['pending', 'failed'] },
      paymentStatus: 'unpaid',
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

// ── Admin Order Status Update ─────────────────────────────────────────────────
const ADMIN_STATUS_TRANSITIONS = {
  pending:    ['confirmed', 'canceled'],
  accepted:   ['processing', 'canceled'],
  confirmed:  ['processing', 'canceled'],
  processing: ['handover', 'canceled'],
  handover:   ['picked_up', 'canceled'],
  picked_up:  ['delivered', 'canceled'],
};

const adminUpdateOrderStatus = async (orderId, { status, reason } = {}, scope, assignedDriver) => {
  const Orders = orderModel();
  if (!mongoose.isValidObjectId(orderId)) throw new AppError('Valid orderId is required', 400);
  const allowed = ['confirmed', 'processing', 'handover', 'picked_up', 'delivered', 'canceled'];
  if (!allowed.includes(status)) throw new AppError('Invalid status', 400);
  const filter = { _id: orderId, ...await adminZoneFilter(scope), ...(assignedDriver ? { deliverymanId: assignedDriver } : {}) };
  const order = await Orders.findOne(filter);
  if (!order) throw new AppError('Order not found', 404);
  const validNext = ADMIN_STATUS_TRANSITIONS[order.orderStatus];
  if (!validNext?.includes(status)) throw new AppError(`Cannot transition order from ${order.orderStatus} to ${status}`, 409);
  if (order.orderType === 'delivery' && status === 'picked_up' && !order.deliverymanId) {
    throw new AppError('Assign a delivery person before pickup', 409);
  }
  if (status === 'canceled') {
    if (order.paymentStatus !== 'unpaid') throw new AppError('Paid orders require payment reconciliation before cancellation', 409);
    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 255) {
      throw new AppError('Enter a cancellation reason of up to 255 characters', 400);
    }
    const claimed = await Orders.findOneAndUpdate(
      { _id: order._id, orderStatus: order.orderStatus, paymentStatus: 'unpaid' },
      { orderStatus: 'canceling', cancellationReason: reason.trim() },
      { new: true },
    );
    if (!claimed) throw new AppError('Order status changed; refresh and try again', 409);
    try {
      if (claimed.stockReserved) await inventoryRequest(claimed._id.toString(), 'release');
      claimed.orderStatus = 'canceled';
      claimed.stockReserved = false;
      claimed.canceledAt = new Date();
      await claimed.save();
      return claimed;
    } catch (err) {
      await Orders.updateOne(
        { _id: claimed._id, orderStatus: 'canceling' },
        { $set: { orderStatus: order.orderStatus }, $unset: { cancellationReason: 1 } },
      );
      throw err;
    }
  }
  const tsMap = { confirmed: 'confirmedAt', processing: 'processingAt', handover: 'handoverAt', picked_up: 'pickedUpAt', delivered: 'deliveredAt' };
  const update = { orderStatus: status, [tsMap[status]]: new Date() };
  if (status === 'delivered' && order.paymentMethod === 'cash_on_delivery') update.paymentStatus = 'paid';
  const state = { ...filter, orderStatus: order.orderStatus, deliverymanId: order.deliverymanId ?? null };
  const changeStatus = (session) => Orders.findOneAndUpdate(state, { $set: update }, {
    returnDocument: 'after', runValidators: true, ...(session ? { session } : {}),
  });
  const updated = status === 'delivered' && order.deliverymanId
    ? await Orders.db.transaction(async (session) => {
      const delivered = await changeStatus(session);
      if (!delivered) return null;
      const DeliveryMan = operationsModel(require('../../models/auth/DeliveryMan'));
      const driver = await DeliveryMan.findById(delivered.deliverymanId).session(session);
      if (!driver) throw new AppError('Assigned delivery person no longer exists', 409);
      driver.currentOrders = Math.max(0, (driver.currentOrders ?? 0) - 1);
      driver.orderCount = (driver.orderCount ?? 0) + 1;
      const amount = money(delivered.deliveryCharge || 0);
      if (driver.earning && amount > 0) {
        const Ledger = operationsModel(require('../../models/auth/DMWalletTransaction'));
        driver.walletBalance = money(driver.walletBalance + amount);
        await Ledger.create([{
          dmId: driver._id, orderId: delivered._id, type: 'credit', amount, balance: driver.walletBalance,
          referenceType: 'order_earning', note: `Delivery earning for ${delivered.orderNumber}`,
        }], { session });
      }
      await driver.save({ session });
      return delivered;
    })
    : await changeStatus();
  if (!updated) throw new AppError('Order status changed; refresh and try again', 409);
  return updated;
};

const ASSIGNABLE = ['pending', 'accepted', 'confirmed', 'processing', 'handover'];
const isEnabled = (value) => [true, 1, '1'].includes(value);
const deliveryScope = async (order) => {
  const Store = operationsModel(require('../../models/store/Store'));
  const store = mongoose.isValidObjectId(order.storeId)
    ? await Store.findById(order.storeId).select('_id zoneId').lean()
    : /^\d+$/.test(String(order.storeId))
      ? await Store.findOne({ legacyId: Number(order.storeId) }).select('_id zoneId').lean()
      : null;
  const zoneId = order.zoneId || store?.zoneId;
  const scope = [{ storeId: store?._id || (mongoose.isValidObjectId(order.storeId) ? order.storeId : null) }].filter(({ storeId }) => storeId);
  if (zoneId && mongoose.isValidObjectId(zoneId)) scope.push({ storeId: null, zoneId });
  return scope;
};

const listDeliveryCandidates = async (orderId, scope, deliverymanId) => {
  const order = await getAdminOrder(orderId, scope);
  if (order.orderType !== 'delivery' || !ASSIGNABLE.includes(order.orderStatus)) return [];
  const scopes = await deliveryScope(order);
  if (!scopes.length) return [];
  const DeliveryMan = operationsModel(require('../../models/auth/DeliveryMan'));
  const drivers = await DeliveryMan.find({
    $or: scopes, ...(deliverymanId ? { _id: deliverymanId } : {}),
  }).select('fName lName status active applicationStatus').sort({ fName: 1, lName: 1 }).lean();
  return drivers.filter((driver) => isEnabled(driver.active) && isEnabled(driver.status)
    && (!driver.applicationStatus || driver.applicationStatus === 'approved'))
    .map(({ _id, fName, lName }) => ({ _id, name: [fName, lName].filter(Boolean).join(' ') }));
};

const assignDeliveryman = async (orderId, deliverymanId, scope, claim = false) => {
  if (!mongoose.isValidObjectId(orderId)) throw new AppError('Valid orderId is required', 400);
  if (!mongoose.isValidObjectId(deliverymanId)) throw new AppError('Valid deliverymanId is required', 400);
  const previous = await getAdminOrder(orderId, scope);
  if (claim && (previous.orderStatus !== 'confirmed' || previous.deliverymanId)) {
    throw new AppError('Order not available for acceptance', 409);
  }
  if (!(await listDeliveryCandidates(orderId, scope, deliverymanId)).length) {
    throw new AppError('No eligible delivery person found for this order', 409);
  }
  if (String(previous.deliverymanId) === String(deliverymanId)) return previous;
  const Orders = orderModel();
  const DeliveryMan = operationsModel(require('../../models/auth/DeliveryMan'));
  const order = await Orders.db.transaction(async (session) => {
    const assigned = await Orders.findOneAndUpdate(
      { _id: orderId, orderType: 'delivery', orderStatus: previous.orderStatus, deliverymanId: previous.deliverymanId ?? null },
      { $set: {
        deliverymanId,
        ...(['pending', 'confirmed'].includes(previous.orderStatus) ? { orderStatus: 'accepted', acceptedAt: new Date() } : {}),
      } },
      { returnDocument: 'after', session },
    );
    if (!assigned) return null;
    await DeliveryMan.updateOne(
      { _id: deliverymanId }, { $inc: { currentOrders: 1, assignedOrderCount: 1 } }, { session },
    );
    if (previous.deliverymanId) {
      await DeliveryMan.updateOne(
        { _id: previous.deliverymanId, currentOrders: { $gt: 0 } }, { $inc: { currentOrders: -1 } }, { session },
      );
    }
    return assigned;
  });
  if (!order) throw new AppError('Order assignment changed; refresh and try again', 409);
  return order;
};

const requestRefund = async (actor, orderId, reason) => {
  if (actor.isGuest) throw new AppError('Sign in to request a refund', 403);
  if (!mongoose.isValidObjectId(orderId)) throw new AppError('Valid orderId is required', 400);
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500)
    throw new AppError('reason is required (max 500 chars)', 400);
  const Orders = orderModel();
  const ownership = { _id: orderId, ownerId: actor.ownerId, isGuest: false };
  const order = await Orders.findOne(ownership);
  if (!order) throw new AppError('Order not found', 404);
  if (order.orderStatus !== 'delivered' || order.paymentStatus !== 'paid' || order.orderType === 'pos') {
    throw new AppError('Refund requests require a paid, delivered online order', 409);
  }
  const refundAmount = money(Math.max(0, order.orderAmount - (order.deliveryCharge ?? 0) - (order.dmTips ?? 0)));
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) throw new AppError('This order has no refundable balance', 409);
  const requested = await Orders.findOneAndUpdate(
    { ...ownership, orderStatus: 'delivered', paymentStatus: 'paid', refundStatus: { $in: ['none', null] } },
    { $set: { refundStatus: 'pending', refundReason: reason.trim(), refundAmount, refundRequestedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!requested) throw new AppError('The refund request already exists or the order has changed', 409);
  return requested;
};

const adminHandleRefund = async (orderId, action, note, scope) => {
  if (!mongoose.isValidObjectId(orderId)) throw new AppError('Valid orderId is required', 400);
  if (!['approved', 'rejected'].includes(action)) throw new AppError('action must be approved or rejected', 400);
  if (note !== undefined && (typeof note !== 'string' || note.trim().length > 500)) throw new AppError('Review note must be at most 500 characters', 400);
  const Orders = orderModel();
  const filter = { _id: orderId, ...await adminZoneFilter(scope) };
  const decision = { refundStatus: action, refundReviewNote: note?.trim(), refundReviewedAt: new Date() };
  return Orders.db.transaction(async (session) => {
    const order = await Orders.findOne(filter).session(session);
    if (!order) throw new AppError('Order not found', 404);
    if (order.refundStatus !== 'pending') throw new AppError('No pending refund request', 409);
    if (action === 'approved') {
      if (order.isGuest || order.paymentMethod !== 'wallet' || order.paymentStatus !== 'paid' || order.orderStatus !== 'delivered') {
        throw new AppError('Automatic settlement is available only for verified wallet payments', 409);
      }
      const User = operationsModel(require('../../models/auth/User'));
      const WalletTransaction = operationsModel(require('../../models/auth/WalletTransaction'));
      const reference = String(order._id);
      const entry = { userId: order.ownerId, reference };
      const debit = await WalletTransaction.findOne({ ...entry, type: 'debit', referenceType: 'order' }).session(session);
      const alreadyCredited = await WalletTransaction.exists({ ...entry, type: 'credit', referenceType: 'refund' }).session(session);
      const amount = money(order.refundAmount);
      if (!debit || alreadyCredited || !Number.isFinite(amount) || amount <= 0 || amount > debit.amount) {
        throw new AppError('A verified, unreversed wallet debit is required to settle this request', 409);
      }
      const user = await User.findById(order.ownerId).session(session);
      if (!user) throw new AppError('Customer account not found', 404);
      user.walletBalance = money(user.walletBalance + amount);
      await user.save({ session });
      await WalletTransaction.create([{
        ...entry, type: 'credit', amount, balance: user.walletBalance, referenceType: 'refund',
        note: `Refund for order ${order.orderNumber}`,
      }], { session });
      order.refundedAt = new Date();
      order.refundMethod = 'wallet';
    }
    Object.assign(order, decision);
    await order.save({ session });
    return order;
  });
};

const listRefundRequests = async (query = {}, scope) => {
  const Orders = orderModel();
  const { skip, page, limit } = paginate(query);
  const status = query.status || 'pending';
  if (!['pending', 'approved', 'rejected'].includes(status)) throw new AppError('Invalid refund status', 400);
  const filter = { refundStatus: status, ...await adminZoneFilter(scope) };
  const [orders, total] = await Promise.all([
    Orders.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit)
      .select('orderNumber storeName orderAmount paymentMethod refundStatus refundReason refundAmount refundReviewNote refundMethod refundRequestedAt').lean(),
    Orders.countDocuments(filter),
  ]);
  return { orders, total, page, limit, pages: Math.ceil(total / limit) };
};

const ParcelCategory = require('../../models/store/ParcelCategory');

const getParcelCategories = async (activeOnly = false) =>
  ParcelCategory.find(activeOnly ? { isActive: true } : {}).sort({ sortOrder: 1, createdAt: -1 });

const createParcelCategory = async (body) => {
  if (!body.name?.trim()) throw new AppError('name is required', 400);
  return ParcelCategory.create({ name: body.name.trim(), image: body.image, description: body.description, sortOrder: body.sortOrder || 0 });
};

const updateParcelCategory = async (id, body) => {
  const fields = Object.fromEntries(
    ['name', 'image', 'description', 'sortOrder', 'isActive']
      .filter((k) => body[k] !== undefined).map((k) => [k, body[k]])
  );
  const cat = await ParcelCategory.findByIdAndUpdate(id, fields, { new: true });
  if (!cat) throw new AppError('Parcel category not found', 404);
  return cat;
};

const removeParcelCategory = async (id) => {
  const cat = await ParcelCategory.findByIdAndDelete(id);
  if (!cat) throw new AppError('Parcel category not found', 404);
};

const placeParcelOrder = async (actor, moduleId, body = {}, idempotencyKey) => {
  if (!moduleId) throw new AppError('moduleId header is required', 400);
  const { parcel_category_id, receiver_details, charge, payment_method, order_note } = body;
  if (!parcel_category_id || !mongoose.isValidObjectId(parcel_category_id))
    throw new AppError('Valid parcel_category_id is required', 400);
  if (!receiver_details?.name || !receiver_details?.phone || !receiver_details?.address)
    throw new AppError('receiver_details (name, phone, address) are required', 400);
  if (!['cash_on_delivery', 'wallet', 'digital_payment'].includes(payment_method))
    throw new AppError('Invalid payment_method', 400);
  const category = await ParcelCategory.findById(parcel_category_id);
  if (!category || !category.isActive) throw new AppError('Parcel category not found or inactive', 404);
  const orderAmount = money(Number(charge) || 0);
  if (payment_method === 'wallet') {
    const User = operationsModel(require('../../models/auth/User'));
    const user = await User.findById(actor.ownerId).select('walletBalance').lean();
    if (!user || user.walletBalance < orderAmount) throw new AppError('Insufficient wallet balance', 400);
  }
  const order = await Order.create({
    orderNumber: `BB-P-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    ownerId: actor.ownerId, isGuest: actor.isGuest, idempotencyKey,
    moduleId: String(moduleId), storeId: 'parcel', storeName: 'Parcel',
    orderType: 'delivery', orderStatus: 'pending',
    paymentMethod: payment_method, paymentStatus: 'unpaid',
    items: [], itemSubtotal: 0, itemDiscount: 0, taxAmount: 0,
    deliveryCharge: orderAmount, orderAmount,
    deliveryAddress: receiver_details, orderNote: order_note?.trim(),
  });
  if (payment_method === 'wallet') {
        const User = operationsModel(require('../../models/auth/User'));
        const WalletTransaction = operationsModel(require('../../models/auth/WalletTransaction'));
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const user = await User.findById(actor.ownerId).session(session);
        if (!user || user.walletBalance < orderAmount) throw new AppError('Insufficient wallet balance', 400);
        user.walletBalance = money(user.walletBalance - orderAmount);
        await user.save({ session });
        await WalletTransaction.create([{
          userId: user._id, type: 'debit', amount: orderAmount,
          balance: user.walletBalance, referenceType: 'order',
          reference: order._id, note: `Parcel order ${order.orderNumber}`,
        }], { session });
        order.paymentStatus = 'paid';
        await order.save({ session });
      });
    } finally { await session.endSession(); }
  }
  return order;
};

module.exports = {
  placeOrder,
  quoteDeliveryAddress,
  reserveOrderStock,
  commitOrderStock,
  releaseOrderStock,
  listOrders,
  listVendorOrders,
  getVendorDashboard,
  updateVendorOrderStatus,
  listAdminOrders,
  getAdminOrder,
  getAdminDashboardStats,
  getOrder,
  cancelOrder,
  adminUpdateOrderStatus,
  assignDeliveryman,
  listDeliveryCandidates,
  requestRefund,
  adminHandleRefund,
  listRefundRequests,
  getParcelCategories,
  createParcelCategory,
  updateParcelCategory,
  removeParcelCategory,
  placeParcelOrder,
};
