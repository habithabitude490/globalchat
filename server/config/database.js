const initSqlJs = process.env.VERCEL === '1'
    ? require('sql.js/dist/sql-asm.js')
    : require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.VERCEL === '1'
    ? path.join('/tmp', 'data', 'globalchat.sqlite')
    : path.join(__dirname, '..', '..', 'data', 'globalchat.sqlite');
let db = null;
let SQL = null;

let saveTimer = null;

function sanitizeParams(params) {
    if (!params) return params;
    return params.map(p => p === undefined ? null : p);
}

function convertParams(text, params) {
    const safeParams = sanitizeParams(params);

    if (!safeParams || safeParams.length === 0) {
        return { text, params: [] };
    }

    if (text.includes('$1') || text.includes('$2')) {
        let idx = 1;
        const newText = text.replace(/\$(\d+)/g, (match, num) => {
            return '?';
        });
        const orderedParams = [];
        for (let i = 0; i < safeParams.length; i++) {
            orderedParams.push(safeParams[i]);
        }
        return { text: newText, params: orderedParams };
    }
    return { text, params: safeParams || [] };
}

function isSelectQuery(text) {
    const trimmed = text.trim().toUpperCase();
    return trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('PRAGMA');
}

async function initializeDatabase() {
    SQL = await initSqlJs();

    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
        console.log('[Database] Loaded existing database from file');
    } else {
        db = new SQL.Database();
        console.log('[Database] Created new database in memory');
    }

    const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    db.run('PRAGMA journal_mode=WAL');
    db.run('PRAGMA foreign_keys=ON');
    db.run(schema);
    console.log('[Database] Schema applied successfully');

    db.run("UPDATE users SET status = 'offline' WHERE status = 'online'");

    saveDatabase();

    if (process.env.VERCEL !== '1') {
        saveTimer = setInterval(saveDatabase, 30000);
    }

    return db;
}

function saveDatabase() {
    if (!db) return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(DB_PATH, buffer);
    } catch (error) {
        console.error('[Database] Failed to save:', error.message);
    }
}

function query(text, params) {
    if (!db) {
        throw new Error('Database not initialized');
    }

    const converted = convertParams(text, params);
    const start = Date.now();

    try {
        if (isSelectQuery(text)) {
            const stmt = db.prepare(converted.text);
            if (converted.params && converted.params.length > 0) {
                stmt.bind(converted.params);
            }
            const rows = [];
            while (stmt.step()) {
                rows.push(stmt.getAsObject());
            }
            stmt.free();
            const duration = Date.now() - start;
            if (process.env.NODE_ENV === 'development') {
                console.log(`[Database] Query in ${duration}ms | rows: ${rows.length}`);
            }
            return { rows, rowCount: rows.length };
        } else {
            db.run(converted.text, converted.params);
            const duration = Date.now() - start;
            if (process.env.NODE_ENV === 'development') {
                console.log(`[Database] Exec in ${duration}ms | changes: ${db.getRowsModified()}`);
            }
            return { rows: [], rowCount: db.getRowsModified() };
        }
    } catch (error) {
        console.error('[Database] Query error:', error.message);
        console.error('[Database] SQL:', text);
        console.error('[Database] Params:', params);
        throw error;
    }
}

function getLastInsertId() {
    const result = db.exec("SELECT last_insert_rowid()");
    return result[0].values[0][0];
}

function getChanges() {
    return db.getRowsModified();
}

function close() {
    if (db) {
        saveDatabase();
        db.close();
        db = null;
    }
}

async function getClient() {
    return {
        query: (text, params) => query(text, params),
        release: () => {}
    };
}

process.on('SIGINT', () => { close(); process.exit(0); });
process.on('SIGTERM', () => { close(); process.exit(0); });
process.on('exit', () => { close(); });

module.exports = { query, getClient, initializeDatabase, getLastInsertId, getChanges, saveDatabase, db };
