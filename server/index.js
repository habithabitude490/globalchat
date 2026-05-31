require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { Server } = require('socket.io');
const { initializeDatabase } = require('./config/database');
const { setupSocket } = require('./config/socket');
const rateLimiter = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || (process.env.VERCEL === '1' ? true : 'http://localhost:3000'),
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingInterval: 25000,
    pingTimeout: 20000
});

const PORT = process.env.PORT || 3000;

app.set('io', io);
app.set('trust proxy', 1);

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN || (process.env.VERCEL === '1' ? true : 'http://localhost:3000'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(rateLimiter.global);

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

app.use('/api/auth', authRoutes);
app.use('/api/users', rateLimiter.api, userRoutes);
app.use('/api/messages', rateLimiter.api, messageRoutes);
app.use('/api/admin', rateLimiter.api, adminRoutes);
app.use('/api/upload', rateLimiter.api, uploadRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

setupSocket(io);

async function start() {
    try {
        await initializeDatabase();
        server.listen(PORT);
        server.on('listening', () => {
            console.log(`[ChatWorld] Server running on port ${PORT}`);
            console.log(`[ChatWorld] Environment: ${process.env.NODE_ENV || 'development'}`);
        });
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`[ChatWorld] Port ${PORT} is already in use.`);
                console.error('[ChatWorld] Stop the existing server first, then try again.');
            } else {
                console.error('[ChatWorld] Server error:', error.message);
            }
            server.close(() => process.exit(1));
        });
    } catch (error) {
        console.error('[ChatWorld] Failed to start server:', error);
        server.close(() => process.exit(1));
    }
}

if (process.env.VERCEL !== '1') {
    start();
}

module.exports = { app, server, io, initializeDatabase, start };
