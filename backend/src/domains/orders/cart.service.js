const mongoose = require('mongoose');
const Cart = require('./cart.model');
const AppError = require('../../utils/AppError');

const catalogUrl = () => (process.env.CATALOG_SERVICE_URL || 'http://localhost:5002').replace(/\/$/, '');
const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
};
const jsonKey = (value) => JSON.stringify(canonicalize(value ?? []));
const plain = (cart) => (typeof cart.toObject === 'function' ? cart.toObject() : cart);

const getCatalogItem = async (itemId) => {
  let response;
  try {
    response = await fetch(`${catalogUrl()}/api/v1/customer/items/${encodeURIComponent(itemId)}`, {
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    throw new AppError(`Catalog service unavailable: ${error.message}`, 503);
  }
  if (response.status === 404) throw new AppError('Item not found', 404);
  if (!response.ok) throw new AppError('Catalog service could not validate the item', 502);
  const payload = await response.json();
  if (!payload?.success || !payload.data) throw new AppError('Catalog service returned an invalid item response', 502);
  return payload.data;
};

const toResponse = async (cart) => {
  const data = plain(cart);
  let item = null;
  try {
    item = await getCatalogItem(data.itemId);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
  }
  return {
    _id: data._id.toString(),
    user_id: data.ownerId,
    is_guest: data.isGuest,
    module_id: data.moduleId,
    item_id: data.itemId,
    item_type: data.itemType,
    price: data.price,
    quantity: data.quantity,
    add_on_ids: data.addOnIds,
    add_on_qtys: data.addOnQtys,
    variation: data.variation,
    item,
    created_at: data.createdAt,
    updated_at: data.updatedAt,
  };
};

const list = async (actor, moduleId) => {
  if (!moduleId) throw new AppError('moduleId header is required', 400);
  const carts = await Cart.find({ ownerId: actor.ownerId, isGuest: actor.isGuest, moduleId: String(moduleId) })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  return Promise.all(carts.map(toResponse));
};

const add = async (actor, moduleId, body = {}) => {
  if (!moduleId) throw new AppError('moduleId header is required', 400);
  if (String(moduleId).length > 128) throw new AppError('moduleId is too long', 400);
  const itemId = body.item_id;
  if (itemId === undefined || itemId === null || itemId === '') throw new AppError('item_id is required', 400);
  if (body.model !== 'Item') {
    throw new AppError('Only Item products are currently supported in the cart', 400);
  }
  const price = Number(body.price);
  const quantity = Number(body.quantity);
  if (!Number.isFinite(price) || price < 0) throw new AppError('price must be a non-negative number', 400);
  if (!Number.isInteger(quantity) || quantity < 1) throw new AppError('quantity must be a positive integer', 400);

  const item = await getCatalogItem(itemId);
  if (String(item.moduleId) !== String(moduleId)) throw new AppError('Item does not belong to the requested module', 400);
  if (item.maximumCartQuantity && quantity > item.maximumCartQuantity) {
    throw new AppError('Maximum cart quantity exceeded', 400);
  }

  const variation = body.variation ?? [];
  if (!Array.isArray(variation) && (!variation || typeof variation !== 'object')) {
    throw new AppError('variation must be an array or object', 400);
  }
  const addOnIds = body.add_on_ids ?? [];
  const addOnQtys = body.add_on_qtys ?? [];
  if (!Array.isArray(addOnIds) || !Array.isArray(addOnQtys)) {
    throw new AppError('add_on_ids and add_on_qtys must be arrays', 400);
  }
  if (addOnIds.length > 50 || addOnQtys.length > 50) throw new AppError('No more than 50 add-ons are allowed', 400);
  if (addOnIds.length !== addOnQtys.length) throw new AppError('Add-on IDs and quantities must have matching lengths', 400);
  if (addOnQtys.some((value) => !Number.isInteger(Number(value)) || Number(value) < 1)) {
    throw new AppError('Add-on quantities must be positive integers', 400);
  }
  const variationKey = jsonKey(variation);
  if (variationKey.length > 512) throw new AppError('variation is too large', 400);
  const filter = {
    ownerId: actor.ownerId,
    isGuest: actor.isGuest,
    moduleId: String(moduleId),
    itemId: String(item._id),
    itemType: 'Item',
    variationKey,
  };
  if (await Cart.exists(filter)) throw new AppError('Item already exists in cart', 409);

  let cart;
  try {
    cart = await Cart.create({
      ...filter,
      price,
      quantity,
      addOnIds,
      addOnQtys,
      variation,
    });
  } catch (error) {
    if (error.code === 11000) throw new AppError('Item already exists in cart', 409);
    throw error;
  }
  return list(actor, moduleId);
};

const update = async (actor, moduleId, body = {}) => {
  if (!moduleId) throw new AppError('moduleId header is required', 400);
  if (String(moduleId).length > 128) throw new AppError('moduleId is too long', 400);
  if (!body.cart_id || !/^[a-f\d]{24}$/i.test(String(body.cart_id))) throw new AppError('Valid cart_id is required', 400);
  const price = Number(body.price);
  const quantity = Number(body.quantity);
  if (!Number.isFinite(price) || price < 0) throw new AppError('price must be a non-negative number', 400);
  if (!Number.isInteger(quantity) || quantity < 1) throw new AppError('quantity must be a positive integer', 400);

  const filter = {
    _id: body.cart_id,
    ownerId: actor.ownerId,
    isGuest: actor.isGuest,
    moduleId: String(moduleId),
  };
  const cart = await Cart.findOne(filter);
  if (!cart) throw new AppError('Cart item not found', 404);
  const item = await getCatalogItem(cart.itemId);
  if (item.maximumCartQuantity && quantity > item.maximumCartQuantity) {
    throw new AppError('Maximum cart quantity exceeded', 400);
  }

  cart.price = price;
  cart.quantity = quantity;
  if (body.add_on_ids !== undefined) {
    if (!Array.isArray(body.add_on_ids)) throw new AppError('add_on_ids must be an array', 400);
    if (body.add_on_ids.length > 50) throw new AppError('No more than 50 add-ons are allowed', 400);
    cart.addOnIds = body.add_on_ids;
  }
  if (body.add_on_qtys !== undefined) {
    if (!Array.isArray(body.add_on_qtys)) throw new AppError('add_on_qtys must be an array', 400);
    if (body.add_on_qtys.length > 50) throw new AppError('No more than 50 add-ons are allowed', 400);
    if (body.add_on_qtys.some((value) => !Number.isInteger(Number(value)) || Number(value) < 1)) {
      throw new AppError('Add-on quantities must be positive integers', 400);
    }
    cart.addOnQtys = body.add_on_qtys;
  }
  if (cart.addOnIds.length !== cart.addOnQtys.length) {
    throw new AppError('Add-on IDs and quantities must have matching lengths', 400);
  }
  if (body.variation !== undefined) {
    const variation = body.variation ?? [];
    if (!Array.isArray(variation) && (!variation || typeof variation !== 'object')) {
      throw new AppError('variation must be an array or object', 400);
    }
    const variationKey = jsonKey(variation);
    if (variationKey.length > 512) throw new AppError('variation is too large', 400);
    cart.variation = variation;
    cart.variationKey = variationKey;
  }
  await cart.save();
  return list(actor, moduleId);
};

const removeItem = async (actor, moduleId, cartId) => {
  if (!moduleId) throw new AppError('moduleId header is required', 400);
  if (!cartId || !/^[a-f\d]{24}$/i.test(String(cartId))) throw new AppError('Valid cart_id is required', 400);
  const removed = await Cart.findOneAndDelete({
    _id: cartId,
    ownerId: actor.ownerId,
    isGuest: actor.isGuest,
    moduleId: String(moduleId),
  });
  if (!removed) throw new AppError('Cart item not found', 404);
  return list(actor, moduleId);
};

const clear = async (actor, moduleId) => {
  if (!moduleId) throw new AppError('moduleId header is required', 400);
  await Cart.deleteMany({ ownerId: actor.ownerId, isGuest: actor.isGuest, moduleId: String(moduleId) });
  return list(actor, moduleId);
};

const mergeGuest = async (actor, moduleId, guestId) => {
  if (actor.isGuest) throw new AppError('Customer authentication is required', 401);
  if (!moduleId) throw new AppError('moduleId header is required', 400);
  if (typeof guestId !== 'string' || !guestId.trim() || guestId.length > 128) {
    throw new AppError('Valid guest_id is required', 400);
  }
  if (guestId === actor.ownerId) throw new AppError('guest_id must be different from the customer id', 400);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const guestCarts = await Cart.find({
        ownerId: guestId,
        isGuest: true,
        moduleId: String(moduleId),
      }).sort({ createdAt: 1, _id: 1 }).session(session);

      for (const guestCart of guestCarts) {
        const customerCart = await Cart.findOne({
          ownerId: actor.ownerId,
          isGuest: false,
          moduleId: String(moduleId),
          itemId: guestCart.itemId,
          itemType: guestCart.itemType,
          variationKey: guestCart.variationKey,
        }).session(session);
        if (customerCart) {
          customerCart.quantity += guestCart.quantity;
          await customerCart.save({ session });
          await guestCart.deleteOne({ session });
        } else {
          guestCart.ownerId = actor.ownerId;
          guestCart.isGuest = false;
          await guestCart.save({ session });
        }
      }
    });
  } finally {
    await session.endSession();
  }
  return list(actor, moduleId);
};

module.exports = { list, add, update, removeItem, clear, mergeGuest };
