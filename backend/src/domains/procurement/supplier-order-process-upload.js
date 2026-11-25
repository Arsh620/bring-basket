const multer = require('multer');
const path = require('path');
const AppError = require('../../utils/AppError');

const allowedExtensions = new Set(['.csv', '.txt', '.xls', '.xlsx']);

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!allowedExtensions.has(path.extname(file.originalname || '').toLowerCase())) {
      callback(new AppError('Upload a CSV, TXT, XLS, or XLSX file', 400));
      return;
    }
    callback(null, true);
  },
});
