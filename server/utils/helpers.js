function sanitizeUser(user) {
    if (!user) return null;
    const { password_hash, is_banned, ban_reason, ...safeUser } = user;
    if (typeof safeUser.languages === 'string') {
        try { safeUser.languages = JSON.parse(safeUser.languages); } catch { safeUser.languages = []; }
    }
    if (typeof safeUser.interests === 'string') {
        try { safeUser.interests = JSON.parse(safeUser.interests); } catch { safeUser.interests = []; }
    }
    return safeUser;
}

function sanitizeUserArray(users) {
    return users.map(user => sanitizeUser(user));
}

function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
}

function generateConversationId(id1, id2) {
    return [id1, id2].sort().join('_');
}

function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

module.exports = {
    sanitizeUser,
    sanitizeUserArray,
    formatRelativeTime,
    generateConversationId,
    parsePagination,
    validateEmail
};
