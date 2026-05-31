const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const Notification = {
    async create({ user_id, type, title, body, related_user_id, conversation_id }) {
        const id = uuidv4();
        await query(
            `INSERT INTO notifications (id, user_id, type, title, body, related_user_id, conversation_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, user_id, type, title, body, related_user_id, conversation_id]
        );
        const result = await query('SELECT * FROM notifications WHERE id = ?', [id]);
        return result.rows[0];
    },

    async getByUser(userId, { limit = 30, offset = 0 } = {}) {
        const result = await query(
            `SELECT n.*, u.display_name as related_name, u.avatar_url as related_avatar
             FROM notifications n
             LEFT JOIN users u ON n.related_user_id = u.id
             WHERE n.user_id = ?
             ORDER BY n.created_at DESC
             LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );
        return result.rows;
    },

    async getUnreadCount(userId) {
        const result = await query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [userId]
        );
        return parseInt(result.rows[0].count, 10);
    },

    async markAsRead(notificationId, userId) {
        await query(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [notificationId, userId]
        );
    },

    async markAllAsRead(userId) {
        await query(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
            [userId]
        );
    },

    async delete(notificationId, userId) {
        await query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [notificationId, userId]);
    }
};

module.exports = Notification;
