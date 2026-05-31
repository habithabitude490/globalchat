const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');
const { messageValidation, conversationIdParam } = require('../middleware/validation');

router.get('/conversations', authenticate, messageController.getConversations);
router.get('/conversations/:conversationId', authenticate, conversationIdParam, messageController.getConversationMessages);
router.post('/conversations/:conversationId/read', authenticate, conversationIdParam, messageController.markAsRead);
router.post('/conversations/:conversationId', authenticate, conversationIdParam, messageController.sendMessage);
router.get('/conversations/:conversationId/search', authenticate, conversationIdParam, messageController.searchMessages);
router.get('/unread', authenticate, messageController.getUnreadCount);
router.delete('/:messageId', authenticate, messageController.deleteMessage);

module.exports = router;
