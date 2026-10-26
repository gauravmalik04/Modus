// =============================================================================
// pipeline/SongStore.js
//
// Handles reading/writing music_features.json.
//
// The file is json-server compatible:
//   { "songs": [ ...Song.toJSON() ] }
//
// All writes are upsert-safe: adding a song with an existing ID replaces it.
// =============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, renameSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const DB_PATH    = resolve(__dirname, '../data/music_features.json');
const EMPTY_DB   = { songs: [] };


export class SongStore {

    constructor() {
        this._songs = null;   // lazy-loaded
    }


    // ==========================================================================
    // Public API
    // ==========================================================================

    /**
     * Load the database from disk.
     * Creates the file (and data/ directory) if they don't exist.
     * @returns {SongStore} this (for chaining)
     */
    load() {

        _ensureDir(DB_PATH);

        if (!existsSync(DB_PATH)) {
            writeFileSync(DB_PATH, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
            this._songs = [];
            console.log(`[SongStore] Created new database at ${DB_PATH}`);
        } else {
            try {
                const raw    = readFileSync(DB_PATH, 'utf8');
                const parsed = JSON.parse(raw);
                this._songs  = Array.isArray(parsed.songs) ? parsed.songs : [];
                console.log(`[SongStore] Loaded ${this._songs.length} existing song(s)`);
            } catch (err) {
                console.warn(`[SongStore] Could not parse existing file — starting fresh. (${err.message})`);
                this._songs = [];
            }
        }

        return this;
    }


    /**
     * Upsert a song by its id.
     * If a song with the same id already exists, it is replaced.
     * @param {object} song - Result of Song.toJSON()
     * @returns {SongStore} this (for chaining)
     */
    add(song) {

        this._assertLoaded();

        const index = this._songs.findIndex(s => s.id === song.id);

        if (index !== -1) {
            this._songs[index] = song;
        } else {
            this._songs.push(song);
        }

        return this;
    }


    /**
     * Write the current in-memory state back to disk.
     * Writes to a temp file first, then renames (atomic on most OS).
     * @returns {SongStore} this (for chaining)
     */
    save() {

        this._assertLoaded();

        const payload  = JSON.stringify({ songs: this._songs }, null, 2);
        const tempPath = `${DB_PATH}.tmp`;

        // Write temp file
        writeFileSync(tempPath, payload, 'utf8');

        // Atomic rename — on Windows, target must not exist
        try {
            if (existsSync(DB_PATH)) {
                unlinkSync(DB_PATH);
            }
            renameSync(tempPath, DB_PATH);
        } catch (err) {
            // If rename fails for any reason, write directly
            writeFileSync(DB_PATH, payload, 'utf8');
            console.warn(`[SongStore] Atomic rename failed, wrote directly. (${err.message})`);
        }

        console.log(`[SongStore] Saved ${this._songs.length} song(s) to ${DB_PATH}`);

        return this;
    }


    /**
     * Returns all songs as plain objects (json-server ready).
     * @returns {Array<object>}
     */
    getAll() {
        this._assertLoaded();
        return [...this._songs];
    }


    /**
     * Find a single song by its id.
     * @param {string} id
     * @returns {object|undefined}
     */
    findById(id) {
        this._assertLoaded();
        return this._songs.find(s => s.id === id);
    }


    /**
     * Returns the count of songs currently in the store.
     * @returns {number}
     */
    get size() {
        return this._songs?.length ?? 0;
    }


    // ==========================================================================
    // Private helpers
    // ==========================================================================

    _assertLoaded() {
        if (this._songs === null) {
            throw new Error('[SongStore] Call .load() before accessing the store.');
        }
    }
}


// Ensure the directory containing filePath exists
function _ensureDir(filePath) {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`[SongStore] Created directory: ${dir}`);
    }
}
