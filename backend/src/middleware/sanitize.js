const FORBIDDEN = /[$]/;
const PASSWORD_FIELDS = new Set(['password', 'currentPassword', 'newPassword', 'oldPassword', 'passwordConfirmation', 'password_confirmation']);

const sanitizeValue = (value) => {
  if (typeof value === 'string') return value.replace(FORBIDDEN, '');
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') return sanitizeObject(value);
  return value;
};

const sanitizeObject = (obj) => {
  const result = {};
  for (const key of Object.keys(obj)) {
    const cleanKey = key.replace(FORBIDDEN, '');
    const value = obj[key];
    result[cleanKey] = PASSWORD_FIELDS.has(key) && typeof value === 'string' ? value : sanitizeValue(value);
  }
  return result;
};

module.exports = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
};
