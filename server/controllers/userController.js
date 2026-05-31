const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const BlockedUser = require('../models/BlockedUser');
const Report = require('../models/Report');
const { searchUsers, countSearchResults } = require('../services/searchService');
const { sanitizeUser } = require('../utils/helpers');

exports.search = async (req, res) => {
    try {
        const { q, country, language, interest, page = 1, limit = 20 } = req.query;
        const results = await searchUsers({
            term: q,
            country,
            language,
            interest,
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            currentUserId: req.userId
        });
        const total = await countSearchResults({
            term: q,
            country,
            language,
            interest,
            currentUserId: req.userId
        });
        res.json({ users: results, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
    } catch (error) {
        console.error('[User] Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const safeUser = sanitizeUser(user);
        if (req.userId) {
            safeUser.is_blocked = await BlockedUser.isBlocked(req.userId, user.id);
        }

        const onlineCount = await User.getOnlineCount();

        res.json({ user: safeUser, online_users: onlineCount });
    } catch (error) {
        console.error('[User] Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const allowedFields = ['display_name', 'biography', 'country', 'languages', 'interests'];
        const updates = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        const user = await User.update(req.userId, updates);
        res.json({ user, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('[User] Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

exports.updateAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        await User.update(req.userId, { avatar_url: avatarUrl });

        res.json({ avatar_url: avatarUrl, message: 'Avatar updated' });
    } catch (error) {
        console.error('[User] Update avatar error:', error);
        res.status(500).json({ error: 'Failed to update avatar' });
    }
};

exports.getOrCreateConversation = async (req, res) => {
    try {
        const otherUserId = req.params.id;

        if (otherUserId === req.userId) {
            return res.status(400).json({ error: 'Cannot start conversation with yourself' });
        }

        const otherUser = await User.findById(otherUserId);
        if (!otherUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const blocked = await BlockedUser.areBlocked(req.userId, otherUserId);
        if (blocked) {
            return res.status(403).json({ error: 'Unable to start conversation' });
        }

        const conversation = await Conversation.findOrCreate(req.userId, otherUserId);

        await query(
            'INSERT OR IGNORE INTO contacts (id, user_id, contact_id) VALUES (?, ?, ?)',
            [uuidv4(), req.userId, otherUserId]
        );
        await query(
            'INSERT OR IGNORE INTO contacts (id, user_id, contact_id) VALUES (?, ?, ?)',
            [uuidv4(), otherUserId, req.userId]
        );

        res.json({ conversation });
    } catch (error) {
        console.error('[User] Get conversation error:', error);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
};

exports.blockUser = async (req, res) => {
    try {
        const blockedId = req.params.id;
        if (blockedId === req.userId) {
            return res.status(400).json({ error: 'Cannot block yourself' });
        }

        const user = await User.findById(blockedId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await BlockedUser.block(req.userId, blockedId);
        res.json({ message: 'User blocked successfully' });
    } catch (error) {
        console.error('[User] Block error:', error);
        res.status(500).json({ error: 'Failed to block user' });
    }
};

exports.unblockUser = async (req, res) => {
    try {
        await BlockedUser.unblock(req.userId, req.params.id);
        res.json({ message: 'User unblocked successfully' });
    } catch (error) {
        console.error('[User] Unblock error:', error);
        res.status(500).json({ error: 'Failed to unblock user' });
    }
};

exports.getBlockedUsers = async (req, res) => {
    try {
        const blocked = await BlockedUser.getBlockedUsers(req.userId);
        res.json({ blocked });
    } catch (error) {
        console.error('[User] Get blocked error:', error);
        res.status(500).json({ error: 'Failed to fetch blocked users' });
    }
};

exports.reportUser = async (req, res) => {
    try {
        const { reason, description } = req.body;
        const reportedId = req.params.id;

        if (reportedId === req.userId) {
            return res.status(400).json({ error: 'Cannot report yourself' });
        }

        const validReasons = ['spam', 'harassment', 'fake_account', 'inappropriate', 'other'];
        if (!validReasons.includes(reason)) {
            return res.status(400).json({ error: 'Invalid report reason' });
        }

        const report = await Report.create({
            reporter_id: req.userId,
            reported_id: reportedId,
            reason,
            description
        });

        res.status(201).json({ message: 'Report submitted successfully', report });
    } catch (error) {
        console.error('[User] Report error:', error);
        res.status(500).json({ error: 'Failed to submit report' });
    }
};

exports.getOnlineUsersList = async (req, res) => {
    try {
        const result = await query(
            `SELECT id, username, display_name, avatar_url, country
             FROM users
             WHERE status = 'online' AND is_banned = 0
             ORDER BY display_name ASC`
        );
        res.json({ users: result.rows });
    } catch (error) {
        console.error('[User] Online list error:', error);
        res.status(500).json({ error: 'Failed to fetch online users' });
    }
};

exports.getOnlineCount = async (req, res) => {
    try {
        const onlineCount = await User.getOnlineCount();
        const totalCount = await User.getTotalCount();
        res.json({ online_users: onlineCount, total_users: totalCount });
    } catch (error) {
        console.error('[User] Online count error:', error);
        res.status(500).json({ error: 'Failed to get online count' });
    }
};

exports.getContacts = async (req, res) => {
    try {
        const result = await query(
            `SELECT u.id, u.username, u.display_name, u.avatar_url, u.country, u.status, u.last_seen
             FROM contacts c
             JOIN users u ON c.contact_id = u.id
             WHERE c.user_id = ?
             ORDER BY u.status DESC, u.last_seen DESC`,
            [req.userId]
        );
        res.json({ contacts: result.rows });
    } catch (error) {
        console.error('[User] Get contacts error:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
};
