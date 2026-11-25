const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const BusinessSetting = require('../../models/store/BusinessSetting');
const AppError = require('../../utils/AppError');

const serviceUrl = () => (process.env.ORDER_SERVICE_URL || 'http://localhost:5006').replace(/\/$/, '');

const vendorServiceContext = async (vendorContext) => {
  const storeIds = (vendorContext?.storeIds || []).map(String);
  if (!storeIds.length) throw new AppError('Vendor has no store access', 403);

  const settings = await BusinessSetting.find({ key: { $in: ['order_confirmation_model', 'canceled_by_store'] } })
    .select('key value').lean();
  const values = Object.fromEntries(settings.map(({ key, value }) => [key, value]));
  return {
    storeIds,
    orderConfirmationModel: values.order_confirmation_model || 'deliveryman',
    canStoreCancel: [true, 1, '1', 'true'].includes(values.canceled_by_store),
  };
};

const forward = (path, includeQuery = false, transform = null) => async (req, res, next) => {
  try {
    const context = await vendorServiceContext(req.vendorContext);
    const token = jwt.sign(
      { sub: 'backend', role: 'service', vendorContext: context },
      process.env.JWT_SECRET,
      { audience: 'order-service', expiresIn: '30s' },
    );
    const query = includeQuery ? `?${new URLSearchParams(req.query).toString()}` : '';
    const response = await fetch(`${serviceUrl()}${path}${query}`, {
      method: req.method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(req.method !== 'GET' ? { 'content-type': 'application/json' } : {}),
      },
      ...(req.method !== 'GET' ? { body: JSON.stringify(req.body || {}) } : {}),
      signal: AbortSignal.timeout(5000),
    });
    const payload = await response.json().catch(() => null);
    if (!payload) return res.status(502).json({ success: false, message: 'Order service returned an invalid response' });
    if (transform) return await transform(payload, req, res, response.status);
    return res.status(response.status).json(payload);
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError' || err.cause?.code) {
      return res.status(503).json({ success: false, message: 'Order service is unavailable' });
    }
    return next(err);
  }
};

exports.list = forward('/internal/vendor/orders', true);
exports.updateStatus = forward('/internal/vendor/orders/update-status');
exports.dashboard = forward('/internal/vendor/dashboard', false, async (payload, req, res, status) => {
  if (status >= 400 || !payload.success) return res.status(status).json(payload);
  const storeIds = req.vendorContext.storeIds.map((id) => new mongoose.Types.ObjectId(id));
  const Item = require('../../models/catalog/Item');
  const totalItems = await Item.countDocuments({ storeId: { $in: storeIds }, status: true });
  return res.status(status).json({
    ...payload,
    data: { ...payload.data, totalItems, totalStores: storeIds.length },
  });
});

exports.adminDashboardStats = async (req, res, next) => {
  try {
    const token = jwt.sign(
      { sub: 'backend', role: 'service' },
      process.env.JWT_SECRET,
      { audience: 'order-service', expiresIn: '30s' },
    );
    const query = new URLSearchParams();
    ['period', 'moduleId', 'zoneId'].forEach((key) => {
      if (typeof req.query[key] === 'string') query.set(key, req.query[key]);
    });
    const queryString = query.size ? `?${query}` : '';
    const response = await fetch(`${serviceUrl()}/internal/admin/dashboard-stats${queryString}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    const payload = await response.json().catch(() => null);
    if (!payload) return res.status(502).json({ success: false, message: 'Order service returned an invalid response' });
    return res.status(response.status).json(payload);
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError' || err.cause?.code) {
      return res.status(503).json({ success: false, message: 'Order service is unavailable' });
    }
    return next(err);
  }
};
