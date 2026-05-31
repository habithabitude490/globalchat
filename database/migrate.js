require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'chatworld.sqlite');

async function migrate() {
    const SQL = await initSqlJs();
    const dir = path.dirname(DB_PATH);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const db = new SQL.Database();
    db.run('PRAGMA journal_mode=WAL');
    db.run('PRAGMA foreign_keys=ON');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('[Migrate] Applying schema...');
    db.run(schema);
    console.log('[Migrate] Schema applied successfully.');

    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    db.close();

    console.log('[Migrate] Database saved to:', DB_PATH);
}

migrate().catch(err => {
    console.error('[Migrate] Error:', err.message);
    process.exit(1);
});
