const mongoose = require('mongoose');

const withdrawalMethodSchema = new mongoose.Schema({
  methodName:   { type: String, required: true, trim: true, maxlength: 100 },
  methodFields: [{
    inputType:   { type: String, trim: true },
    inputName:   { type: String, trim: true },
    placeholder: { type: String, trim: true },
    isRequired:  { type: Boolean, default: false },
  }],
  isActive:  { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.models.WithdrawalMethod || mongoose.model('WithdrawalMethod', withdrawalMethodSchema);
