const WithdrawalMethod = require('../../models/store/WithdrawalMethod');
const AppError = require('../../utils/AppError');

const getAll = (activeOnly = false) =>
  WithdrawalMethod.find(activeOnly ? { isActive: true } : {}).sort({ isDefault: -1, createdAt: -1 });

const create = async (body) => {
  if (!body.methodName?.trim()) throw new AppError('methodName is required', 400);
  const count = await WithdrawalMethod.countDocuments();
  if (body.isDefault) await WithdrawalMethod.updateMany({}, { isDefault: false });
  return WithdrawalMethod.create({
    methodName: body.methodName.trim(),
    methodFields: body.methodFields || [],
    isDefault: body.isDefault || count === 0,
  });
};

const update = async (id, body) => {
  if (body.isDefault) await WithdrawalMethod.updateMany({ _id: { $ne: id } }, { isDefault: false });
  const m = await WithdrawalMethod.findByIdAndUpdate(id, body, { new: true });
  if (!m) throw new AppError('Withdrawal method not found', 404);
  return m;
};

const toggle = async (id) => {
  const m = await WithdrawalMethod.findById(id);
  if (!m) throw new AppError('Withdrawal method not found', 404);
  m.isActive = !m.isActive;
  await m.save();
  return m;
};

const setDefault = async (id) => {
  await WithdrawalMethod.updateMany({}, { isDefault: false });
  const m = await WithdrawalMethod.findByIdAndUpdate(id, { isDefault: true }, { new: true });
  if (!m) throw new AppError('Withdrawal method not found', 404);
  return m;
};

const remove = async (id) => {
  const m = await WithdrawalMethod.findByIdAndDelete(id);
  if (!m) throw new AppError('Withdrawal method not found', 404);
};

module.exports = { getAll, create, update, toggle, setDefault, remove };
