let app;
let initializeDatabase;

try {
    const serverModule = require('../server/index');
    app = serverModule.app;
    initializeDatabase = serverModule.initializeDatabase;
    console.log('[Vercel] Server module loaded');
} catch (err) {
    console.error('[Vercel] Failed to load server module:', err);
}

let dbInitialized = false;

module.exports = async (req, res) => {
    try {
        if (!app) {
            return res.status(500).json({ error: 'Server module failed to load' });
        }
        if (!dbInitialized) {
            console.log('[Vercel] Initializing database...');
            await initializeDatabase();
            dbInitialized = true;
            console.log('[Vercel] Database initialized');
        }
        return app(req, res);
    } catch (error) {
        console.error('[Vercel] Handler error:', error.message);
        console.error('[Vercel] Stack:', error.stack);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
