const router = require('express').Router();

// ── Admin ──────────────────────────────────────────
router.use('/admin/auth',        require('./admin/auth.routes'));
router.use('/admin/roles',       require('./admin/roles.routes'));
router.use('/admin/admins',      require('./admin/admins.routes'));
router.use('/admin/categories',  require('./admin/category.routes'));
router.use('/admin/brands',      require('./admin/brand.routes'));
router.use('/admin/items',       require('./admin/item.routes'));
router.use('/admin/units',       require('./admin/unit.routes'));
router.use('/admin/unit-groups', require('./admin/unit-group.routes'));
router.use('/admin/item-batches', require('./admin/item-batch.routes'));
router.use('/admin/warehouses',  require('./admin/warehouse.routes'));
router.use('/admin/warehouses',  require('./admin/warehouse-stock.routes'));
router.use('/admin/stock-movements', require('./admin/stock-movement.routes'));
router.use('/admin/stock-transfers', require('./admin/stock-transfer.routes'));
router.use('/admin/store-stock-requests', require('./admin/store-stock-request.routes'));
router.use('/admin/batch-write-offs', require('./admin/batch-write-off.routes'));
router.use('/admin/modules',      require('./admin/module.routes'));
router.use('/admin/zones',        require('./admin/zone.routes'));
router.use('/admin/stores',       require('./admin/store.routes'));

// ── Warehouse Portal ───────────────────────────────
router.use('/warehouse/auth',    require('./warehouse/auth.routes'));

// ── Supplier Portal ────────────────────────────────
router.use('/supplier/auth',     require('./supplier/auth.routes'));

// ── Vendor ─────────────────────────────────────────
router.use('/vendor/auth',       require('./vendor/auth.routes'));

// ── Customer ───────────────────────────────────────
router.use('/customer/auth',     require('./customer/auth.routes'));

// ── Delivery Man ───────────────────────────────────
router.use('/deliveryman/auth',  require('./deliveryman/auth.routes'));

module.exports = router;
