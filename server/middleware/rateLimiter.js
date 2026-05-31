const rateLimit = require('express-rate-limit');

const global = rateLimit({
    windowMs: 60000,
    max: 1000000,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: process.env.NODE_ENV === 'production'
});

const api = rateLimit({
    windowMs: 60000,
    max: 1000000,
    message: { error: 'API rate limit exceeded' },
    standardHeaders: true,
    legacyHeaders: false
});

const auth = rateLimit({
    windowMs: 60000,
    max: 1000000,
    message: { error: 'Too many authentication attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
});

const search = rateLimit({
    windowMs: 60000,
    max: 1000000,
    message: { error: 'Search rate limit exceeded' }
});

const upload = rateLimit({
    windowMs: 60000,
    max: 1000000,
    message: { error: 'Upload limit exceeded, please try again later' }
});

module.exports = { global, api, auth, search, upload };
