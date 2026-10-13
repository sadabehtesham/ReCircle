const multer = require('multer');
const ApiError = require('../utils/ApiError');

const allowed = ['image/jpeg', 'image/png', 'image/webp'];

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) =>
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new ApiError(400, 'Only JPEG, PNG or WebP images are allowed')),
}).array('images', 5);
