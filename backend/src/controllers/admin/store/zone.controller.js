const mongoose = require('mongoose');
const Zone = require('../../../models/store/Zone');
const { success, error } = require('../../../utils/response');

exports.getAll = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status !== undefined) filter.status = req.query.status === 'true';
    if (req.query.state) filter.state = req.query.state;
    const zones = await Zone.find(filter).sort({ name: 1 });
    return success(res, zones);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid zone ID', 400);
    const zone = await Zone.findById(req.params.id);
    if (!zone) return error(res, 'Not found', 404);
    return success(res, zone);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, displayName, state, coordinates, cashOnDelivery, digitalPayment, offlinePayment,
      increasedDeliveryFee, increasedDeliveryFeeStatus, increaseDeliveryChargeMessage } = req.body;
    if (!name?.trim()) return error(res, 'name is required', 400);
    if (!coordinates) return error(res, 'coordinates is required', 400);
    const zone = await Zone.create({ name, displayName, state, coordinates, cashOnDelivery,
      digitalPayment, offlinePayment, increasedDeliveryFee, increasedDeliveryFeeStatus,
      increaseDeliveryChargeMessage });
    return success(res, zone, 'Zone created', 201);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid zone ID', 400);
    const allowed = ['name', 'displayName', 'state', 'coordinates', 'status', 'cashOnDelivery',
      'digitalPayment', 'offlinePayment', 'increasedDeliveryFee', 'increasedDeliveryFeeStatus',
      'increaseDeliveryChargeMessage', 'storeWiseTopic', 'customerWiseTopic', 'deliverymanWiseTopic'];
    const fields = Object.fromEntries(
      allowed.filter(k => req.body[k] !== undefined).map(k => [k, req.body[k]])
    );
    if (!Object.keys(fields).length) return error(res, 'No valid fields to update', 400);
    const zone = await Zone.findByIdAndUpdate(req.params.id, fields, { new: true });
    if (!zone) return error(res, 'Not found', 404);
    return success(res, zone);
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid zone ID', 400);
    if (typeof req.body.status !== 'boolean')
      return error(res, 'status (boolean) is required', 400);
    const zone = await Zone.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!zone) return error(res, 'Not found', 404);
    return success(res, zone);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return error(res, 'Invalid zone ID', 400);
    const zone = await Zone.findByIdAndDelete(req.params.id);
    if (!zone) return error(res, 'Not found', 404);
    return success(res, null, 'Deleted');
  } catch (err) { next(err); }
};
