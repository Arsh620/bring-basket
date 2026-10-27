const router = require('express').Router();
const c = require('../../../controllers/admin/catalog/category.controller');

router.get('/', c.getAll);
router.get('/:id', c.getOne);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);
router.patch('/:id/status', c.updateStatus);

module.exports = router;
