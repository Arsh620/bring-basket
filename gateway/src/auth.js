const jwt = require('jsonwebtoken');

// Public routes — JWT verify nahi hoga
const PUBLIC_ROUTES = [
  { method: 'POST', path: /^\/api\/v1\/(admin|customer|vendor|supplier|warehouse|deliveryman)\/auth\/login$/ },
  { method: 'POST', path: /^\/api\/v1\/(admin|customer)\/auth\/register$/ },
  { method: 'GET',  path: /^\/health$/ },
];

const isPublic = (req) =>
  PUBLIC_ROUTES.some(
    (r) => r.method === req.method && r.path.test(req.path),
  );

module.exports = (req, res, next) => {
  if (isPublic(req)) return next();

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Downstream services ko user info headers mein bhejo
    req.headers['x-user-id']   = decoded.id;
    req.headers['x-user-role'] = decoded.role;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};
