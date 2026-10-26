/**
 * backend/services/playlist.service.js
 *
 * Playlist business logic:
 *   - CRUD operations (per-user isolation)
 *   - Song addition & removal with automatic cached stats recomputation
 *   - Resequencing via greedy nearest-neighbor algorithm (PlaylistSequencer)
 *   - Exporting generated sequences as new user playlists
 */

'use strict';

const mongoose           = require('mongoose');
const Playlist           = require('../models/Playlist');
const Song               = require('../models/Song');
const PlaylistSequencer  = require('../pipeline/PlaylistSequencer');
const { PRESET_KEYS }    = require('../models/Playlist');
const ApiError           = require('../utils/ApiError');

function escapeRegex(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Fetch all playlists for a specific user.
 *
 * @param {string} userId - User's MongoDB ObjectId
 * @returns {Promise<Array<object>>}
 */
async function getUserPlaylists(userId) {
    const playlists = await Playlist.find({ userId })
        .populate('songs')
        .sort({ createdAt: -1 });

    return playlists.map(p => p.toPublic());
}

/**
 * Retrieve a single playlist by ID (enforcing user ownership).
 *
 * @param {string} playlistId
 * @param {string} userId
 * @returns {Promise<{ playlist: object, songs: Array<object> }>}
 */
async function getPlaylistById(playlistId, userId) {
    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw ApiError.badRequest('Invalid playlist ID format.');
    }

    const playlist = await Playlist.findOne({ _id: playlistId, userId })
        .populate('songs');

    if (!playlist) {
        throw ApiError.notFound('Playlist not found.');
    }

    return {
        playlist: playlist.toPublic(),
        songs:    playlist.songs,
    };
}

/**
 * Create a new playlist for the user.
 *
 * @param {string} userId
 * @param {object} data - { name, description?, coverImage?, tags?, songIds?, algorithm? }
 * @returns {Promise<object>}
 */
async function createPlaylist(userId, data) {
    const { name, description = '', coverImage = '', tags = [], songIds = [], algorithm = null, isDefault = false } = data;

    const trimmedName = (name || '').trim();
    if (!trimmedName) {
        throw ApiError.badRequest('Playlist name is required.');
    }

    // Check name uniqueness per user
    const existing = await Playlist.findOne({
        userId,
        name: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i'),
    }).lean();

    if (existing) {
        throw ApiError.conflict(`You already have a playlist named "${trimmedName}".`);
    }

    // Validate song IDs if supplied
    let validatedSongIds = [];
    if (Array.isArray(songIds) && songIds.length > 0) {
        const validIds = songIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validIds.length > 0) {
            const foundSongs = await Song.find({ _id: { $in: validIds } }).select('_id');
            const foundSet = new Set(foundSongs.map(s => s._id.toString()));
            validatedSongIds = validIds.filter(id => foundSet.has(id.toString()));
        }
    }

    const playlist = new Playlist({
        userId,
        name: trimmedName,
        description,
        coverImage,
        tags,
        algorithm,
        isDefault: Boolean(isDefault),
        songs: validatedSongIds,
    });

    if (validatedSongIds.length > 0) {
        await playlist.populate('songs');
        await Playlist.updateStats(playlist);
    } else {
        await playlist.save();
    }

    return playlist.toPublic();
}

/**
 * Update an existing playlist's metadata.
 *
 * @param {string} playlistId
 * @param {string} userId
 * @param {object} updates - { name?, description?, coverImage?, tags?, algorithm? }
 * @returns {Promise<object>}
 */
async function updatePlaylist(playlistId, userId, updates) {
    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw ApiError.badRequest('Invalid playlist ID format.');
    }

    const playlist = await Playlist.findOne({ _id: playlistId, userId });
    if (!playlist) {
        throw ApiError.notFound('Playlist not found.');
    }

    if (updates.name !== undefined) {
        const newName = updates.name.trim();
        if (!newName) {
            throw ApiError.badRequest('Playlist name cannot be empty.');
        }

        // If name changed, check uniqueness
        if (newName.toLowerCase() !== playlist.name.toLowerCase()) {
            const dup = await Playlist.findOne({
                userId,
                _id: { $ne: playlistId },
                name: new RegExp(`^${escapeRegex(newName)}$`, 'i'),
            }).lean();

            if (dup) {
                throw ApiError.conflict(`You already have a playlist named "${newName}".`);
            }
        }
        playlist.name = newName;
    }

    if (updates.description !== undefined) playlist.description = updates.description;
    if (updates.coverImage  !== undefined) playlist.coverImage  = updates.coverImage;
    if (updates.tags        !== undefined) playlist.tags        = updates.tags;
    if (updates.algorithm   !== undefined) playlist.algorithm   = updates.algorithm;

    await playlist.save();
    return playlist.toPublic();
}

/**
 * Delete a playlist.
 *
 * @param {string} playlistId
 * @param {string} userId
 * @returns {Promise<{ message: string }>}
 */
async function deletePlaylist(playlistId, userId) {
    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw ApiError.badRequest('Invalid playlist ID format.');
    }

    const playlist = await Playlist.findOne({ _id: playlistId, userId });
    if (!playlist) {
        throw ApiError.notFound('Playlist not found.');
    }

    if (playlist.isDefault) {
        throw ApiError.forbidden('The default playlist cannot be deleted.');
    }

    await Playlist.deleteOne({ _id: playlistId, userId });

    return { message: 'Playlist deleted successfully.' };
}

