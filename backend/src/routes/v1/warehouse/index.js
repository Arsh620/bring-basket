const router = require('express').Router();
const warehouseAuthCtrl = require('../../../domains/identity/warehouse-auth.controller');
const warehouseStock = require('../../../domains/inventory/warehouse-stock.controller');
const stockTransfers = require('../../../domains/inventory/stock-transfers.controller');
const storeStockRequests = require('../../../domains/inventory/store-stock-requests.controller');
const stockMovements = require('../../../domains/inventory/stock-movements.controller');
const subWarehouses = require('../../../domains/inventory/sub-warehouses.controller');
const warehouseExpiry = require('../../../domains/inventory/warehouse-expiry.service');
const purchaseVendors = require('../../../domains/procurement/purchase-vendors.controller');
const purchaseOrders = require('../../../domains/procurement/purchase-orders.controller');
const purchaseBills = require('../../../domains/procurement/purchase-bills.controller');
const purchasePayments = require('../../../domains/procurement/purchase-payments.controller');
const { warehouseAuth } = require('../../../middleware/auth');
const warehouseAccess = require('../../../middleware/warehouse-portal');
const motherOnly = warehouseAccess.requireWarehouseType('mother');

// ── Public auth ───────────────────────────────────────────────────────────────
router.post('/auth/login', warehouseAuthCtrl.login);
router.get('/auth/me', warehouseAuth, warehouseAuthCtrl.me);
router.post('/auth/logout', warehouseAuth, warehouseAuthCtrl.logout);

// ── All routes below require warehouse auth ───────────────────────────────────
router.use(warehouseAuth);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res, next) => {
  try {
    const WarehouseItemStock = require('../../../models/warehouse/WarehouseItemStock');
    const StoreStockRequest = require('../../../models/warehouse/StoreStockRequest');
    const WarehouseStockTransfer = require('../../../models/warehouse/WarehouseStockTransfer');
    const PurchaseBill = require('../../../models/purchase/PurchaseBill');
    const PurchaseOrder = require('../../../models/purchase/PurchaseOrder');

    const wId = req.warehouse._id;
    const isMother = req.warehouse.type === 'mother';

    const [totalItems, pendingRequests, pendingTransfers, openBills, draftOrders] = await Promise.all([
      WarehouseItemStock.countDocuments({ warehouseId: wId }),
      isMother ? StoreStockRequest.countDocuments({ motherWarehouseId: wId, status: 'requested' }) : 0,
      WarehouseStockTransfer.countDocuments({
        $or: [{ motherWarehouseId: wId }, { subWarehouseId: wId }],
        status: 'requested',
      }),
      isMother ? PurchaseBill.countDocuments({ warehouseId: wId, status: { $in: ['open', 'partially_paid'] } }) : 0,
      isMother ? PurchaseOrder.countDocuments({ warehouseId: wId, status: 'draft' }) : 0,
    ]);

    return res.json({
      success: true,
      data: { totalItems, pendingRequests, pendingTransfers, openBills, draftOrders },
    });
  } catch (err) { next(err); }
});

// ── Own stock ─────────────────────────────────────────────────────────────────
router.get('/stock', (req, res, next) => {
  req.params.id = req.user.id;
  return warehouseStock.getStock(req, res, next);
});
router.put('/stock/:itemId', (req, res) =>
  res.status(403).json({ success: false, message: 'Only administrators can update warehouse stock' }));
router.patch('/stock/:itemId/adjust', (req, res) =>
  res.status(403).json({ success: false, message: 'Only administrators can update warehouse stock' }));

// ── Stock movements ───────────────────────────────────────────────────────────
router.get('/stock-movements', warehouseAccess.scopeStockMovements, stockMovements.getAll);

// ── Stock transfers ───────────────────────────────────────────────────────────
router.get('/transfers', warehouseAccess.scopeTransfers, stockTransfers.getAll);
router.post('/transfers', warehouseAccess.requireWarehouseType('sub'), warehouseAccess.requireSubMother, stockTransfers.create);
router.get('/transfers/:id', warehouseAccess.requireTransferParty, stockTransfers.getOne);
router.patch('/transfers/:id/dispatch', motherOnly, warehouseAccess.requireTransferParty, stockTransfers.dispatch);
router.patch('/transfers/:id/receive', warehouseAccess.requireTransferParty, warehouseAccess.requireTransferDestination, stockTransfers.receive);
router.patch('/transfers/:id/reject', motherOnly, warehouseAccess.requireTransferParty, stockTransfers.reject);
router.patch('/transfers/:id/cancel', warehouseAccess.requireWarehouseType('sub'), warehouseAccess.requireTransferParty, stockTransfers.cancel);

