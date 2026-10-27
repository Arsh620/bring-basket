require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const modelsDirectory = path.join(__dirname, '..', 'src', 'models');
const { definitions, registeredModels } = require('../src/models/GeneratedBusinessModels');

for (const fileName of fs.readdirSync(modelsDirectory).filter((name) => name.endsWith('.js'))) {
  require(path.join(modelsDirectory, fileName));
}

const migrateDatabase = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set in backend/.env');
  }

  const missingTables = Object.entries(definitions)
    .filter(([tableName, definition]) => {
      const model = registeredModels[tableName];
      return !model || model.modelName !== definition.modelName;
    })
    .map(([tableName]) => tableName);
  if (missingTables.length > 0) {
    throw new Error(`Mongoose models are missing for SQL tables: ${missingTables.join(', ')}`);
  }

  await mongoose.connect(process.env.MONGO_URI);

  for (const modelName of mongoose.modelNames()) {
    const model = mongoose.model(modelName);
    const collectionName = model.collection.collectionName;
    const collectionExists = await mongoose.connection.db
      .listCollections({ name: collectionName }, { nameOnly: true })
      .hasNext();

    if (!collectionExists) {
      await model.createCollection();
    }

    await model.createIndexes();
    console.log(`Schema ready: ${collectionName}`);
  }

  console.log(`Schema migration complete: ${Object.keys(definitions).length} business tables registered.`);
};

migrateDatabase()
  .catch((error) => {
    console.error('MongoDB schema migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
