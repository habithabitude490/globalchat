const { body, param, query, validationResult } = require('express-validator');

function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(e => ({ field: e.path, message: e.msg }))
        });
    }
    next();
}

const registerValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username must be 3-30 characters, alphanumeric and underscores only'),
    body('display_name')
        .trim()
        .isLength({ min: 2, max: 60 })
        .withMessage('Display name must be 2-60 characters'),
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('password')
        .isLength({ min: 8, max: 128 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must be 8+ chars with uppercase, lowercase, and number'),
    handleValidationErrors
];

const loginValidation = [
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors
];

const messageValidation = [
    body('conversationId').isUUID().withMessage('Invalid conversation ID'),
    body('content').optional().trim().isLength({ max: 5000 }).withMessage('Message too long'),
    handleValidationErrors
];

const userIdParam = [
    param('id').isUUID().withMessage('Invalid user ID'),
    handleValidationErrors
];

const conversationIdParam = [
    param('conversationId').isUUID().withMessage('Invalid conversation ID'),
    handleValidationErrors
];

const profileUpdate = [
    body('display_name').optional().trim().isLength({ min: 2, max: 60 }),
    body('biography').optional().trim().isLength({ max: 500 }),
    body('country').optional().trim().isLength({ max: 100 }),
    body('languages').optional().isArray(),
    body('interests').optional().isArray(),
    handleValidationErrors
];

const searchValidation = [
    query('q').optional().trim().isLength({ max: 100 }),
    query('country').optional().trim().isLength({ max: 100 }),
    query('language').optional().trim().isLength({ max: 50 }),
    query('interest').optional().trim().isLength({ max: 50 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    handleValidationErrors
];

module.exports = {
    registerValidation,
    loginValidation,
    messageValidation,
    userIdParam,
    conversationIdParam,
    profileUpdate,
    searchValidation,
    handleValidationErrors
};
