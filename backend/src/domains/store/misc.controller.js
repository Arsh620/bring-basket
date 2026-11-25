const cancelSvc = require('../orders/cancel-reasons.service');
const activitySvc = require('../store/activity-log.service');
const { success } = require('../../utils/response');

const run = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

const pg = (res, result, key) => res.json({
  success: true, data: result[key],
  pagination: { total: result.total, page: result.page, limit: result.limit, pages: result.pages },
});

// Cancel Reasons
exports.getCancelReasons    = run(async (req, res) => success(res, await cancelSvc.getAll(req.query.userType)));
exports.getActiveCancelReasons = run(async (req, res) => success(res, await cancelSvc.getActive(req.query.userType)));
exports.createCancelReason  = run(async (req, res) => success(res, await cancelSvc.create(req.body), 'Created', 201));
exports.updateCancelReason  = run(async (req, res) => success(res, await cancelSvc.update(req.params.id, req.body), 'Updated'));
exports.toggleCancelReason  = run(async (req, res) => success(res, await cancelSvc.toggle(req.params.id), 'Status toggled'));
exports.removeCancelReason  = run(async (req, res) => { await cancelSvc.remove(req.params.id); success(res, null, 'Deleted'); });

// Activity Logs
exports.getActivityLogs = run(async (req, res) => pg(res, await activitySvc.getAll(req.query), 'logs'));
