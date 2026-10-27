const router = require('express').Router();
const c = require('../../../controllers/admin/catalog/item-batch.controller');
const { adminAuth } = require('../../../middleware/auth');

router.use(adminAuth);

router.get('/expiring-soon', c.getExpiringSoon);
router.get('/', c.getAll);
router.post('/', c.create);
router.get('/:id', c.getOne);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
