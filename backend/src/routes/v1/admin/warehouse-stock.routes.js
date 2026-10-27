const router = require('express').Router({ mergeParams: true });
const c = require('../../../controllers/admin/warehouse/stock.controller');
const { adminAuth } = require('../../../middleware/auth');

router.use(adminAuth);

router.get('/:id/stock', c.getStock);
router.put('/:id/stock/:itemId', c.setStock);
router.patch('/:id/stock/:itemId/adjust', c.adjustStock);

module.exports = router;
