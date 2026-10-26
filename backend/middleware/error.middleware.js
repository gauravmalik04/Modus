/**
 * backend/middleware/error.middleware.js
 *
 * Global error handler — must be the LAST middleware registered in server.js.
 * Catches all errors forwarded via next(err), including ApiError instances.
 */

'use strict';

const ApiError = require('../utils/ApiError');
const env      = require('../config/env');

/**
 * @param {Error}             err
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {Function}          next
 */
function errorMiddleware(err, req, res, next) {  // eslint-disable-line no-unused-vars

    // ── Mongoose validation error ──────────────────────────────────────────
    if (err.name === 'ValidationError') {
        const details = Object.values(err.errors).map(e => ({
            field: e.path,
            message: e.message,
        }));
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            details,
        });
    }

    // ── Mongoose duplicate key error (e.g. unique email) ──────────────────
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        return res.status(409).json({
            success: false,
            message: `Duplicate value for ${field}. That ${field} is already in use.`,
        });
    }

    // ── JWT errors ────────────────────────────────────────────────────────
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
    }

    // ── Known ApiError ────────────────────────────────────────────────────
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            ...(err.details ? { details: err.details } : {}),
        });
    }

    // ── Unknown / unhandled error ─────────────────────────────────────────
    console.error('[Error]', err);

    return res.status(500).json({
        success: false,
        message: 'Internal server error.',
        // Only expose stack trace in development
        ...(env.isDev() ? { stack: err.stack } : {}),
    });
}

module.exports = errorMiddleware;
