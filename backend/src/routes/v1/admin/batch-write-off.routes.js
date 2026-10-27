const router = require('express').Router();
const c = require('../../../controllers/admin/warehouse/batch-write-off.controller');
const { adminAuth } = require('../../../middleware/auth');

router.use(adminAuth);

router.get('/', c.getAll);
router.post('/', c.create);

module.exports = router;
