const User = require('../models/User');
const Report = require('../models/Report');
const Conversation = require('../models/Conversation');
const { query } = require('../config/database');
const { sanitizeUser } = require('../utils/helpers');

exports.getStats = async (req, res) => {
    try {
        const userStats = await User.getStats();
        const convStats = await Conversation.getStats();
        const reportStats = await Report.getStats();
        const messageResult = await query(
            `SELECT COUNT(*) as total,
                    SUM(CASE WHEN created_at > datetime('now', '-1 day') THEN 1 ELSE 0 END) as today
             FROM messages`
        );

        res.json({
            users: userStats,
            conversations: convStats,
            messages: messageResult.rows[0],
            reports: reportStats
        });
    } catch (error) {
        console.error('[Admin] Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
};

exports.listUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, banned } = req.query;
        const users = await User.list({
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            search,
            banned: banned !== undefined ? banned === 'true' : null
        });
        res.json({ users, page: parseInt(page, 10), limit: parseInt(limit, 10) });
    } catch (error) {
        console.error('[Admin] List users error:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
};

exports.getUserDetails = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const convCount = await query(
            'SELECT COUNT(*) as count FROM conversations WHERE participant_one = ? OR participant_two = ?',
            [user.id, user.id]
        );

        const msgCount = await query(
            'SELECT COUNT(*) as count FROM messages WHERE sender_id = ?',
            [user.id]
        );

        const reportCount = await query(
            'SELECT COUNT(*) as count FROM reports WHERE reported_id = ?',
            [user.id]
        );

        await query(
            `INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details, ip_address)
             VALUES (?, ?, 'view_user', 'user', ?, ?, ?)`,
            [require('uuid').v4(), req.userId, user.id, JSON.stringify({ viewed_at: new Date().toISOString() }), req.ip]
        );

        res.json({
            user: sanitizeUser(user),
            stats: {
                conversations: convCount.rows[0].count,
                messages: msgCount.rows[0].count,
                reports: reportCount.rows[0].count
            }
        });
    } catch (error) {
        console.error('[Admin] User details error:', error);
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
};

exports.toggleBan = async (req, res) => {
    try {
        const { id } = req.params;
        const { ban, reason } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.is_admin) {
            return res.status(403).json({ error: 'Cannot ban an admin' });
        }

        await User.toggleBan(id, ban, reason || null);

        await query(
            `INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details, ip_address)
             VALUES (?, ?, ?, 'user', ?, ?, ?)`,
            [require('uuid').v4(), req.userId, ban ? 'ban_user' : 'unban_user', id,
             JSON.stringify({ reason, timestamp: new Date().toISOString() }), req.ip]
        );

        res.json({ message: ban ? 'User banned' : 'User unbanned' });
    } catch (error) {
        console.error('[Admin] Toggle ban error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

exports.toggleAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin } = req.body;

        if (id === req.userId) {
            return res.status(400).json({ error: 'Cannot modify own admin status' });
        }

        await User.setAdmin(id, admin);

        await query(
            `INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details, ip_address)
             VALUES (?, ?, ?, 'user', ?, ?, ?)`,
            [require('uuid').v4(), req.userId, admin ? 'set_admin' : 'remove_admin', id,
             JSON.stringify({ timestamp: new Date().toISOString() }), req.ip]
        );

        res.json({ message: admin ? 'Admin privileges granted' : 'Admin privileges revoked' });
    } catch (error) {
        console.error('[Admin] Toggle admin error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

exports.getReports = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const reports = await Report.getAll({
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            status
        });
        const stats = await Report.getStats();
        res.json({ reports, stats, page: parseInt(page, 10), limit: parseInt(limit, 10) });
    } catch (error) {
        console.error('[Admin] Get reports error:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
};

exports.resolveReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['reviewed', 'resolved', 'dismissed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await Report.resolve(id, req.userId, status);

        await query(
            `INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details, ip_address)
             VALUES (?, ?, 'resolve_report', 'report', ?, ?, ?)`,
            [require('uuid').v4(), req.userId, id, JSON.stringify({ status, timestamp: new Date().toISOString() }), req.ip]
        );

        res.json({ message: `Report ${status}` });
    } catch (error) {
        console.error('[Admin] Resolve report error:', error);
        res.status(500).json({ error: 'Failed to resolve report' });
    }
};

exports.getLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        const result = await query(
            `SELECT al.*, u.username as admin_username
             FROM admin_logs al
             JOIN users u ON al.admin_id = u.id
             ORDER BY al.created_at DESC
             LIMIT ? OFFSET ?`,
            [parseInt(limit, 10), offset]
        );

        res.json({ logs: result.rows, page: parseInt(page, 10), limit: parseInt(limit, 10) });
    } catch (error) {
        console.error('[Admin] Get logs error:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
};
