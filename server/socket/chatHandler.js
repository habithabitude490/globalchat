const { query } = require('../config/database');
const Message = require('../models/Message');

function setupChatHandler(io, socket) {
    socket.on('message:send', async (data, callback) => {
        try {
            const { conversationId, content, messageType = 'text', fileUrl, fileName, fileSize } = data;

            if (!conversationId || (!content && messageType === 'text')) {
                if (callback) callback({ error: 'Invalid message data' });
                return;
            }

            const convResult = await query(
                'SELECT participant_one, participant_two FROM conversations WHERE id = $1',
                [conversationId]
            );
            if (convResult.rows.length === 0) {
                if (callback) callback({ error: 'Conversation not found' });
                return;
            }

            const conv = convResult.rows[0];
            const receiverId = conv.participant_one === socket.userId
                ? conv.participant_two
                : conv.participant_one;

            const blockCheck = await query(
                `SELECT id FROM blocked_users
                 WHERE (blocker_id = $1 AND blocked_id = $2)
                    OR (blocker_id = $2 AND blocked_id = $1)`,
                [socket.userId, receiverId]
            );
            if (blockCheck.rows.length > 0) {
                if (callback) callback({ error: 'Unable to send message' });
                return;
            }

            const message = await Message.create({
                conversation_id: conversationId,
                sender_id: socket.userId,
                content,
                message_type: messageType,
                file_url: fileUrl,
                file_name: fileName,
                file_size: fileSize
            });

            const userResult = await query(
                'SELECT username, display_name, avatar_url FROM users WHERE id = $1',
                [socket.userId]
            );
            const enrichedMessage = { ...message, ...userResult.rows[0] };

            io.to(`user:${socket.userId}`).emit('message:sent', enrichedMessage);
            io.to(`user:${receiverId}`).emit('message:received', enrichedMessage);

            if (callback) callback({ success: true, message: enrichedMessage });
        } catch (error) {
            console.error('[ChatHandler] Send error:', error);
            if (callback) callback({ error: 'Failed to send message' });
        }
    });

    socket.on('message:read', async (data) => {
        try {
            const { messageIds } = data;
            if (!messageIds || messageIds.length === 0) return;

            await Message.markAsRead(messageIds, socket.userId);
            io.to(`user:${socket.userId}`).emit('messages:read', { messageIds });
        } catch (error) {
            console.error('[ChatHandler] Read error:', error);
        }
    });

    socket.on('message:typing', (data) => {
        const { conversationId, isTyping } = data;
        socket.to(`conversation:${conversationId}`).emit('message:typing', {
            userId: socket.userId,
            username: socket.user.username,
            displayName: socket.user.display_name,
            conversationId,
            isTyping
        });
    });

    socket.on('conversation:join', (conversationId) => {
        if (conversationId) {
            socket.join(`conversation:${conversationId}`);
        }
    });

    socket.on('conversation:leave', (conversationId) => {
        if (conversationId) {
            socket.leave(`conversation:${conversationId}`);
        }
    });

    socket.on('user:onlineStatus', async (data) => {
        try {
            const { userId } = data;
            const result = await query(
                'SELECT status, last_seen FROM users WHERE id = $1',
                [userId]
            );
            if (result.rows.length > 0) {
                socket.emit('user:onlineStatus', { userId, ...result.rows[0] });
            }
        } catch (error) {
            console.error('[ChatHandler] Status error:', error);
        }
    });
}

module.exports = { setupChatHandler };
