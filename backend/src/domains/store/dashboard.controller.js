const mongoose = require('mongoose');
const Store = require('../../models/store/Store');
const Module = require('../../models/store/Module');
const Zone = require('../../models/store/Zone');
const { success, error } = require('../../utils/response');

const isDashboardId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

const referenceValues = async (Model, value) => {
  const document = await Model.collection.findOne(
    { _id: new mongoose.Types.ObjectId(value) },
    { projection: { legacyId: 1 } },
  );
  const values = [new mongoose.Types.ObjectId(value), value];
  if (document?.legacyId !== undefined && document.legacyId !== null) {
    values.push(document.legacyId);
    if (typeof document.legacyId !== 'string') values.push(String(document.legacyId));
  }
  return values;
};

exports.getStoreIds = async (req, res, next) => {
  try {
    const filter = {};
    const { moduleId, zoneId } = req.query;
    if (moduleId && moduleId !== 'all') {
      if (!isDashboardId(moduleId)) {
        return error(res, 'Invalid module ID', 400);
      }
      filter.moduleId = { $in: await referenceValues(Module, moduleId) };
    }
    if (zoneId && zoneId !== 'all') {
      if (!isDashboardId(zoneId)) {
        return error(res, 'Invalid zone ID', 400);
      }
      filter.zoneId = { $in: await referenceValues(Zone, zoneId) };
    }

    const stores = await Store.collection.find(filter, { projection: { _id: 1 } }).toArray();
    return success(res, { storeIds: stores.map((store) => String(store._id)) });
  } catch (err) {
    return next(err);
  }
};
