const mongoose = require('mongoose');

const posHeldCartSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  actorRole: { type: String, enum: ['admin', 'vendor', 'vendor_employee'], required: true },
  label: { type: String, maxlength: 120, default: '' },
  cart: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

posHeldCartSchema.index({ storeId: 1, actorId: 1, actorRole: 1, createdAt: -1 });

// The generated PosHeldCart model maps the Laravel holderId and cartJson fields.
module.exports = mongoose.models.PosHeldCartSnapshot || mongoose.model('PosHeldCartSnapshot', posHeldCartSchema, 'posheldcarts');
