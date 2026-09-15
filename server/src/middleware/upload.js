const multer = require('multer');
const { BadRequestError } = require('../utils/AppError');

// Store files in memory buffer for streaming to cloud storage
const storage = multer.memoryStorage();

// File type filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestError(
        'Invalid file type. Only JPEG, PNG, and WebP image files are permitted.'
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 Megabytes
  },
});

module.exports = {
  uploadSingleImage: (fieldName = 'image') => upload.single(fieldName),
  uploadMultipleImages: (fieldName = 'images', maxCount = 5) => upload.array(fieldName, maxCount),
};
