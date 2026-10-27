const router = require('express').Router();
const c = require('../../../controllers/warehouse/auth.controller');
const { warehouseAuth } = require('../../../middleware/auth');

router.post('/login', c.login);
router.get('/me', warehouseAuth, c.me);
router.post('/logout', warehouseAuth, c.logout);

module.exports = router;
