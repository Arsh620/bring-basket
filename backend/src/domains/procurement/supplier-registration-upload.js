const multer = require('multer');
const AppError = require('../../utils/AppError');

const documentTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 11, fields: 40, parts: 55 },
  fileFilter: (req, file, callback) => {
    const allowed = file.fieldname === 'photo' ? imageTypes : documentTypes;
    if (!allowed.has(file.mimetype)) {
      callback(new AppError(
        file.fieldname === 'photo'
          ? 'Profile photo must be JPEG, PNG, or WebP'
          : 'Documents must be PDF, JPEG, PNG, WebP, DOC, or DOCX files',
        400,
      ));
      return;
    }
    callback(null, true);
  },
}).fields([
  { name: 'documents', maxCount: 10 },
  { name: 'photo', maxCount: 1 },
]);
