const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const validateFields = require('../middleware/validation.middleware');

const router = express.Router();

// Input sanitization and validation criteria
const registerValidation = [
  body('name')
    .notEmpty()
    .withMessage('Name field is required')
    .trim(),
  body('email')
    .isEmail()
    .withMessage('Please specify a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password length must be at least 6 characters'),
  body('role')
    .optional()
    .isIn(['user', 'tech', 'admin'])
    .withMessage('Invalid role specified. Must be user, tech, or admin')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please specify a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password field is required')
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .withMessage('Please specify a valid email address')
    .normalizeEmail()
];

const resetPasswordValidation = [
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password length must be at least 6 characters')
];

// Bind endpoints to controllers and validation middlewares
router.post('/register', registerValidation, validateFields, authController.register);
router.post('/login', loginValidation, validateFields, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/forgot-password', forgotPasswordValidation, validateFields, authController.forgotPassword);
router.post('/reset-password/:token', resetPasswordValidation, validateFields, authController.resetPassword);

module.exports = router;
