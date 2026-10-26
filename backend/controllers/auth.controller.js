/**
 * backend/controllers/auth.controller.js
 *
 * Thin HTTP layer for authentication.
 * Each method:
 *   1. Reads validated data from req.body (express-validator already ran)
 *   2. Delegates to authService
 *   3. Sends a consistent JSON response
 *
 * All async errors are caught by asyncHandler and forwarded to error.middleware.js.
 */

'use strict';

const authService  = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
/**
 * Register a new user.
 * Body: { username, email, password, confirmPassword }
 * Response: { success, message, token, user }
 */
const signup = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    const { user, token } = await authService.signup({ username, email, password });

    res.status(201).json({
        success: true,
        message: 'Account created successfully.',
        token,
        user,
    });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
/**
 * Authenticate an existing user.
 * Body: { identifier, password }  (identifier = email or username)
 * Response: { success, message, token, user }
 */
const login = asyncHandler(async (req, res) => {
    const { identifier, password } = req.body;

    const { user, token } = await authService.login({ identifier, password });

    res.status(200).json({
        success: true,
        message: `Welcome back, ${user.username}!`,
        token,
        user,
    });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
/**
 * Get the currently authenticated user's profile.
 * Requires: Authorization: Bearer <JWT>  (handled by protect middleware)
 * Response: { success, user }
 */
const getMe = asyncHandler(async (req, res) => {
    // req.user is set by auth.middleware.js (protect)
    const user = await authService.getUserById(req.user.userId);

    res.status(200).json({
        success: true,
        user,
    });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
/**
 * Logout the current user.
 * JWT is stateless — actual invalidation happens client-side (delete token from storage).
 * This endpoint exists so clients have a consistent logout API call to make,
 * and for future server-side token blocklisting.
 * Response: { success, message }
 */
const logout = asyncHandler(async (req, res) => {
    // Future: add token to a blocklist / invalidate refresh token
    res.status(200).json({
        success: true,
        message: 'Logged out successfully.',
    });
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
/**
 * Trigger a password recovery flow.
 * Body: { email }
 * Response: { success, message }  (always 200 — don't reveal if email exists)
 */
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const { message } = await authService.forgotPassword({ email });

    res.status(200).json({
        success: true,
        message,
    });
});

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = { signup, login, getMe, logout, forgotPassword };
