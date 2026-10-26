/**
 * backend/controllers/playlist.controller.js
 *
 * Playlist HTTP controller.
 * Translates HTTP requests to playlistService calls.
 */

'use strict';

const playlistService = require('../services/playlist.service');
const asyncHandler    = require('../utils/asyncHandler');

// ── GET /api/playlists ────────────────────────────────────────────────────────
const getAll = asyncHandler(async (req, res) => {
    const playlists = await playlistService.getUserPlaylists(req.user.userId);

    res.status(200).json({
        success: true,
        count:   playlists.length,
        playlists,
    });
});

// ── POST /api/playlists ───────────────────────────────────────────────────────
const create = asyncHandler(async (req, res) => {
    const playlist = await playlistService.createPlaylist(req.user.userId, req.body);

    res.status(201).json({
        success: true,
        message: 'Playlist created successfully.',
        playlist,
    });
});

// ── GET /api/playlists/:id ────────────────────────────────────────────────────
const getById = asyncHandler(async (req, res) => {
    const data = await playlistService.getPlaylistById(req.params.id, req.user.userId);

    res.status(200).json({
        success: true,
        ...data,
    });
});

// ── PUT /api/playlists/:id ────────────────────────────────────────────────────
const update = asyncHandler(async (req, res) => {
    const playlist = await playlistService.updatePlaylist(
        req.params.id,
        req.user.userId,
        req.body
    );

    res.status(200).json({
        success: true,
        message: 'Playlist updated successfully.',
        playlist,
    });
});

// ── DELETE /api/playlists/:id ─────────────────────────────────────────────────
const deletePlaylist = asyncHandler(async (req, res) => {
    const result = await playlistService.deletePlaylist(req.params.id, req.user.userId);

    res.status(200).json({
        success: true,
        ...result,
    });
});

// ── POST /api/playlists/:id/songs ─────────────────────────────────────────────
const addSong = asyncHandler(async (req, res) => {
    const playlist = await playlistService.addSongToPlaylist(
        req.params.id,
        req.user.userId,
        req.body.songId
    );

    res.status(200).json({
        success: true,
        message: 'Song added to playlist.',
        playlist,
    });
});

// ── DELETE /api/playlists/:id/songs/:songId ───────────────────────────────────
const removeSong = asyncHandler(async (req, res) => {
    const playlist = await playlistService.removeSongFromPlaylist(
        req.params.id,
        req.user.userId,
        req.params.songId
    );

    res.status(200).json({
        success: true,
        message: 'Song removed from playlist.',
        playlist,
    });
});

// ── POST /api/playlists/:id/resequence ────────────────────────────────────────
const resequence = asyncHandler(async (req, res) => {
    const result = await playlistService.resequencePlaylist(
        req.params.id,
        req.user.userId,
        req.body.algorithm
    );

    res.status(200).json({
        success: true,
        ...result,
    });
});

// ── POST /api/playlists/:id/export or POST /api/playlists/export ──────────────
const exportSequence = asyncHandler(async (req, res) => {
    const playlist = await playlistService.exportSequence(req.user.userId, req.body);

    res.status(201).json({
        success: true,
        message: 'Sequence exported as new playlist.',
        playlist,
    });
});

module.exports = {
    getAll,
    create,
    getById,
    update,
    deletePlaylist,
    addSong,
    removeSong,
    resequence,
    exportSequence,
};
