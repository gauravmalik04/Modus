/**
 * backend/models/Playlist.js
 *
 * Mongoose schema for the `playlists` collection.
 *
 * Design decisions:
 *   - `userId`  — ObjectId ref to User; every playlist belongs to exactly one user
 *   - `songs`   — Ordered array of ObjectId refs to Song (global catalog)
 *                 Order matters — it IS the playback sequence
 *   - Cached stats (trackCount, totalDurationMs, topMood) are recomputed in a
 *     pre-save hook whenever the songs array changes, using populated song data
 *   - `isDefault` — marks the system's "All Songs" playlist per user (not deletable)
 *   - `algorithm` — records which sequencer preset was used (or 'manual')
 */

'use strict';

const mongoose = require('mongoose');

// ── Constants (mirror pipeline/thresholds.js preset list) ────────────────────
const PRESET_KEYS = ['romantic', 'energetic', 'thrill', 'chill', 'feel_good', 'melancholic'];

const PRESET_LABELS = {
    romantic:    'Romantic',
    energetic:   'Energetic',
    thrill:      'Thrill',
    chill:       'Chill',
    feel_good:   'Feel Good',
    melancholic: 'Melancholic',
};

// ── topMood sub-schema ────────────────────────────────────────────────────────
const topMoodSchema = new mongoose.Schema(
    {
        key:   { type: String, default: 'mix' },
        name:  { type: String, default: 'Mix' },
        score: { type: Number, default: 0 },
    },
    { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────
const playlistSchema = new mongoose.Schema(
    {
        // ── Ownership ─────────────────────────────────────────────────────────
        userId: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'User',
            required: [true, 'Playlist must belong to a user.'],
            index:    true,
        },

        // ── Identity ──────────────────────────────────────────────────────────
        name: {
            type:      String,
            required:  [true, 'Playlist name is required.'],
            trim:      true,
            maxlength: [100, 'Playlist name cannot exceed 100 characters.'],
        },

        description: {
            type:      String,
            default:   '',
            trim:      true,
            maxlength: [500, 'Description cannot exceed 500 characters.'],
        },

        coverImage: {
            type:    String,
            default: '',        // URL string (empty = no cover)
        },

        tags: {
            type:    [String],
            default: [],
        },

        // Which sequencer algorithm was used to order this playlist
        algorithm: {
            type:    String,
            enum:    [...PRESET_KEYS, 'manual', 'mixed', null],
            default: null,
        },

        // System playlist flag — cannot be deleted by user (future use)
        isDefault: {
            type:    Boolean,
            default: false,
        },

        // ── Songs (ordered) ───────────────────────────────────────────────────
        // An ordered array of Song ObjectIds.
        // Use .populate('songs') to get full song documents.
        songs: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref:  'Song',
            },
        ],

        // ── Cached stats (recomputed on save) ─────────────────────────────────
        // These avoid re-running aggregations on every read.
        // Populated by the pre-save hook when songs are populated,
        // or by playlist.service.js after population.
        trackCount:      { type: Number, default: 0 },
        totalDurationMs: { type: Number, default: 0 },
        topMood:         { type: topMoodSchema, default: () => ({}) },
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                delete ret.__v;
                return ret;
            },
            virtuals: true,
        },
    }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Per-user queries (main access pattern)
playlistSchema.index({ userId: 1, createdAt: -1 });

// Prevent duplicate playlist names per user
playlistSchema.index({ userId: 1, name: 1 }, { unique: true });

// ── Virtual: totalDurationLabel ───────────────────────────────────────────────
playlistSchema.virtual('totalDurationLabel').get(function () {
    const totalSeconds = Math.floor((this.totalDurationMs || 0) / 1000);
    const hours   = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
});

// ── Static: Compute topMood from an array of song plain objects ───────────────
/**
 * Given an array of populated song documents (or plain objects with .presets),
 * compute the top mood key, name, and score.
 *
 * @param {object[]} songs
 * @returns {{ key: string, name: string, score: number }}
 */
playlistSchema.statics.computeTopMood = function (songs) {
    if (!songs || songs.length === 0) {
        return { key: 'mix', name: 'Mix', score: 0 };
    }

    const averages = {};
    PRESET_KEYS.forEach(p => {
        const total = songs.reduce((sum, s) => {
            const val = s.presets ? Number(s.presets[p] ?? 0) : 0;
            return sum + val;
        }, 0);
        averages[p] = total / songs.length;
    });

    let topKey = PRESET_KEYS[0];
    for (const p of PRESET_KEYS) {
        if (averages[p] > averages[topKey]) topKey = p;
    }

    return {
        key:   topKey,
        name:  PRESET_LABELS[topKey] || topKey,
        score: Math.round(averages[topKey] * 100),
    };
};

// ── Static: updateStats ───────────────────────────────────────────────────────
/**
 * Re-compute and persist trackCount, totalDurationMs, topMood for a playlist.
 * Called by playlist.service.js after modifying the songs array.
 *
 * Requires the playlist's songs to be populated before calling.
 *
 * @param {PlaylistDocument} playlist — with .songs already populated
 * @returns {Promise<PlaylistDocument>} — updated document
 */
playlistSchema.statics.updateStats = async function (playlist) {
    const populatedSongs = playlist.songs;

    // Ensure songs are populated (not just ObjectIds)
    const songDocs = populatedSongs.filter(s => s && typeof s === 'object' && s.duration_ms !== undefined);

    playlist.trackCount      = songDocs.length;
    playlist.totalDurationMs = songDocs.reduce((sum, s) => sum + (Number(s.duration_ms) || 0), 0);
    playlist.topMood         = this.computeTopMood(songDocs);

    return playlist.save();
};

// ── Instance Method: toPublic ─────────────────────────────────────────────────
/**
 * Return a serialisable plain object safe for API responses.
 * Songs may be ObjectIds (list view) or populated docs (detail view).
 */
playlistSchema.methods.toPublic = function () {
    return {
        _id:              this._id,
        name:             this.name,
        description:      this.description,
        coverImage:       this.coverImage,
        tags:             this.tags,
        algorithm:        this.algorithm,
        isDefault:        this.isDefault,
        songs:            this.songs,      // may be IDs or populated docs
        trackCount:       this.trackCount,
        totalDurationMs:  this.totalDurationMs,
        totalDurationLabel: this.totalDurationLabel,
        topMood:          this.topMood,
        createdAt:        this.createdAt,
        updatedAt:        this.updatedAt,
    };
};

// ── Model ─────────────────────────────────────────────────────────────────────
const Playlist = mongoose.model('Playlist', playlistSchema);

module.exports = Playlist;
module.exports.Playlist = Playlist;
module.exports.PRESET_KEYS = PRESET_KEYS;
module.exports.PRESET_LABELS = PRESET_LABELS;
