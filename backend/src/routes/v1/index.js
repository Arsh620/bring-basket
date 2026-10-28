const router = require('express').Router();

router.use('/', require('./identity'));
router.use('/admin', require('./catalog'));
router.use('/admin', require('./inventory'));
router.use('/admin', require('./store'));

module.exports = router;
