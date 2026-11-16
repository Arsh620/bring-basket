const WalletBonus = require('../../models/store/WalletBonus');
const { success, error, paginated } = require('../../utils/response');
const { paginate } = require('../../utils/pagination');

exports.getAll = async (req, res, next) => {
  try {
    const { skip, page, limit } = paginate(req.query);
    const filter = req.query.status !== undefined ? { status: req.query.status === 'true' } : {};
    const [data, total] = await Promise.all([
      WalletBonus.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WalletBonus.countDocuments(filter),
    ]);
    return paginated(res, data, total, page, limit);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { title, bonusType, bonusAmount } = req.body;
    if (!title || !bonusType || bonusAmount === undefined) return error(res, 'title, bonusType, bonusAmount required', 400);
    return success(res, await WalletBonus.create(req.body), 'Wallet bonus created', 201);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const bonus = await WalletBonus.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!bonus) return error(res, 'Not found', 404);
    return success(res, bonus);
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const bonus = await WalletBonus.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!bonus) return error(res, 'Not found', 404);
    return success(res, bonus);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const bonus = await WalletBonus.findByIdAndDelete(req.params.id);
    if (!bonus) return error(res, 'Not found', 404);
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};
