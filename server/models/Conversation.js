const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const Conversation = {
    async findOrCreate(userId1, userId2) {
        const smallId = userId1 < userId2 ? userId1 : userId2;
        const largeId = userId1 < userId2 ? userId2 : userId1;

        let result = await query(
            `SELECT * FROM conversations
             WHERE participant_one = ? AND participant_two = ?`,
            [smallId, largeId]
        );

        if (result.rows.length === 0) {
            const id = uuidv4();
            await query(
                `INSERT INTO conversations (id, participant_one, participant_two)
                 VALUES (?, ?, ?)`,
                [id, smallId, largeId]
            );
            result = await query('SELECT * FROM conversations WHERE id = ?', [id]);
        }

        return result.rows[0];
    },

    async getUserConversations(userId) {
        const result = await query(
            `SELECT c.*,
                    CASE WHEN c.participant_one = ? THEN u2.id ELSE u1.id END as other_user_id,
                    CASE WHEN c.participant_one = ? THEN u2.username ELSE u1.username END as other_username,
                    CASE WHEN c.participant_one = ? THEN u2.display_name ELSE u1.display_name END as other_display_name,
                    CASE WHEN c.participant_one = ? THEN u2.avatar_url ELSE u1.avatar_url END as other_avatar_url,
                    CASE WHEN c.participant_one = ? THEN u2.status ELSE u1.status END as other_status,
                    (SELECT content FROM messages WHERE conversation_id = c.id AND deleted_for_sender = 0 ORDER BY created_at DESC LIMIT 1) as last_message,
                    (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
             FROM conversations c
             JOIN users u1 ON c.participant_one = u1.id
             JOIN users u2 ON c.participant_two = u2.id
             WHERE (c.participant_one = ? OR c.participant_two = ?)
             ORDER BY last_message_time DESC`,
            [userId, userId, userId, userId, userId, userId, userId]
        );
        return result.rows;
    },

    async findById(id) {
        const result = await query('SELECT * FROM conversations WHERE id = ?', [id]);
        return result.rows[0] || null;
    },

    async delete(id) {
        await query('DELETE FROM conversations WHERE id = ?', [id]);
    },

    async getStats() {
        const result = await query(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN created_at > datetime('now', '-1 day') THEN 1 ELSE 0 END) as created_today
            FROM conversations
        `);
        return result.rows[0];
    }
};

module.exports = Conversation;
