/**
 * backend/middleware/auth.middleware.js
 *
 * JWT Bearer token verification.
 * Sets req.user = { userId, username, email } on success.
 * Throws 401 ApiError on missing / invalid / expired tokens.
 */

'use strict';

const jwt      = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const env      = require('../config/env');

/**
 * Protect a route — must be called before the controller.
 *
 * @example
 *   router.get('/me', protect, authController.getMe);
 */
async function protect(req, res, next) {
    try {
        // 1. Extract Bearer token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw ApiError.unauthorized('No token provided. Please log in.');
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            throw ApiError.unauthorized('Malformed Authorization header.');
        }

        // 2. Verify + decode
        const decoded = jwt.verify(token, env.JWT_SECRET);

        // 3. Attach decoded payload to request
        // decoded = { userId, username, email, iat, exp }
        req.user = {
            userId:   decoded.userId,
            username: decoded.username,
            email:    decoded.email,
            role:     decoded.role || 'user',
        };

        next();
    } catch (err) {
        next(err); // forwards to error.middleware.js
    }
}

/**
 * Admin-only guard.
 * Accepts either:
 *   1. X-Admin-Secret header matching env.ADMIN_SECRET
 *   2. Or an authenticated user with role === 'admin'
 */
function adminOnly(req, res, next) {
    const secret = req.headers['x-admin-secret'];
    if (secret && secret === env.ADMIN_SECRET) {
        return next();
    }

    if (req.user && req.user.role === 'admin') {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, env.JWT_SECRET);
            if (decoded && decoded.role === 'admin') {
                req.user = decoded;
                return next();
            }
        } catch (e) {
            // ignore and drop through
        }
    }

    return next(ApiError.forbidden('Admin access required. Provide X-Admin-Secret header or admin credentials.'));
}

module.exports = { protect, adminOnly };
