const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authorization = req.get('authorization');
  if (authorization) {
    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ success: false, message: 'Invalid authorization header' });
    }

    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      if (user.role !== 'customer' || !user.id) {
        return res.status(403).json({ success: false, message: 'Customer access required' });
      }
      req.cartActor = { ownerId: String(user.id), isGuest: false };
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  } else {
    const guestId = req.body?.guest_id ?? req.query.guest_id;
    if (typeof guestId !== 'string' && typeof guestId !== 'number') {
      return res.status(400).json({ success: false, message: 'guest_id is required' });
    }
    const ownerId = String(guestId).trim();
    if (!ownerId || ownerId.length > 128) {
      return res.status(400).json({ success: false, message: 'guest_id must be 1-128 characters' });
    }
    req.cartActor = { ownerId, isGuest: true };
  }
  return next();
};
