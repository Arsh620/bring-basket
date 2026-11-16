const router = require('express').Router();
const modules = require('../../../domains/store/modules.controller');
const zones = require('../../../domains/store/zones.controller');
const stores = require('../../../domains/store/stores.controller');
const customerStores = require('../../../domains/store/customer-stores.controller');
const banners = require('../../../domains/store/banners.controller');
const coupons = require('../../../domains/store/coupons.controller');
const flashSales = require('../../../domains/store/flash-sales.controller');
const campaigns = require('../../../domains/store/campaigns.controller');
const advertisements = require('../../../domains/store/advertisements.controller');
const { adminAuth } = require('../../../middleware/auth');
const { checkRole } = require('../../../middleware/roleCheck');

const adminOnly = [adminAuth, checkRole('admin')];

// Modules
router.get('/modules', adminOnly, modules.getAll);
router.post('/modules', adminOnly, modules.create);
router.get('/modules/:id', adminOnly, modules.getOne);
router.put('/modules/:id', adminOnly, modules.update);
router.patch('/modules/:id/status', adminOnly, modules.updateStatus);
router.delete('/modules/:id', adminOnly, modules.remove);

// Zones
router.get('/zones', adminOnly, zones.getAll);
router.post('/zones', adminOnly, zones.create);
router.get('/zones/:id', adminOnly, zones.getOne);
router.put('/zones/:id', adminOnly, zones.update);
router.patch('/zones/:id/status', adminOnly, zones.updateStatus);
router.delete('/zones/:id', adminOnly, zones.remove);

// Stores
router.get('/stores', adminOnly, stores.getAll);
router.post('/stores', adminOnly, stores.create);
router.get('/stores/:id', adminOnly, stores.getOne);
router.put('/stores/:id', adminOnly, stores.update);
router.patch('/stores/:id/status', adminOnly, stores.updateStatus);
router.delete('/stores/:id', adminOnly, stores.remove);
router.get('/stores/:id/schedule', adminOnly, stores.getSchedule);
router.put('/stores/:id/schedule', adminOnly, stores.updateSchedule);

// Marketing
router.get('/banners', adminOnly, banners.adminGetAll);
router.post('/banners', adminOnly, banners.adminCreate);
router.put('/banners/:id', adminOnly, banners.adminUpdate);
router.patch('/banners/:id/status', adminOnly, banners.adminUpdateStatus);
router.delete('/banners/:id', adminOnly, banners.adminDelete);

router.get('/coupons', adminOnly, coupons.adminGetAll);
router.post('/coupons', adminOnly, coupons.adminCreate);
router.put('/coupons/:id', adminOnly, coupons.adminUpdate);
router.patch('/coupons/:id/status', adminOnly, coupons.adminUpdateStatus);
router.delete('/coupons/:id', adminOnly, coupons.adminDelete);

router.get('/flash-sales', adminOnly, flashSales.adminGetAll);
router.post('/flash-sales', adminOnly, flashSales.adminCreate);
router.get('/flash-sales/:id', adminOnly, flashSales.adminGetOne);
router.put('/flash-sales/:id', adminOnly, flashSales.adminUpdate);
router.patch('/flash-sales/:id/status', adminOnly, flashSales.adminUpdateStatus);
router.delete('/flash-sales/:id', adminOnly, flashSales.adminDelete);

router.get('/campaigns', adminOnly, campaigns.adminGetAll);
router.post('/campaigns', adminOnly, campaigns.adminCreate);
router.put('/campaigns/:id', adminOnly, campaigns.adminUpdate);
router.patch('/campaigns/:id/status', adminOnly, campaigns.adminUpdateStatus);
router.delete('/campaigns/:id', adminOnly, campaigns.adminDelete);

router.get('/advertisements', adminOnly, advertisements.adminGetAll);
router.post('/advertisements', adminOnly, advertisements.adminCreate);
router.put('/advertisements/:id', adminOnly, advertisements.adminUpdate);
router.patch('/advertisements/:id/status', adminOnly, advertisements.adminUpdateStatus);
router.delete('/advertisements/:id', adminOnly, advertisements.adminDelete);

const customerRouter = require('express').Router();
customerRouter.get('/stores', customerStores.getAll);
customerRouter.get('/stores/:id', customerStores.getOne);
customerRouter.post('/zones/check', customerStores.checkAddressZone);
customerRouter.get('/banners', banners.getAll);
customerRouter.get('/banners/store/:storeId', banners.getByStore);
customerRouter.get('/flash-sales', flashSales.getActive);
customerRouter.get('/flash-sales/items', flashSales.getItems);
customerRouter.get('/campaigns/basic', campaigns.getBasic);
customerRouter.get('/campaigns/item', campaigns.getItem);
customerRouter.get('/advertisements', advertisements.getAll);
router.customerRouter = customerRouter;

module.exports = router;
