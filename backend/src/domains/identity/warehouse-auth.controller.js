const bcrypt = require('bcryptjs');
const Warehouse = require('../../models/warehouse/Warehouse');
const { generateToken } = require('../../middleware/auth');
const { success, error } = require('../../utils/response');

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return error(res, 'Username and password required', 400);

    const warehouse = await Warehouse.findOne({ username, status: 'active' }).select('+passwordHash');
    if (!warehouse) return error(res, 'Invalid credentials', 401);

    const isMatch = await bcrypt.compare(password, warehouse.passwordHash);
    if (!isMatch) return error(res, 'Invalid credentials', 401);

    const token = generateToken(warehouse._id, 'warehouse');
    const data = warehouse.toObject();
    delete data.passwordHash;

    return success(res, { token, warehouse: data }, 'Login successful');
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findById(req.user.id);
    if (!warehouse) return error(res, 'Not found', 404);
    return success(res, warehouse);
  } catch (err) { next(err); }
};

exports.logout = async (req, res, next) => {
  try {
    return success(res, null, 'Logged out');
  } catch (err) { next(err); }
};
