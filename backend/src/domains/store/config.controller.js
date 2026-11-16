const BusinessSetting = require('../../models/store/BusinessSetting');
const Zone = require('../../models/store/Zone');
const { success, error } = require('../../utils/response');

const PUBLIC_KEYS = [
  'terms_and_conditions', 'about_us', 'privacy_policy',
  'refund_policy', 'shipping_policy', 'cancellation_policy',
  'app_name', 'app_logo', 'app_minimum_version_android',
  'app_minimum_version_ios', 'currency_symbol', 'currency_symbol_direction',
  'decimal_point_values', 'country_code', 'play_store_config',
  'app_store_config', 'social_media_link', 'footer_text',
];

// GET /config
exports.getConfig = async (req, res, next) => {
  try {
    const settings = await BusinessSetting.find({ key: { $in: PUBLIC_KEYS } }).lean();
    const config = {};
    settings.forEach((s) => { config[s.key] = s.value; });
    return success(res, config);
  } catch (err) { next(err); }
};

// GET /config/terms-and-conditions
exports.getPage = (key) => async (req, res, next) => {
  try {
    const setting = await BusinessSetting.findOne({ key }).lean();
    return success(res, setting?.value || '');
  } catch (err) { next(err); }
};

// GET /zones
exports.getZones = async (req, res, next) => {
  try {
    const zones = await Zone.find({ status: true }).select('_id name displayName state cashOnDelivery digitalPayment').lean();
    return success(res, zones);
  } catch (err) { next(err); }
};

// POST /zones/check  body: { latitude, longitude }
exports.checkZone = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) return error(res, 'latitude and longitude are required', 400);
    const { zoneContains } = require('../../utils/geospatial');
    const zones = await Zone.find({ status: true }).lean();
    const matched = zones.filter((z) => zoneContains(z.coordinates, { latitude: Number(latitude), longitude: Number(longitude) }));
    if (!matched.length) return error(res, 'No zone found for this location', 404);
    return success(res, matched);
  } catch (err) { next(err); }
};

// Admin - manage settings
exports.adminGetAll = async (req, res, next) => {
  try {
    const settings = await BusinessSetting.find().lean();
    return success(res, settings);
  } catch (err) { next(err); }
};

exports.adminUpsert = async (req, res, next) => {
  try {
    const { key, value } = req.body;
    if (!key) return error(res, 'key is required', 400);
    const setting = await BusinessSetting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
    return success(res, setting);
  } catch (err) { next(err); }
};

exports.adminBulkUpsert = async (req, res, next) => {
  try {
    const { settings } = req.body;
    if (!Array.isArray(settings)) return error(res, 'settings array is required', 400);
    const ops = settings.map(({ key, value }) => ({
      updateOne: { filter: { key }, update: { $set: { value } }, upsert: true },
    }));
    await BusinessSetting.bulkWrite(ops);
    return success(res, null, 'Settings updated');
  } catch (err) { next(err); }
};
