const router = require('express').Router();
const c = require('../../../controllers/admin/catalog/unit-group.controller');
const { adminAuth } = require('../../../middleware/auth');

router.use(adminAuth);

// Unit Groups
router.get('/', c.getAll);
router.post('/', c.create);
router.get('/:id', c.getOne);
router.put('/:id', c.update);
router.patch('/:id/status', c.updateStatus);
router.delete('/:id', c.remove);

// Conversions
router.get('/:id/conversions', c.getConversions);
router.post('/:id/conversions', c.addConversion);
router.put('/:id/conversions/:conversionId', c.updateConversion);
router.delete('/:id/conversions/:conversionId', c.removeConversion);

module.exports = router;
