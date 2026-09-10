// =============================================================================
// pipeline/FreqBlogClient.js
//
// Primary audio features client.
// Uses POST /bulk for efficient batch fetching:
//   - Chunks input into groups of ≤50 (FreqBlog limit)
//   - Processes chunks sequentially (avoids concurrency 429)
//   - Retries on 429 using the Retry-After header
//   - Re-queues tracks returned as null/processing after time-box
// =============================================================================

import 'dotenv/config';

const FREQBLOG_BASE   = 'https://api.freqblog.com';
const CHUNK_SIZE      = 50;
const MAX_RETRIES     = 3;
const DEFAULT_BACKOFF = 2000; // ms — fallback if no Retry-After header


// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Fetch audio features for a batch of songs.
 *
 * @param {Array<{ artist: string, title: string, isrc?: string }>} tracks
 * @returns {Promise<Array<{ query: object, result: object|null }>>}
 */
export async function bulkGetFeatures(tracks) {

    if (!process.env.FREQBLOG_API_KEY) {
        throw new Error('FREQBLOG_API_KEY is not set in .env');
    }

    const chunks  = _chunkArray(tracks, CHUNK_SIZE);
    const results = [];

    for (let i = 0; i < chunks.length; i++) {

        const chunk = chunks[i];

        console.log(`\n[FreqBlog] Chunk ${i + 1}/${chunks.length} — ${chunk.length} tracks`);

        const chunkResults = await _fetchChunkWithRetry(chunk);
        results.push(...chunkResults);
    }

    return results;
}


// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

/**
 * POST /bulk for one chunk, retrying on 429.
 */
