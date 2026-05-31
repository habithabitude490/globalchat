const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { query } = require('../config/database');

exports.getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.getUserConversations(req.userId);
        const unreadMap = await Message.getUnreadByConversation(req.userId);

        const enriched = conversations.map(c => ({
            ...c,
            unread_count: unreadMap[c.id] || 0
        }));

        res.json({ conversations: enriched });
    } catch (error) {
        console.error('[Message] Get conversations error:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
};

exports.getConversationMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (conversation.participant_one !== req.userId && conversation.participant_two !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const messages = await Message.getByConversation(conversationId, {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10)
        });

        res.json({ messages, conversation });
    } catch (error) {
        console.error('[Message] Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (conversation.participant_one !== req.userId && conversation.participant_two !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await Message.markConversationAsRead(conversationId, req.userId);

        const io = req.app.get('io');
        io.to(`user:${req.userId}`).emit('messages:read', { conversationId });

        res.json({ message: 'Messages marked as read' });
    } catch (error) {
        console.error('[Message] Mark read error:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
};

exports.searchMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { q } = req.query;

        if (!q || q.trim().length === 0) {
            return res.status(400).json({ error: 'Search query required' });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (conversation.participant_one !== req.userId && conversation.participant_two !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const messages = await Message.searchInConversation(conversationId, q);
        res.json({ messages });
    } catch (error) {
        console.error('[Message] Search messages error:', error);
        res.status(500).json({ error: 'Failed to search messages' });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { content, messageType = 'text', fileUrl, fileName, fileSize } = req.body;

        if (!content && messageType === 'text') {
            return res.status(400).json({ error: 'Message content is required' });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (conversation.participant_one !== req.userId && conversation.participant_two !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const message = await Message.create({
            conversation_id: conversationId,
            sender_id: req.userId,
            content,
            message_type: messageType,
            file_url: fileUrl,
            file_name: fileName,
            file_size: fileSize
        });

        const receiverId = conversation.participant_one === req.userId
            ? conversation.participant_two
            : conversation.participant_one;

        const io = req.app.get('io');
        const userResult = await query(
            'SELECT username, display_name, avatar_url FROM users WHERE id = ?',
            [req.userId]
        );
        const enrichedMessage = { ...message, ...userResult.rows[0] };

        io.to(`user:${req.userId}`).emit('message:sent', enrichedMessage);
        io.to(`user:${receiverId}`).emit('message:received', enrichedMessage);

        res.status(201).json({ message: enrichedMessage });
    } catch (error) {
        console.error('[Message] Send error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const count = await Message.getUnreadCount(req.userId);
        res.json({ unread_count: count });
    } catch (error) {
        console.error('[Message] Unread count error:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        await Message.deleteForSender(messageId, req.userId);
        res.json({ message: 'Message deleted' });
    } catch (error) {
        console.error('[Message] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
};
