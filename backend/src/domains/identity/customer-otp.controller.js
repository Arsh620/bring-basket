const crypto = require('node:crypto');
const User = require('../../models/auth/User');
const OtpVerification = require('../../models/auth/OtpVerification');
const { success, error } = require('../../utils/response');

const OTP_EXPIRY_MINUTES = 10;
const MAX_HIT = 5;

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// POST /customer/auth/forgot-password  body: { phone } or { email }
exports.forgotPassword = async (req, res, next) => {
  try {
    const { phone, email } = req.body;
    if (!phone && !email) return error(res, 'phone or email required', 400);

    const query = phone ? { phone } : { email: email.toLowerCase() };
    const user = await User.findOne(query).select('_id status');
    if (!user || !user.status) return error(res, 'No account found', 404);

    // block if too many attempts
    const existing = await OtpVerification.findOne({ ...query, type: 'password_reset', verified: false });
    if (existing?.isBlocked) return error(res, 'Too many attempts. Try after some time.', 429);

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await OtpVerification.findOneAndUpdate(
      { ...query, type: 'password_reset' },
      { otp, expiresAt, verified: false, hitCount: 0, isBlocked: false },
      { upsert: true, new: true },
    );

    // TODO: send OTP via SMS/email when notification service is ready
    // For dev: return OTP in response (remove in production)
    const devOtp = process.env.NODE_ENV !== 'production' ? { otp } : {};
    return success(res, devOtp, `OTP sent to your ${phone ? 'phone' : 'email'}`);
  } catch (err) { next(err); }
};

// POST /customer/auth/verify-otp  body: { phone/email, otp }
exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, email, otp } = req.body;
    if (!otp) return error(res, 'otp required', 400);
    if (!phone && !email) return error(res, 'phone or email required', 400);

    const query = phone ? { phone } : { email: email.toLowerCase() };
    const record = await OtpVerification.findOne({ ...query, type: 'password_reset', verified: false });

    if (!record) return error(res, 'OTP not found or already used', 400);
    if (record.isBlocked) return error(res, 'Too many attempts. Request a new OTP.', 429);
    if (record.expiresAt < new Date()) return error(res, 'OTP expired', 400);

    if (record.otp !== String(otp)) {
      const hitCount = record.hitCount + 1;
      await OtpVerification.findByIdAndUpdate(record._id, {
        hitCount,
        isBlocked: hitCount >= MAX_HIT,
      });
      return error(res, 'Invalid OTP', 400);
    }

    // generate a short-lived reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    await OtpVerification.findByIdAndUpdate(record._id, {
      verified: true,
      otp: resetToken, // reuse field to store token
    });

    return success(res, { reset_token: resetToken }, 'OTP verified');
  } catch (err) { next(err); }
};

// PUT /customer/auth/reset-password  body: { phone/email, reset_token, password }
exports.resetPassword = async (req, res, next) => {
  try {
    const { phone, email, reset_token, password } = req.body;
    if (!reset_token || !password) return error(res, 'reset_token and password required', 400);
    if (!phone && !email) return error(res, 'phone or email required', 400);
    if (password.length < 6) return error(res, 'Password must be at least 6 characters', 400);

    const query = phone ? { phone } : { email: email.toLowerCase() };
    const record = await OtpVerification.findOne({ ...query, type: 'password_reset', verified: true, otp: reset_token });
    if (!record) return error(res, 'Invalid or expired reset token', 400);
    if (record.expiresAt < new Date()) return error(res, 'Reset token expired', 400);

    const user = await User.findOne(query).select('+password');
    if (!user) return error(res, 'User not found', 404);

    user.password = password;
    await user.save();
    await OtpVerification.findByIdAndDelete(record._id);

    return success(res, null, 'Password reset successful');
  } catch (err) { next(err); }
};
