/**
 * backend/models/Song.js
 *
 * Mongoose schema for the `songs` collection.
 *
 * This is the global song catalog — shared across all users.
 * Songs are populated via FreqBlog API calls and cached here to avoid
 * re-fetching known tracks.
 *
 * Structure mirrors pipeline/Song.js exactly:
 *   Layer 1 — Identity / Metadata     (from FreqBlog)
 *   Layer 2 — Raw Audio Features      (0–1 floats, matching original fetching_data.js)
 *   Layer 3 — Preset Scores           (computed by pipeline/Song.js, stored here)
 */

'use strict';

const mongoose = require('mongoose');

// ── Sub-schemas ───────────────────────────────────────────────────────────────

/**
 * Layer 2: Raw audio features.
 * All numeric fields are 0–1 floats unless noted.
 * Stored as sparse fields — null means "not available from source".
 */
const featuresSchema = new mongoose.Schema(
    {
        // Theme — Emotional character
        happiness:    { type: Number, min: 0, max: 1, default: null },  // valence
        sadness:      { type: Number, min: 0, max: 1, default: null },  // 1 − valence
        aggression:   { type: Number, min: 0, max: 1, default: null },  // energy proxy
        party:        { type: Number, min: 0, max: 1, default: null },  // danceability proxy
        acousticness: { type: Number, min: 0, max: 1, default: null },
        danceability: { type: Number, min: 0, max: 1, default: null },

        // Transition — Structural / playback
        bpm:      { type: Number, default: null },                       // raw BPM (e.g. 128)
        key:      { type: String, default: null },                       // e.g. "C#"
        mode:     { type: String, enum: ['major', 'minor', null], default: null },
        loudness: { type: Number, default: null },                       // LUFS (negative float)
        timbre:   { type: String, enum: ['bright', 'dark', null], default: null },

        // Texture — Sound composition
        vocalness:        { type: Number, min: 0, max: 1, default: null },  // 1 − instrumentalness
        instrumentalness: { type: Number, min: 0, max: 1, default: null },
        electronicness:   { type: Number, min: 0, max: 1, default: null },  // derived

        // Derived
        energy: { type: Number, min: 0, max: 1, default: null },        // weighted composite
    },
    { _id: false } // embedded sub-doc, no separate _id
);

/**
 * Layer 3: Preset scores.
 * Computed by pipeline/Song.js _computePresets(); stored for fast querying.
 * All values are 0–1 floats (null if insufficient features).
 */
const presetsSchema = new mongoose.Schema(
    {
        romantic:    { type: Number, min: 0, max: 1, default: null },
        energetic:   { type: Number, min: 0, max: 1, default: null },
        thrill:      { type: Number, min: 0, max: 1, default: null },
        chill:       { type: Number, min: 0, max: 1, default: null },
        feel_good:   { type: Number, min: 0, max: 1, default: null },
        melancholic: { type: Number, min: 0, max: 1, default: null },
    },
    { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const songSchema = new mongoose.Schema(
    {
        // ── Layer 1: Identity / Metadata ──────────────────────────────────────
        isrc:         { type: String, default: null },    // index defined via songSchema.index()
        mbid:         { type: String, default: null },
        name:         { type: String, required: [true, 'Song name is required.'], trim: true },
        artist:       { type: String, required: [true, 'Artist name is required.'], trim: true },
        album:        { type: String, default: null, trim: true },
        release_date: { type: String, default: null },                  // "YYYY-MM-DD" or "YYYY"
        duration_ms:  { type: Number, default: null, min: 0 },
        genre:        { type: String, default: null, trim: true },
        fetched_at:   { type: Date, default: Date.now },

        // ── Layer 2: Raw Audio Features ───────────────────────────────────────
        features: {
            type:    featuresSchema,
            default: () => ({}),
        },

        // ── Layer 3: Preset Scores ────────────────────────────────────────────
        presets: {
            type:    presetsSchema,
            default: () => ({}),
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                delete ret.__v;
                return ret;
            },
        },
    }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
songSchema.index({ isrc: 1 }, { unique: true, sparse: true });     // fast ISRC lookup, skips nulls
songSchema.index({ name: 'text', artist: 'text' });                 // full-text search
songSchema.index({ 'presets.romantic': -1 });                       // fast preset queries
songSchema.index({ 'presets.energetic': -1 });
songSchema.index({ 'presets.thrill': -1 });
songSchema.index({ 'presets.chill': -1 });
songSchema.index({ 'presets.feel_good': -1 });
songSchema.index({ 'presets.melancholic': -1 });

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * Find an existing song or create a new one.
 * Deduplication priority: ISRC → (name + artist) fallback.
 *
 * @param {object} songData  — Plain song object from pipeline/Song.js .toJSON()
 * @returns {Promise<{ doc: SongDocument, created: boolean }>}
 */
songSchema.statics.findOrCreate = async function (songData) {
    // Build the query: prefer ISRC match, fallback to name+artist
    let query;
    if (songData.isrc) {
        query = { isrc: songData.isrc };
    } else {
        query = {
            name:   new RegExp(`^${escapeRegex(songData.name)}$`, 'i'),
            artist: new RegExp(`^${escapeRegex(songData.artist)}$`, 'i'),
        };
    }

    // findOneAndUpdate with upsert=true → atomic find-or-create
    const doc = await this.findOneAndUpdate(
        query,
        { $setOnInsert: songData }, // only set fields if creating (not overwriting existing)
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    // Detect if we just inserted or found existing
    // We check fetched_at freshness as proxy (within 2 seconds = just created)
    const wasJustCreated = doc.fetched_at && (Date.now() - doc.fetched_at.getTime() < 2000);

    return { doc, created: wasJustCreated };
};

/**
 * Upsert a song — always update features and presets if the song already exists.
 * Use this when re-fetching to keep features fresh.
 *
 * @param {object} songData
 * @returns {Promise<SongDocument>}
 */
songSchema.statics.upsert = async function (songData) {
    const query = songData.isrc
        ? { isrc: songData.isrc }
        : {
              name:   new RegExp(`^${escapeRegex(songData.name)}$`, 'i'),
              artist: new RegExp(`^${escapeRegex(songData.artist)}$`, 'i'),
          };

    return this.findOneAndUpdate(
        query,
        { $set: { ...songData, fetched_at: new Date() } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
};

/**
 * Search the catalog by name and/or artist (case-insensitive partial match).
 * @param {string} q  — free-text search string
 * @param {number} [limit=20]
 * @returns {Promise<SongDocument[]>}
 */
songSchema.statics.search = async function (q, limit = 20) {
    if (!q || !q.trim()) return [];

    // Try full-text index first
    const textResults = await this
        .find({ $text: { $search: q } }, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit);

    if (textResults.length > 0) return textResults;

    // Fallback: regex on name + artist
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    return this.find({ $or: [{ name: regex }, { artist: regex }] }).limit(limit);
};

// ── Model ─────────────────────────────────────────────────────────────────────
const Song = mongoose.model('Song', songSchema);

module.exports = Song;

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
