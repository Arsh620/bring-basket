const router = require('express').Router();
const c = require('../../../controllers/admin/warehouse/warehouse.controller');

router.get('/', c.getAll);
router.post('/', c.create);
router.get('/:id', c.getOne);
router.put('/:id', c.update);
router.patch('/:id/status', c.updateStatus);
router.delete('/:id', c.remove);

module.exports = router;
