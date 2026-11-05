const router = require('express').Router();
const modules = require('../../../domains/store/modules.controller');
const zones = require('../../../domains/store/zones.controller');
const stores = require('../../../domains/store/stores.controller');
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

module.exports = router;
