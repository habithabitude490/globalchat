function errorHandler(err, req, res, next) {
    console.error('[ErrorHandler]', err);

    if (err.code === '23505') {
        return res.status(409).json({ error: 'Resource already exists' });
    }
    if (err.code === '23503') {
        return res.status(404).json({ error: 'Referenced resource not found' });
    }

    const statusCode = err.statusCode || 500;
    const message = err.statusCode ? err.message : 'Internal server error';

    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { details: err.stack })
    });
}

module.exports = errorHandler;
