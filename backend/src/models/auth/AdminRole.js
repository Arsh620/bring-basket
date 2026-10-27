const mongoose = require('mongoose');

const adminRoleSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  modules: { type: mongoose.Schema.Types.Mixed },
  status:  { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.models.AdminRole || mongoose.model('AdminRole', adminRoleSchema);
