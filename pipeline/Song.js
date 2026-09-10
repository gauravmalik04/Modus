// =============================================================================
// pipeline/Song.js
//
// Song class — the canonical data model for a single track.
//
// Structure:
//   Layer 1 — Identity / Metadata   (from FreqBlog)
//   Layer 2 — Raw Audio Features    (same field names as original fetching_data.js)
//   Layer 3 — Preset Scores         (computed locally from raw features)
//
// Preset score formulas are weighted sums that:
//   - Gracefully skip null inputs (partial scores still computed)
//   - Return null only if ALL inputs for a preset are missing
//   - Produce 0–1 floats rounded to 4 decimal places
// =============================================================================


export class Song {

    /**
     * @param {object} result - Normalized result from FreqBlogClient._mapToSchema()
     */
    constructor(result) {


        // ======================================================================
        // LAYER 1 — Identity / Metadata
        // ======================================================================

        this.id           = result.isrc   ?? _generateId(result);  // ISRC as stable ID
        this.isrc         = result.isrc   ?? null;
        this.mbid         = result.mbid   ?? null;
        this.name         = result.title  ?? null;
        this.artist       = result.artist ?? null;
        this.album        = result.album  ?? null;
        this.release_date = result.release_date ?? null;
        this.duration_ms  = result.duration_ms  ?? null;
        this.genre        = result.genre  ?? null;
        this.fetched_at   = new Date().toISOString();


        // ======================================================================
        // LAYER 2 — Raw Audio Features
        // All field names match the original fetching_data.js extractFeatures()
        // ======================================================================

        this.features = {

            // ------------------------------------------------------------------
            // Theme — Emotional character (all 0–1 probabilities)
            // ------------------------------------------------------------------

            happiness:    result.valence    ?? null,             // mood_happy  → valence
            sadness:      result.valence != null
                            ? _round(1 - result.valence)
                            : null,                              // derived: 1 − valence
            aggression:   result.aggression ?? null,             // mood_aggressive → energy
            party:        result.danceability ?? null,           // mood_party  → danceability proxy
            acousticness: result.acousticness ?? null,           // mood_acoustic → acousticness
            danceability: result.danceability ?? null,           // danceability


            // ------------------------------------------------------------------
            // Transition — Structural / playback properties
            // ------------------------------------------------------------------

            bpm:     result.tempo    ?? null,                    // rhythm.bpm  → tempo
            key:     result.key      ?? null,                    // tonal.key_key → key (e.g. "C")
            mode:    result.mode     ?? null,                    // tonal.key_scale → "major"/"minor"
            loudness: result.loudness ?? null,                   // LUFS negative float (e.g. -6.2)
            timbre:  result.timbre   ?? null,                    // "bright" / "dark" / null


            // ------------------------------------------------------------------
            // Texture — Sound composition
            // ------------------------------------------------------------------

            vocalness:        result.instrumentalness != null
                                ? _round(1 - result.instrumentalness)
                                : null,                          // derived: 1 − instrumentalness
            instrumentalness: result.instrumentalness ?? null,
            electronicness:   result.electronicness   ?? null,   // mood_electronic proxy


            // ------------------------------------------------------------------
            // Derived — Computed from other features
            // Replicates the exact formula from the original fetching_data.js
            // energy = aggression×0.35 + danceability×0.25 + electronicness×0.20 + loudnessScore×0.20
            // ------------------------------------------------------------------

            energy: this._computeEnergy(result),
        };


        // ======================================================================
        // LAYER 3 — Preset Scores
        // Computed locally — no extra API calls
        // ======================================================================

        this.presets = this._computePresets();
    }


    // ==========================================================================
    // Preset formulas
    // Each is a weighted sum of raw features (see _score() for null handling)
    // ==========================================================================

