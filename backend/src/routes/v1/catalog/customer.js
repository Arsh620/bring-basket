const router = require('express').Router();
const items = require('../../../domains/catalog/customer-items.controller');

router.get('/items', items.getAll);
router.get('/items/:id', items.getOne);

module.exports = router;
