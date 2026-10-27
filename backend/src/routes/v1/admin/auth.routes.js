const router = require('express').Router();
const c = require('../../../controllers/admin/auth/auth.controller');
const { adminAuth } = require('../../../middleware/auth');

router.post('/login', c.login);
router.post('/register', c.register);
router.get('/me', adminAuth, c.me);
router.post('/logout', adminAuth, c.logout);

module.exports = router;
