const router = require('express').Router();
const warehouses = require('../../../domains/inventory/warehouses.controller');
const warehouseStock = require('../../../domains/inventory/warehouse-stock.controller');
const stockMovements = require('../../../domains/inventory/stock-movements.controller');
const stockTransfers = require('../../../domains/inventory/stock-transfers.controller');
const storeStockRequests = require('../../../domains/inventory/store-stock-requests.controller');
const batchWriteOffs = require('../../../domains/inventory/batch-write-offs.controller');
const { adminAuth } = require('../../../middleware/auth');

// Warehouses
router.get('/warehouses', adminAuth, warehouses.getAll);
router.post('/warehouses', adminAuth, warehouses.create);
router.get('/warehouses/:id', adminAuth, warehouses.getOne);
router.put('/warehouses/:id', adminAuth, warehouses.update);
router.patch('/warehouses/:id/status', adminAuth, warehouses.updateStatus);
router.delete('/warehouses/:id', adminAuth, warehouses.remove);

// Warehouse Stock
router.get('/warehouses/:id/stock', adminAuth, warehouseStock.getStock);
router.put('/warehouses/:id/stock/:itemId', adminAuth, warehouseStock.setStock);
router.patch('/warehouses/:id/stock/:itemId/adjust', adminAuth, warehouseStock.adjustStock);

// Stock Movements
router.get('/stock-movements', adminAuth, stockMovements.getAll);

// Stock Transfers
router.get('/stock-transfers', adminAuth, stockTransfers.getAll);
router.post('/stock-transfers', adminAuth, stockTransfers.create);
router.get('/stock-transfers/:id', adminAuth, stockTransfers.getOne);
router.patch('/stock-transfers/:id/dispatch', adminAuth, stockTransfers.dispatch);
router.patch('/stock-transfers/:id/receive', adminAuth, stockTransfers.receive);
router.patch('/stock-transfers/:id/reject', adminAuth, stockTransfers.reject);

// Store Stock Requests
router.get('/store-stock-requests', adminAuth, storeStockRequests.getAll);
router.post('/store-stock-requests', adminAuth, storeStockRequests.create);
router.get('/store-stock-requests/:id', adminAuth, storeStockRequests.getOne);
router.patch('/store-stock-requests/:id/approve', adminAuth, storeStockRequests.approve);
router.patch('/store-stock-requests/:id/dispatch', adminAuth, storeStockRequests.dispatch);
router.patch('/store-stock-requests/:id/receive', adminAuth, storeStockRequests.receive);
router.patch('/store-stock-requests/:id/reject', adminAuth, storeStockRequests.reject);

// Batch Write-offs
router.get('/batch-write-offs', adminAuth, batchWriteOffs.getAll);
router.post('/batch-write-offs', adminAuth, batchWriteOffs.create);

module.exports = router;
