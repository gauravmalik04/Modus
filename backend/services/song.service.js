/**
 * backend/services/song.service.js
 *
 * Song business logic & external catalog integration.
 * Responsibilities:
 *   - Search catalog songs stored in MongoDB
 *   - Fetch song by MongoDB ObjectId
 *   - Search & fetch audio features from FreqBlog API (with DB caching)
 *   - Batch/bulk fetch songs with automatic deduplication
 *   - Compute presets from raw features
 */

'use strict';

const mongoose         = require('mongoose');
const Song             = require('../models/Song');
const { Song: PipelineSong } = require('../pipeline/Song');
const { bulkGetFeatures }    = require('../pipeline/FreqBlogClient');
const { ensureSongsSeeded }  = require('./seed.service');
const ApiError         = require('../utils/ApiError');
const env              = require('../config/env');

function escapeRegex(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Search songs already saved in MongoDB catalog.
 *
 * @param {string} query - Search term (title or artist)
 * @param {number} [limit=20] - Max results
 * @returns {Promise<Array<object>>} List of matching songs
 */
async function searchSongs(query, limit = 20) {
    const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const count = await Song.countDocuments();
    if (count < 20) {
        await ensureSongsSeeded();
    }
    if (!query || !query.trim()) {
        // Return catalog songs if no query provided
        return Song.find({}).sort({ createdAt: 1 }).limit(lim).lean();
    }
    return Song.search(query.trim(), lim);
}

/**
 * Retrieve a single song by MongoDB ObjectId.
 *
 * @param {string} songId - 24-char hex ObjectId
 * @returns {Promise<object>}
 */
async function getSongById(songId) {
    if (!mongoose.Types.ObjectId.isValid(songId)) {
        throw ApiError.badRequest('Invalid song ID format.');
    }
    const song = await Song.findById(songId).lean();
    if (!song) {
        throw ApiError.notFound('Song not found.');
    }
    return song;
}

/**
 * Search for a track. Checks MongoDB cache first;
 * if not found, queries FreqBlog API, computes presets, saves to DB, and returns it.
 *
 * @param {{ artist: string, title: string, isrc?: string }} params
 * @returns {Promise<{ song: object, cached: boolean }>}
 */
async function searchAndFetchSong({ artist, title, isrc }) {
    const cleanArtist = (artist || '').trim();
    const cleanTitle  = (title || '').trim();
    const cleanIsrc   = isrc ? isrc.trim() : null;

    if (!cleanTitle || !cleanArtist) {
        throw ApiError.badRequest('Both title and artist are required.');
    }

    // 1. Check MongoDB cache first
    let cachedSong = null;
    if (cleanIsrc) {
        cachedSong = await Song.findOne({ isrc: cleanIsrc }).lean();
    }
    if (!cachedSong) {
        cachedSong = await Song.findOne({
            name:   new RegExp(`^${escapeRegex(cleanTitle)}$`, 'i'),
            artist: new RegExp(`^${escapeRegex(cleanArtist)}$`, 'i'),
        }).lean();
    }

    if (cachedSong) {
        return { song: cachedSong, cached: true };
    }

    // 2. Fetch from FreqBlog API if not in cache
    if (!env.FREQBLOG_API_KEY && !process.env.FREQBLOG_API_KEY) {
        throw ApiError.internal('FREQBLOG_API_KEY is not configured on the server.');
    }

    let fResults;
    try {
        fResults = await bulkGetFeatures([
            { artist: cleanArtist, title: cleanTitle, isrc: cleanIsrc },
        ]);
    } catch (err) {
        console.error('[SongService] FreqBlog API error:', err.message);
        throw ApiError.internal('Failed to fetch audio features from provider.');
    }

    const firstResult = fResults && fResults[0] ? fResults[0].result : null;

    if (!firstResult) {
        throw ApiError.notFound(`Audio features not found for "${cleanTitle}" by ${cleanArtist}.`);
    }

    // 3. Process features and compute presets using pipeline/Song.js
    const pipelineSong = new PipelineSong(firstResult);
    const songData = pipelineSong.toJSON();
    delete songData.id; // Let Mongo manage _id

    // Fallback if title/artist was missing in raw metadata
    if (!songData.name)   songData.name = cleanTitle;
    if (!songData.artist) songData.artist = cleanArtist;
    if (cleanIsrc && !songData.isrc) songData.isrc = cleanIsrc;

    // 4. Save to MongoDB
    const savedSong = await Song.upsert(songData);

    return { song: savedSong.toJSON(), cached: false };
}

/**
 * Bulk fetch a list of songs.
 * Existing songs are pulled directly from DB; missing tracks are batch-fetched from FreqBlog,
 * processed, stored in DB, and returned together.
 *
 * @param {Array<{ artist: string, title: string, isrc?: string }>} tracks
 * @returns {Promise<Array<object>>}
 */
async function bulkFetchSongs(tracks) {
    if (!Array.isArray(tracks) || tracks.length === 0) {
        return [];
    }

    const results = [];
    const missing = [];

    // 1. Check cache for each track
    for (const track of tracks) {
        const cleanArtist = (track.artist || '').trim();
        const cleanTitle  = (track.title || '').trim();
        const cleanIsrc   = track.isrc ? track.isrc.trim() : null;

        let found = null;
        if (cleanIsrc) {
            found = await Song.findOne({ isrc: cleanIsrc }).lean();
        }
        if (!found && cleanTitle && cleanArtist) {
            found = await Song.findOne({
                name:   new RegExp(`^${escapeRegex(cleanTitle)}$`, 'i'),
                artist: new RegExp(`^${escapeRegex(cleanArtist)}$`, 'i'),
            }).lean();
        }

        if (found) {
            results.push(found);
        } else if (cleanTitle && cleanArtist) {
            missing.push({ artist: cleanArtist, title: cleanTitle, isrc: cleanIsrc });
        }
    }

    // 2. Fetch missing tracks from FreqBlog in one bulk request
    if (missing.length > 0 && (env.FREQBLOG_API_KEY || process.env.FREQBLOG_API_KEY)) {
        try {
            const fResults = await bulkGetFeatures(missing);
            for (let i = 0; i < fResults.length; i++) {
                const { query, result } = fResults[i];
                if (result) {
                    const pipelineSong = new PipelineSong(result);
                    const songData = pipelineSong.toJSON();
                    delete songData.id;
                    if (!songData.name)   songData.name = query.title;
                    if (!songData.artist) songData.artist = query.artist;
                    if (query.isrc && !songData.isrc) songData.isrc = query.isrc;

                    const saved = await Song.upsert(songData);
                    results.push(saved.toJSON());
                }
            }
        } catch (err) {
            console.error('[SongService] Bulk FreqBlog fetch error:', err.message);
        }
    }

    return results;
}

/**
 * Recompute preset scores for given raw features without saving.
 *
 * @param {object} features
 * @returns {object} Presets { romantic, energetic, thrill, chill, feel_good, melancholic }
 */
function computePresets(features) {
    const dummyResult = {
        title: 'temp',
        artist: 'temp',
        ...features,
    };
    const s = new PipelineSong(dummyResult);
    return s.presets;
}

module.exports = {
    searchSongs,
    getSongById,
    searchAndFetchSong,
    bulkFetchSongs,
    computePresets,
};
