const mongoose = require('mongoose');

const employeeRoleSchema = new mongoose.Schema({
  legacyId: { type: Number, unique: true, sparse: true },
  name: { type: String, required: true, trim: true },
  modules: { type: mongoose.Schema.Types.Mixed },
  status: { type: Boolean, default: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
}, { timestamps: true });

employeeRoleSchema.index({ storeId: 1, name: 1 });

module.exports = mongoose.models.EmployeeRole
  || mongoose.model('EmployeeRole', employeeRoleSchema, 'employeeroles');
