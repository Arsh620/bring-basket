const { error } = require('../utils/response');

const isInactive = (status) => status === false || status === 0 || status === '0';

module.exports = (...modules) => async (req, res, next) => {
  const authorization = req.headers.authorization;
  const identityServiceUrl = process.env.IDENTITY_SERVICE_URL;

  if (!authorization) return error(res, 'No token provided', 401);
  if (!identityServiceUrl) return error(res, 'Admin identity service is not configured', 503);

  let response;
  try {
    response = await fetch(`${identityServiceUrl.replace(/\/+$/, '')}/api/v1/admin/auth/me`, {
      headers: { authorization },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return error(res, 'Admin identity service is unavailable', 503);
  }

  if (!response.ok) {
    const statusCode = response.status === 401 ? 401 : response.status === 403 || response.status === 404 ? 403 : 503;
    return error(res, statusCode === 503 ? 'Admin identity service is unavailable' : 'Access denied', statusCode);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    return error(res, 'Invalid response from Admin identity service', 502);
  }

  const admin = result?.data;
  const role = admin?.roleId;
  if (!result?.success || !admin || isInactive(admin.status) || !role || isInactive(role.status)) {
    return error(res, 'Access denied', 403);
  }
  req.adminScope = { zoneId: Number(role.legacyId) === 1 ? null : admin.zoneId || null };
  if (Number(role.legacyId) === 1) return next();
  if (admin.zoneId && modules.includes('zone')) return error(res, 'Access denied', 403);
  if (modules.length === 0) return next();

  let grantedModules = role.modules;
  if (typeof grantedModules === 'string') {
    try {
      grantedModules = JSON.parse(grantedModules);
    } catch {
      grantedModules = [];
    }
  }
  if (!Array.isArray(grantedModules) || !modules.some((module) => grantedModules.includes(module))) {
    return error(res, 'Access denied', 403);
  }

  return next();
};
