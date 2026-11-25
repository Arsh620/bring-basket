const crypto = require('node:crypto');
const User = require('../../models/auth/User');
const OtpVerification = require('../../models/auth/OtpVerification');
const { success, error } = require('../../utils/response');

const OTP_EXPIRY_MINUTES = 10;
const MAX_HIT = 5;

const generateOtp = () => String(crypto.randomInt(100000, 1000000));
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const matchesHash = (token, hash) => {
  const tokenHash = Buffer.from(hashToken(token));
  const storedHash = Buffer.from(hash);
  return tokenHash.length === storedHash.length && crypto.timingSafeEqual(tokenHash, storedHash);
};
const getIdentity = ({ phone, email }) => {
  if (typeof phone === 'string' && phone.trim()) return { phone: phone.trim() };
  if (typeof email === 'string' && email.trim()) return { email: email.trim().toLowerCase() };
  return null;
};

// POST /customer/auth/forgot-password  body: { phone } or { email }
exports.forgotPassword = async (req, res, next) => {
  try {
    const { phone, email } = req.body;
    const query = getIdentity({ phone, email });
    if (!query) return error(res, 'phone or email required', 400);
    if (process.env.NODE_ENV === 'production') {
      return error(res, 'Password reset delivery is not configured', 503);
    }

    const user = await User.findOne(query).select('_id status');
    if (!user || !user.status) return success(res, {}, 'If the account exists, a reset code will be sent');

    // block if too many attempts
    const existing = await OtpVerification.findOne({ ...query, type: 'password_reset', verified: false });
    if (existing?.isBlocked) return error(res, 'Too many attempts. Try after some time.', 429);

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await OtpVerification.findOneAndUpdate(
      { ...query, type: 'password_reset' },
      { otp: hashToken(otp), expiresAt, verified: false, hitCount: 0, isBlocked: false },
      { upsert: true, new: true },
    );

    return success(res, { otp }, 'Development reset code generated');
  } catch (err) { next(err); }
};

// POST /customer/auth/verify-otp  body: { phone/email, otp }
exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, email, otp } = req.body;
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) return error(res, 'otp must be a 6-digit code', 400);
    const query = getIdentity({ phone, email });
    if (!query) return error(res, 'phone or email required', 400);

    const record = await OtpVerification.findOne({ ...query, type: 'password_reset', verified: false });

    if (!record) return error(res, 'OTP not found or already used', 400);
    if (record.isBlocked) return error(res, 'Too many attempts. Request a new OTP.', 429);
    if (record.expiresAt < new Date()) return error(res, 'OTP expired', 400);

    if (!matchesHash(otp, record.otp)) {
      const hitCount = record.hitCount + 1;
      await OtpVerification.findByIdAndUpdate(record._id, {
        hitCount,
        isBlocked: hitCount >= MAX_HIT,
      });
      return error(res, 'Invalid OTP', 400);
    }

    // generate a short-lived reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const verified = await OtpVerification.findOneAndUpdate(
      { _id: record._id, verified: false, isBlocked: false, expiresAt: { $gt: new Date() } },
      { verified: true, otp: hashToken(resetToken) },
      { new: true },
    );
    if (!verified) return error(res, 'OTP expired or already used', 400);

    return success(res, { reset_token: resetToken }, 'OTP verified');
  } catch (err) { next(err); }
};

// PUT /customer/auth/reset-password  body: { phone/email, reset_token, password }
exports.resetPassword = async (req, res, next) => {
  try {
    const { phone, email, reset_token, password } = req.body;
    if (typeof reset_token !== 'string' || !reset_token || typeof password !== 'string') {
      return error(res, 'reset_token and password required', 400);
    }
    const query = getIdentity({ phone, email });
    if (!query) return error(res, 'phone or email required', 400);
    if (password.length < 6) return error(res, 'Password must be at least 6 characters', 400);

    const record = await OtpVerification.findOne({
      ...query,
      type: 'password_reset',
      verified: true,
      expiresAt: { $gt: new Date() },
    });
    if (!record) return error(res, 'Invalid or expired reset token', 400);
    if (!matchesHash(reset_token, record.otp)) return error(res, 'Invalid or expired reset token', 400);

    const user = await User.findOne(query).select('+password');
    if (!user) return error(res, 'User not found', 404);

    const consumed = await OtpVerification.findOneAndDelete({
      _id: record._id,
      verified: true,
      otp: record.otp,
      expiresAt: { $gt: new Date() },
    });
    if (!consumed) return error(res, 'Reset token already used', 400);

    user.password = password;
    await user.save();

    return success(res, null, 'Password reset successful');
  } catch (err) { next(err); }
};
