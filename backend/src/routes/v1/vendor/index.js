const router = require('express').Router();
const vendor = require('../../../domains/identity/vendor.controller');
const orders = require('../../../domains/orders/order-proxy.controller');
const vendorAccess = require('../../../domains/identity/vendor-access.controller');
const { vendorAuth, checkVendorModule } = require('../../../middleware/auth');
const { success } = require('../../../utils/response');
const ssr = require('../../../domains/inventory/store-stock-requests.service');
const disbursement = require('../../../domains/store/store-disbursement.controller');
const itemReviews = require('../../../domains/catalog/item-reviews.controller');
const cancelReasons = require('../../../domains/store/misc.controller');
const notifExt = require('../../../domains/identity/notification-extended.controller');

router.use(vendorAuth);

router.get('/profile', vendor.getProfile);
router.put('/update-profile', checkVendorModule('bank_info'), vendor.updateProfile);
router.put('/update-fcm-token', vendor.updateFcmToken);
router.get('/dashboard', orders.dashboard);
router.get('/stores', checkVendorModule('my_shop'), vendor.getStores);

// Orders
router.get('/orders', checkVendorModule('order'), orders.list);
router.put('/orders/update-status', checkVendorModule('order'), orders.updateStatus);

// Items
router.get('/items', checkVendorModule('item'), vendor.getItems);
router.post('/items', checkVendorModule('item'), vendor.createItem);
router.put('/items/:id', checkVendorModule('item'), vendor.updateItem);
router.patch('/items/:id/status', checkVendorModule('item'), vendor.updateItemStatus);
router.delete('/items/:id', checkVendorModule('item'), vendor.deleteItem);

// Store Stock Requests (vendor creates + receives)
router.get('/store-stock-requests', checkVendorModule('item'), async (req, res, next) => {
  try {
    const storeIds = req.vendorContext?.storeIds || [];
    const result = await ssr.getAllForVendor(storeIds, req.query);
    return res.json({ success: true, data: result.requests, pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages } });
  } catch (err) { next(err); }
});

router.post('/store-stock-requests', checkVendorModule('item'), async (req, res, next) => {
  try {
    const storeIds = req.vendorContext?.storeIds || [];
    const request = await ssr.createRequestForVendor(storeIds, req.body);
    return success(res, request, 'Stock request created', 201);
  } catch (err) { next(err); }
});

router.get('/store-stock-requests/:id', checkVendorModule('item'), async (req, res, next) => {
  try {
    const storeIds = req.vendorContext?.storeIds || [];
    const request = await ssr.getByIdForVendor(req.params.id, storeIds);
    return success(res, request);
  } catch (err) { next(err); }
});

router.post('/store-stock-requests/:id/receive', checkVendorModule('item'), async (req, res, next) => {
  try {
    const storeIds = req.vendorContext?.storeIds || [];
    const request = await ssr.receiveRequestForVendor(req.params.id, storeIds, req.body.items, req.body.grnNumber);
    return success(res, request, 'Stock received');
  } catch (err) { next(err); }
});

router.post('/store-stock-requests/:id/cancel', checkVendorModule('item'), async (req, res, next) => {
  try {
    const storeIds = req.vendorContext?.storeIds || [];
    const request = await ssr.cancelRequestForVendor(req.params.id, storeIds);
    return success(res, request, 'Request cancelled');
  } catch (err) { next(err); }
});

// Wallet & Disbursement
router.get('/wallet', (req, res, next) => {
  const svc = require('../../../domains/store/store-disbursement.service');
  svc.getWallet(req.vendor._id).then((data) => res.json({ success: true, data })).catch(next);
});
router.get('/withdraw-requests', disbursement.getWithdrawRequests);
router.post('/withdraw-requests', disbursement.createWithdrawRequest);
router.get('/withdrawal-methods', (req, res, next) => {
  const svc = require('../../../domains/store/withdrawal-methods.service');
  svc.getAll(true).then((data) => res.json({ success: true, data })).catch(next);
});

// Item Reviews (vendor sees reviews for own store items)
router.get('/reviews', checkVendorModule('report'), itemReviews.getAll);

// Cancel Reasons (public for vendor)
router.get('/cancel-reasons', cancelReasons.getActiveCancelReasons);

// Chat (vendor ↔ admin)
router.get('/conversations', notifExt.vendorGetConversations);
router.get('/conversations/:id/messages', notifExt.vendorGetMessages);
router.post('/conversations/send', notifExt.vendorSendMessage);

// Employee Rolesrouter.get('/roles/permissions', checkVendorModule('custom_role'), vendorAccess.getPermissionModules);
router.get('/roles/assignable', checkVendorModule('employee'), vendorAccess.getAssignableRoles);
router.get('/roles', checkVendorModule('custom_role'), vendorAccess.getRoles);
router.post('/roles', checkVendorModule('custom_role'), vendorAccess.createRole);
router.get('/roles/:id', checkVendorModule('custom_role'), vendorAccess.getRole);
router.put('/roles/:id', checkVendorModule('custom_role'), vendorAccess.updateRole);
router.delete('/roles/:id', checkVendorModule('custom_role'), vendorAccess.deleteRole);

// Employees
router.get('/employees', checkVendorModule('employee'), vendorAccess.getEmployees);
router.post('/employees', checkVendorModule('employee'), vendorAccess.createEmployee);
router.put('/employees/:id', checkVendorModule('employee'), vendorAccess.updateEmployee);
router.patch('/employees/:id/status', checkVendorModule('employee'), vendorAccess.updateEmployeeStatus);
router.delete('/employees/:id', checkVendorModule('employee'), vendorAccess.deleteEmployee);

module.exports = router;
