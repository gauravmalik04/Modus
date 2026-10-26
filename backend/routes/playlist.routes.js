/**
 * backend/routes/playlist.routes.js
 *
 * All routes mounted at /api/playlists
 * All routes require valid JWT (protect middleware).
 *
 * Route table:
 *   GET    /api/playlists                     — Get all playlists for logged-in user
 *   POST   /api/playlists                     — Create new playlist
 *   GET    /api/playlists/:id                 — Get playlist + populated songs
 *   PUT    /api/playlists/:id                 — Update playlist metadata
 *   DELETE /api/playlists/:id                 — Delete playlist
 *   POST   /api/playlists/:id/songs           — Add song to playlist
 *   DELETE /api/playlists/:id/songs/:songId   — Remove song from playlist
 *   POST   /api/playlists/:id/resequence      — Run sequencer on playlist
 *   POST   /api/playlists/:id/export          — Export sequence as new playlist
 *   POST   /api/playlists/export              — Export sequence (without ID)
 */

'use strict';

const express               = require('express');
const { body, param }       = require('express-validator');

const playlistController    = require('../controllers/playlist.controller');
const { protect }           = require('../middleware/auth.middleware');
const validate              = require('../middleware/validate.middleware');

const router = express.Router();

// ── Validation Rules ──────────────────────────────────────────────────────────

const createPlaylistRules = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Playlist name is required.')
        .isLength({ max: 100 })
        .withMessage('Playlist name cannot exceed 100 characters.'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters.'),
    body('tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array of strings.'),
    body('songIds')
        .optional()
        .isArray()
        .withMessage('songIds must be an array of song IDs.'),
];

const updatePlaylistRules = [
    param('id')
        .isMongoId()
        .withMessage('Invalid playlist ID format.'),
    body('name')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Playlist name cannot be empty.')
        .isLength({ max: 100 })
        .withMessage('Playlist name cannot exceed 100 characters.'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters.'),
];

const playlistIdRules = [
    param('id')
        .isMongoId()
        .withMessage('Invalid playlist ID format.'),
];

const addSongRules = [
    param('id')
        .isMongoId()
        .withMessage('Invalid playlist ID format.'),
    body('songId')
        .isMongoId()
        .withMessage('Invalid song ID format.'),
];

const removeSongRules = [
    param('id')
        .isMongoId()
        .withMessage('Invalid playlist ID format.'),
    param('songId')
        .isMongoId()
        .withMessage('Invalid song ID format.'),
];

const resequenceRules = [
    param('id')
        .isMongoId()
        .withMessage('Invalid playlist ID format.'),
    body('algorithm')
        .trim()
        .notEmpty()
        .withMessage('Algorithm preset is required (e.g. romantic, energetic, chill).'),
];

const exportRules = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Exported playlist name is required.'),
    body('songIds')
        .isArray({ min: 1 })
        .withMessage('songIds must be an array with at least one song ID.'),
];

// ── Protected Routes ──────────────────────────────────────────────────────────

router.use(protect); // All routes require auth

router.get ('/',                             playlistController.getAll);
router.post('/',       createPlaylistRules,  validate, playlistController.create);
router.post('/export', exportRules,          validate, playlistController.exportSequence);

router.get   ('/:id',  playlistIdRules,      validate, playlistController.getById);
router.put   ('/:id',  updatePlaylistRules,  validate, playlistController.update);
router.delete('/:id',  playlistIdRules,      validate, playlistController.deletePlaylist);

router.post  ('/:id/songs',         addSongRules,    validate, playlistController.addSong);
router.delete('/:id/songs/:songId', removeSongRules, validate, playlistController.removeSong);

router.post('/:id/resequence', resequenceRules, validate, playlistController.resequence);
router.post('/:id/export',     exportRules,     validate, playlistController.exportSequence);

module.exports = router;
