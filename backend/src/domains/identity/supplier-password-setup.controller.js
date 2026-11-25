const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const PurchaseVendor = require('../../models/purchase/PurchaseVendor');
const SupplierPasswordSetupToken = require('../../models/auth/SupplierPasswordSetupToken');
const { success, error } = require('../../utils/response');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const TOKEN_TTL_MS = 60 * 60 * 1000;

exports.createInvitation = async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    if (!mongoose.isValidObjectId(supplierId)) return error(res, 'Invalid supplier ID', 400);

    const supplier = await PurchaseVendor.findById(supplierId).select('_id email status');
    if (!supplier) return error(res, 'Supplier not found', 404);
    if (supplier.status === false) return error(res, 'Supplier account is disabled', 403);
    if (!supplier.email?.trim()) return error(res, 'Supplier email is required for portal access', 400);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await SupplierPasswordSetupToken.findOneAndUpdate(
      { supplierId: supplier._id },
      { $set: { tokenHash: hashToken(token), expiresAt } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );

    return success(res, {
      setupPath: `/supplier/set-password#${token}`,
      expiresAt,
    }, 'Password setup link generated. Copy and share it with the supplier.', 201);
  } catch (err) {
    return next(err);
  }
};

exports.setPassword = async (req, res, next) => {
  try {
    const { token, password, confirmPassword } = req.body || {};
    if (typeof token !== 'string' || !/^[a-f\d]{64}$/i.test(token)) {
      return error(res, 'Invalid or expired password setup link', 400);
    }
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      return error(res, 'Password must be at least 8 characters and no more than 72 bytes', 400);
    }
    if (confirmPassword !== password) return error(res, 'Password confirmation does not match', 400);

    const setupToken = await SupplierPasswordSetupToken.findOneAndDelete({
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() },
    });
    if (!setupToken) return error(res, 'Invalid or expired password setup link', 400);

    const supplier = await PurchaseVendor.findById(setupToken.supplierId);
    if (!supplier) return error(res, 'Supplier not found', 404);
    if (supplier.status === false) return error(res, 'Supplier account is disabled', 403);

    supplier.password = await bcrypt.hash(password, 10);
    supplier.passwordSetAt = new Date();
    await supplier.save();

    return success(res, null, 'Password set successfully. You can now sign in when your account is approved.');
  } catch (err) {
    return next(err);
  }
};
