const router = require('express').Router();
const c = require('../../../controllers/vendor/auth.controller');
const { vendorAuth } = require('../../../middleware/auth');

router.post('/login', c.login);
router.get('/me', vendorAuth, c.me);
router.post('/logout', vendorAuth, c.logout);

module.exports = router;
