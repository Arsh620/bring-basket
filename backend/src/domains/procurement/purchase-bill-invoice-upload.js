const multer = require('multer');
const AppError = require('../../utils/AppError');

const allowedTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      callback(new AppError('Invoice must be a PDF, JPEG, PNG, or WebP file', 400));
      return;
    }
    callback(null, true);
  },
});
