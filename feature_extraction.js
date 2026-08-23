// =============================================================================
// feature_extraction.js
//
// Entry point for the music feature extraction pipeline.
//
// Usage:
//   node feature_extraction.js
//
// Add songs to the SONGS array below as { artist, title } objects.
// Results are written to data/music_features.json (json-server compatible).
//
// Rate limits (FreqBlog free tier):
//   - 1,000 requests/month
//   - POST /bulk charges 1 request per track resolved
//   - Chunks processed sequentially — no concurrency 429s
// =============================================================================

import 'dotenv/config';
import { bulkGetFeatures } from './pipeline/FreqBlogClient.js';
import { Song }            from './pipeline/Song.js';
import { SongStore }       from './pipeline/SongStore.js';


// =============================================================================
// 🎵 Song List — Add your songs here
// Format: { artist: string, title: string }
// =============================================================================

const SONGS = [
    { artist: 'Ed Sheeran', title: 'Perfect' },
    { artist: 'John Legend', title: 'All of Me' },
    { artist: 'Frank Sinatra', title: 'Fly Me to the Moon' },
    { artist: 'Dua Lipa', title: 'Levitating' },
    { artist: 'Calvin Harris', title: 'Summer' },
    { artist: 'Avicii', title: 'Wake Me Up' },
    { artist: 'Daft Punk', title: 'Get Lucky' },
    { artist: 'Eminem', title: 'Lose Yourself' },
    { artist: 'Metallica', title: 'Enter Sandman' },
    { artist: 'Imagine Dragons', title: 'Warriors' },
    { artist: 'System of a Down', title: 'Chop Suey!' },
    { artist: 'Norah Jones', title: "Don't Know Why" },
    { artist: 'Jack Johnson', title: 'Better Together' },
    { artist: 'Bon Iver', title: 'Skinny Love' },
    { artist: 'Adele', title: 'Someone Like You' },
    { artist: 'Coldplay', title: 'Fix You' },
    { artist: 'Radiohead', title: 'Creep' },
    { artist: 'Johnny Cash', title: 'Hurt' },
    { artist: 'Pharrell Williams', title: 'Happy' },
    { artist: 'Mark Ronson ft. Bruno Mars', title: 'Uptown Funk' }
];


// =============================================================================
// Pipeline
// =============================================================================

async function runPipeline(songs) {

    console.log('═══════════════════════════════════════════');
    console.log('  MODUS — Feature Extraction Pipeline');
    console.log(`  ${songs.length} song(s) queued`);
    console.log('═══════════════════════════════════════════\n');

    // ── Step 1: Fetch features from FreqBlog (POST /bulk) ──────────────────
    console.log('[Pipeline] Step 1 — Fetching features from FreqBlog…\n');

    let rawResults;

    try {
        rawResults = await bulkGetFeatures(songs);
    } catch (err) {
        console.error('[Pipeline] Fatal error during FreqBlog fetch:', err.message);
        process.exit(1);
    }

    // ── Step 2: Build Song instances ────────────────────────────────────────
    console.log('\n[Pipeline] Step 2 — Building Song instances…\n');

    const songObjects = [];
    const failed      = [];

    for (let i = 0; i < rawResults.length; i++) {

        const { query, result } = rawResults[i];
        const label = `${query.artist} — ${query.title}`;

        if (!result) {
            console.warn(`  [${i + 1}/${rawResults.length}] ✗ ${label}  (no data returned)`);
            failed.push(label);
            continue;
        }

        try {
            const song = new Song(result);
            songObjects.push(song.toJSON());
            console.log(`  [${i + 1}/${rawResults.length}] ✓ ${label}`);
        } catch (err) {
            console.warn(`  [${i + 1}/${rawResults.length}] ✗ ${label}  (${err.message})`);
            failed.push(label);
        }
    }

    // ── Step 3: Persist to music_features.json ──────────────────────────────
    console.log('\n[Pipeline] Step 3 — Saving to music_features.json…\n');

    const store = new SongStore();
    store.load();

    for (const song of songObjects) {
        store.add(song);
    }

    store.save();

    // ── Summary ─────────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════');
    console.log(`  ✓ Saved:  ${songObjects.length}/${songs.length} song(s)`);

    if (failed.length > 0) {
        console.log(`  ✗ Failed: ${failed.length}/${songs.length} song(s)`);
        failed.forEach(f => console.log(`      - ${f}`));
    }

    console.log(`  Total in DB: ${store.size} song(s)`);
    console.log('═══════════════════════════════════════════\n');
    console.log('  Run json-server:');
    console.log('  npm run serve');
    console.log('  → GET http://localhost:3001/songs');
    console.log('═══════════════════════════════════════════\n');
}


runPipeline(SONGS);
