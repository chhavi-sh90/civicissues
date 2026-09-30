// src/middleware/uploadMiddleware.js
// Uses multer with memoryStorage (files arrive as buffers, which we then
// hand to config/cloudStorage.js -> uploadFile()). This keeps the
// upload destination (local vs cloud) fully decoupled from multer.

const multer = require('multer');
const env = require('../config/env');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only JPG, PNG or WEBP images are allowed.'));
  }
  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    files: 5, // max 5 photos per complaint
  },
  fileFilter,
});

// Named exports for the two upload shapes we need across the API:
module.exports = {
  singleImage: upload.single('image'),
  multipleImages: upload.array('images', 5),
};
