/**
 * backend/server.js
 *
 * Modus API — Express application entry point.
 *
 * Startup sequence:
 *   1. Load & validate environment variables
 *   2. Connect to MongoDB Atlas
 *   3. Register global middleware (cors, helmet, morgan, JSON parser)
 *   4. Mount API routes
 *   5. Register global error handler
 *   6. Start HTTP server
 */

'use strict';

// ── 1. Environment (must be first) ───────────────────────────────────────────
const env = require('./config/env');

// ── Core imports ─────────────────────────────────────────────────────────────
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

const { connectDB }    = require('./config/db');
const errorMiddleware  = require('./middleware/error.middleware');

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/auth.routes');
const songRoutes     = require('./routes/song.routes');
const playlistRoutes = require('./routes/playlist.routes');
const adminRoutes    = require('./routes/admin.routes');

// ── Create Express App ────────────────────────────────────────────────────────
const app = express();

// ── Global Middleware ─────────────────────────────────────────────────────────

// Security headers
app.use(helmet());

// CORS — allow the frontend origin (Vercel in prod, all localhost/127.0.0.1 in dev)
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
            env.isDev() ||
            origin === env.CLIENT_ORIGIN ||
            origin.startsWith('http://localhost:') ||
            origin.startsWith('http://127.0.0.1:') ||
            origin.endsWith('.vercel.app')
        ) {
            return callback(null, true);
        }
        return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Secret'],
    credentials: false,
}));

// HTTP request logging (skip in test env)
if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.isDev() ? 'dev' : 'combined'));
}

// Parse JSON bodies
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
// Global: 200 req / 15 min per IP
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

// Stricter limiter for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many auth attempts. Please wait and try again.' },
});

// ── Health Check ──────────────────────────────────────────────────────────────
app.get(['/health', '/api/health'], (req, res) => {
    res.json({
        success: true,
        service: 'Modus API',
        version: '1.0.0',
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',      authLimiter, authRoutes);
app.use('/api/songs',     songRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/admin',     adminRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
});

// ── Global Error Handler (must be LAST) ──────────────────────────────────────
app.use(errorMiddleware);

// ── Start Server ──────────────────────────────────────────────────────────────
async function start() {
    // Connect to MongoDB first — exits process on failure
    await connectDB();

    app.listen(env.PORT, () => {
        console.log(`\n🎵  Modus API running`);
        console.log(`   Environment : ${env.NODE_ENV}`);
        console.log(`   Port        : ${env.PORT}`);
        console.log(`   Client      : ${env.CLIENT_ORIGIN}`);
        console.log(`   Health      : http://localhost:${env.PORT}/health\n`);
    });
}

if (require.main === module) {
    start();
}

module.exports = app;
module.exports.start = start;
