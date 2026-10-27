const router = require('express').Router();
const c = require('../../../controllers/customer/auth.controller');
const { customerAuth } = require('../../../middleware/auth');

router.post('/login', c.login);
router.post('/register', c.register);
router.get('/me', customerAuth, c.me);

module.exports = router;
