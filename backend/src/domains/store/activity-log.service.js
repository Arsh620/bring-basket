const { ActivityLog } = require('../../models/store/OrderCancelReason');
const { paginate } = require('../../utils/pagination');

const log = async (action, subjectType, subjectId, actorType, actorId, actorName, attributes, note) => {
  try {
    await ActivityLog.create({ action, subjectType, subjectId: String(subjectId), actorType, actorId, actorName, attributes, note });
  } catch (_) { /* non-blocking */ }
};

const getAll = async (query = {}) => {
  const { skip, page, limit } = paginate(query);
  const filter = {};
  if (query.subjectType) filter.subjectType = query.subjectType;
  if (query.subjectId) filter.subjectId = String(query.subjectId);
  if (query.actorId) filter.actorId = query.actorId;
  const [logs, total] = await Promise.all([
    ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ActivityLog.countDocuments(filter),
  ]);
  return { logs, total, page, limit, pages: Math.ceil(total / limit) };
};

module.exports = { log, getAll };
