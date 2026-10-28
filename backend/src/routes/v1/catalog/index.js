const router = require('express').Router();
const brands = require('../../../domains/catalog/brands.controller');
const categories = require('../../../domains/catalog/categories.controller');
const items = require('../../../domains/catalog/items.controller');
const units = require('../../../domains/catalog/units.controller');
const unitGroups = require('../../../domains/catalog/unit-groups.controller');
const itemBatches = require('../../../domains/catalog/item-batches.controller');
const { adminAuth } = require('../../../middleware/auth');

// Brands
router.get('/brands', adminAuth, brands.getAll);
router.post('/brands', adminAuth, brands.create);
router.put('/brands/:id', adminAuth, brands.update);
router.patch('/brands/:id/status', adminAuth, brands.updateStatus);
router.delete('/brands/:id', adminAuth, brands.remove);

// Categories
router.get('/categories', adminAuth, categories.getAll);
router.get('/categories/:id', adminAuth, categories.getOne);
router.post('/categories', adminAuth, categories.create);
router.put('/categories/:id', adminAuth, categories.update);
router.patch('/categories/:id/status', adminAuth, categories.updateStatus);
router.delete('/categories/:id', adminAuth, categories.remove);

// Items
router.get('/items', adminAuth, items.getAll);
router.get('/items/low-stock', adminAuth, items.getLowStock);
router.get('/items/:id', adminAuth, items.getOne);
router.post('/items', adminAuth, items.create);
router.put('/items/:id', adminAuth, items.update);
router.patch('/items/:id/status', adminAuth, items.updateStatus);
router.patch('/items/:id/stock', adminAuth, items.updateStock);
router.delete('/items/:id', adminAuth, items.remove);

// Units
router.get('/units', adminAuth, units.getAll);
router.get('/units/:id', adminAuth, units.getOne);
router.post('/units', adminAuth, units.create);
router.put('/units/:id', adminAuth, units.update);
router.delete('/units/:id', adminAuth, units.remove);

// Unit Groups
router.get('/unit-groups', adminAuth, unitGroups.getAll);
router.get('/unit-groups/:id', adminAuth, unitGroups.getOne);
router.post('/unit-groups', adminAuth, unitGroups.create);
router.put('/unit-groups/:id', adminAuth, unitGroups.update);
router.patch('/unit-groups/:id/status', adminAuth, unitGroups.updateStatus);
router.delete('/unit-groups/:id', adminAuth, unitGroups.remove);
router.get('/unit-groups/:id/conversions', adminAuth, unitGroups.getConversions);
router.post('/unit-groups/:id/conversions', adminAuth, unitGroups.addConversion);
router.put('/unit-groups/:id/conversions/:conversionId', adminAuth, unitGroups.updateConversion);
router.delete('/unit-groups/:id/conversions/:conversionId', adminAuth, unitGroups.removeConversion);

// Item Batches
router.get('/item-batches/expiring-soon', adminAuth, itemBatches.getExpiringSoon);
router.get('/item-batches', adminAuth, itemBatches.getAll);
router.get('/item-batches/:id', adminAuth, itemBatches.getOne);
router.post('/item-batches', adminAuth, itemBatches.create);
router.put('/item-batches/:id', adminAuth, itemBatches.update);
router.delete('/item-batches/:id', adminAuth, itemBatches.remove);

module.exports = router;
