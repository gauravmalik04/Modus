// =============================================================================
// pipeline/PlaylistSequencer.js
//
// Generates sequenced playlists for presets using a greedy nearest-neighbor
// algorithm to ensure smooth transitions between songs.
//
// Weighs key compatibility (Camelot wheel), BPM proximity, and timbre match.
// =============================================================================

import { PRESET_THRESHOLDS } from './thresholds.js';

export class PlaylistSequencer {

    /**
     * @param {Array<object>} songs - Array of Song JSON objects
     */
    constructor(songs) {
        this.songs = songs || [];
    }

    /**
     * Returns the transition-smoothed ordered playlist for a given preset.
     * @param {string} preset
     * @returns {Array<object>}
     */
    getPlaylist(preset) {
        const eligible = this.songs.filter(
            s => (s.presets?.[preset] ?? 0) >= PRESET_THRESHOLDS[preset]
        );
        return this._sequence(eligible, preset);
    }

    /**
     * Returns all 6 playlists.
     * @returns {Object<string, Array<object>>}
     */
    getAllPlaylists() {
        return Object.fromEntries(
            Object.keys(PRESET_THRESHOLDS).map(p => [p, this.getPlaylist(p)])
        );
    }

    // ==========================================================================
    // Sequencing Algorithm
    // ==========================================================================

    _sequence(songs, preset) {
        if (!songs || songs.length === 0) return [];

        const unplaced = [...songs];
        const playlist = [];

        // 1. Seed: Pick the song with the highest score for this preset
        unplaced.sort((a, b) => (b.presets[preset] ?? 0) - (a.presets[preset] ?? 0));
        let current = unplaced.shift();
        playlist.push(current);

        // 2. Greedily pick the next best song based on transition score
        while (unplaced.length > 0) {
            let bestScore = -Infinity;
            let bestIndex = -1;

            for (let i = 0; i < unplaced.length; i++) {
                const candidate = unplaced[i];
                const score = this._transitionScore(current, candidate, preset);

                if (score > bestScore) {
                    bestScore = score;
                    bestIndex = i;
                }
            }

            current = unplaced.splice(bestIndex, 1)[0];
            playlist.push(current);
        }

        return playlist;
    }

    _transitionScore(from, to, preset) {
        return (
            this._keyCompat(from, to)    * 0.40 +
            this._bpmCompat(from, to)    * 0.35 +
            this._timbreCompat(from, to) * 0.15 +
            (to.presets[preset] ?? 0)    * 0.10
        );
    }

    // ==========================================================================
    // Compatibility Scorers
    // ==========================================================================

    _keyCompat(a, b) {
        const fromKey = this._toCamelot(a.features?.key, a.features?.mode);
        const toKey   = this._toCamelot(b.features?.key, b.features?.mode);

        if (!fromKey || !toKey) return 0.65; // neutral penalty for unknown

        // Same position and letter (e.g. 1B to 1B)
        if (fromKey.num === toKey.num && fromKey.letter === toKey.letter) {
            return 1.00;
        }

        // Relative major/minor (e.g. 1A to 1B)
        if (fromKey.num === toKey.num && fromKey.letter !== toKey.letter) {
            return 0.85;
        }

        // Calculate shortest distance on 1-12 wheel
        let dist = Math.abs(fromKey.num - toKey.num);
        if (dist > 6) dist = 12 - dist;

        if (dist === 1) {
            return fromKey.letter === toKey.letter ? 0.80 : 0.60;
        }
        if (dist === 2) {
            return fromKey.letter === toKey.letter ? 0.55 : 0.40;
        }

        // Clash
        return 0.20;
    }

    _bpmCompat(a, b) {
        const bpmA = a.features?.bpm;
        const bpmB = b.features?.bpm;
        if (bpmA == null || bpmB == null) return 0.70;

        const delta = Math.abs(bpmA - bpmB);
        return 1 - Math.min(1, delta / 60);
    }

    _timbreCompat(a, b) {
        const tA = a.features?.timbre;
        const tB = b.features?.timbre;

        if (!tA || !tB) return 0.70; // neutral
        if (tA === tB) return 1.00;  // same color
        return 0.35;                 // jarring shift (bright <-> dark)
    }

    // ==========================================================================
    // Camelot Wheel Mapping
    // ==========================================================================

    /**
     * Converts a standard key (e.g., "C#") and mode ("major") to Camelot notation.
     * Returns { num, letter } where letter 'B' is major, 'A' is minor.
     * 1B=B, 2B=F#, 3B=Db, 4B=Ab, 5B=Eb, 6B=Bb, 7B=F, 8B=C, 9B=G, 10B=D, 11B=A, 12B=E
     * 1A=G#m, 2A=D#m, 3A=Bbm, 4A=Fm, 5A=Cm, 6A=Gm, 7A=Dm, 8A=Am, 9A=Em, 10A=Bm, 11A=F#m, 12A=C#m
     */
    _toCamelot(keyStr, modeStr) {
        if (!keyStr) return null;

        const isMajor = modeStr !== 'minor';
        const letter = isMajor ? 'B' : 'A';
        const k = keyStr.replace(/ /g, '').toLowerCase();

        const map = {
            // Major (B)
            'b': 1, 'cb': 1,
            'f#': 2, 'gb': 2,
            'c#': 3, 'db': 3,
            'g#': 4, 'ab': 4,
            'd#': 5, 'eb': 5,
            'a#': 6, 'bb': 6,
            'f': 7,
            'c': 8,
            'g': 9,
            'd': 10,
            'a': 11,
            'e': 12,

            // Minor (A)
            'g#m': 1, 'abm': 1,
            'd#m': 2, 'ebm': 2,
            'a#m': 3, 'bbm': 3,
            'fm': 4,
            'cm': 5,
            'gm': 6,
            'dm': 7,
            'am': 8,
            'em': 9,
            'bm': 10,
            'f#m': 11, 'gbm': 11,
            'c#m': 12, 'dbm': 12
        };

        const lookupKey = isMajor ? k : `${k}m`;
        const num = map[lookupKey];

        if (num === undefined) return null;

        return { num, letter };
    }
}
