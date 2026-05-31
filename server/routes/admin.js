const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUserDetails);
router.patch('/users/:id/ban', adminController.toggleBan);
router.patch('/users/:id/admin', adminController.toggleAdmin);
router.get('/reports', adminController.getReports);
router.patch('/reports/:id/resolve', adminController.resolveReport);
router.get('/logs', adminController.getLogs);

module.exports = router;
