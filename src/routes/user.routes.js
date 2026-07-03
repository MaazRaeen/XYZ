const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');
const validateFields = require('../middleware/validation.middleware');

const router = express.Router();

// Apply auth protection to all routes in this file
router.use(protect);

// Registration Validation rules
const fcmTokenValidation = [
  body('fcmToken')
    .notEmpty()
    .withMessage('FCM registration token (fcmToken) is required')
    .trim()
];

// POST /api/users/fcm-token
router.post('/fcm-token', fcmTokenValidation, validateFields, userController.updateFcmToken);

module.exports = router;
