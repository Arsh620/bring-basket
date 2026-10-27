const router = require('express').Router();
const c = require('../../../controllers/admin/warehouse/movement.controller');
const { adminAuth } = require('../../../middleware/auth');

router.use(adminAuth);

router.get('/', c.getAll);

module.exports = router;
