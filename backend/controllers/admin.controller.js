/**
 * backend/controllers/admin.controller.js
 *
 * Administrative and database maintenance endpoints.
 * Protected by adminOnly middleware (requires X-Admin-Secret or admin role).
 */

'use strict';

const fs           = require('fs');
const path         = require('path');
const Song         = require('../models/Song');
const songService  = require('../services/song.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError     = require('../utils/ApiError');

// ── POST /api/admin/seed ──────────────────────────────────────────────────────
/**
 * Seed the global songs catalog from data/music_features.json.
 * Uses atomic upsert so running multiple times safely updates features without duplication.
 *
 * Body (optional): { filePath: string }
 */
const seed = asyncHandler(async (req, res) => {
    const defaultPath = path.resolve(__dirname, '../../data/music_features.json');
    const targetPath  = req.body && req.body.filePath ? path.resolve(req.body.filePath) : defaultPath;

    if (!fs.existsSync(targetPath)) {
        throw ApiError.notFound(`Seed data file not found at: ${targetPath}`);
    }

    let parsed;
    try {
        const raw = fs.readFileSync(targetPath, 'utf8');
        parsed = JSON.parse(raw);
    } catch (err) {
        throw ApiError.badRequest(`Failed to read/parse seed JSON: ${err.message}`);
    }

    const songsArray = Array.isArray(parsed.songs) ? parsed.songs : (Array.isArray(parsed) ? parsed : []);
    if (songsArray.length === 0) {
        return res.status(200).json({
            success: true,
            message: 'No songs found in seed file.',
            total: 0,
            upserted: 0,
        });
    }

    let upsertedCount = 0;
    for (const item of songsArray) {
        const songData = { ...item };
        delete songData.id; // Let MongoDB generate canonical ObjectId

        await Song.upsert(songData);
        upsertedCount++;
    }

    res.status(200).json({
        success: true,
        message: `Successfully seeded ${upsertedCount} songs into MongoDB catalog.`,
        total:    songsArray.length,
        upserted: upsertedCount,
    });
});

// ── POST /api/admin/extract ───────────────────────────────────────────────────
/**
 * Trigger feature extraction for an array of tracks via FreqBlog API and cache them in DB.
 * Body: { tracks: [{ artist: string, title: string, isrc?: string }] }
 */
const extract = asyncHandler(async (req, res) => {
    const { tracks } = req.body;

    if (!Array.isArray(tracks) || tracks.length === 0) {
        throw ApiError.badRequest('Tracks array must contain at least one track.');
    }

    const results = await songService.bulkFetchSongs(tracks);

    res.status(200).json({
        success: true,
        message: `Extracted and stored features for ${results.length} tracks.`,
        count:   results.length,
        results,
    });
});

module.exports = {
    seed,
    extract,
};
