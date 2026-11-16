const mongoose = require('mongoose');
const CustomerAddress = require('../../models/auth/CustomerAddress');
const AppError = require('../../utils/AppError');
const { paginate } = require('../../utils/pagination');
const { success } = require('../../utils/response');

const addressFilter = (id) => {
  if (/^[a-f\d]{24}$/i.test(String(id))) return { _id: new mongoose.Types.ObjectId(id) };
  if (/^[1-9]\d*$/.test(String(id))) return { legacyId: Number(id) };
  throw new AppError('Invalid address_id', 400);
};

const normalizeAddress = (body = {}) => {
  const required = {
    address_type: 100,
    contact_person_name: 100,
    contact_person_number: 20,
    address: 2000,
  };
  for (const [field, maxLength] of Object.entries(required)) {
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      throw new AppError(`${field} is required`, 400);
    }
    if (body[field].trim().length > maxLength) {
      throw new AppError(`${field} must be at most ${maxLength} characters`, 400);
    }
  }

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new AppError('latitude must be between -90 and 90', 400);
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new AppError('longitude must be between -180 and 180', 400);
  }

  const optional = {};
  for (const field of ['floor', 'road', 'house']) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'string' || body[field].length > 255) {
        throw new AppError(`${field} must be a string no longer than 255 characters`, 400);
      }
      optional[field] = body[field].trim();
    }
  }

  return {
    addressType: body.address_type.trim(),
    contactPersonName: body.contact_person_name.trim(),
    contactPersonNumber: body.contact_person_number.trim(),
    address: body.address.trim(),
    latitude: String(latitude),
    longitude: String(longitude),
    ...optional,
  };
};

const resolveZone = async (moduleId, address) => {
  if (!moduleId) throw new AppError('moduleId header is required', 400);
  const baseUrl = (process.env.STORE_SERVICE_URL || 'http://localhost:5003').replace(/\/$/, '');
  let response;
  try {
    response = await fetch(`${baseUrl}/api/v1/customer/zones/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', moduleId: String(moduleId) },
      body: JSON.stringify({ latitude: Number(address.latitude), longitude: Number(address.longitude) }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    throw new AppError(`Store service is unavailable: ${error.message}`, 503);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AppError(payload?.message || 'Address is outside an active store zone', response.status >= 500 ? 503 : response.status);
  }
  if (!payload?.success || !payload.data?.zone_id) {
    throw new AppError('Store service returned an invalid zone response', 502);
  }
  return payload.data.zone_id;
};

const userIdFor = (req) => {
  if (!mongoose.isValidObjectId(req.user?.id)) throw new AppError('Invalid customer identity', 401);
  return new mongoose.Types.ObjectId(req.user.id);
};

const publicAddress = ({ userId, ...address }) => address;

exports.list = async (req, res, next) => {
  try {
    const userId = userIdFor(req);
    const { skip, page, limit } = paginate({ page: req.query.offset, limit: req.query.limit });
    const filter = { userId };
    const [addresses, total] = await Promise.all([
      CustomerAddress.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CustomerAddress.countDocuments(filter),
    ]);
    return success(res, {
      total_size: total,
      limit,
      offset: page,
      addresses: addresses.map(publicAddress),
    });
  } catch (error) { return next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const userId = userIdFor(req);
    const address = normalizeAddress(req.body);
    address.zoneId = await resolveZone(req.get('moduleId'), address);
    const created = await CustomerAddress.create({ ...address, userId });
    return success(res, publicAddress(created.toObject()), 'Address added', 201);
  } catch (error) { return next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const userId = userIdFor(req);
    const filter = { ...addressFilter(req.params.id), userId };
    const address = normalizeAddress(req.body);
    address.zoneId = await resolveZone(req.get('moduleId'), address);
    const updated = await CustomerAddress.findOneAndUpdate(
      filter,
      { $set: address },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) throw new AppError('Address not found', 404);
    return success(res, publicAddress(updated), 'Address updated');
  } catch (error) { return next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    const userId = userIdFor(req);
    if (!req.body.address_id) throw new AppError('address_id is required', 400);
    const deleted = await CustomerAddress.findOneAndDelete({
      ...addressFilter(req.body.address_id),
      userId,
    });
    if (!deleted) throw new AppError('Address not found', 404);
    return success(res, null, 'Address removed');
  } catch (error) { return next(error); }
};
