/**
 * backend/routes/song.routes.js
 *
 * All routes mounted at /api/songs
 * All routes require valid JWT (protect middleware).
 *
 * Route table:
 *   GET    /api/songs          — Search songs in DB catalog (?q=...&limit=...)
 *   GET    /api/songs/:id      — Get song by MongoDB ID
 *   POST   /api/songs/search   — Look up song (DB cache first, then FreqBlog)
 *   POST   /api/songs/bulk     — Batch lookup / caching
 */

'use strict';

const express         = require('express');
const { body, param, query } = require('express-validator');

const songController  = require('../controllers/song.controller');
const { protect }     = require('../middleware/auth.middleware');
const validate        = require('../middleware/validate.middleware');

const router = express.Router();

// ── Validation Rules ──────────────────────────────────────────────────────────

const searchSongRules = [
    body('artist')
        .trim()
        .notEmpty()
        .withMessage('Artist name is required.'),
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Song title is required.'),
    body('isrc')
        .optional({ checkFalsy: true })
        .trim(),
];

const bulkSongsRules = [
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

const songIdRules = [
    param('id')
        .isMongoId()
        .withMessage('Invalid song ID format.'),
];

const catalogSearchRules = [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be an integer between 1 and 100.'),
];

// ── Routes (All Protected) ────────────────────────────────────────────────────

router.use(protect); // Apply JWT protection to all /api/songs endpoints

router.get('/',        catalogSearchRules, validate, songController.search);
router.get('/:id',     songIdRules,        validate, songController.getById);
router.post('/search', searchSongRules,    validate, songController.searchAndFetch);
router.post('/bulk',   bulkSongsRules,      validate, songController.bulk);

module.exports = router;
