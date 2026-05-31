const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { authenticate } = require('../middleware/auth');
const { uploadImage, uploadFile, handleUploadError } = require('../middleware/upload');
const rateLimiter = require('../middleware/rateLimiter');

router.post('/image', authenticate, rateLimiter.upload, uploadImage, handleUploadError, uploadController.uploadImage);
router.post('/file', authenticate, rateLimiter.upload, uploadFile, handleUploadError, uploadController.uploadFile);
router.delete('/:type/:filename', authenticate, uploadController.deleteUpload);

module.exports = router;
