const router = require('express').Router();
const c = require('../../../controllers/admin/warehouse/transfer.controller');
const { adminAuth } = require('../../../middleware/auth');

router.use(adminAuth);

router.get('/', c.getAll);
router.post('/', c.create);
router.get('/:id', c.getOne);
router.patch('/:id/dispatch', c.dispatch);
router.patch('/:id/receive', c.receive);
router.patch('/:id/reject', c.reject);

module.exports = router;
