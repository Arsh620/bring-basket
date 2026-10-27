const router = require('express').Router();
const c = require('../../../controllers/supplier/auth.controller');
const { supplierAuth } = require('../../../middleware/auth');

router.post('/login', c.login);
router.get('/me', supplierAuth, c.me);
router.post('/logout', supplierAuth, c.logout);

module.exports = router;