/**
 * Add a song to a playlist.
 *
 * @param {string} playlistId
 * @param {string} userId
 * @param {string} songId
 * @returns {Promise<object>}
 */
async function addSongToPlaylist(playlistId, userId, songId) {
    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw ApiError.badRequest('Invalid playlist ID format.');
    }
    if (!mongoose.Types.ObjectId.isValid(songId)) {
        throw ApiError.badRequest('Invalid song ID format.');
    }

    const [playlist, song] = await Promise.all([
        Playlist.findOne({ _id: playlistId, userId }),
        Song.findById(songId),
    ]);

    if (!playlist) throw ApiError.notFound('Playlist not found.');
    if (!song)     throw ApiError.notFound('Song not found.');

    // If song is not already in playlist, append it
    const alreadyPresent = playlist.songs.some(s => s.toString() === songId.toString());
    if (!alreadyPresent) {
        playlist.songs.push(song._id);
        await playlist.populate('songs');
        await Playlist.updateStats(playlist);
    } else {
        await playlist.populate('songs');
    }

    return playlist.toPublic();
}

/**
 * Remove a song from a playlist.
 *
 * @param {string} playlistId
 * @param {string} userId
 * @param {string} songId
 * @returns {Promise<object>}
 */
async function removeSongFromPlaylist(playlistId, userId, songId) {
    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw ApiError.badRequest('Invalid playlist ID format.');
    }
    if (!mongoose.Types.ObjectId.isValid(songId)) {
        throw ApiError.badRequest('Invalid song ID format.');
    }

    const playlist = await Playlist.findOne({ _id: playlistId, userId });
    if (!playlist) {
        throw ApiError.notFound('Playlist not found.');
    }

    playlist.songs = playlist.songs.filter(s => s.toString() !== songId.toString());
    await playlist.populate('songs');
    await Playlist.updateStats(playlist);

    return playlist.toPublic();
}

/**
 * Resequence a playlist's songs using the transition-smoothing algorithm.
 *
 * @param {string} playlistId
 * @param {string} userId
 * @param {string} algorithm - Preset key (e.g. 'romantic', 'energetic', 'chill')
 * @returns {Promise<{ sequence: Array<object>, algorithm: string, count: number }>}
 */
async function resequencePlaylist(playlistId, userId, algorithm) {
    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw ApiError.badRequest('Invalid playlist ID format.');
    }

    const algo = (algorithm || '').trim().toLowerCase();
    if (!PRESET_KEYS.includes(algo)) {
        throw ApiError.badRequest(
            `Invalid algorithm "${algo}". Allowed presets: ${PRESET_KEYS.join(', ')}.`
        );
    }

    const playlist = await Playlist.findOne({ _id: playlistId, userId })
        .populate('songs');

    if (!playlist) {
        throw ApiError.notFound('Playlist not found.');
    }

    if (!playlist.songs || playlist.songs.length === 0) {
        return { sequence: [], algorithm: algo, count: 0 };
    }

    // Convert Mongoose song docs to plain JSON objects for the sequencer
    const plainSongs = playlist.songs.map(s => (s.toJSON ? s.toJSON() : s));

    const sequencer = new PlaylistSequencer(plainSongs);
    let sequence = sequencer.getPlaylist(algo);

    // If no songs met the strict threshold, fallback to sequencing all playlist songs
    if (!sequence || sequence.length === 0) {
        sequence = sequencer._sequence(plainSongs, algo);
    }

    return {
        sequence,
        algorithm: algo,
        count: sequence.length,
    };
}

/**
 * Export a generated sequence as a new playlist for the user.
 *
 * @param {string} userId
 * @param {object} data - { name, algorithm, songIds, description?, coverImage?, tags? }
 * @returns {Promise<object>}
 */
async function exportSequence(userId, data) {
    const { name, algorithm, songIds = [], description = '', coverImage = '', tags = [] } = data;

    const trimmedName = (name || '').trim();
    if (!trimmedName) {
        throw ApiError.badRequest('Exported playlist name is required.');
    }

    if (!Array.isArray(songIds) || songIds.length === 0) {
        throw ApiError.badRequest('Cannot export an empty sequence.');
    }

    // Generate unique name if collision occurs
    let finalName = trimmedName;
    const exists = await Playlist.findOne({
        userId,
        name: new RegExp(`^${escapeRegex(finalName)}$`, 'i'),
    }).lean();

    if (exists) {
        finalName = `${trimmedName} (Exported)`;
    }

    // Validate and keep song order intact
    const validIds = songIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    const foundSongs = await Song.find({ _id: { $in: validIds } });
    const songMap = new Map(foundSongs.map(s => [s._id.toString(), s]));

    // Ordered valid song documents
    const orderedValidIds = validIds.filter(id => songMap.has(id.toString()));

    const newPlaylist = new Playlist({
        userId,
        name: finalName,
        description: description || `Sequenced with ${algorithm || 'Modus engine'}`,
        coverImage,
        tags,
        algorithm: algorithm || 'mixed',
        songs: orderedValidIds,
    });

    await newPlaylist.populate('songs');
    await Playlist.updateStats(newPlaylist);

    return newPlaylist.toPublic();
}

module.exports = {
    getUserPlaylists,
    getPlaylistById,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    resequencePlaylist,
    exportSequence,
};
