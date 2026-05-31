const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const User = require('../models/User');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const { sanitizeUser } = require('../utils/helpers');

function generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
}

exports.register = async (req, res) => {
    try {
        const { username, display_name, email, password } = req.body;

        const existingEmail = await User.findByEmail(email);
        if (existingEmail) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const existingUsername = await User.findByUsername(username);
        if (existingUsername) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        const salt = await bcrypt.genSalt(12);
        const password_hash = await bcrypt.hash(password, salt);

        const user = await User.create({ username, display_name, email, password_hash });

        const verificationToken = uuidv4();
        await query(
            `INSERT INTO email_verifications (id, user_id, token, expires_at)
             VALUES (?, ?, ?, datetime('now', '+24 hours'))`,
            [uuidv4(), user.id, verificationToken]
        );

        sendVerificationEmail(email, username, verificationToken);

        const token = generateToken(user.id);

        res.status(201).json({
            message: 'Account created successfully. Please verify your email.',
            token,
            user: sanitizeUser({ ...user })
        });
    } catch (error) {
        console.error('[Auth] Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (user.is_banned) {
            return res.status(403).json({ error: 'Account suspended', reason: user.ban_reason });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = generateToken(user.id);

        await query(
            `INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at)
             VALUES (?, ?, ?, ?, ?, datetime('now', '+7 days'))`,
            [uuidv4(), user.id, token, req.ip, req.headers['user-agent']]
        );

        await User.setStatus(user.id, 'online');

        res.json({
            token,
            user: sanitizeUser(user)
        });
    } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

exports.logout = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader.split(' ')[1];

        await query('UPDATE sessions SET is_valid = 0 WHERE token = ?', [token]);
        await User.setStatus(req.userId, 'offline');

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('[Auth] Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user: sanitizeUser(user) });
    } catch (error) {
        console.error('[Auth] GetMe error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findByEmail(email);

        if (!user) {
            return res.json({ message: 'If the email exists, a reset link has been sent.' });
        }

        const token = uuidv4();
        await query(
            `INSERT INTO password_resets (id, user_id, token, expires_at)
             VALUES (?, ?, ?, datetime('now', '+1 hour'))`,
            [uuidv4(), user.id, token]
        );

        await sendPasswordResetEmail(email, user.username, token);

        res.json({ message: 'If the email exists, a reset link has been sent.' });
    } catch (error) {
        console.error('[Auth] Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        const result = await query(
            `SELECT pr.user_id, pr.expires_at, pr.used
             FROM password_resets pr
             WHERE pr.token = ?`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        const reset = result.rows[0];
        if (reset.used || new Date() > new Date(reset.expires_at)) {
            return res.status(400).json({ error: 'Token expired or already used' });
        }

        const salt = await bcrypt.genSalt(12);
        const password_hash = await bcrypt.hash(password, salt);

        await User.updatePassword(reset.user_id, password_hash);
        await query('UPDATE password_resets SET used = 1 WHERE token = ?', [token]);

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('[Auth] Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        const result = await query(
            `SELECT ev.user_id, ev.expires_at, ev.used
             FROM email_verifications ev
             WHERE ev.token = ?`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid verification token' });
        }

        const verification = result.rows[0];
        if (verification.used || new Date() > new Date(verification.expires_at)) {
            return res.status(400).json({ error: 'Token expired or already used' });
        }

        await User.verifyEmail(verification.user_id);
        await query('UPDATE email_verifications SET used = 1 WHERE token = ?', [token]);

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        console.error('[Auth] Verify email error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
};

exports.refreshToken = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token required' });
        }

        const oldToken = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(oldToken, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const sessionCheck = await query(
            'SELECT id FROM sessions WHERE token = ? AND is_valid = 1',
            [oldToken]
        );
        if (sessionCheck.rows.length === 0) {
            return res.status(401).json({ error: 'Session invalid' });
        }

        const newToken = generateToken(decoded.userId);
        await query('UPDATE sessions SET token = ? WHERE token = ?', [newToken, oldToken]);

        res.json({ token: newToken });
    } catch (error) {
        console.error('[Auth] Refresh token error:', error);
        res.status(500).json({ error: 'Token refresh failed' });
    }
};
