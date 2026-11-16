const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String },
  image:       { type: String },
  startDate:   { type: Date, required: true },
  endDate:     { type: Date, required: true },
  moduleId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Module' },
  type:        { type: String, enum: ['basic', 'item'], default: 'basic' },
  status:      { type: Boolean, default: true },
  stores:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'Store' }],
  items:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
}, { timestamps: true });

campaignSchema.index({ moduleId: 1, status: 1 });

module.exports = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
