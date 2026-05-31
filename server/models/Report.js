const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const Report = {
    async create({ reporter_id, reported_id, reason, description }) {
        const id = uuidv4();
        await query(
            `INSERT INTO reports (id, reporter_id, reported_id, reason, description)
             VALUES (?, ?, ?, ?, ?)`,
            [id, reporter_id, reported_id, reason, description]
        );
        const result = await query('SELECT * FROM reports WHERE id = ?', [id]);
        return result.rows[0];
    },

    async getPending({ page = 1, limit = 20 } = {}) {
        const offset = (page - 1) * limit;
        const result = await query(
            `SELECT r.*, reporter.username as reporter_name, reported.username as reported_name,
                    reported.display_name as reported_display
             FROM reports r
             JOIN users reporter ON r.reporter_id = reporter.id
             JOIN users reported ON r.reported_id = reported.id
             WHERE r.status = 'pending'
             ORDER BY r.created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        return result.rows;
    },

    async getAll({ page = 1, limit = 20, status } = {}) {
        const offset = (page - 1) * limit;
        let sql = `
            SELECT r.*, reporter.username as reporter_name, reported.username as reported_name,
                   reported.display_name as reported_display
            FROM reports r
            JOIN users reporter ON r.reporter_id = reporter.id
            JOIN users reported ON r.reported_id = reported.id
            WHERE 1=1`;
        const params = [];

        if (status) {
            sql += ' AND r.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const result = await query(sql, params);
        return result.rows;
    },

    async resolve(reportId, adminId, status) {
        await query(
            `UPDATE reports SET status = ?, resolved_by = ?, resolved_at = datetime('now')
             WHERE id = ?`,
            [status, adminId, reportId]
        );
    },

    async getStats() {
        const result = await query(`
            SELECT
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
                SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) as dismissed,
                COUNT(*) as total
            FROM reports
        `);
        return result.rows[0];
    }
};

module.exports = Report;