    _computePresets() {

        const f = this.features;

        return {

            // ------------------------------------------------------------------
            // Romantic — soft, vocal, happy, acoustic, slow, not aggressive
            // ------------------------------------------------------------------
            romantic: this._score([
                [f.happiness,              0.30],
                [f.acousticness,           0.25],
                [f.vocalness,              0.20],
                [_inv(f.aggression),       0.15],   // less aggressive → more romantic
                [_inv(f.electronicness),   0.10],   // less electronic  → more organic/romantic
            ]),

            // ------------------------------------------------------------------
            // Energetic — high energy, fast, danceable, loud, electronic
            // ------------------------------------------------------------------
            energetic: this._score([
                [f.energy,                 0.35],
                [f.danceability,           0.25],
                [f.electronicness,         0.20],
                [f.aggression,             0.10],
                [this._bpmScore(f.bpm, 120, 180), 0.10],  // fast BPM target
            ]),

            // ------------------------------------------------------------------
            // Thrill — aggressive, high energy, tense, cinematic
            // ------------------------------------------------------------------
            thrill: this._score([
                [f.aggression,             0.35],
                [f.energy,                 0.30],
                [_inv(f.happiness),        0.20],   // less happy → more tense
                [f.electronicness,         0.15],
            ]),

            // ------------------------------------------------------------------
            // Chill — low energy, slow, acoustic, calm
            // ------------------------------------------------------------------
            chill: this._score([
                [_inv(f.energy),           0.30],
                [f.acousticness,           0.25],
                [_inv(f.aggression),       0.20],
                [_inv(f.danceability),     0.15],
                [this._bpmSlowScore(f.bpm), 0.10],         // 1.0 at 60 BPM → 0.0 at 120+ BPM
            ]),

            // ------------------------------------------------------------------
            // Feel Good — happy, danceable, upbeat, party
            // ------------------------------------------------------------------
            feel_good: this._score([
                [f.happiness,              0.35],
                [f.party,                  0.25],
                [f.danceability,           0.25],
                [f.energy,                 0.15],
            ]),

            // ------------------------------------------------------------------
            // Melancholic — sad, acoustic, vocal, low energy
            // ------------------------------------------------------------------
            melancholic: this._score([
                [f.sadness,                0.35],
                [f.acousticness,           0.20],
                [f.vocalness,              0.20],
                [_inv(f.energy),           0.15],
                [_inv(f.party),            0.10],
            ]),
        };
    }


    // ==========================================================================
    // Private helpers
    // ==========================================================================

    /**
     * Replicates the energy formula from the original fetching_data.js exactly.
     * energy = aggression×0.35 + danceability×0.25 + electronicness×0.20 + loudnessScore×0.20
     * Loudness (LUFS) is normalised to [0,1] using the same (x+30)/30 mapping.
     */
    _computeEnergy(result) {

        const aggression  = result.aggression       ?? null;
        const danceability = result.danceability     ?? null;
        const electronic  = result.electronicness   ?? null;
        const loudness    = result.loudness          ?? null;

        // All four inputs required (matches original strict check)
        if ([aggression, danceability, electronic, loudness].some(v => v == null)) {
            return null;
        }

        const loudnessScore = Math.max(0, Math.min(1, (loudness + 30) / 30));

        return _round(
            aggression   * 0.35 +
            danceability * 0.25 +
            electronic   * 0.20 +
            loudnessScore * 0.20
        );
    }


    /**
     * Weighted sum of [value, weight] pairs.
     * Null values are skipped; weight is redistributed to present values.
     * Returns null only if ALL inputs are null.
     *
     * @param {Array<[number|null, number]>} pairs
     * @returns {number|null}
     */
    _score(pairs) {

        let total  = 0;
        let weight = 0;

        for (const [val, w] of pairs) {
            if (val != null && !isNaN(val)) {
                total  += val * w;
                weight += w;
            }
        }

        return weight === 0 ? null : _round(total / weight);
    }


    /**
     * Normalise a BPM value into [0, 1] for a target range [min, max].
     * Values outside the range clamp to 0 or 1.
     */
    _bpmScore(bpm, min, max) {
        if (bpm == null) return null;
        return Math.max(0, Math.min(1, (bpm - min) / (max - min)));
    }

    /**
     * Inverted BPM score for chill songs.
     * Scores 1.0 at 60 BPM, 0.0 at 120+ BPM.
     */
    _bpmSlowScore(bpm) {
        if (bpm == null) return null;
        return Math.max(0, Math.min(1, (120 - bpm) / 60));
    }


    toJSON() {
        // Strip private helper methods — only serialise own data properties
        return {
            id:           this.id,
            isrc:         this.isrc,
            mbid:         this.mbid,
            name:         this.name,
            artist:       this.artist,
            album:        this.album,
            release_date: this.release_date,
            duration_ms:  this.duration_ms,
            genre:        this.genre,
            fetched_at:   this.fetched_at,
            features:     this.features,
            presets:      this.presets,
        };
    }
}


// =============================================================================
// Module-level helpers
// =============================================================================

// Round to 4 decimal places
function _round(val) {
    return parseFloat(val.toFixed(4));
}

// Invert a 0–1 value (1 − val), returning null if val is null
function _inv(val) {
    return val != null ? _round(1 - val) : null;
}

// Generate a fallback ID from artist + title when ISRC is unavailable
function _generateId(result) {
    const raw = `${result.artist ?? 'unknown'}-${result.title ?? 'unknown'}`;
    return raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
