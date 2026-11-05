const mongoose = require('mongoose');

const sequenceSchema = new mongoose.Schema({
  _id: { type: String },
  value: { type: Number, required: true, default: 0 },
}, { versionKey: false });

module.exports = mongoose.models.Sequence || mongoose.model('Sequence', sequenceSchema, 'sequences');
