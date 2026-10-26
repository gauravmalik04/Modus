/**
 * backend/controllers/song.controller.js
 *
 * Song HTTP controller.
 * Handles:
 *   - GET  /api/songs          (search in MongoDB catalog)
 *   - GET  /api/songs/:id      (get song by ID)
 *   - POST /api/songs/search   (search & fetch from FreqBlog with caching)
 *   - POST /api/songs/bulk     (bulk fetch tracks)
 */

'use strict';

const songService  = require('../services/song.service');
const asyncHandler = require('../utils/asyncHandler');

// ── GET /api/songs ────────────────────────────────────────────────────────────
/**
 * Search songs stored in the database catalog.
 * Query params: ?q=name+or+artist&limit=20
 */
const search = asyncHandler(async (req, res) => {
    const { q, limit } = req.query;
    const songs = await songService.searchSongs(q, limit);

    res.status(200).json({
        success: true,
        count:   songs.length,
        songs,
    });
});

// ── GET /api/songs/:id ────────────────────────────────────────────────────────
/**
 * Get a single song by its MongoDB ObjectId.
 */
const getById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const song = await songService.getSongById(id);

    res.status(200).json({
        success: true,
        song,
    });
});

// ── POST /api/songs/search ────────────────────────────────────────────────────
/**
 * Look up a song by artist + title (or isrc).
 * Returns from DB cache if available, otherwise queries FreqBlog API and caches.
 * Body: { artist, title, isrc? }
 */
const searchAndFetch = asyncHandler(async (req, res) => {
    const { artist, title, isrc } = req.body;
    const { song, cached } = await songService.searchAndFetchSong({ artist, title, isrc });

    res.status(200).json({
        success: true,
        cached,
        song,
    });
});

// ── POST /api/songs/bulk ──────────────────────────────────────────────────────
/**
 * Bulk fetch a list of tracks.
 * Body: { tracks: [{ artist, title, isrc? }] }
 */
const bulk = asyncHandler(async (req, res) => {
    const { tracks } = req.body;
    const songs = await songService.bulkFetchSongs(tracks);

    res.status(200).json({
        success: true,
        count:   songs.length,
        songs,
    });
});

module.exports = {
    search,
    getById,
    searchAndFetch,
    bulk,
};
