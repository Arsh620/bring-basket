const mongoose = require('mongoose');
const Order = require('./order.model');

// The Order and operations databases share a MongoDB client and replica set.
const modelInDatabase = (model, name) => {
  if (!name || name === model.db.name) return model;
  const db = mongoose.connection.useDb(name, { useCache: true });
  return db.models[model.modelName] || db.model(model.modelName, model.schema, model.collection.name);
};

exports.orderModel = () => modelInDatabase(Order, process.env.ORDER_DATABASE);
exports.operationsModel = (model) => modelInDatabase(model, process.env.ORDER_OPERATIONS_DATABASE);
