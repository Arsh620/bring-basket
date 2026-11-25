const WarehouseItemBatch = require('../../models/warehouse/WarehouseItemBatch');
const WarehouseStockMovement = require('../../models/warehouse/WarehouseStockMovement');
const AppError = require('../../utils/AppError');

const nearExpiry = async (warehouseId, days = 30) => {
  const cutoff = new Date(Date.now() + Number(days) * 86400000);
  return WarehouseItemBatch.find({
    warehouseId,
    qty: { $gt: 0 },
    expiryDate: { $gte: new Date(), $lte: cutoff },
  }).populate('itemId', 'name sku').sort({ expiryDate: 1 });
};

const expired = async (warehouseId) => {
  return WarehouseItemBatch.find({
    warehouseId,
    qty: { $gt: 0 },
    expiryDate: { $lt: new Date() },
  }).populate('itemId', 'name sku').sort({ expiryDate: 1 });
};

/** Write off all expired qty for a specific batch */
const writeOff = async (batchId, warehouseId, note) => {
  const batch = await WarehouseItemBatch.findOne({ _id: batchId, warehouseId });
  if (!batch) throw new AppError('Batch not found', 404);
  if (batch.qty <= 0) throw new AppError('Batch already has zero qty', 400);

  const writtenQty = batch.qty;
  batch.qty = 0;
  await batch.save();

  await WarehouseStockMovement.create({
    warehouseId,
    itemId: batch.itemId,
    type: 'write_off',
    qty: -writtenQty,
    note: note || `Expiry write-off — batch ${batch.batchCode || batchId}`,
    referenceType: 'WarehouseItemBatch',
    referenceId: batch._id,
  });

  return { batchId, writtenQty };
};

module.exports = { nearExpiry, expired, writeOff };
