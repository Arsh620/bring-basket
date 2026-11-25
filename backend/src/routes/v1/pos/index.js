const router = require('express').Router();
const pos = require('../../../domains/orders/pos.controller');
const { adminAuth, checkAdminModule, vendorAuth, checkVendorModule } = require('../../../middleware/auth');
const { checkRole } = require('../../../middleware/roleCheck');
const AppError = require('../../../utils/AppError');
const mongoose = require('mongoose');

// Admin POS — requires admin auth + pos module
const adminPosAccess = [adminAuth, checkRole('admin'), checkAdminModule('pos')];
const adminPosContext = async (req, res, next) => {
  try {
    const suppliedSession = req.headers['x-pos-session'] || req.query.sessionId;
    if (typeof suppliedSession !== 'string' || suppliedSession.length < 4 || suppliedSession.length > 128) {
      throw new AppError('x-pos-session header is required (4-128 chars)', 400);
    }
    const storeId = req.headers['x-pos-store'] || req.body?.storeId || req.query.storeId;
    if (!mongoose.isValidObjectId(storeId)) throw new AppError('Choose a valid store for this POS session', 400);

    const Admin = require('../../../models/auth/Admin');
    const Store = require('../../../models/store/Store');
    const [admin, store] = await Promise.all([
      Admin.findById(req.user.id).select('zoneId status').lean(),
      Store.findById(storeId).select('_id zoneId status active').lean(),
    ]);
    if (!admin || admin.status === false || !store || store.status === false || store.active === false) {
      throw new AppError('Store is not available to this admin', 403);
    }
    if (admin.zoneId && String(admin.zoneId) !== String(store.zoneId)) {
      throw new AppError('Store is outside your assigned zone', 403);
    }
    req.posStoreId = String(store._id);
    req.posSessionId = `admin:${req.user.id}:${store._id}:${suppliedSession}`;
    return next();
  } catch (err) {
    return next(err);
  }
};

router.get('/admin/pos/stores',            ...adminPosAccess, pos.listAdminStores);
router.get('/admin/pos/items',             ...adminPosAccess, adminPosContext, pos.listItems);
router.get('/admin/pos/items/scan',        ...adminPosAccess, adminPosContext, pos.scanItem);
router.get('/admin/pos/cart',              ...adminPosAccess, adminPosContext, pos.getCart);
router.post('/admin/pos/cart/items',       ...adminPosAccess, adminPosContext, pos.addItem);
router.put('/admin/pos/cart/items/:index', ...adminPosAccess, adminPosContext, pos.updateItem);
router.delete('/admin/pos/cart/items/:index', ...adminPosAccess, adminPosContext, pos.removeItem);
router.delete('/admin/pos/cart',           ...adminPosAccess, adminPosContext, pos.clearCart);
router.post('/admin/pos/cart/hold',        ...adminPosAccess, adminPosContext, pos.holdCart);
router.get('/admin/pos/cart/held',         ...adminPosAccess, adminPosContext, pos.listHeldCarts);
router.post('/admin/pos/cart/held/:id/resume', ...adminPosAccess, adminPosContext, pos.resumeHeldCart);
router.delete('/admin/pos/cart/held/:id',  ...adminPosAccess, adminPosContext, pos.discardHeldCart);
router.patch('/admin/pos/cart/meta',       ...adminPosAccess, adminPosContext, pos.setMeta);
router.post('/admin/pos/cart/place-order', ...adminPosAccess, adminPosContext, pos.placeOrder);
router.get('/admin/pos/customers',         ...adminPosAccess, adminPosContext, pos.searchCustomers);

// Vendor POS — requires vendor auth
const vendorPosContext = (req, res, next) => {
  const suppliedSession = req.headers['x-pos-session'] || req.query.sessionId;
  if (typeof suppliedSession !== 'string' || suppliedSession.length < 4 || suppliedSession.length > 128) {
    return next(new AppError('x-pos-session header is required (4-128 chars)', 400));
  }

  const allowedStores = (req.vendorContext?.storeIds || []).map(String);
  const requestedStore = req.headers['x-pos-store'] || req.body?.storeId || req.query.storeId;
  const storeId = requestedStore ? String(requestedStore) : allowedStores.length === 1 ? allowedStores[0] : null;
  if (!storeId || !allowedStores.includes(storeId)) {
    return next(new AppError('Choose a store you are authorized to manage', 403));
  }

  req.posStoreId = storeId;
  req.posSessionId = `vendor:${req.vendorContext.vendorId}:${storeId}:${suppliedSession}`;
  return next();
};
const vendorPosAccess = [vendorAuth, checkVendorModule('pos'), vendorPosContext];

router.get('/vendor/pos/cart',              ...vendorPosAccess, pos.getCart);
router.get('/vendor/pos/items',             ...vendorPosAccess, pos.listItems);
router.get('/vendor/pos/items/scan',        ...vendorPosAccess, pos.scanItem);
router.post('/vendor/pos/cart/items',       ...vendorPosAccess, pos.addItem);
router.put('/vendor/pos/cart/items/:index', ...vendorPosAccess, pos.updateItem);
router.delete('/vendor/pos/cart/items/:index', ...vendorPosAccess, pos.removeItem);
router.delete('/vendor/pos/cart',           ...vendorPosAccess, pos.clearCart);
router.post('/vendor/pos/cart/hold',        ...vendorPosAccess, pos.holdCart);
router.get('/vendor/pos/cart/held',         ...vendorPosAccess, pos.listHeldCarts);
router.post('/vendor/pos/cart/held/:id/resume', ...vendorPosAccess, pos.resumeHeldCart);
router.delete('/vendor/pos/cart/held/:id',  ...vendorPosAccess, pos.discardHeldCart);
router.patch('/vendor/pos/cart/meta',       ...vendorPosAccess, pos.setMeta);
router.post('/vendor/pos/cart/place-order', ...vendorPosAccess, pos.placeOrder);
router.get('/vendor/pos/customers',         ...vendorPosAccess, pos.searchCustomers);

module.exports = router;
