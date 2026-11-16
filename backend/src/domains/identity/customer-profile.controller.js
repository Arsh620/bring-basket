const User = require('../../models/auth/User');
const { success, error } = require('../../utils/response');

// GET /customer/info
exports.info = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return error(res, 'User not found', 404);
    return success(res, user);
  } catch (err) { next(err); }
};

// POST /customer/update-profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { fName, lName, email, image, cmFirebaseToken, currentLanguageKey } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { fName, lName, email, image, cmFirebaseToken, currentLanguageKey },
      { new: true, runValidators: true },
    );
    return success(res, user);
  } catch (err) { next(err); }
};

// PUT /customer/cm-firebase-token  body: { cm_firebase_token }
exports.updateFirebaseToken = async (req, res, next) => {
  try {
    if (!req.body.cm_firebase_token) return error(res, 'cm_firebase_token is required', 400);
    await User.findByIdAndUpdate(req.user.id, { cmFirebaseToken: req.body.cm_firebase_token });
    return success(res, null, 'Token updated');
  } catch (err) { next(err); }
};

// DELETE /customer/remove-account
exports.removeAccount = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { status: false, email: null, phone: null });
    return success(res, null, 'Account removed');
  } catch (err) { next(err); }
};

// GET /customer/loyalty-point/transactions
exports.loyaltyTransactions = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('loyaltyPoint').lean();
    return success(res, { loyaltyPoint: user?.loyaltyPoint || 0 });
  } catch (err) { next(err); }
};
