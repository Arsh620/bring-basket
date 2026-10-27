const router = require('express').Router();
const c = require('../../../controllers/deliveryman/auth.controller');
const { deliverymanAuth } = require('../../../middleware/auth');

router.post('/login', c.login);
router.get('/me', deliverymanAuth, c.me);
router.post('/logout', deliverymanAuth, c.logout);

module.exports = router;
