const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const result = await query(
            'SELECT id, username, display_name, email, avatar_url, country, languages, biography, interests, is_verified, is_admin, is_banned, status, last_seen, created_at FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        if (user.is_banned) {
            return res.status(403).json({ error: 'Account has been suspended', reason: user.ban_reason });
        }

        req.user = user;
        req.userId = user.id;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        console.error('[Auth Middleware] Error:', error);
        return res.status(500).json({ error: 'Authentication error' });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        req.userId = null;
        return next();
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        query('SELECT id, username, display_name, avatar_url, is_admin, is_banned FROM users WHERE id = $1', [decoded.userId])
            .then(result => {
                if (result.rows.length > 0 && !result.rows[0].is_banned) {
                    req.user = result.rows[0];
                    req.userId = result.rows[0].id;
                } else {
                    req.user = null;
                    req.userId = null;
                }
                next();
            })
            .catch(() => {
                req.user = null;
                req.userId = null;
                next();
            });
    } catch {
        req.user = null;
        req.userId = null;
        next();
    }
}

module.exports = { authenticate, requireAdmin, optionalAuth };
