const router = require('express').Router();
const c = require('../../../controllers/admin/catalog/item.controller');

router.get('/', c.getAll);
router.get('/low-stock', c.getLowStock);
router.get('/:id', c.getOne);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);
router.patch('/:id/stock', c.updateStock);
router.patch('/:id/status', c.updateStatus);

module.exports = router;
