const { query, getLastInsertId } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const Message = {
    async create({ conversation_id, sender_id, content, message_type = 'text', file_url, file_name, file_size }) {
        const id = uuidv4();
        await query(
            `INSERT INTO messages (id, conversation_id, sender_id, content, message_type, file_url, file_name, file_size)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, conversation_id, sender_id, content, message_type, file_url, file_name, file_size]
        );
        const result = await query('SELECT * FROM messages WHERE id = ?', [id]);
        return result.rows[0];
    },

    async getByConversation(conversationId, { page = 1, limit = 50 } = {}) {
        const offset = (page - 1) * limit;
        const result = await query(
            `SELECT m.*, u.username, u.display_name, u.avatar_url
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             WHERE m.conversation_id = ? AND m.deleted_for_sender = 0
             ORDER BY m.created_at DESC
             LIMIT ? OFFSET ?`,
            [conversationId, limit, offset]
        );
        return result.rows.reverse();
    },

    async markAsRead(messageIds, userId) {
        if (!messageIds || messageIds.length === 0) return;
        const placeholders = messageIds.map(() => '?').join(',');
        await query(
            `UPDATE messages SET is_read = 1, read_at = datetime('now')
             WHERE id IN (${placeholders}) AND sender_id != ? AND is_read = 0`,
            [...messageIds, userId]
        );
    },

    async markConversationAsRead(conversationId, userId) {
        await query(
            `UPDATE messages SET is_read = 1, read_at = datetime('now')
             WHERE conversation_id = ? AND sender_id != ? AND is_read = 0`,
            [conversationId, userId]
        );
    },

    async getUnreadCount(userId) {
        const result = await query(`
            SELECT COUNT(*) as count
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE (c.participant_one = ? OR c.participant_two = ?)
              AND m.sender_id != ?
              AND m.is_read = 0
        `, [userId, userId, userId]);
        return parseInt(result.rows[0].count, 10);
    },

    async getUnreadByConversation(userId) {
        const result = await query(`
            SELECT c.id as conversation_id, COUNT(m.id) as unread_count
            FROM conversations c
            LEFT JOIN messages m ON m.conversation_id = c.id AND m.sender_id != ? AND m.is_read = 0
            WHERE c.participant_one = ? OR c.participant_two = ?
            GROUP BY c.id
        `, [userId, userId, userId]);

        const map = {};
        result.rows.forEach(r => { map[r.conversation_id] = parseInt(r.unread_count, 10); });
        return map;
    },

    async searchInConversation(conversationId, searchTerm) {
        const result = await query(
            `SELECT m.*, u.username, u.display_name, u.avatar_url
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             WHERE m.conversation_id = ?
               AND m.content LIKE ?
               AND m.deleted_for_sender = 0
             ORDER BY m.created_at DESC
             LIMIT 50`,
            [conversationId, `%${searchTerm}%`]
        );
        return result.rows.reverse();
    },

    async deleteForSender(messageId, userId) {
        await query(
            'UPDATE messages SET deleted_for_sender = 1 WHERE id = ? AND sender_id = ?',
            [messageId, userId]
        );
    },

    async getAttachment(messageId) {
        const result = await query(
            'SELECT id, message_type, file_url, file_name, file_size, sender_id FROM messages WHERE id = ?',
            [messageId]
        );
        return result.rows[0] || null;
    }
};

module.exports = Message;
