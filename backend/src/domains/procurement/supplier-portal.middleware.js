const PurchaseVendor = require('../../models/purchase/PurchaseVendor');
const AppError = require('../../utils/AppError');

module.exports = async (req, res, next) => {
  try {
    const supplier = await PurchaseVendor.findOne({
      _id: req.user.id,
      status: true,
      approvalStatus: 'approved',
      portalStatus: 'enabled',
    })
      .select('_id displayName email')
      .lean();

    if (!supplier) throw new AppError('Supplier portal is unavailable', 403);
    req.supplier = supplier;
    return next();
  } catch (error) {
    return next(error);
  }
};
