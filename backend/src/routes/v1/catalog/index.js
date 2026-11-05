const router = require('express').Router();
const brands = require('../../../domains/catalog/brands.controller');
const categories = require('../../../domains/catalog/categories.controller');
const items = require('../../../domains/catalog/items.controller');
const units = require('../../../domains/catalog/units.controller');
const unitGroups = require('../../../domains/catalog/unit-groups.controller');
const itemBatches = require('../../../domains/catalog/item-batches.controller');
const { adminAuth } = require('../../../middleware/auth');
const { checkRole } = require('../../../middleware/roleCheck');

const adminOnly = [adminAuth, checkRole('admin')];

// Brands
router.get('/brands', adminOnly, brands.getAll);
router.post('/brands', adminOnly, brands.create);
router.put('/brands/:id', adminOnly, brands.update);
router.patch('/brands/:id/status', adminOnly, brands.updateStatus);
router.delete('/brands/:id', adminOnly, brands.remove);

// Categories
router.get('/categories', adminOnly, categories.getAll);
router.get('/categories/:id', adminOnly, categories.getOne);
router.post('/categories', adminOnly, categories.create);
router.put('/categories/:id', adminOnly, categories.update);
router.patch('/categories/:id/status', adminOnly, categories.updateStatus);
router.delete('/categories/:id', adminOnly, categories.remove);

// Items
router.get('/items', adminOnly, items.getAll);
router.get('/items/low-stock', adminOnly, items.getLowStock);
router.get('/items/:id', adminOnly, items.getOne);
router.post('/items', adminOnly, items.create);
router.put('/items/:id', adminOnly, items.update);
router.patch('/items/:id/status', adminOnly, items.updateStatus);
router.patch('/items/:id/stock', adminOnly, items.updateStock);
router.delete('/items/:id', adminOnly, items.remove);

// Units
router.get('/units', adminOnly, units.getAll);
router.get('/units/:id', adminOnly, units.getOne);
router.post('/units', adminOnly, units.create);
router.put('/units/:id', adminOnly, units.update);
router.delete('/units/:id', adminOnly, units.remove);

// Unit Groups
router.get('/unit-groups', adminOnly, unitGroups.getAll);
router.get('/unit-groups/:id', adminOnly, unitGroups.getOne);
router.post('/unit-groups', adminOnly, unitGroups.create);
router.put('/unit-groups/:id', adminOnly, unitGroups.update);
router.patch('/unit-groups/:id/status', adminOnly, unitGroups.updateStatus);
router.delete('/unit-groups/:id', adminOnly, unitGroups.remove);
router.get('/unit-groups/:id/conversions', adminOnly, unitGroups.getConversions);
router.post('/unit-groups/:id/conversions', adminOnly, unitGroups.addConversion);
router.put('/unit-groups/:id/conversions/:conversionId', adminOnly, unitGroups.updateConversion);
router.delete('/unit-groups/:id/conversions/:conversionId', adminOnly, unitGroups.removeConversion);

// Item Batches
router.get('/item-batches/expiring-soon', adminOnly, itemBatches.getExpiringSoon);
router.get('/item-batches', adminOnly, itemBatches.getAll);
router.get('/item-batches/:id', adminOnly, itemBatches.getOne);
router.post('/item-batches', adminOnly, itemBatches.create);
router.put('/item-batches/:id', adminOnly, itemBatches.update);
router.delete('/item-batches/:id', adminOnly, itemBatches.remove);

module.exports = router;
