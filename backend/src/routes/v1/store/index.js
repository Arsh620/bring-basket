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
const brandSales = require('../../../domains/store/brand-sales.controller');
const { adminAuth, checkAdminModule } = require('../../../middleware/auth');
const { checkRole } = require('../../../middleware/roleCheck');

const access = (module) => [adminAuth, checkRole('admin'), checkAdminModule(module)];

// Modules
router.get('/modules', access('module'), modules.getAll);
router.post('/modules', access('module'), modules.create);
router.get('/modules/:id', access('module'), modules.getOne);
router.put('/modules/:id', access('module'), modules.update);
router.patch('/modules/:id/status', access('module'), modules.updateStatus);
router.delete('/modules/:id', access('module'), modules.remove);

// Zones
router.get('/zones', access('zone'), zones.getAll);
router.post('/zones', access('zone'), zones.create);
router.get('/zones/:id', access('zone'), zones.getOne);
router.put('/zones/:id', access('zone'), zones.update);
router.patch('/zones/:id/status', access('zone'), zones.updateStatus);
router.delete('/zones/:id', access('zone'), zones.remove);

// Stores
router.get('/stores', access('store'), stores.getAll);
router.post('/stores', access('store'), stores.create);
router.get('/stores/:id', access('store'), stores.getOne);
router.put('/stores/:id', access('store'), stores.update);
router.patch('/stores/:id/status', access('store'), stores.updateStatus);
router.delete('/stores/:id', access('store'), stores.remove);
router.get('/stores/:id/schedule', access('store'), stores.getSchedule);
router.put('/stores/:id/schedule', access('store'), stores.updateSchedule);

// Marketing
router.get('/banners', access('banner'), banners.adminGetAll);
router.post('/banners', access('banner'), banners.adminCreate);
router.put('/banners/:id', access('banner'), banners.adminUpdate);
router.patch('/banners/:id/status', access('banner'), banners.adminUpdateStatus);
router.delete('/banners/:id', access('banner'), banners.adminDelete);

router.get('/coupons', access('coupon'), coupons.adminGetAll);
router.post('/coupons', access('coupon'), coupons.adminCreate);
router.put('/coupons/:id', access('coupon'), coupons.adminUpdate);
router.patch('/coupons/:id/status', access('coupon'), coupons.adminUpdateStatus);
router.delete('/coupons/:id', access('coupon'), coupons.adminDelete);

router.get('/flash-sales', access('campaign'), flashSales.adminGetAll);
router.post('/flash-sales', access('campaign'), flashSales.adminCreate);
router.get('/flash-sales/:id', access('campaign'), flashSales.adminGetOne);
router.put('/flash-sales/:id', access('campaign'), flashSales.adminUpdate);
router.patch('/flash-sales/:id/status', access('campaign'), flashSales.adminUpdateStatus);
router.delete('/flash-sales/:id', access('campaign'), flashSales.adminDelete);

router.get('/campaigns', access('campaign'), campaigns.adminGetAll);
router.post('/campaigns', access('campaign'), campaigns.adminCreate);
router.put('/campaigns/:id', access('campaign'), campaigns.adminUpdate);
router.patch('/campaigns/:id/status', access('campaign'), campaigns.adminUpdateStatus);
router.delete('/campaigns/:id', access('campaign'), campaigns.adminDelete);

router.get('/advertisements', access('campaign'), advertisements.adminGetAll);
router.post('/advertisements', access('campaign'), advertisements.adminCreate);
router.put('/advertisements/:id', access('campaign'), advertisements.adminUpdate);
router.patch('/advertisements/:id/status', access('campaign'), advertisements.adminUpdateStatus);
router.delete('/advertisements/:id', access('campaign'), advertisements.adminDelete);

// Brand Sales
router.get('/brand-sales', access('campaign'), brandSales.getAll);
router.post('/brand-sales', access('campaign'), brandSales.create);
router.get('/brand-sales/:id', access('campaign'), brandSales.getOne);
router.put('/brand-sales/:id', access('campaign'), brandSales.update);
router.patch('/brand-sales/:id/toggle', access('campaign'), brandSales.toggle);
router.post('/brand-sales/:id/end-now', access('campaign'), brandSales.endNow);
router.delete('/brand-sales/:id', access('campaign'), brandSales.remove);

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
