/**
 * backend/routes/admin.routes.js
 *
 * All routes mounted at /api/admin
 * Protected by adminOnly guard (requires X-Admin-Secret header or admin user role).
 *
 * Route table:
 *   POST /api/admin/seed     — Seed catalog from data/music_features.json
 *   POST /api/admin/extract  — Trigger FreqBlog extraction and caching
 */

'use strict';

const express         = require('express');
const { body }        = require('express-validator');

const adminController = require('../controllers/admin.controller');
const { adminOnly }   = require('../middleware/auth.middleware');
const validate        = require('../middleware/validate.middleware');

const router = express.Router();

// ── Validation Rules ──────────────────────────────────────────────────────────

const seedRules = [
    body('filePath')
        .optional()
        .isString()
        .withMessage('filePath must be a string path.'),
];

const extractRules = [
    body('tracks')
        .isArray({ min: 1 })
        .withMessage('Tracks array must contain at least one track.'),
    body('tracks.*.artist')
        .trim()
        .notEmpty()
        .withMessage('Each track must include an artist.'),
    body('tracks.*.title')
        .trim()
        .notEmpty()
        .withMessage('Each track must include a title.'),
];

// ── Protected Admin Routes ────────────────────────────────────────────────────

router.use(adminOnly); // Enforce admin check for all admin routes

router.post('/seed',    seedRules,    validate, adminController.seed);
router.post('/extract', extractRules, validate, adminController.extract);

module.exports = router;
