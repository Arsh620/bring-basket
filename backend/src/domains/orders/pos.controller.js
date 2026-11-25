const { success } = require('../../utils/response');
const pos = require('./pos.service');

const run = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (err) { next(err); }
};

// sessionId = per-user/per-terminal unique string sent by client
const sid = (req) => {
  if (req.posSessionId) return req.posSessionId;
  const id = req.headers['x-pos-session'] || req.query.sessionId;
  if (!id || typeof id !== 'string' || id.length < 4 || id.length > 128) {
    const { error } = require('../../utils/response');
    throw Object.assign(new Error('x-pos-session header is required (4-128 chars)'), { statusCode: 400 });
  }
  // Keep carts separate for each authenticated operator, even when clients reuse a session ID.
  return `${req.user?.id || 'operator'}:${id}`;
};

exports.getCart = run(async (req, res) => {
  const result = await pos.getCart(sid(req));
  success(res, result || { cart: null, totals: null });
});

exports.addItem = run(async (req, res) => {
  const result = await pos.addItem(sid(req), req.posStoreId || req.body.storeId, req.body);
  success(res, result, 'Item added');
});

exports.updateItem = run(async (req, res) => {
  const result = await pos.updateItem(sid(req), req.params.index, req.body.qty);
  success(res, result, 'Item updated');
});

exports.removeItem = run(async (req, res) => {
  const result = await pos.removeItem(sid(req), req.params.index);
  success(res, result, 'Item removed');
});

const actor = (req) => ({ id: req.user?.id, role: req.user?.role });

exports.holdCart = run(async (req, res) => {
  const held = await pos.holdCart(sid(req), req.posStoreId || req.body.storeId, actor(req), req.body.label);
  success(res, held, 'Cart held', 201);
});

exports.listHeldCarts = run(async (req, res) => {
  const held = await pos.listHeldCarts(req.posStoreId || req.query.storeId, actor(req));
  success(res, held);
});

exports.resumeHeldCart = run(async (req, res) => {
  const cart = await pos.resumeHeldCart(sid(req), req.posStoreId || req.body.storeId, req.params.id, actor(req));
  success(res, cart, 'Held cart resumed');
});

exports.discardHeldCart = run(async (req, res) => {
  const result = await pos.discardHeldCart(req.posStoreId || req.body.storeId, req.params.id, actor(req));
  success(res, result, 'Held cart deleted');
});

exports.scanItem = run(async (req, res) => {
  const item = await pos.scanItem(req.posStoreId || req.query.storeId, req.query.code);
  success(res, item);
});

exports.listItems = run(async (req, res) => {
  const result = await pos.listItems(req.posStoreId || req.query.storeId, req.query);
  success(res, result);
});

exports.listAdminStores = run(async (req, res) => {
  const stores = await pos.listAdminStores(req.user.id);
  success(res, stores);
});

exports.clearCart = run(async (req, res) => {
  const result = await pos.clearCart(sid(req));
  success(res, result, 'Cart cleared');
});

exports.setMeta = run(async (req, res) => {
  const result = await pos.setCartMeta(sid(req), req.body, req.posStoreId || req.body.storeId);
  success(res, result, 'Cart updated');
});

exports.placeOrder = run(async (req, res) => {
  const order = await pos.placeOrder(sid(req), {
    paymentMethod: req.body.paymentMethod,
    actorId: req.user?.id,
    actorRole: req.user?.role,
  });
  success(res, order, 'Order placed', 201);
});

exports.searchCustomers = run(async (req, res) => {
  const customers = await pos.searchCustomers(req.query.q);
  success(res, customers);
});
