const router = require('express').Router();
const c = require('../../../controllers/admin/catalog/unit.controller');

router.get('/', c.getAll);
router.post('/', c.create);
router.get('/:id', c.getOne);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