// ── Store stock requests (mother dispatches to stores) ────────────────────────
router.get('/store-requests', motherOnly, warehouseAccess.scopeStoreRequests, storeStockRequests.getAll);
router.get('/store-requests/:id', motherOnly, warehouseAccess.requireStoreRequestParty, storeStockRequests.getOne);
router.patch('/store-requests/:id/dispatch', motherOnly, warehouseAccess.requireStoreRequestParty, storeStockRequests.dispatch);
router.patch('/store-requests/:id/reject', motherOnly, warehouseAccess.requireStoreRequestParty, storeStockRequests.reject);

// ── Sub-warehouse management (mother only) ────────────────────────────────────
router.get('/subs', motherOnly, subWarehouses.getAll);
router.post('/subs', motherOnly, subWarehouses.create);
router.get('/subs/:id', motherOnly, subWarehouses.getOne);
router.put('/subs/:id', motherOnly, subWarehouses.update);
router.patch('/subs/:id/status', motherOnly, subWarehouses.updateStatus);
router.post('/subs/:id/credentials', motherOnly, subWarehouses.setCredentials);
router.get('/subs/:id/stock', motherOnly, subWarehouses.getStock);

// ── Expiry reports (warehouse portal) ────────────────────────────────────────
router.get('/expiry/near', async (req, res, next) => {
  try {
    const data = await warehouseExpiry.nearExpiry(req.warehouse._id, req.query.days);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});
router.get('/expiry/expired', async (req, res, next) => {
  try {
    const data = await warehouseExpiry.expired(req.warehouse._id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});
router.post('/expiry/write-off/:batchId', motherOnly, async (req, res, next) => {
  try {
    const result = await warehouseExpiry.writeOff(req.params.batchId, req.warehouse._id, req.body.note);
    res.json({ success: true, data: result, message: 'Write-off recorded' });
  } catch (e) { next(e); }
});

// ── Purchase suite (mother only, scoped to this warehouse) ────────────────────
router.use('/purchases', motherOnly, (req, res, next) => {
  // Inject warehouseId into query/body so controllers scope correctly
  req.query.warehouseId = String(req.warehouse._id);
  next();
});

// Vendors (scoped to this warehouse's state/vendors)
router.get('/purchases/vendors', purchaseVendors.getAll);
router.get('/purchases/vendors/:id', purchaseVendors.getOne);
router.post('/purchases/vendors', purchaseVendors.create);
router.put('/purchases/vendors/:id', purchaseVendors.update);
router.patch('/purchases/vendors/:id/status', purchaseVendors.updateStatus);
router.patch('/purchases/vendors/:id/approval', purchaseVendors.updateApproval);
router.delete('/purchases/vendors/:id', purchaseVendors.remove);

// Purchase Orders
router.get('/purchases/orders', purchaseOrders.getAll);
router.get('/purchases/orders/:id', purchaseOrders.getOne);
router.post('/purchases/orders', purchaseOrders.create);
router.put('/purchases/orders/:id', purchaseOrders.update);
router.post('/purchases/orders/:id/issue', purchaseOrders.issue);
router.post('/purchases/orders/:id/cancel', purchaseOrders.cancel);
router.post('/purchases/orders/:id/convert-to-bill', purchaseBills.convertFromOrder);

// Purchase Bills
router.get('/purchases/bills', purchaseBills.getAll);
router.get('/purchases/bills/:id', purchaseBills.getOne);
router.put('/purchases/bills/:id', purchaseBills.update);
router.post('/purchases/bills/:id/void', purchaseBills.void);
router.post('/purchases/bills/:id/mark-stock-received', purchaseBills.receiveStock);

// Purchase Payments
router.get('/purchases/payments', purchasePayments.getAll);
router.post('/purchases/payments', purchasePayments.record);
router.delete('/purchases/payments/:id', purchasePayments.remove);

module.exports = router;
