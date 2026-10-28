const router = require('express').Router();
const modules = require('../../../domains/store/modules.controller');
const zones = require('../../../domains/store/zones.controller');
const stores = require('../../../domains/store/stores.controller');
const { adminAuth } = require('../../../middleware/auth');

// Modules
router.get('/modules', adminAuth, modules.getAll);
router.post('/modules', adminAuth, modules.create);
router.get('/modules/:id', adminAuth, modules.getOne);
router.put('/modules/:id', adminAuth, modules.update);
router.patch('/modules/:id/status', adminAuth, modules.updateStatus);
router.delete('/modules/:id', adminAuth, modules.remove);

// Zones
router.get('/zones', adminAuth, zones.getAll);
router.post('/zones', adminAuth, zones.create);
router.get('/zones/:id', adminAuth, zones.getOne);
router.put('/zones/:id', adminAuth, zones.update);
router.patch('/zones/:id/status', adminAuth, zones.updateStatus);
router.delete('/zones/:id', adminAuth, zones.remove);

// Stores
router.get('/stores', adminAuth, stores.getAll);
router.post('/stores', adminAuth, stores.create);
router.get('/stores/:id', adminAuth, stores.getOne);
router.put('/stores/:id', adminAuth, stores.update);
router.patch('/stores/:id/status', adminAuth, stores.updateStatus);
router.delete('/stores/:id', adminAuth, stores.remove);
router.get('/stores/:id/schedule', adminAuth, stores.getSchedule);
router.put('/stores/:id/schedule', adminAuth, stores.updateSchedule);

module.exports = router;
