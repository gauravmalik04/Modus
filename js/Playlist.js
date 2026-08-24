/**
 * Modus - Playlist Model
 * Represents a playlist and wraps an array of song objects.
 */

export class Playlist {

    /**
     * @param {object} opts
     * @param {string}   opts.id
     * @param {string}   opts.name
     * @param {string}   opts.description
     * @param {string}   opts.coverImage   — URL of cover art
     * @param {number}   opts.moodScore    — 0-100
     * @param {string[]} opts.tags
     * @param {object[]} opts.songs        — raw song objects from music_features.json
     */
    constructor({ id, name, description = '', coverImage = '', moodScore = 0, tags = [], songs = [] }) {
        this.id          = id;
        this.name        = name;
        this.description = description;
        this.coverImage  = coverImage;
        this.moodScore   = moodScore;
        this.tags        = tags;
        this.songs       = songs;
    }

    /** Number of songs in the playlist */
    get trackCount() {
        return this.songs.length;
    }

    /** Total duration in milliseconds */
    get totalDurationMs() {
        return this.songs.reduce((sum, s) => sum + (Number(s.duration_ms) || 0), 0);
    }

    static PRESET_LABELS = {
        romantic: 'Romantic',
        energetic: 'Energetic',
        thrill: 'Thrill',
        chill: 'Chill',
        feel_good: 'Feel Good',
        melancholic: 'Melancholic',
    };

    /** Top mood preset and score across all songs in the playlist */
    get topMood() {
        if (!this.songs.length) return { key: 'mix', name: 'Mix', score: 0 };
        const presets = ['romantic', 'energetic', 'thrill', 'chill', 'feel_good', 'melancholic'];
        const averages = {};

        presets.forEach(p => {
            const total = this.songs.reduce((sum, s) => sum + (Number(s.presets?.[p]) || 0), 0);
            averages[p] = total / this.songs.length;
        });

        let topKey = presets[0];
        for (const p of presets) {
            if (averages[p] > averages[topKey]) {
                topKey = p;
            }
        }

        return {
            key: topKey,
            name: Playlist.PRESET_LABELS[topKey] || topKey,
            score: Math.round(averages[topKey] * 100),
        };
    }

    /**
     * Human-readable duration label, e.g. "1h 12m" or "45m"
     */
    get totalDurationLabel() {
        const totalSeconds = Math.floor(this.totalDurationMs / 1000);
        const hours        = Math.floor(totalSeconds / 3600);
        const minutes      = Math.floor((totalSeconds % 3600) / 60);

        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    /**
     * Build a Playlist from the raw music_features.json shape { songs: [...] }
     * @param {object} data     — parsed JSON object
     * @param {object} [meta]   — optional overrides for name, coverImage, etc.
     * @returns {Playlist}
     */
    static fromJSON(data, meta = {}) {
        const songs = Array.isArray(data.songs) ? data.songs : [];

        // Derive a rough mood score: average of all song romanticness presets
        const moodScore = songs.length
            ? Math.round(
                songs.reduce((sum, s) => {
                    const val = Number(s.presets?.romantic ?? s.presets?.feel_good ?? 0);
                    return sum + val;
                }, 0) / songs.length * 100
              )
            : 0;

        return new Playlist({
            id:          meta.id          ?? 'playlist_default',
            name:        meta.name        ?? 'Dummy Playlist',
            description: meta.description ?? 'Your full collection — ready to sequence.',
            coverImage:  meta.coverImage  ?? '',
            moodScore:   meta.moodScore   ?? moodScore,
            tags:        meta.tags        ?? ['Mix'],
            songs,
        });
    }
}
