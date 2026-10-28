'use strict';

const app = require('../server');
const { connectDB } = require('../config/db');

module.exports = async (req, res) => {
    try {
        await connectDB();
        return app(req, res);
    } catch (error) {
        console.error('[API] Database connection failed:', error.message);

        return res.status(503).json({
            success: false,
            message: 'Database temporarily unavailable',
        });
    }
};