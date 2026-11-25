const { OrderCancelReason } = require('../../models/store/OrderCancelReason');
const AppError = require('../../utils/AppError');

const getAll = (userType) => {
  const filter = {};
  if (userType) filter.userType = userType;
  return OrderCancelReason.find(filter).sort({ createdAt: -1 });
};

const getActive = (userType) => {
  const filter = { status: true };
  if (userType) filter.userType = userType;
  return OrderCancelReason.find(filter).sort({ createdAt: -1 });
};

const create = async (body) => {
  if (!body.reason?.trim()) throw new AppError('reason is required', 400);
  if (!['customer', 'vendor', 'admin', 'deliveryman'].includes(body.userType))
    throw new AppError('Invalid userType', 400);
  return OrderCancelReason.create({ reason: body.reason.trim(), userType: body.userType });
};

const update = async (id, body) => {
  const r = await OrderCancelReason.findByIdAndUpdate(id, body, { new: true });
  if (!r) throw new AppError('Cancel reason not found', 404);
  return r;
};

const toggle = async (id) => {
  const r = await OrderCancelReason.findById(id);
  if (!r) throw new AppError('Cancel reason not found', 404);
  r.status = !r.status;
  await r.save();
  return r;
};

const remove = async (id) => {
  const r = await OrderCancelReason.findByIdAndDelete(id);
  if (!r) throw new AppError('Cancel reason not found', 404);
};

module.exports = { getAll, getActive, create, update, toggle, remove };