async function _fetchChunkWithRetry(tracks, attempt = 1) {

    try {

        const response = await fetch(`${FREQBLOG_BASE}/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key':    process.env.FREQBLOG_API_KEY,
            },
            // FreqBlog expects a bare JSON array (NOT a wrapped object)
            body: JSON.stringify(
                tracks.map(t => ({
                    artist: t.artist,
                    track:  t.title,
                    ...(t.isrc ? { isrc: t.isrc } : {}),
                }))
            ),
        });

        // ── Rate-limited ───────────────────────────────────────────────────
        if (response.status === 429) {

            if (attempt > MAX_RETRIES) {
                console.warn(`[FreqBlog] 429 after ${MAX_RETRIES} retries — skipping chunk`);
                return tracks.map(t => ({ query: t, result: null }));
            }

            const retryAfter = response.headers.get('Retry-After');
            const waitMs     = retryAfter
                ? parseInt(retryAfter, 10) * 1000
                : DEFAULT_BACKOFF * attempt;

            console.warn(`[FreqBlog] 429 rate-limited. Retrying in ${waitMs / 1000}s (attempt ${attempt}/${MAX_RETRIES})…`);

            await _sleep(waitMs);

            return _fetchChunkWithRetry(tracks, attempt + 1);
        }

        // ── Non-OK ─────────────────────────────────────────────────────────
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            console.warn(`[FreqBlog] HTTP ${response.status} — ${text}`);
            return tracks.map(t => ({ query: t, result: null }));
        }

        const data = await response.json();

        // ── Map results back to query objects ──────────────────────────────
        // POST /bulk returns an array matching the input order.
        // Items not yet processed have found: false with backfill_status: "processing"
        const mapped    = [];
        const requeue   = [];

        // FreqBlog /bulk response: { results: [{ found, result: {...} }], found, not_found }
        const items = data.results ?? (Array.isArray(data) ? data : []);

        for (let i = 0; i < tracks.length; i++) {

            const item  = items[i] ?? null;
            const query = tracks[i];

            if (!item || item.found === false || !item.result) {
                // Not found or still processing
                if (item?.backfill_status === 'processing') {
                    requeue.push({ index: i, query });
                } else {
                    console.warn(`  [FreqBlog] Not found: ${query.artist} — ${query.title}`);
                    mapped.push({ query, result: null });
                }
            } else {
                mapped.push({ query, result: _mapToSchema(item.result) });
            }
        }

        // ── Re-queue tracks that were still processing ─────────────────────
        if (requeue.length > 0) {

            console.log(`[FreqBlog] ${requeue.length} track(s) still processing — retrying after 5s…`);

            await _sleep(5000);

            const retried = await _fetchChunkWithRetry(
                requeue.map(r => r.query),
                1   // reset attempt counter for re-queued items
            );

            mapped.push(...retried);
        }

        return mapped;

    } catch (err) {

        console.error(`[FreqBlog] Network error:`, err.message);
        return tracks.map(t => ({ query: t, result: null }));
    }
}


/**
 * Map a raw FreqBlog response object to the project's normalized feature schema.
 * Field names match the original fetching_data.js extractFeatures() output exactly.
 *
 * @param {object} raw - Raw FreqBlog API response for one track
 * @returns {object} Normalized result with metadata + features
 */
function _mapToSchema(raw) {

    // FreqBlog key format: "C#-Major" or "Ab-Minor"
    // Split into key name and mode string
    const { keyName, modeName } = _parseKey(raw.key);

    return {

        // ── Metadata ────────────────────────────────────────────────────────
        isrc:         raw.isrc         ?? null,
        mbid:         raw.mbid         ?? null,
        title:        raw.track_name   ?? null,
        artist:       raw.artist_name  ?? null,
        album:        raw.album_name   ?? null,
        release_date: raw.release_date ?? null,
        duration_ms:  raw.duration_ms  ?? null,
        genre:        raw.genre        ?? null,

        // ── Theme features ──────────────────────────────────────────────────
        valence:      _clamp01(raw.valence),
        aggression:   _clamp01(raw.energy),             // energy ≈ aggression
        acousticness: _clamp01(raw.acousticness),
        danceability: _clamp01(raw.danceability),

        // ── Transition features ─────────────────────────────────────────────
        tempo:        raw.bpm          ?? null,          // bpm field
        key:          keyName,                           // e.g. "C#"
        mode:         modeName,                          // "major" or "minor"
        loudness:     raw.loudness_db  ?? null,          // LUFS via loudness_db
        timbre:       null,                              // not provided by FreqBlog

        // ── Texture features ────────────────────────────────────────────────
        instrumentalness: _clamp01(raw.instrumentalness),
        electronicness:   _deriveElectronicness(raw),
    };
}


/**
 * Parse FreqBlog's combined key string (e.g. "C#-Major", "Ab-Minor") into
 * separate keyName ("C#") and modeName ("major" | "minor" | null).
 */
function _parseKey(keyStr) {
    if (!keyStr || typeof keyStr !== 'string') {
        return { keyName: null, modeName: null };
    }
    const parts = keyStr.split('-');
    if (parts.length >= 2) {
        return {
            keyName:  parts[0],
            modeName: parts[1].toLowerCase(),
        };
    }
    return { keyName: keyStr, modeName: null };
}


/**
 * Electronicness is not a native FreqBlog field.
 * We approximate it from energy + genre keywords when available.
 */
function _deriveElectronicness(raw) {

    const electronicGenres = [
        'electronic', 'edm', 'house', 'techno', 'trance', 'synth',
        'dubstep', 'drum and bass', 'dnb', 'electro', 'ambient',
    ];

    const genre = (raw.genre ?? '').toLowerCase();
    const isElectronicGenre = electronicGenres.some(g => genre.includes(g));

    if (isElectronicGenre) {
        // Genre confirms electronic — bias high, tempered by energy
        const energy = _clamp01(raw.energy) ?? 0.5;
        return _clamp01(0.5 + energy * 0.5);
    }

    // Fallback: estimate from energy + danceability
    const energy      = _clamp01(raw.energy)      ?? null;
    const danceability = _clamp01(raw.danceability) ?? null;

    if (energy != null && danceability != null) {
        return _clamp01((energy * 0.6 + danceability * 0.4) * 0.8);
    }

    return null;
}


// Clamp a value to [0, 1], returning null for missing/invalid
function _clamp01(val) {
    if (val == null || typeof val !== 'number' || isNaN(val)) return null;
    return Math.max(0, Math.min(1, val));
}

// Split array into chunks of a given size
function _chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

// Sleep for ms milliseconds
function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
