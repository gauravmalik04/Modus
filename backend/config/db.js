/**
 * backend/config/db.js
 *
 * MongoDB Atlas connection via Mongoose.
 * Call connectDB() once from server.js on startup.
 */

'use strict';

const mongoose = require('mongoose');
const env      = require('./env');

/**
 * Connect to MongoDB Atlas.
 * Exits the process on failure so the server never starts in a broken state.
 */
async function connectDB() {
    try {
        const conn = await mongoose.connect(env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
        });

        console.log(`[DB] MongoDB connected: ${conn.connection.host}`);
    } catch (err) {
        if (env.isDev() && env.MONGODB_URI.includes('mongodb.net')) {
            console.warn('[DB] Atlas connection failed (likely IP whitelist). Attempting local MongoDB fallback...');
            try {
                const localConn = await mongoose.connect('mongodb://127.0.0.1:27017/modus', {
                    serverSelectionTimeoutMS: 3000,
                });
                console.log(`[DB] Connected to local MongoDB fallback: ${localConn.connection.host}`);
                return;
            } catch (localErr) {
                console.error('[DB] Local fallback also failed:', localErr.message);
            }
        }
        console.error('[DB] Connection failed:', err.message);
        process.exit(1);
    }
}

// Optionally log connection events for visibility
mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected.');
});

mongoose.connection.on('reconnected', () => {
    console.log('[DB] MongoDB reconnected.');
});

module.exports = { connectDB };
