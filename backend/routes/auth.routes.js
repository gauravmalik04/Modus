/**
 * backend/routes/auth.routes.js
 *
 * All routes mounted at /api/auth
 *
 * Route table:
 *   POST   /api/auth/signup           — Register new user
 *   POST   /api/auth/login            — Login (email or username)
 *   GET    /api/auth/me               — Get current user profile  [protected]
 *   POST   /api/auth/logout           — Logout (client clears token) [protected]
 *   POST   /api/auth/forgot-password  — Trigger recovery email
 */

'use strict';

const express    = require('express');
const { body }   = require('express-validator');

const authController = require('../controllers/auth.controller');
const { protect }    = require('../middleware/auth.middleware');
const validate       = require('../middleware/validate.middleware');

const router = express.Router();

// ── Validation rule sets ──────────────────────────────────────────────────────

/**
 * Signup validation — mirrors frontend/js/validation.js rules exactly.
 * Username: 3–20 chars, letters/numbers/underscores only
 * Email: valid RFC format
 * Password: 8+ chars, at least 1 uppercase, at least 1 number
 * confirmPassword: must match password
 */
const signupRules = [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('Username is required.')
        .isLength({ min: 3, max: 20 })
        .withMessage('Username must be between 3 and 20 characters.')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers and underscores.'),

    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required.')
        .isEmail()
        .withMessage('Enter a valid email address.')
        .normalizeEmail(),

    body('password')
        .notEmpty()
        .withMessage('Password is required.')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters.')
        .matches(/[A-Z]/)
        .withMessage('Password must contain at least one uppercase letter.')
        .matches(/[0-9]/)
        .withMessage('Password must contain at least one number.'),

    body('confirmPassword')
        .notEmpty()
        .withMessage('Please confirm your password.')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match.');
            }
            return true;
        }),
];

/**
 * Login validation — lightweight; service handles the actual auth logic.
 */
const loginRules = [
    body('identifier')
        .trim()
        .notEmpty()
        .withMessage('Email or username is required.'),

    body('password')
        .notEmpty()
        .withMessage('Password is required.'),
];

/**
 * Forgot password validation — email format only.
 */
const forgotPasswordRules = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required.')
        .isEmail()
        .withMessage('Enter a valid email address.')
        .normalizeEmail(),
];

// ── Routes ────────────────────────────────────────────────────────────────────

// Public routes
router.post('/signup',          signupRules,          validate, authController.signup);
router.post('/login',           loginRules,           validate, authController.login);
router.post('/forgot-password', forgotPasswordRules,  validate, authController.forgotPassword);

// Protected routes (require valid JWT)
router.get ('/me',     protect, authController.getMe);
router.post('/logout', protect, authController.logout);

// Health check (remove in production if desired)
router.get('/health', (req, res) => res.json({ route: 'auth', status: 'ok' }));

module.exports = router;
