/**
 * backend/config/db.js
 *
 * MongoDB Atlas connection with connection caching for Vercel.
 */

'use strict';

const mongoose = require('mongoose');
const env = require('./env');

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = {
        conn: null,
        promise: null,
    };
}

async function connectDB() {
    // Reuse an existing connection.
    if (cached.conn && mongoose.connection.readyState === 1) {
        return cached.conn;
    }

    // Reuse an in-progress connection attempt.
    if (!cached.promise) {
        if (!env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is missing');
        }

        cached.promise = mongoose.connect(env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
        });
    }

    try {
        cached.conn = await cached.promise;

        console.log(
            `[DB] MongoDB connected: ${cached.conn.connection.host}`
        );

        return cached.conn;
    } catch (err) {
        cached.promise = null;
        cached.conn = null;

        console.error('[DB] Connection failed:', err.message);

        throw err;
    }
}

mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected.');
});

mongoose.connection.on('reconnected', () => {
    console.log('[DB] MongoDB reconnected.');
});

module.exports = { connectDB };