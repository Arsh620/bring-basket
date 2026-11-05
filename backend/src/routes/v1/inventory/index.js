const router = require('express').Router();
const warehouses = require('../../../domains/inventory/warehouses.controller');
const warehouseStock = require('../../../domains/inventory/warehouse-stock.controller');
const stockMovements = require('../../../domains/inventory/stock-movements.controller');
const stockTransfers = require('../../../domains/inventory/stock-transfers.controller');
const storeStockRequests = require('../../../domains/inventory/store-stock-requests.controller');
const batchWriteOffs = require('../../../domains/inventory/batch-write-offs.controller');
const { adminAuth } = require('../../../middleware/auth');
const { checkRole } = require('../../../middleware/roleCheck');

const adminOnly = [adminAuth, checkRole('admin')];

// Warehouses
router.get('/warehouses', adminOnly, warehouses.getAll);
router.post('/warehouses', adminOnly, warehouses.create);
router.get('/warehouses/:id', adminOnly, warehouses.getOne);
router.put('/warehouses/:id', adminOnly, warehouses.update);
router.patch('/warehouses/:id/status', adminOnly, warehouses.updateStatus);
router.delete('/warehouses/:id', adminOnly, warehouses.remove);

// Warehouse Stock
router.get('/warehouses/:id/stock', adminOnly, warehouseStock.getStock);
router.put('/warehouses/:id/stock/:itemId', adminOnly, warehouseStock.setStock);
router.patch('/warehouses/:id/stock/:itemId/adjust', adminOnly, warehouseStock.adjustStock);

// Stock Movements
router.get('/stock-movements', adminOnly, stockMovements.getAll);

// Stock Transfers
router.get('/stock-transfers', adminOnly, stockTransfers.getAll);
router.post('/stock-transfers', adminOnly, stockTransfers.create);
router.get('/stock-transfers/:id', adminOnly, stockTransfers.getOne);
router.patch('/stock-transfers/:id/dispatch', adminOnly, stockTransfers.dispatch);
router.patch('/stock-transfers/:id/receive', adminOnly, stockTransfers.receive);
router.patch('/stock-transfers/:id/reject', adminOnly, stockTransfers.reject);

// Store Stock Requests
router.get('/store-stock-requests', adminOnly, storeStockRequests.getAll);
router.post('/store-stock-requests', adminOnly, storeStockRequests.create);
router.get('/store-stock-requests/:id', adminOnly, storeStockRequests.getOne);
router.patch('/store-stock-requests/:id/approve', adminOnly, storeStockRequests.approve);
router.patch('/store-stock-requests/:id/dispatch', adminOnly, storeStockRequests.dispatch);
router.patch('/store-stock-requests/:id/receive', adminOnly, storeStockRequests.receive);
router.patch('/store-stock-requests/:id/reject', adminOnly, storeStockRequests.reject);

// Batch Write-offs
router.get('/batch-write-offs', adminOnly, batchWriteOffs.getAll);
router.post('/batch-write-offs', adminOnly, batchWriteOffs.create);

module.exports = router;
