const router = require('express').Router();
const brands = require('../../../domains/catalog/brands.controller');
const categories = require('../../../domains/catalog/categories.controller');
const items = require('../../../domains/catalog/items.controller');
const units = require('../../../domains/catalog/units.controller');
const unitGroups = require('../../../domains/catalog/unit-groups.controller');
const itemBatches = require('../../../domains/catalog/item-batches.controller');
const { adminAuth, checkAdminModule } = require('../../../middleware/auth');
const { checkRole } = require('../../../middleware/roleCheck');

const access = (module) => [adminAuth, checkRole('admin'), checkAdminModule(module)];

// Brands
router.get('/brands', access('item'), brands.getAll);
router.post('/brands', access('item'), brands.create);
router.put('/brands/:id', access('item'), brands.update);
router.patch('/brands/:id/status', access('item'), brands.updateStatus);
router.delete('/brands/:id', access('item'), brands.remove);

// Categories
router.get('/categories', access('category'), categories.getAll);
router.get('/categories/:id', access('category'), categories.getOne);
router.post('/categories', access('category'), categories.create);
router.put('/categories/:id', access('category'), categories.update);
router.patch('/categories/:id/status', access('category'), categories.updateStatus);
router.delete('/categories/:id', access('category'), categories.remove);

// Items
router.get('/items', access('item'), items.getAll);
router.get('/items/low-stock', access('item'), items.getLowStock);
router.get('/items/:id', access('item'), items.getOne);
router.post('/items', access('item'), items.create);
router.put('/items/:id', access('item'), items.update);
router.patch('/items/:id/status', access('item'), items.updateStatus);
router.patch('/items/:id/stock', access('item'), items.updateStock);
router.delete('/items/:id', access('item'), items.remove);

// Units
router.get('/units', access('unit'), units.getAll);
router.get('/units/:id', access('unit'), units.getOne);
router.post('/units', access('unit'), units.create);
router.put('/units/:id', access('unit'), units.update);
router.delete('/units/:id', access('unit'), units.remove);

// Unit Groups
router.get('/unit-groups', access('unit'), unitGroups.getAll);
router.get('/unit-groups/:id', access('unit'), unitGroups.getOne);
router.post('/unit-groups', access('unit'), unitGroups.create);
router.put('/unit-groups/:id', access('unit'), unitGroups.update);
router.patch('/unit-groups/:id/status', access('unit'), unitGroups.updateStatus);
router.delete('/unit-groups/:id', access('unit'), unitGroups.remove);
router.get('/unit-groups/:id/conversions', access('unit'), unitGroups.getConversions);
router.post('/unit-groups/:id/conversions', access('unit'), unitGroups.addConversion);
router.put('/unit-groups/:id/conversions/:conversionId', access('unit'), unitGroups.updateConversion);
router.delete('/unit-groups/:id/conversions/:conversionId', access('unit'), unitGroups.removeConversion);

// Item Batches
router.get('/item-batches/expiring-soon', access('item'), itemBatches.getExpiringSoon);
router.get('/item-batches', access('item'), itemBatches.getAll);
router.get('/item-batches/:id', access('item'), itemBatches.getOne);
router.post('/item-batches', access('item'), itemBatches.create);
router.put('/item-batches/:id', access('item'), itemBatches.update);
router.delete('/item-batches/:id', access('item'), itemBatches.remove);

module.exports = router;
