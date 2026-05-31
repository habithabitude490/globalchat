const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { registerValidation, loginValidation } = require('../middleware/validation');
const rateLimiter = require('../middleware/rateLimiter');

router.post('/register', rateLimiter.auth, registerValidation, authController.register);
router.post('/login', rateLimiter.auth, loginValidation, authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.post('/forgot-password', rateLimiter.auth, authController.forgotPassword);
router.post('/reset-password', rateLimiter.auth, authController.resetPassword);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/refresh-token', authController.refreshToken);

module.exports = router;
