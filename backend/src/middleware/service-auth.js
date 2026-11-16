const jwt = require('jsonwebtoken');

module.exports = (serviceName, audience) => (req, res, next) => {
  const token = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ success: false, message: 'Service token required' });
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET, { audience });
    if (claims.sub !== serviceName || claims.role !== 'service') {
      return res.status(403).json({ success: false, message: 'Service access denied' });
    }
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired service token' });
  }
};
