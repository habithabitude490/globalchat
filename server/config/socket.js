const jwt = require('jsonwebtoken');
const { query } = require('./database');
const { setupChatHandler } = require('../socket/chatHandler');

const onlineUsers = new Map();

function setupSocket(io) {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            if (!token) {
                return next(new Error('Authentication required'));
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const result = await query(
                'SELECT id, username, display_name, avatar_url, status, is_banned FROM users WHERE id = ?',
                [decoded.userId]
            );
            if (result.rows.length === 0 || result.rows[0].is_banned) {
                return next(new Error('User not found or banned'));
            }
            socket.user = result.rows[0];
            socket.userId = result.rows[0].id;
            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', async (socket) => {
        const userId = socket.userId;
        onlineUsers.set(userId, {
            socketId: socket.id,
            user: socket.user,
            lastActivity: Date.now()
        });

        await query("UPDATE users SET status = ?, last_seen = datetime('now') WHERE id = ?", ['online', userId]);
        io.emit('user:status', { userId, status: 'online', displayName: socket.user.display_name, username: socket.user.username, avatarUrl: socket.user.avatar_url });
        io.emit('online:count', { count: onlineUsers.size });

        socket.join(`user:${userId}`);

        setupChatHandler(io, socket);

        socket.on('user:search', async (data) => {
            try {
                const { term } = data;
                const searchTerm = term ? `%${term}%` : null;
                const result = await query(
                    `SELECT id, username, display_name, avatar_url, country, languages, interests, status, last_seen
                     FROM users
                     WHERE is_banned = 0 AND id != ?
                       AND (? IS NULL OR ? = '' OR username LIKE ? OR display_name LIKE ? OR country LIKE ?)
                     ORDER BY last_seen DESC
                     LIMIT 20`,
                    [userId, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]
                );
                socket.emit('user:searchResults', result.rows);
            } catch (error) {
                console.error('[Socket] Search error:', error);
            }
        });

        socket.on('disconnect', async () => {
            onlineUsers.delete(userId);
            await query("UPDATE users SET status = ?, last_seen = datetime('now') WHERE id = ?", ['offline', userId]);
            io.emit('user:status', { userId, status: 'offline' });
            io.emit('online:count', { count: onlineUsers.size });
        });
    });
}

function getOnlineUsers() {
    return onlineUsers;
}

function isUserOnline(userId) {
    return onlineUsers.has(userId);
}

module.exports = { setupSocket, getOnlineUsers, isUserOnline };
