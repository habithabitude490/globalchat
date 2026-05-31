const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { userIdParam, profileUpdate, searchValidation } = require('../middleware/validation');
const rateLimiter = require('../middleware/rateLimiter');
const { uploadAvatar } = require('../middleware/upload');

router.get('/online', userController.getOnlineUsersList);
router.get('/online-count', userController.getOnlineCount);
router.get('/search', rateLimiter.search, searchValidation, userController.search);
router.get('/:id', userIdParam, userController.getProfile);
router.put('/profile', authenticate, profileUpdate, userController.updateProfile);
router.put('/avatar', authenticate, uploadAvatar, userController.updateAvatar);
router.post('/:id/conversation', authenticate, userIdParam, userController.getOrCreateConversation);
router.post('/:id/block', authenticate, userIdParam, userController.blockUser);
router.post('/:id/unblock', authenticate, userIdParam, userController.unblockUser);
router.get('/blocks/list', authenticate, userController.getBlockedUsers);
router.post('/:id/report', authenticate, userIdParam, userController.reportUser);
router.get('/contacts/list', authenticate, userController.getContacts);

module.exports = router;
