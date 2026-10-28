/**
 * backend/config/env.js
 *
 * Loads and validates all required environment variables on startup.
 * Throws immediately if a required variable is missing — fail fast.
 */

'use strict';

const dotenv = require('dotenv');
const path   = require('path');

// Load .env from the repo root (one level above backend/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Assert that an env var is set; throw if not.
 * @param {string} name
 * @returns {string}
 */
function require_env(name) {
    const val = process.env[name];
    if (!val || val.trim() === '') {
        throw new Error(`[env] Missing required environment variable: ${name}`);
    }
    return val.trim();
}

/**
 * Optional env var with a fallback default.
 * @param {string} name
 * @param {string} defaultValue
 * @returns {string}
 */
function optional_env(name, defaultValue = '') {
    const val = process.env[name];
    return (val && val.trim()) ? val.trim() : defaultValue;
}

const env = {
    NODE_ENV:     optional_env('NODE_ENV', 'production'),
    PORT:         parseInt(optional_env('PORT', '5000'), 10),

    // MongoDB Atlas
    MONGODB_URI:  require_env('MONGODB_URI'),

    // JWT
    JWT_SECRET:      require_env('JWT_SECRET'),
    JWT_EXPIRES_IN:  optional_env('JWT_EXPIRES_IN', '7d'),

    // FreqBlog
    FREQBLOG_API_KEY: optional_env('FREQBLOG_API_KEY'),

    // Spotify (future)
    SPOTIFY_CLIENT_ID:     optional_env('SPOTIFY_CLIENT_ID'),
    SPOTIFY_CLIENT_SECRET: optional_env('SPOTIFY_CLIENT_SECRET'),
    SPOTIFY_REDIRECT_URI:  optional_env('SPOTIFY_REDIRECT_URI'),

    // Admin
    ADMIN_SECRET: optional_env('ADMIN_SECRET', 'change_me_in_production'),

    // Frontend origin (for CORS)
    CLIENT_ORIGIN: optional_env('CLIENT_ORIGIN', 'http://localhost:5500'),

    // Helpers
    isDev:  () => env.NODE_ENV === 'development',
    isProd: () => env.NODE_ENV === 'production',
};

module.exports = env;
