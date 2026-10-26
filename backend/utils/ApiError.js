/**
 * backend/utils/ApiError.js
 *
 * Custom error class that carries an HTTP status code.
 * Thrown from services/controllers; caught by error.middleware.js.
 *
 * Usage:
 *   throw new ApiError(404, 'Playlist not found');
 *   throw new ApiError(400, 'Validation failed', { field: 'email', msg: '...' });
 */

'use strict';

class ApiError extends Error {
    /**
     * @param {number} statusCode  — HTTP status (400, 401, 403, 404, 409, 500, …)
     * @param {string} message     — Human-readable error message
     * @param {any}    [details]   — Optional extra info (field errors, raw error, …)
     */
    constructor(statusCode, message, details = null) {
        super(message);
        this.name       = 'ApiError';
        this.statusCode = statusCode;
        this.details    = details;

        // Preserve proper stack trace in V8
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ApiError);
        }
    }

    /**
     * Convenience factory methods
     */
    static badRequest(msg, details)  { return new ApiError(400, msg, details); }
    static unauthorized(msg)         { return new ApiError(401, msg || 'Unauthorized'); }
    static forbidden(msg)            { return new ApiError(403, msg || 'Forbidden'); }
    static notFound(msg)             { return new ApiError(404, msg || 'Not found'); }
    static conflict(msg, details)    { return new ApiError(409, msg, details); }
    static internal(msg)             { return new ApiError(500, msg || 'Internal server error'); }
}

module.exports = ApiError;
