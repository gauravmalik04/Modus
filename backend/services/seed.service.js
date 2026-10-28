/**
 * backend/services/seed.service.js
 *
 * Ensures demo songs from data/music_features.json are seeded in MongoDB.
 * Ensures the Dummy Playlist for any user contains all 20 demo tracks.
 */

'use strict';

const Song = require('../models/Song');

// Statically required so @vercel/nft automatically bundles data/music_features.json
let demoSongsData = null;
try {
    demoSongsData = require('../../data/music_features.json');
} catch (e1) {
    try {
        demoSongsData = require('../data/music_features.json');
    } catch (e2) {
        demoSongsData = { songs: [] };
    }
}

/**
 * Returns array of raw 20 demo song objects.
 */
function getDemoSongs() {
    return Array.isArray(demoSongsData.songs) ? demoSongsData.songs : [];
}

let seedPromise = null;

/**
 * Ensures all 20 demo songs exist in the MongoDB collection.
 * Idempotent: checks count and uses Song.upsert() to avoid duplicates.
 */
async function ensureSongsSeeded() {
    if (seedPromise) return seedPromise;

    seedPromise = (async () => {
        try {
            const demoSongs = getDemoSongs();
            if (demoSongs.length === 0) return;

            const count = await Song.countDocuments();
            if (count < demoSongs.length) {
                console.log(`[Seed] Database has ${count} songs. Seeding ${demoSongs.length} demo songs...`);
                for (const s of demoSongs) {
                    const songData = { ...s };
                    delete songData.id;
                    await Song.upsert(songData);
                }
                console.log(`[Seed] Seeded ${demoSongs.length} demo songs successfully.`);
            }
        } catch (err) {
            console.error('[Seed] Error seeding songs:', err.message);
        } finally {
            seedPromise = null;
        }
    })();

    return seedPromise;
}

module.exports = {
    getDemoSongs,
    ensureSongsSeeded,
};

