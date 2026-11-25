const mongoose = require('mongoose');

const parcelCategorySchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  image:       { type: String, trim: true },
  description: { type: String, trim: true, maxlength: 500 },
  isActive:    { type: Boolean, default: true },
  sortOrder:   { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.models.ParcelCategory || mongoose.model('ParcelCategory', parcelCategorySchema);
