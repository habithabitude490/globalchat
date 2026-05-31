const { query, getLastInsertId } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const User = {
    async findById(id) {
        const result = await query(
            `SELECT id, username, display_name, email, avatar_url, country, languages, biography,
                    interests, is_verified, is_admin, is_banned, ban_reason, status, last_seen, created_at
             FROM users WHERE id = ?`,
            [id]
        );
        return result.rows[0] || null;
    },

    async findByEmail(email) {
        const result = await query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        return result.rows[0] || null;
    },

    async findByUsername(username) {
        const result = await query('SELECT * FROM users WHERE username = ?', [username]);
        return result.rows[0] || null;
    },

    async create({ username, display_name, email, password_hash }) {
        const id = uuidv4();
        await query(
            `INSERT INTO users (id, username, display_name, email, password_hash)
             VALUES (?, ?, ?, ?, ?)`,
            [id, username, display_name, email.toLowerCase(), password_hash]
        );
        return { id, username, display_name, email: email.toLowerCase() };
    },

    async update(id, fields) {
        const allowed = ['display_name', 'avatar_url', 'country', 'languages', 'biography', 'interests'];
        const updates = [];
        const params = [];

        for (const [key, value] of Object.entries(fields)) {
            if (allowed.includes(key)) {
                updates.push(`${key} = ?`);
                params.push(value);
            }
        }

        if (updates.length === 0) return null;

        params.push(id);
        await query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        const result = await query(
            'SELECT id, username, display_name, avatar_url, country, languages, biography, interests, status, last_seen FROM users WHERE id = ?',
            [id]
        );
        return result.rows[0];
    },

    async updatePassword(id, password_hash) {
        await query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, id]);
    },

    async verifyEmail(id) {
        await query("UPDATE users SET is_verified = 1 WHERE id = ?", [id]);
    },

    async setStatus(id, status) {
        await query("UPDATE users SET status = ?, last_seen = datetime('now') WHERE id = ?", [status, id]);
    },

    async toggleBan(id, isBanned, reason = null) {
        await query(
            'UPDATE users SET is_banned = ?, ban_reason = ? WHERE id = ?',
            [isBanned ? 1 : 0, reason, id]
        );
    },

    async setAdmin(id, isAdmin) {
        await query('UPDATE users SET is_admin = ? WHERE id = ?', [isAdmin ? 1 : 0, id]);
    },

    async getOnlineCount() {
        const result = await query("SELECT COUNT(*) as count FROM users WHERE status = 'online'");
        return parseInt(result.rows[0].count, 10);
    },

    async getTotalCount() {
        const result = await query('SELECT COUNT(*) as count FROM users');
        return parseInt(result.rows[0].count, 10);
    },

    async getStats() {
        const result = await query(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
                SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as verified,
                SUM(CASE WHEN is_banned = 1 THEN 1 ELSE 0 END) as banned,
                SUM(CASE WHEN created_at > datetime('now', '-1 day') THEN 1 ELSE 0 END) as joined_today
            FROM users
        `);
        return result.rows[0];
    },

    async list({ page = 1, limit = 20, search = '', banned = null } = {}) {
        const offset = (page - 1) * limit;
        let sql = 'SELECT id, username, display_name, email, country, status, is_verified, is_banned, is_admin, created_at FROM users WHERE 1=1';
        const params = [];

        if (search) {
            sql += ' AND (username LIKE ? OR display_name LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (banned !== null) {
            sql += ' AND is_banned = ?';
            params.push(banned ? 1 : 0);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const result = await query(sql, params);
        return result.rows;
    }
};

module.exports = User;
