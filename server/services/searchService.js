const { query } = require('../config/database');

async function searchUsers({ term, country, language, interest, page = 1, limit = 20, currentUserId = null }) {
    const offset = (page - 1) * limit;

    let sql = `
        SELECT id, username, display_name, avatar_url, country, languages, interests, status, last_seen
        FROM users
        WHERE is_banned = 0
    `;
    const params = [];

    if (currentUserId) {
        sql += ' AND id != ?';
        params.push(currentUserId);
    }

    if (term && term.trim()) {
        sql += ' AND (';
        sql += ' username LIKE ?';
        sql += ' OR display_name LIKE ?';
        sql += ' OR country LIKE ?';
        sql += ' OR languages LIKE ?';
        sql += ' OR interests LIKE ?';
        sql += ' )';
        const likeTerm = `%${term.trim()}%`;
        params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
    }

    if (country && country.trim()) {
        sql += ' AND country LIKE ?';
        params.push(`%${country.trim()}%`);
    }

    if (language && language.trim()) {
        sql += ' AND languages LIKE ?';
        params.push(`%${language.trim()}%`);
    }

    if (interest && interest.trim()) {
        sql += ' AND interests LIKE ?';
        params.push(`%${interest.trim()}%`);
    }

    sql += " ORDER BY CASE WHEN status = 'online' THEN 0 ELSE 1 END, last_seen DESC";
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
}

async function countSearchResults({ term, country, language, interest, currentUserId = null }) {
    let sql = 'SELECT COUNT(*) as count FROM users WHERE is_banned = 0';
    const params = [];

    if (currentUserId) {
        sql += ' AND id != ?';
        params.push(currentUserId);
    }

    if (term && term.trim()) {
        sql += ' AND (';
        sql += ' username LIKE ?';
        sql += ' OR display_name LIKE ?';
        sql += ' OR country LIKE ?';
        sql += ' OR languages LIKE ?';
        sql += ' OR interests LIKE ?';
        sql += ' )';
        const likeTerm = `%${term.trim()}%`;
        params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
    }

    if (country && country.trim()) {
        sql += ' AND country LIKE ?';
        params.push(`%${country.trim()}%`);
    }

    if (language && language.trim()) {
        sql += ' AND languages LIKE ?';
        params.push(`%${language.trim()}%`);
    }

    if (interest && interest.trim()) {
        sql += ' AND interests LIKE ?';
        params.push(`%${interest.trim()}%`);
    }

    const result = await query(sql, params);
    return parseInt(result.rows[0].count, 10);
}

module.exports = { searchUsers, countSearchResults };
