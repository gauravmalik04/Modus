# Modus — Complete Project Overview

> **Mood-based music playlist generator** — *"Sequence Your Soul"*

---

## Table of Contents

1. [What is Modus?](#1-what-is-modus)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Application Workflow](#3-application-workflow)
4. [Features Breakdown](#4-features-breakdown)
   - [Feature 1 — Audio Feature Extraction Pipeline](#feature-1--audio-feature-extraction-pipeline)
   - [Feature 2 — Song Data Model & Preset Scoring](#feature-2--song-data-model--preset-scoring)
   - [Feature 3 — Persistent Song Database](#feature-3--persistent-song-database)
   - [Feature 4 — Mood-Based Playlist Generation](#feature-4--mood-based-playlist-generation)
   - [Feature 5 — Transition-Aware Playlist Sequencing](#feature-5--transition-aware-playlist-sequencing)
   - [Feature 6 — Interactive Landing Page UI](#feature-6--interactive-landing-page-ui)
   - [Feature 7 — Front-End Playlist Bridge](#feature-7--front-end-playlist-bridge)
5. [File-by-File Function Reference](#5-file-by-file-function-reference)
6. [Data Flow Diagram](#6-data-flow-diagram)
7. [Preset System Explained](#7-preset-system-explained)
8. [Tech Stack & Scripts](#8-tech-stack--scripts)

---

## 1. What is Modus?

**Modus** is a web application that generates **mood-based, transition-aware playlists** from a library of songs. Instead of simply grouping songs by genre, Modus:

- Fetches rich **audio features** (BPM, key, energy, valence, danceability, etc.) for each song from an external API (**FreqBlog**).
- Scores every song against **6 mood presets** (Romantic, Energetic, Thrill, Chill, Feel Good, Melancholic) using weighted formulas.
- **Sequences** eligible songs in the smoothest possible order using the **Camelot Wheel** (harmonic key compatibility), BPM proximity, and timbre matching.
- Presents everything through a clean, Bauhaus-inspired **web UI** with an interactive preset selector.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BACK-END PIPELINE                        │
│  (Node.js — runs once via `npm run extract`)                    │
│                                                                 │
│  feature_extraction.js                                          │
│       │                                                         │
│       ├──▶ FreqBlogClient.js  ──▶  FreqBlog REST API            │
│       │        (fetch audio features in bulk)                   │
│       │                                                         │
│       ├──▶ Song.js                                              │
│       │        (build structured Song objects + compute         │
│       │         mood preset scores)                             │
│       │                                                         │
│       └──▶ SongStore.js  ──▶  data/music_features.json          │
│                (persist to JSON file)                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │  data/music_features.json served by json-server
         │  GET http://localhost:3001/songs
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        FRONT-END (Browser)                      │
│                                                                 │
│  landing.html  ──▶  js/pages/landing.js                        │
│                         (interactive preset UI)                 │
│                                                                 │
│  js/sequencer.js  ──▶  pipeline/PlaylistSequencer.js            │
│      (fetch songs from json-server → sequence → return UI data) │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Application Workflow

The workflow has two distinct phases:

### Phase 1 — Data Pipeline (Offline / One-Time Setup)

```
Step 1:  Developer adds songs to SONGS array in feature_extraction.js
              ↓
Step 2:  Run: npm run extract
              ↓
Step 3:  bulkGetFeatures()  →  FreqBlog POST /bulk API
         (sends up to 50 songs per HTTP request, handles rate limits)
              ↓
Step 4:  _mapToSchema()  converts raw API response → normalized fields
              ↓
Step 5:  new Song(result)  builds the Song object:
         - Layer 1: Identity metadata (name, artist, album, ISRC...)
         - Layer 2: Raw audio features (BPM, key, valence, energy...)
         - Layer 3: Preset scores (romantic, energetic, thrill, chill...)
              ↓
Step 6:  SongStore.add() + SongStore.save()
         upserts into data/music_features.json
              ↓
Step 7:  Run: npm run serve
         json-server exposes http://localhost:3001/songs
```

### Phase 2 — Playlist Generation (Run-Time / Browser)

```
Step 1:  User opens landing.html in browser
              ↓
Step 2:  getSequencedPlaylists() fetches all songs from json-server
              ↓
Step 3:  PlaylistSequencer.getAllPlaylists() is called
              ↓
Step 4:  For each of the 6 presets:
         a) Filter songs by preset threshold (thresholds.js)
         b) Seed with highest-scoring song for that preset
         c) Greedy nearest-neighbor: pick next song with best
            transitionScore() = key_compat(40%) + bpm_compat(35%)
                                 + timbre_compat(15%) + preset_score(10%)
              ↓
Step 5:  Return ordered playlist arrays → rendered in UI
              ↓
Step 6:  User clicks a preset card → selectPreset() updates
         the track list with smooth fade/slide animation
```

---

## 4. Features Breakdown

---

### Feature 1 — Audio Feature Extraction Pipeline

**Entry point:** `feature_extraction.js`

**What it does:**
Takes a developer-defined list of songs (artist + title) and fetches detailed audio features for all of them from the FreqBlog API in an efficient batch operation, then saves the enriched data locally.

**Functions involved:**

| Function | File | What it does |
|---|---|---|
| `runPipeline(songs)` | `feature_extraction.js` | Orchestrates all 3 pipeline steps end-to-end |
| `bulkGetFeatures(tracks)` | `pipeline/FreqBlogClient.js` | Chunks songs into batches of ≤50, sends POST /bulk, returns raw results |
| `_fetchChunkWithRetry(tracks, attempt)` | `pipeline/FreqBlogClient.js` | Sends one HTTP chunk; retries on HTTP 429 using `Retry-After` header; re-queues tracks still in "processing" state |
| `_mapToSchema(raw)` | `pipeline/FreqBlogClient.js` | Maps raw FreqBlog API fields to the project's standardized schema (e.g. `bpm` → `tempo`, `energy` → `aggression`) |
| `_parseKey(keyStr)` | `pipeline/FreqBlogClient.js` | Splits FreqBlog's combined key string (e.g. `"C#-Major"`) into separate `keyName` and `modeName` |
| `_deriveElectronicness(raw)` | `pipeline/FreqBlogClient.js` | Approximates electronicness (not native to FreqBlog) from genre keywords + energy + danceability |
| `_clamp01(val)` | `pipeline/FreqBlogClient.js` | Clamps any numeric value to the `[0, 1]` range; returns `null` for invalid input |
| `_chunkArray(arr, size)` | `pipeline/FreqBlogClient.js` | Splits a large array into sub-arrays of max `size` elements |
| `_sleep(ms)` | `pipeline/FreqBlogClient.js` | Promise-based delay (used between retries and re-queue waits) |

---

### Feature 2 — Song Data Model & Preset Scoring

**Entry point:** `pipeline/Song.js`

**What it does:**
Every fetched track is instantiated as a `Song` object. The constructor builds three layers of data and immediately computes mood preset scores without any additional API calls.

**Data layers inside a `Song` object:**

| Layer | Fields | Source |
|---|---|---|
| **Layer 1: Identity** | `id`, `isrc`, `mbid`, `name`, `artist`, `album`, `release_date`, `duration_ms`, `genre` | FreqBlog API metadata |
| **Layer 2: Raw Features** | `happiness`, `sadness`, `aggression`, `party`, `acousticness`, `danceability`, `bpm`, `key`, `mode`, `loudness`, `timbre`, `vocalness`, `instrumentalness`, `electronicness`, `energy` | Computed from API data |
| **Layer 3: Presets** | `romantic`, `energetic`, `thrill`, `chill`, `feel_good`, `melancholic` | Computed locally via weighted formulas |

**Functions involved:**

| Function | What it does |
|---|---|
| `constructor(result)` | Initializes all three layers; calls `_computeEnergy()` and `_computePresets()` |
| `_computeEnergy(result)` | Derives `energy` score: `aggression×0.35 + danceability×0.25 + electronicness×0.20 + loudnessScore×0.20`. Normalizes loudness from LUFS using `(x+30)/30` |
| `_computePresets()` | Computes all 6 preset scores using `_score()` for each preset's weighted formula |
| `_score(pairs)` | Weighted average of `[value, weight]` pairs; gracefully skips `null` values and redistributes weight; returns `null` only if all inputs are null |
| `_bpmScore(bpm, min, max)` | Normalizes a BPM value to `[0,1]` for a given target range (used by "Energetic" preset) |
| `_bpmSlowScore(bpm)` | Inverted BPM score: returns `1.0` at 60 BPM → `0.0` at 120+ BPM (used by "Chill" preset) |
| `toJSON()` | Serializes the Song to a plain object suitable for JSON storage |
| `_round(val)` *(module-level)* | Rounds to 4 decimal places for consistent precision |
| `_inv(val)` *(module-level)* | Computes `1 - val` (inversion) for features like sadness = `1 - happiness` |
| `_generateId(result)` *(module-level)* | Generates a slug-style fallback ID from `artist-title` when ISRC is missing |

**Preset Score Formulas:**

| Preset | Formula (weighted features) |
|---|---|
| **Romantic** | happiness×0.30 + acousticness×0.25 + vocalness×0.20 + (1-aggression)×0.15 + (1-electronicness)×0.10 |
| **Energetic** | energy×0.35 + danceability×0.25 + electronicness×0.20 + aggression×0.10 + bpmScore(120-180)×0.10 |
| **Thrill** | aggression×0.35 + energy×0.30 + (1-happiness)×0.20 + electronicness×0.15 |
| **Chill** | (1-energy)×0.30 + acousticness×0.25 + (1-aggression)×0.20 + (1-danceability)×0.15 + bpmSlowScore×0.10 |
| **Feel Good** | happiness×0.35 + party×0.25 + danceability×0.25 + energy×0.15 |
| **Melancholic** | sadness×0.35 + acousticness×0.20 + vocalness×0.20 + (1-energy)×0.15 + (1-party)×0.10 |

---

### Feature 3 — Persistent Song Database

**Entry point:** `pipeline/SongStore.js`

**What it does:**
Manages reading and writing of `data/music_features.json` — the local flat-file database of all processed songs. Designed to be **json-server compatible** so the same file can be served directly as a REST API.

**Functions involved:**

| Function | What it does |
|---|---|
| `load()` | Reads `data/music_features.json` from disk (lazy-loaded); creates the file and directory if they don't exist; parses the JSON safely |
| `add(song)` | Upserts a song by its `id` — if a song with the same `id` exists it is replaced, otherwise it is appended (prevents duplicates) |
| `save()` | Writes the in-memory songs array back to disk; uses an **atomic write** pattern (write to `.tmp` file first, then rename) to prevent data corruption |
| `getAll()` | Returns a shallow copy of all songs |
| `findById(id)` | Looks up a single song by its `id` field |
| `size` *(getter)* | Returns the number of songs currently in the store |
| `_assertLoaded()` | Guards all public methods — throws if `.load()` was never called |
| `_ensureDir(filePath)` *(module-level)* | Creates the parent directory of a file path if it doesn't exist |

---

### Feature 4 — Mood-Based Playlist Generation

**Entry point:** `pipeline/thresholds.js` + `pipeline/PlaylistSequencer.js`

**What it does:**
Defines minimum quality thresholds for each preset, then filters the full song library down to only those songs that are a genuine match for a requested mood.

**Thresholds (calibrated from sample data):**

| Preset | Minimum Score |
|---|---|
| Romantic | 0.57 |
| Energetic | 0.58 |
| Thrill | 0.55 |
| Chill | 0.57 |
| Feel Good | 0.60 |
| Melancholic | 0.55 |

**Functions involved:**

| Function | File | What it does |
|---|---|---|
| `PRESET_THRESHOLDS` | `thresholds.js` | Exported constant object with min score per preset |
| `getQualifyingPresets(song)` | `thresholds.js` | Returns an array of preset names the given song qualifies for (used for labeling/display) |
| `getPlaylist(preset)` | `PlaylistSequencer.js` | Filters songs by threshold for a given preset, then passes eligible songs to `_sequence()` |
| `getAllPlaylists()` | `PlaylistSequencer.js` | Calls `getPlaylist()` for all 6 presets; returns a map of `{ presetName → orderedSongArray }` |

---

### Feature 5 — Transition-Aware Playlist Sequencing

**Entry point:** `pipeline/PlaylistSequencer.js`

**What it does:**
Takes a filtered set of eligible songs and orders them for the **smoothest listening experience** using a greedy nearest-neighbor algorithm. The goal is to minimize jarring jumps between tracks.

**Algorithm:**
1. **Seed**: Pick the song with the highest preset score as the first track.
2. **Greedy step**: For every remaining position, score all unplaced candidates against the current track using `_transitionScore()`, pick the best.
3. **Repeat** until all songs are placed.

**Transition Score Formula:**
```
transitionScore = keyCompat × 0.40
               + bpmCompat × 0.35
               + timbreCompat × 0.15
               + presetScore × 0.10
```

**Functions involved:**

| Function | What it does |
|---|---|
| `_sequence(songs, preset)` | Greedy nearest-neighbor algorithm; seeds from highest preset-scorer, then iteratively picks next best transition candidate |
| `_transitionScore(from, to, preset)` | Computes the composite transition score between two consecutive songs using key, BPM, timbre, and preset score |
| `_keyCompat(a, b)` | Converts both songs to Camelot wheel notation and scores their harmonic compatibility (same key = 1.0, adjacent = 0.8, clash = 0.2) |
| `_bpmCompat(a, b)` | Scores BPM compatibility: `1 - min(1, |bpmA - bpmB| / 60)`. A 0 BPM difference = 1.0; a 60+ BPM difference = 0.0 |
| `_timbreCompat(a, b)` | Compares timbre labels ("bright"/"dark"); same timbre = 1.0, different = 0.35, unknown = neutral 0.70 |
| `_toCamelot(keyStr, modeStr)` | Converts a standard music key (e.g. `"C#"`, `"major"`) to Camelot wheel notation `{ num, letter }` using a complete lookup table of all 24 keys |

**Camelot Wheel — Key Compatibility Rules:**

| Condition | Score | Meaning |
|---|---|---|
| Same key and mode | 1.00 | Perfect match |
| Same number, different mode (relative major/minor) | 0.85 | Very smooth |
| Adjacent on wheel (distance 1), same mode | 0.80 | Good transition |
| Adjacent on wheel (distance 1), different mode | 0.60 | Acceptable |
| Distance 2, same mode | 0.55 | Noticeable shift |
| Distance 2, different mode | 0.40 | Slightly jarring |
| Distance ≥ 3 | 0.20 | Key clash |
| Unknown key | 0.65 | Neutral penalty |

---

### Feature 6 — Interactive Landing Page UI

**Entry point:** `landing.html` + `js/pages/landing.js`

**What it does:**
The main user-facing page. Showcases Modus with a hero section and a live **interactive Mood Sequencer** demo where users can click preset cards to see the track list change with smooth animations.

**UI Sections:**
- **Navbar** — Fixed top bar with logo and "Get Started" CTA (→ `login.html`)
- **Hero Section** — Title, tagline, two CTA buttons (Launch App, Learn More)
- **Mood Sequencer Demo** — Interactive preset cards + track list preview
- **Trust Section** — Tagline banner
- **Footer** — Navigation links + copyright

**Functions involved:**

| Function | What it does |
|---|---|
| `selectPreset(presetId)` | Master controller: updates preset button styles, badge text/color, and calls `updateTracklist()` when a preset is selected |
| `updateTracklist(preset)` | Animates the track list: fades out current tracks (`track-swap-out`), swaps in new track data (title, artist, BPM, meter fill, colors), then fades in (`track-swap-in`) — all within a 150ms → 300ms timed sequence |
| `getPresetFromClasses(element)` | Fallback helper that detects which preset a button belongs to by reading its CSS class names (when `data-preset` attribute is absent) |
| `initPlaybackControls()` | Attaches click listeners to each track's play box; toggles the icon between `play_arrow` and `pause`, ensuring only one track appears "playing" at a time |
| Preset card `click` | Reads `data-preset` attribute → calls `selectPreset()` |
| Preset badge `click` | Cycles to the next preset in order (wraps around) |
| Hero/Navbar CTA `click` | Redirects to `login.html` |
| Learn More `click` | Smooth-scrolls to the `.sequencer-section` |

**Animation Classes used:**

| Class | Effect |
|---|---|
| `track-swap-out` | Fades/slides track out |
| `track-swap-in` | Fades/slides track in |
| `sequencer-preset-card-active` | Active state highlight on selected preset button |
| `shadow-brutal` / `shadow-brutal-lg` | Neobrutalist drop shadow (active vs inactive buttons) |

---

### Feature 7 — Front-End Playlist Bridge

**Entry point:** `js/sequencer.js`

**What it does:**
A lightweight front-end module that bridges the back-end json-server data with the `PlaylistSequencer` algorithm. Designed to be imported into any page that needs ready-made sequenced playlists.

**Functions involved:**

| Function | What it does |
|---|---|
| `getSequencedPlaylists()` | Fetches all songs from `http://localhost:3001/songs` (json-server), instantiates `PlaylistSequencer`, calls `getAllPlaylists()`, and returns the full map of `{ presetName → orderedSongArray }`. Returns `null` on network error. |

---

## 5. File-by-File Function Reference

### `feature_extraction.js` — Pipeline Entry Point
| Function | Purpose |
|---|---|
| `runPipeline(songs)` | Main async function: runs steps 1–3 (fetch → build → save) and logs a summary |

### `pipeline/FreqBlogClient.js` — API Client
| Function | Purpose |
|---|---|
| `bulkGetFeatures(tracks)` | Public: chunks tracks, calls `_fetchChunkWithRetry` per chunk, returns all results |
| `_fetchChunkWithRetry(tracks, attempt)` | Internal: POSTs to FreqBlog `/bulk`, handles 429/errors, re-queues processing items |
| `_mapToSchema(raw)` | Internal: normalizes raw API response to project schema |
| `_parseKey(keyStr)` | Internal: splits `"C#-Major"` → `{ keyName: "C#", modeName: "major" }` |
| `_deriveElectronicness(raw)` | Internal: estimates electronicness from genre + energy/danceability |
| `_clamp01(val)` | Internal: clamps to `[0,1]`, null-safe |
| `_chunkArray(arr, size)` | Internal: splits array into chunks |
| `_sleep(ms)` | Internal: async delay |

### `pipeline/Song.js` — Data Model
| Function | Purpose |
|---|---|
| `constructor(result)` | Builds all 3 data layers |
| `_computeEnergy(result)` | Calculates composite energy score |
| `_computePresets()` | Calculates all 6 preset scores |
| `_score(pairs)` | Null-safe weighted average |
| `_bpmScore(bpm, min, max)` | BPM → score for a fast target range |
| `_bpmSlowScore(bpm)` | BPM → score for a slow target range |
| `toJSON()` | Serializes to plain JSON-safe object |
| `_round(val)` *(module)* | 4 decimal place rounding |
| `_inv(val)` *(module)* | `1 - val` inversion |
| `_generateId(result)` *(module)* | Slug fallback ID from artist+title |

### `pipeline/SongStore.js` — Database
| Function | Purpose |
|---|---|
| `load()` | Load/create `music_features.json` |
| `add(song)` | Upsert song by ID |
| `save()` | Atomic write back to disk |
| `getAll()` | Return all songs |
| `findById(id)` | Find one song by ID |
| `size` | Song count |
| `_assertLoaded()` | Guard: ensures `load()` was called |
| `_ensureDir(filePath)` *(module)* | Create parent directory if missing |

### `pipeline/PlaylistSequencer.js` — Sequencing Engine
| Function | Purpose |
|---|---|
| `getPlaylist(preset)` | Filter + sequence songs for one preset |
| `getAllPlaylists()` | All 6 playlists at once |
| `_sequence(songs, preset)` | Greedy nearest-neighbor ordering |
| `_transitionScore(from, to, preset)` | Composite score for a song pair transition |
| `_keyCompat(a, b)` | Camelot wheel harmonic compatibility |
| `_bpmCompat(a, b)` | BPM closeness score |
| `_timbreCompat(a, b)` | Timbre label match score |
| `_toCamelot(keyStr, modeStr)` | Key + mode → Camelot `{ num, letter }` |

### `pipeline/thresholds.js` — Quality Gates
| Export | Purpose |
|---|---|
| `PRESET_THRESHOLDS` | Min score map per preset |
| `getQualifyingPresets(song)` | List of presets a song qualifies for |

### `js/sequencer.js` — Front-End Bridge
| Function | Purpose |
|---|---|
| `getSequencedPlaylists()` | Fetch → sequence → return all playlists |

### `js/pages/landing.js` — Landing Page Controller
| Function | Purpose |
|---|---|
| `selectPreset(presetId)` | Switch active preset + update all UI elements |
| `updateTracklist(preset)` | Animate track list swap |
| `getPresetFromClasses(element)` | Detect preset from CSS class names |
| `initPlaybackControls()` | Wire up play/pause button interactivity |

---

## 6. Data Flow Diagram

```
Developer Input (SONGS array)
         │
         ▼
feature_extraction.js  ::  runPipeline()
         │
         ├──▶ FreqBlogClient  ::  bulkGetFeatures()
         │         │
         │         ├──▶ _chunkArray()          (split into ≤50 per batch)
         │         ├──▶ _fetchChunkWithRetry() (POST /bulk with retry)
         │         ├──▶ _mapToSchema()         (normalize field names)
         │         ├──▶ _deriveElectronicness()(compute missing feature)
         │         └──▶ returns [{query, result}, ...]
         │
         ├──▶ new Song(result)
         │         │
         │         ├──▶ Layer 1: copy identity fields
         │         ├──▶ Layer 2: compute features
         │         │       ├── sadness    = 1 - valence
         │         │       ├── vocalness  = 1 - instrumentalness
         │         │       └── energy     = _computeEnergy()
         │         ├──▶ Layer 3: _computePresets()
         │         │       └── _score([feature, weight], ...)  x6 presets
         │         └──▶ returns Song instance
         │
         └──▶ SongStore  ::  load() → add() → save()
                   └──▶ data/music_features.json


data/music_features.json
         │
         ▼  (npm run serve → json-server)
http://localhost:3001/songs
         │
         ▼
js/sequencer.js  ::  getSequencedPlaylists()
         │
         ▼
PlaylistSequencer  ::  getAllPlaylists()
         │
         ├──▶ getPlaylist("romantic")
         │         ├── filter by PRESET_THRESHOLDS["romantic"] = 0.57
         │         └── _sequence()  →  greedy nearest-neighbor
         │               ├── seed: highest preset scorer
         │               └── per step: _transitionScore()
         │                     ├── _keyCompat()     → Camelot wheel
         │                     ├── _bpmCompat()     → BPM delta
         │                     └── _timbreCompat()  → bright/dark
         │
         ├──▶ getPlaylist("energetic") ... (x6 presets total)
         │
         └──▶ returns { romantic: [...], energetic: [...], ... }
                   │
                   ▼
            Rendered in Browser UI
```

---

## 7. Preset System Explained

Each song gets a score from `0.0` to `1.0` for each of the 6 mood presets. A song can qualify for **multiple presets** if it meets the minimum threshold for each.

### How Preset Scores Work

1. Raw audio features (e.g. `valence = 0.82`, `acousticness = 0.65`) are fetched from FreqBlog.
2. Some features are **derived**: `sadness = 1 - valence`, `vocalness = 1 - instrumentalness`.
3. Each preset has a **weighted formula** that combines relevant features into a single `0–1` score.
4. If a feature is `null` (missing from API), `_score()` redistributes its weight to present features — ensuring partial data still produces a valid score.
5. The score is compared against the preset's threshold. Songs scoring above the threshold appear in that preset's playlist.

### Example Calculation

**Song features:** `valence=0.8, acousticness=0.7, vocalness=0.6, aggression=0.2, electronicness=0.1`

**Romantic preset formula:**
```
happiness×0.30 + acousticness×0.25 + vocalness×0.20 + (1-aggression)×0.15 + (1-electronicness)×0.10

= 0.8×0.30  +  0.7×0.25  +  0.6×0.20  +  (1-0.2)×0.15  +  (1-0.1)×0.10
= 0.240     +  0.175     +  0.120     +   0.120          +   0.090
= 0.745
```

Since `0.745 > 0.57` (threshold), this song **qualifies** for the Romantic playlist. ✓

---

## 8. Tech Stack & Scripts

### Technologies Used

| Category | Technology | Purpose |
|---|---|---|
| Runtime | Node.js (ESM) | Pipeline execution |
| HTTP | Native `fetch` API | FreqBlog API calls |
| Config | `dotenv` | Loads `FREQBLOG_API_KEY` from `.env` |
| Mock Server | `json-server` | Serves `music_features.json` as REST API |
| Front-End | Vanilla HTML + CSS + JS | Landing page UI |
| Fonts | Google Fonts (Space Grotesk, Inter) | Typography |
| Icons | Material Symbols Outlined | UI icons |

### NPM Scripts

| Command | What it does |
|---|---|
| `npm run extract` | Runs `feature_extraction.js` — fetches features and populates `data/music_features.json` |
| `npm run serve` | Starts json-server on port 3001 — serves `data/music_features.json` as `GET /songs` |

### Environment Variables (`.env`)

| Variable | Purpose |
|---|---|
| `FREQBLOG_API_KEY` | API key for the FreqBlog audio features service |

### Project Pages

| File | Purpose |
|---|---|
| `landing.html` | Home page with hero + interactive mood sequencer demo |
| `login.html` | Login / Sign-up page *(front-end scaffold, logic pending)* |
| `playlists.html` | Playlist manager — CRUD interface *(scaffold)* |
| `profile.html` | User profile + playlists list *(scaffold)* |

---

*Source: `c:\Users\LENOVO\Desktop\University\Sem5\Modus`*
