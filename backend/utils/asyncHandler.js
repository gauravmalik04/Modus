/**
 * backend/utils/asyncHandler.js
 *
 * Wraps an async route handler so any rejected promise is passed to next(err),
 * avoiding repetitive try/catch blocks in every controller.
 *
 * Usage:
 *   router.get('/example', asyncHandler(async (req, res) => {
 *       const data = await someService();
 *       res.json({ data });
 *   }));
 */

'use strict';

/**
 * @param {Function} fn  — async (req, res, next) => void
 * @returns {Function}   — Express middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
