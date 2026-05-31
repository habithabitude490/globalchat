const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const BlockedUser = {
    async block(blockerId, blockedId) {
        const existing = await query(
            'SELECT id FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?',
            [blockerId, blockedId]
        );
        if (existing.rows.length > 0) return existing.rows[0];

        const id = uuidv4();
        await query(
            'INSERT INTO blocked_users (id, blocker_id, blocked_id) VALUES (?, ?, ?)',
            [id, blockerId, blockedId]
        );
        return { id, blocker_id: blockerId, blocked_id: blockedId };
    },

    async unblock(blockerId, blockedId) {
        await query(
            'DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?',
            [blockerId, blockedId]
        );
    },

    async isBlocked(blockerId, blockedId) {
        const result = await query(
            'SELECT id FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?',
            [blockerId, blockedId]
        );
        return result.rows.length > 0;
    },

    async areBlocked(userId1, userId2) {
        const result = await query(
            `SELECT id FROM blocked_users
             WHERE (blocker_id = ? AND blocked_id = ?)
                OR (blocker_id = ? AND blocked_id = ?)`,
            [userId1, userId2, userId2, userId1]
        );
        return result.rows.length > 0;
    },

    async getBlockedUsers(userId) {
        const result = await query(
            `SELECT u.id, u.username, u.display_name, u.avatar_url, u.country, b.created_at as blocked_at
             FROM blocked_users b
             JOIN users u ON b.blocked_id = u.id
             WHERE b.blocker_id = ?
             ORDER BY b.created_at DESC`,
            [userId]
        );
        return result.rows;
    },

    async getBlockedBy(userId) {
        const result = await query(
            'SELECT blocker_id FROM blocked_users WHERE blocked_id = ?',
            [userId]
        );
        return result.rows.map(r => r.blocker_id);
    }
};

module.exports = BlockedUser;
