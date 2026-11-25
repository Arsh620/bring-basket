const router = require('express').Router();

router.use('/', require('./identity'));
router.use('/', require('./catalog'));
router.use('/', require('./store'));
router.use('/', require('./inventory'));
router.use('/', require('./procurement'));
router.use('/', require('./orders'));
router.use('/', require('./customer'));
router.use('/deliveryman', require('./deliveryman'));
router.use('/vendor', require('./vendor'));
router.use('/admin', require('./admin'));
router.use('/payment', require('./payment'));
router.use('/warehouse', require('./warehouse'));
router.use('/', require('./pos'));
router.use('/admin/account', require('./accounting'));
router.use('/admin', require('./retention'));

module.exports = router;
