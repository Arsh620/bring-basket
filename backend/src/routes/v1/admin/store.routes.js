const router = require('express').Router();
const c = require('../../../controllers/admin/store/store.controller');
const { adminAuth } = require('../../../middleware/auth');

router.use(adminAuth);

router.get('/', c.getAll);
router.post('/', c.create);
router.get('/:id', c.getOne);
router.put('/:id', c.update);
router.patch('/:id/status', c.updateStatus);
router.delete('/:id', c.remove);
router.get('/:id/schedule', c.getSchedule);
router.put('/:id/schedule', c.updateSchedule);

module.exports = router;
