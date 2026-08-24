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
   - [Feature 6 — Playlist Model (Front-End)](#feature-6--playlist-model-front-end)
   - [Feature 7 — Auth System (Login / Signup / Recovery)](#feature-7--auth-system-login--signup--recovery)
   - [Feature 8 — Interactive Landing Page UI](#feature-8--interactive-landing-page-ui)
   - [Feature 9 — Library Page](#feature-9--library-page)
   - [Feature 10 — Sequence Engine Page (Playlists)](#feature-10--sequence-engine-page-playlists)
   - [Feature 11 — Front-End Sequencer Bridge](#feature-11--front-end-sequencer-bridge)
5. [File-by-File Function Reference](#5-file-by-file-function-reference)
6. [Data Flow Diagram](#6-data-flow-diagram)
7. [Preset System Explained](#7-preset-system-explained)
8. [Tech Stack & Scripts](#8-tech-stack--scripts)
9. [Page Navigation Map](#9-page-navigation-map)

---

## 1. What is Modus?

**Modus** is a full-stack web application that generates **mood-based, transition-aware playlists** from a library of songs. Instead of simply grouping songs by genre or shuffling them randomly, Modus:

- Fetches rich **audio features** (BPM, key, energy, valence, danceability, etc.) for each song from an external API (**FreqBlog**).
- Scores every song against **6 mood presets** (Romantic, Energetic, Thrill, Chill, Feel Good, Melancholic) using weighted formulas.
- **Sequences** eligible songs in the smoothest possible order using the **Camelot Wheel** (harmonic key compatibility), BPM proximity, and timbre matching.
- Presents everything through a **multi-page web UI** with login/auth, a library view, and a live sequencing engine page.

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
│                (persist to JSON flat-file database)             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │  data/music_features.json (served two ways)
         │
         ├──▶ npm run serve  →  json-server  →  GET http://localhost:3001/songs
         │                      (used by js/sequencer.js)
         │
         └──▶ Directly via fetch('./data/music_features.json')
                      (used by library.js and playlists.js)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        FRONT-END (Browser)                      │
│                                                                 │
│  landing.html  ──▶  js/pages/landing.js                        │
│                         (interactive preset UI demo)            │
│                                                                 │
│  login.html    ──▶  js/pages/login.js                           │
│                         (auth forms: login / signup / recover)  │
│                         depends on: js/auth.js                  │
│                                     js/storage.js               │
│                                     js/validation.js            │
│                                                                 │
│  library.html  ──▶  js/pages/library.js                         │
│                         (auth-guarded; loads music_features.json│
│                          via Playlist model; shows playlist card)│
│                         depends on: js/Playlist.js              │
│                                                                 │
│  playlists.html ──▶  js/pages/playlists.js                      │
│                         (full sequence engine UI: song list,    │
│                          algorithm selector, preview panel)     │
│                         depends on: pipeline/PlaylistSequencer  │
│                                     pipeline/thresholds.js      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Application Workflow

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
         upserts into data/music_features.json (atomic write)
              ↓
Step 7:  Run: npm run serve
         json-server exposes http://localhost:3001/songs
```

### Phase 2 — User Journey (Run-Time / Browser)

```
Step 1:  User opens landing.html
         → Interactive preset demo (Focus / Hype / Mellow / Chill)
         → Click "Get Started" or "Launch App" → login.html
              ↓
Step 2:  User signs up or logs in on login.html
         → Auth.signup() / Auth.login() validates via Validator
         → AuthStorage saves user to localStorage, session to sessionStorage
              ↓
Step 3:  Redirect to library.html (session guard enforced)
         → library.js fetches music_features.json directly
         → Playlist.fromJSON() builds a Playlist model with mood score
         → Renders a single playlist card (track count, duration, mood score)
         → Click card → playlists.html
              ↓
Step 4:  playlists.html — the Sequence Engine
         → Left panel: full song list loaded from music_features.json
         → Middle panel: 6 algorithm cards (Romantic, Energetic, Thrill,
           Chill, Feel Good, Melancholic)
         → Click "Generate Sequence" → PlaylistSequencer.getPlaylist()
         → Right panel: ordered sequence with BPM, key, mood score bar
         → Click any seq item → inline song detail card
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
| `runPipeline(songs)` | `feature_extraction.js` | Orchestrates all 3 pipeline steps end-to-end; logs per-track success/failure |
| `bulkGetFeatures(tracks)` | `pipeline/FreqBlogClient.js` | Chunks songs into batches of ≤50, sends POST /bulk, returns raw results |
| `_fetchChunkWithRetry(tracks, attempt)` | `pipeline/FreqBlogClient.js` | Sends one HTTP chunk; retries on HTTP 429 using `Retry-After` header; re-queues tracks still in "processing" state |
| `_mapToSchema(raw)` | `pipeline/FreqBlogClient.js` | Maps raw FreqBlog API fields to the project's standardized schema |
| `_parseKey(keyStr)` | `pipeline/FreqBlogClient.js` | Splits FreqBlog's combined key string (e.g. `"C#-Major"`) into separate `keyName` and `modeName` |
| `_deriveElectronicness(raw)` | `pipeline/FreqBlogClient.js` | Approximates electronicness from genre keywords + energy + danceability |
| `_clamp01(val)` | `pipeline/FreqBlogClient.js` | Clamps any numeric value to the `[0, 1]` range; returns `null` for invalid input |
| `_chunkArray(arr, size)` | `pipeline/FreqBlogClient.js` | Splits a large array into sub-arrays of max `size` elements |
| `_sleep(ms)` | `pipeline/FreqBlogClient.js` | Promise-based delay (used between retries and re-queue waits) |

**Currently loaded songs (20 tracks in `SONGS` array):**

| Artist | Title |
|---|---|
| Ed Sheeran | Perfect |
| John Legend | All of Me |
| Frank Sinatra | Fly Me to the Moon |
| Dua Lipa | Levitating |
| Calvin Harris | Summer |
| Avicii | Wake Me Up |
| Daft Punk | Get Lucky |
| Eminem | Lose Yourself |
| Metallica | Enter Sandman |
| Imagine Dragons | Warriors |
| System of a Down | Chop Suey! |
| Norah Jones | Don't Know Why |
| Jack Johnson | Better Together |
| Bon Iver | Skinny Love |
| Adele | Someone Like You |
| Coldplay | Fix You |
| Radiohead | Creep |
| Johnny Cash | Hurt |
| Pharrell Williams | Happy |
| Mark Ronson ft. Bruno Mars | Uptown Funk |

---

### Feature 2 — Song Data Model & Preset Scoring

**Entry point:** `pipeline/Song.js`

**What it does:**
Every fetched track is instantiated as a `Song` object. The constructor builds three layers of data and immediately computes mood preset scores without any additional API calls.

**Data structure inside a `Song` object:**

```
Song
├── id            (ISRC or generated slug)
├── isrc          (string | null)
├── mbid          (string | null)
├── name          (string)
├── artist        (string)
├── album         (string | null)
├── release_date  (string | null)
├── duration_ms   (number | null)
├── genre         (string | null)
├── fetched_at    (ISO timestamp)
│
├── features
│   ├── Theme
│   │   ├── happiness      (valence)
│   │   ├── sadness        (1 − valence)
│   │   ├── aggression     (energy from API)
│   │   ├── party          (danceability proxy)
│   │   ├── acousticness
│   │   └── danceability
│   ├── Transition
│   │   ├── bpm            (tempo)
│   │   ├── key            (e.g. "C#")
│   │   ├── mode           ("major" | "minor")
│   │   ├── loudness       (LUFS float)
│   │   └── timbre         ("bright" | "dark" | null)
│   └── Texture
│       ├── vocalness      (1 − instrumentalness)
│       ├── instrumentalness
│       ├── electronicness (derived)
│       └── energy         (computed composite)
│
└── presets
    ├── romantic    (0.0 – 1.0)
    ├── energetic   (0.0 – 1.0)
    ├── thrill      (0.0 – 1.0)
    ├── chill       (0.0 – 1.0)
    ├── feel_good   (0.0 – 1.0)
    └── melancholic (0.0 – 1.0)
```

**Functions involved:**

| Function | What it does |
|---|---|
| `constructor(result)` | Initializes all three layers; calls `_computeEnergy()` and `_computePresets()` |
| `_computeEnergy(result)` | Derives `energy` score: `aggression×0.35 + danceability×0.25 + electronicness×0.20 + loudnessScore×0.20`. Normalizes loudness from LUFS using `(x+30)/30` |
| `_computePresets()` | Computes all 6 preset scores using `_score()` for each preset's weighted formula |
| `_score(pairs)` | Weighted average of `[value, weight]` pairs; gracefully skips `null` values and redistributes weight; returns `null` only if all inputs are null |
| `_bpmScore(bpm, min, max)` | Normalizes a BPM value to `[0,1]` for a given target range (used by "Energetic" preset, target 120–180 BPM) |
| `_bpmSlowScore(bpm)` | Inverted BPM score: returns `1.0` at 60 BPM → `0.0` at 120+ BPM (used by "Chill" preset) |
| `toJSON()` | Serializes the Song to a plain object suitable for JSON storage; strips class methods |
| `_round(val)` *(module-level)* | Rounds to 4 decimal places for consistent precision |
| `_inv(val)` *(module-level)* | Computes `1 - val` (inversion) for derived features like `sadness` |
| `_generateId(result)` *(module-level)* | Generates a slug-style fallback ID from `artist-title` when ISRC is missing |

**Preset Score Formulas:**

| Preset | Formula (weighted features) |
|---|---|
| **Romantic** | happiness×0.30 + acousticness×0.25 + vocalness×0.20 + (1−aggression)×0.15 + (1−electronicness)×0.10 |
| **Energetic** | energy×0.35 + danceability×0.25 + electronicness×0.20 + aggression×0.10 + bpmScore(120–180)×0.10 |
| **Thrill** | aggression×0.35 + energy×0.30 + (1−happiness)×0.20 + electronicness×0.15 |
| **Chill** | (1−energy)×0.30 + acousticness×0.25 + (1−aggression)×0.20 + (1−danceability)×0.15 + bpmSlowScore×0.10 |
| **Feel Good** | happiness×0.35 + party×0.25 + danceability×0.25 + energy×0.15 |
| **Melancholic** | sadness×0.35 + acousticness×0.20 + vocalness×0.20 + (1−energy)×0.15 + (1−party)×0.10 |

---

### Feature 3 — Persistent Song Database

**Entry point:** `pipeline/SongStore.js`

**What it does:**
Manages reading and writing of `data/music_features.json` — the local flat-file database of all processed songs. Designed to be **json-server compatible** so the same file can be served as a REST API.

The file format is:
```json
{
  "songs": [ ...Song.toJSON() ]
}
```

**Functions involved:**

| Function | What it does |
|---|---|
| `load()` | Reads `data/music_features.json` from disk (lazy-loaded); creates the file and `data/` directory if they don't exist; parses JSON safely; returns `this` for chaining |
| `add(song)` | Upserts a song by its `id` — if a song with the same `id` exists it is replaced, otherwise it is appended (prevents duplicates on re-runs) |
| `save()` | Writes the in-memory songs array back to disk using an **atomic write** pattern: write to `.tmp` file first, then rename; falls back to direct write if rename fails (Windows compat) |
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

| Preset | Minimum Score | Meaning |
|---|---|---|
| Romantic | 0.57 | Song must score ≥ 57% on romantic formula |
| Energetic | 0.58 | Song must score ≥ 58% on energetic formula |
| Thrill | 0.55 | Song must score ≥ 55% on thrill formula |
| Chill | 0.57 | Song must score ≥ 57% on chill formula |
| Feel Good | 0.60 | Song must score ≥ 60% on feel_good formula |
| Melancholic | 0.55 | Song must score ≥ 55% on melancholic formula |

**Functions involved:**

| Function | File | What it does |
|---|---|---|
| `PRESET_THRESHOLDS` | `thresholds.js` | Exported constant object with min score per preset |
| `getQualifyingPresets(song)` | `thresholds.js` | Returns an array of preset names the given song qualifies for |
| `getPlaylist(preset)` | `PlaylistSequencer.js` | Filters songs by threshold for a given preset, then passes eligible songs to `_sequence()` |
| `getAllPlaylists()` | `PlaylistSequencer.js` | Calls `getPlaylist()` for all 6 presets; returns `{ presetName → orderedSongArray }` |

---

### Feature 5 — Transition-Aware Playlist Sequencing

**Entry point:** `pipeline/PlaylistSequencer.js`

**What it does:**
Takes a filtered set of eligible songs and orders them for the **smoothest listening experience** using a greedy nearest-neighbor algorithm.

**Algorithm:**
1. **Seed**: Sort eligible songs by preset score descending. Pick the top scorer as the first track.
2. **Greedy step**: Score all unplaced candidates against the current track using `_transitionScore()`. Pick the best.
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
| `constructor(songs)` | Accepts array of Song JSON objects; stores as `this.songs` |
| `getPlaylist(preset)` | Filters by `PRESET_THRESHOLDS[preset]`, then calls `_sequence()` |
| `getAllPlaylists()` | Calls `getPlaylist()` for all 6 presets via `Object.fromEntries`; returns full map |
| `_sequence(songs, preset)` | Greedy nearest-neighbor algorithm; seeds from highest preset-scorer |
| `_transitionScore(from, to, preset)` | Composite transition score between two consecutive songs |
| `_keyCompat(a, b)` | Converts both songs to Camelot wheel notation and scores harmonic compatibility |
| `_bpmCompat(a, b)` | `1 - min(1, |bpmA - bpmB| / 60)`. Returns 0.70 if either BPM is missing |
| `_timbreCompat(a, b)` | Same timbre = 1.0, different = 0.35, missing = neutral 0.70 |
| `_toCamelot(keyStr, modeStr)` | Converts a standard music key to Camelot wheel `{ num, letter }` via full 24-key lookup table |

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

### Feature 6 — Playlist Model (Front-End)

**Entry point:** `js/Playlist.js`

**What it does:**
A front-end ES Module class that wraps an array of raw song objects (from `music_features.json`) into a structured playlist with computed display properties. Used by `library.js` to render playlist cards.

**Constructor options:**

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | string | — | Unique playlist identifier |
| `name` | string | — | Display name |
| `description` | string | `''` | Short description text |
| `coverImage` | string | `''` | URL of cover art |
| `moodScore` | number | `0` | Aggregate mood score (0–100) |
| `tags` | string[] | `[]` | Display tags (e.g. `['Focus', 'Ambient']`) |
| `songs` | object[] | `[]` | Raw song objects from JSON |

**Functions / Getters involved:**

| Member | Type | What it does |
|---|---|---|
| `trackCount` | getter | Returns `this.songs.length` |
| `totalDurationMs` | getter | Sums `duration_ms` across all songs |
| `totalDurationLabel` | getter | Formats total duration as `"1h 12m"` or `"45m"` |
| `Playlist.fromJSON(data, meta)` | static method | Builds a `Playlist` from the raw `music_features.json` shape `{ songs: [...] }`. Derives `moodScore` as the mean of each song's `romantic ?? feel_good` preset score × 100 |

**`fromJSON` mood score derivation:**
```js
moodScore = Math.round(
    songs.reduce((sum, s) => sum + Number(s.presets?.romantic ?? s.presets?.feel_good ?? 0), 0)
    / songs.length * 100
)
```

---

### Feature 7 — Auth System (Login / Signup / Recovery)

**Entry points:** `js/auth.js`, `js/storage.js`, `js/validation.js`

These three modules are loaded as classic browser scripts (non-module) and work together as a layered auth stack.

---

#### `js/validation.js` — `Validator` (IIFE)

Pure validation logic with no side effects.

| Function | What it does |
|---|---|
| `validateEmail(email)` | RFC 5322 simplified regex check; returns error string or `null` |
| `validateUsername(username)` | 3–20 chars, letters/numbers/underscores only; returns error string or `null` |
| `validatePassword(password)` | Min 8 chars, requires uppercase letter and digit; returns error string or `null` |
| `passwordStrength(password)` | Returns a score 0–4 (length ≥8, uppercase, digit, special char) |
| `validateLogin({ identifier, password })` | Returns `{ identifier?, password? }` errors object |
| `validateSignup({ username, email, password, confirmPassword })` | Validates all signup fields; checks password match |
| `validateForgotPassword({ email })` | Validates email only; returns errors object |

---

#### `js/storage.js` — `AuthStorage` (IIFE)

Manages persistence using browser storage APIs.

| Storage | Key | Content | Lifetime |
|---|---|---|---|
| `localStorage` | `modus_users` | JSON array of all user records | Permanent |
| `sessionStorage` | `modus_session` | `{ id, username, email }` of current user | Tab lifetime |

| Function | What it does |
|---|---|
| `getUsers()` | Reads and parses `modus_users` from `localStorage`; returns `[]` on error |
| `saveUsers(users)` | Serializes and writes users array back to `localStorage` |
| `findUser(identifier)` | Looks up a user by email or username (case-insensitive) |
| `isEmailTaken(email)` | Returns `true` if email is already registered |
| `isUsernameTaken(username)` | Returns `true` if username is already registered |
| `addUser({ username, email, password })` | Creates a new user record with `id: 'usr_' + Date.now().toString(36)` and `createdAt` timestamp; appends and saves |
| `setSession(user)` | Writes `{ id, username, email }` to `sessionStorage` (strips password) |
| `getSession()` | Returns the current session object or `null` |
| `clearSession()` | Removes `modus_session` from `sessionStorage` (used for logout) |

> **Note:** Passwords are stored in plain text — intentional for this browser-only demo. A real backend with hashing is listed in the roadmap.

---

#### `js/auth.js` — `Auth` (IIFE)

Business logic layer. Depends on `Validator` and `AuthStorage` being loaded first.

| Function | Returns on success | Throws on failure |
|---|---|---|
| `login({ identifier, password })` | `{ user }` | `Error` with `.fields` map for field-level UI errors |
| `signup({ username, email, password, confirmPassword })` | `{ user, message }` | `Error` with `.fields` map |
| `recoverPassword({ email })` | `{ message }` | `Error` with `.fields` map |

**`login()` steps:**
1. Basic field validation via `Validator.validateLogin()`
2. Look up account via `AuthStorage.findUser()`
3. Plain-text password comparison
4. Start session via `AuthStorage.setSession()`

**`signup()` steps:**
1. Full field validation via `Validator.validateSignup()`
2. Duplicate username check via `AuthStorage.isUsernameTaken()`
3. Duplicate email check via `AuthStorage.isEmailTaken()`
4. Create and save user via `AuthStorage.addUser()`

---

### Feature 8 — Interactive Landing Page UI

**Entry point:** `landing.html` + `js/pages/landing.js`

**What it does:**
The main public-facing home page. Contains a fixed navbar, a hero section, and a live **interactive Mood Sequencer** demo with 4 preset cards.

**Presets defined in the landing demo (these are UI demos, not the pipeline's 6 presets):**

| Preset | Badge Color | Sample Tracks |
|---|---|---|
| **Focus** | `bg-secondary` | Synaptic Resonance (112 BPM), Deep Monolith (106 BPM) |
| **Hype** | `bg-error` (red) | Overdrive Riot (142 BPM), Subsonic Velocity (138 BPM) |
| **Mellow** | `bg-primary` | Midnight Drift (85 BPM), Echoes of Slate (72 BPM) |
| **Chill** | `bg-tertiary` | Velvet Horizon (64 BPM), Astral Drift (58 BPM) |

**UI Sections:**
- **Navbar** — Fixed top bar with logo and "Get Started" CTA (→ `login.html`)
- **Hero Section** — Title, tagline, "Launch App" CTA and "Learn More" scroll button
- **Mood Sequencer Demo** — 4 interactive preset cards + 2 animated track rows
- **Footer** — Navigation links + copyright

**Functions involved:**

| Function | What it does |
|---|---|
| `selectPreset(presetId)` | Master controller: removes/adds inactive/active CSS classes on all buttons, updates badge text and color, calls `updateTracklist()` |
| `updateTracklist(preset)` | Two-phase animation: (1) adds `track-swap-out` class on all track items; (2) after 150ms timeout swaps title/artist/BPM/meter fill/hover color and adds `track-swap-in`; (3) after 300ms cleans up animation class |
| `getPresetFromClasses(element)` | Fallback detector — reads CSS class names when `data-preset` attribute is absent |
| `initPlaybackControls()` | Attaches click listeners to each track's play box; toggles between `play_arrow` and `pause` icons; enforces single-track "playing" state |

**Event Bindings:**

| Trigger | Action |
|---|---|
| Preset card click | Reads `data-preset` → calls `selectPreset()` |
| Badge click | Cycles to next preset (wraps using `PRESET_KEYS` array modulo) |
| `.hero-btn-primary` / `.navbar-cta-btn` click | `window.location.href = 'login.html'` |
| `.hero-btn-secondary` click | Smooth-scrolls to `.sequencer-section` |

**CSS animation classes used:**

| Class | Effect |
|---|---|
| `track-swap-out` | Fades/slides track out |
| `track-swap-in` | Fades/slides track in |
| `sequencer-preset-card-active` | Active state highlight on selected preset |
| `shadow-brutal` / `shadow-brutal-lg` | Neobrutalist drop shadow (inactive vs active) |

**Initialization:** `initPlaybackControls()` then `selectPreset('mellow')` — page defaults to Mellow preset.

---

### Feature 9 — Library Page

**Entry point:** `library.html` + `js/pages/library.js`

**What it does:**
The auth-guarded landing page after login. Fetches `data/music_features.json` directly (no json-server needed), builds a `Playlist` model, and renders a single clickable playlist card.

**Auth Guard:**
An immediately invoked function at the top of `library.js` reads `sessionStorage['modus_session']`. If no session exists, it immediately redirects to `login.html`.

**Functions involved:**

| Function | What it does |
|---|---|
| `init()` | `async` — fetches `./data/music_features.json`, builds `Playlist.fromJSON(data, meta)`, calls `renderCard()` |
| `renderCard(playlist)` | Creates an `<article>` DOM element with: cover image, mood score badge, track count, total duration (via `Playlist` getters), tags, description; attaches click + keydown handlers to navigate to `playlists.html` |

**Filter buttons** are wired for visual toggle only (no filtering logic implemented yet).

**Logout button** clears `modus_session` from `sessionStorage` and redirects to `login.html`.

---

### Feature 10 — Sequence Engine Page (Playlists)

**Entry point:** `playlists.html` + `js/pages/playlists.js`

**What it does:**
The core application view. A three-panel layout that allows users to browse their song library, choose a mood algorithm, and generate a transition-smoothed sequence in real time.

**Three-Panel Layout:**

| Panel | Content |
|---|---|
| **Left — Source Panel** | Full song list loaded from `music_features.json`. Each item shows name, artist, BPM. Click to show song detail in right panel. |
| **Middle — Engine Panel** | 6 algorithm cards (Romantic, Energetic, Thrill, Chill, Feel Good, Melancholic). One is active at a time. "Generate Sequence" button. |
| **Right — Preview Panel** | Shows either a selected song's detail view or the generated sequence. |

**Functions involved:**

| Function | What it does |
|---|---|
| `loadSongs()` | `async` — fetches `./data/music_features.json` directly; populates `songs` array; calls `displaySongs()` and `updateSourceHeader()` |
| `displaySongs()` | Renders each song as a `.song-item` div (name, artist, BPM) in the left panel; click selects and calls `showSongPreview()` |
| `showSongPreview(song)` | Renders a "now playing" card + song stats (BPM, duration, genre, key) + energy/danceability/happiness bars in the right panel |
| `updateSourceHeader()` | Computes and displays total track count and total duration of loaded library |
| `generateSequence()` | Instantiates `new PlaylistSequencer(songs)`, calls `getPlaylist(selectedAlgorithm)`, calls `displaySequence()` |
| `displaySequence(sequence)` | Renders the sequence in the right panel: header card (preset badge, seed song, total tracks/duration, min score threshold), then a scrollable list of sequence items |
| `showSongPreviewInline(song, itemEl)` | Inserts a `.seq-detail-card` immediately after a clicked sequence item; shows album, release date, duration, genre, energy, danceability, happiness |

**Algorithm selection:** clicking an `.algorithm-card` reads its text content, lowercases and underscores it (`feel good` → `feel_good`), stores in `selectedAlgorithm`. Default is `"romantic"`.

**Sequence item display fields:** track number (padded), song name, artist, mood score bar (width = score%), BPM, key + mode, score percentage.

**Empty state:** if no songs qualify for the selected preset (all below threshold), renders a "NO SONGS QUALIFY" message with the threshold percentage.

**Export button:** placeholder — shows `alert('Export to Library functionality coming soon!')`.

**Logout:** clears `modus_session` and redirects to `login.html`.

---

### Feature 11 — Front-End Sequencer Bridge

**Entry point:** `js/sequencer.js`

**What it does:**
A lightweight ES Module that bridges json-server with `PlaylistSequencer`. Used when songs are served over HTTP rather than fetched directly from the file system.

| Function | What it does |
|---|---|
| `getSequencedPlaylists()` | `async` — fetches all songs from `http://localhost:3001/songs` (json-server), instantiates `new PlaylistSequencer(songs)`, calls `getAllPlaylists()`, returns the full map of `{ presetName → orderedSongArray }`. Returns `null` on network error. |

> **Note:** `playlists.js` currently fetches `music_features.json` directly (bypasses json-server). `js/sequencer.js` exists as a reusable module for any page that needs json-server-backed playlists.

---

## 5. File-by-File Function Reference

### `feature_extraction.js` — Pipeline Entry Point
| Function | Purpose |
|---|---|
| `runPipeline(songs)` | Main async function: runs steps 1–3 (fetch → build → save), logs per-song results and final summary |

### `pipeline/FreqBlogClient.js` — API Client
| Function | Purpose |
|---|---|
| `bulkGetFeatures(tracks)` | Public: chunks tracks, processes each chunk sequentially, returns all results |
| `_fetchChunkWithRetry(tracks, attempt)` | Internal: POSTs to FreqBlog `/bulk`, handles 429/errors, re-queues processing items |
| `_mapToSchema(raw)` | Internal: normalizes raw API response to project schema |
| `_parseKey(keyStr)` | Internal: splits `"C#-Major"` → `{ keyName: "C#", modeName: "major" }` |
| `_deriveElectronicness(raw)` | Internal: estimates electronicness from genre + energy/danceability |
| `_clamp01(val)` | Internal: clamps to `[0,1]`, null-safe |
| `_chunkArray(arr, size)` | Internal: splits array into chunks of `size` |
| `_sleep(ms)` | Internal: async delay |

### `pipeline/Song.js` — Data Model
| Function | Purpose |
|---|---|
| `constructor(result)` | Builds all 3 data layers |
| `_computeEnergy(result)` | Calculates composite energy score; requires all 4 inputs to be non-null |
| `_computePresets()` | Calculates all 6 preset scores |
| `_score(pairs)` | Null-safe weighted average; redistributes weight for missing values |
| `_bpmScore(bpm, min, max)` | BPM → score for fast target range (120–180) |
| `_bpmSlowScore(bpm)` | BPM → score for slow target range (1.0 at 60, 0.0 at 120+) |
| `toJSON()` | Serializes to plain JSON-safe object (no class methods) |
| `_round(val)` *(module)* | 4 decimal place rounding |
| `_inv(val)` *(module)* | `1 - val` inversion, null-safe |
| `_generateId(result)` *(module)* | Slug fallback ID from `artist-title` |

### `pipeline/SongStore.js` — Database
| Function | Purpose |
|---|---|
| `load()` | Load/create `music_features.json`; returns `this` |
| `add(song)` | Upsert song by ID; returns `this` |
| `save()` | Atomic write back to disk (`.tmp` → rename); returns `this` |
| `getAll()` | Return shallow copy of all songs |
| `findById(id)` | Find one song by ID |
| `size` *(getter)* | Song count |
| `_assertLoaded()` | Guard: throws if `load()` not called |
| `_ensureDir(filePath)` *(module)* | Create parent directory if missing |

### `pipeline/PlaylistSequencer.js` — Sequencing Engine
| Function | Purpose |
|---|---|
| `constructor(songs)` | Accepts raw Song JSON array |
| `getPlaylist(preset)` | Filter by threshold + sequence songs for one preset |
| `getAllPlaylists()` | All 6 playlists via `Object.fromEntries` |
| `_sequence(songs, preset)` | Greedy nearest-neighbor ordering |
| `_transitionScore(from, to, preset)` | Composite score for a song-pair transition |
| `_keyCompat(a, b)` | Camelot wheel harmonic compatibility |
| `_bpmCompat(a, b)` | BPM closeness score |
| `_timbreCompat(a, b)` | Timbre label match score |
| `_toCamelot(keyStr, modeStr)` | Key + mode → Camelot `{ num, letter }` |

### `pipeline/thresholds.js` — Quality Gates
| Export | Purpose |
|---|---|
| `PRESET_THRESHOLDS` | Min score map per preset |
| `getQualifyingPresets(song)` | List of presets a song qualifies for |

### `js/Playlist.js` — Front-End Playlist Model
| Member | Purpose |
|---|---|
| `constructor(opts)` | Stores id, name, description, coverImage, moodScore, tags, songs |
| `trackCount` *(getter)* | `songs.length` |
| `totalDurationMs` *(getter)* | Sum of all `duration_ms` |
| `totalDurationLabel` *(getter)* | `"Xh Ym"` or `"Ym"` format |
| `Playlist.fromJSON(data, meta)` | Static factory from raw JSON data |

### `js/validation.js` — `Validator` (IIFE)
| Function | Purpose |
|---|---|
| `validateEmail(email)` | Email format check |
| `validateUsername(username)` | 3–20 chars, alphanumeric + underscore |
| `validatePassword(password)` | Min 8 chars, 1 uppercase, 1 digit |
| `passwordStrength(password)` | Score 0–4 |
| `validateLogin(fields)` | Login form errors object |
| `validateSignup(fields)` | Signup form errors object |
| `validateForgotPassword(fields)` | Forgot password errors object |

### `js/storage.js` — `AuthStorage` (IIFE)
| Function | Purpose |
|---|---|
| `getUsers()` | Read all users from `localStorage` |
| `saveUsers(users)` | Write users array to `localStorage` |
| `findUser(identifier)` | Find by email or username |
| `isEmailTaken(email)` | Duplicate email check |
| `isUsernameTaken(username)` | Duplicate username check |
| `addUser(fields)` | Create + save new user |
| `setSession(user)` | Write safe session to `sessionStorage` |
| `getSession()` | Read session or return `null` |
| `clearSession()` | Remove session (logout) |

### `js/auth.js` — `Auth` (IIFE)
| Function | Purpose |
|---|---|
| `login({ identifier, password })` | Validate → find → check password → set session |
| `signup({ username, email, password, confirmPassword })` | Validate → check duplicates → create user |
| `recoverPassword({ email })` | Validate → check email exists → return message |

### `js/sequencer.js` — Front-End Sequencer Bridge
| Function | Purpose |
|---|---|
| `getSequencedPlaylists()` | Fetch from json-server → sequence → return all 6 playlists |

### `js/pages/landing.js` — Landing Page Controller
| Function | Purpose |
|---|---|
| `selectPreset(presetId)` | Switch active preset + update all UI elements |
| `updateTracklist(preset)` | Animate track list swap (fade out → swap → fade in) |
| `getPresetFromClasses(element)` | Detect preset from CSS class names |
| `initPlaybackControls()` | Wire up play/pause button interactivity |

### `js/pages/library.js` — Library Page Controller
| Function | Purpose |
|---|---|
| *(IIFE auth guard)* | Session check → redirect if not logged in |
| `init()` | Fetch JSON → build Playlist → render card |
| `renderCard(playlist)` | Build and append playlist card article with all data fields |

### `js/pages/playlists.js` — Sequence Engine Controller
| Function | Purpose |
|---|---|
| `loadSongs()` | Fetch songs from JSON file → display → update header |
| `displaySongs()` | Render all songs in left panel |
| `showSongPreview(song)` | Show selected song detail in right panel |
| `updateSourceHeader()` | Compute + display track count and total duration |
| `generateSequence()` | Run PlaylistSequencer and show result |
| `displaySequence(sequence)` | Render sequenced playlist in right panel with score bars |
| `showSongPreviewInline(song, itemEl)` | Insert inline detail card after clicked sequence item |
| `getPresetScore(song)` | Helper: returns `song.presets[selectedAlgorithm]` |

---

## 6. Data Flow Diagram

```
Developer Input (SONGS array in feature_extraction.js)
         │
         ▼
feature_extraction.js  ::  runPipeline()
         │
         ├──▶ FreqBlogClient  ::  bulkGetFeatures()
         │         │
         │         ├──▶ _chunkArray()          (split into ≤50 per batch)
         │         ├──▶ _fetchChunkWithRetry() (POST /bulk with retry on 429)
         │         ├──▶ _mapToSchema()         (normalize field names)
         │         ├──▶ _parseKey()            ("C#-Major" → key + mode)
         │         ├──▶ _deriveElectronicness()(genre + energy heuristic)
         │         └──▶ returns [{query, result}, ...]
         │
         ├──▶ new Song(result)
         │         │
         │         ├──▶ Layer 1: identity fields (name, artist, isrc, ...)
         │         ├──▶ Layer 2: features
         │         │       ├── happiness  = valence
         │         │       ├── sadness    = 1 - valence
         │         │       ├── vocalness  = 1 - instrumentalness
         │         │       └── energy     = _computeEnergy()
         │         ├──▶ Layer 3: _computePresets()
         │         │       └── _score([feature, weight], ...)  ×6 presets
         │         └──▶ song.toJSON()  →  plain object
         │
         └──▶ SongStore  ::  load() → add() → save()
                   └──▶ data/music_features.json (atomic write)


data/music_features.json
         │
         ├──▶ (Path A) npm run serve → json-server
         │         └──▶ GET http://localhost:3001/songs
         │                   └──▶ js/sequencer.js :: getSequencedPlaylists()
         │                             └──▶ PlaylistSequencer → all 6 playlists
         │
         └──▶ (Path B) fetch('./data/music_features.json') [direct]
                   │
                   ├──▶ library.js :: init()
                   │       └──▶ Playlist.fromJSON() → playlist card UI
                   │
                   └──▶ playlists.js :: loadSongs()
                             ├──▶ displaySongs()  → left panel
                             └──▶ generateSequence()
                                       └──▶ new PlaylistSequencer(songs)
                                                 │
                                                 ├──▶ getPlaylist(selectedAlgorithm)
                                                 │       ├── filter by PRESET_THRESHOLDS
                                                 │       └── _sequence()
                                                 │             ├── seed: highest preset scorer
                                                 │             └── greedy: _transitionScore()
                                                 │                   ├── _keyCompat()  (Camelot)
                                                 │                   ├── _bpmCompat()  (BPM delta)
                                                 │                   └── _timbreCompat()
                                                 │
                                                 └──▶ displaySequence() → right panel


User Authentication Flow
         │
         ▼
login.html  ::  js/pages/login.js
         │         │
         │         ├──▶ Login form  → Auth.login()
         │         │       ├── Validator.validateLogin()
         │         │       ├── AuthStorage.findUser()
         │         │       └── AuthStorage.setSession() → sessionStorage
         │         │
         │         └──▶ Signup form → Auth.signup()
         │                 ├── Validator.validateSignup()
         │                 ├── AuthStorage.isUsernameTaken()
         │                 ├── AuthStorage.isEmailTaken()
         │                 └── AuthStorage.addUser() → localStorage
         │
         └──▶ library.html (session guard → redirect if no session)
                   └──▶ playlists.html (click playlist card)
```

---

## 7. Preset System Explained

Each song gets a score from `0.0` to `1.0` for each of the 6 mood presets. A song can qualify for **multiple presets** if it meets the minimum threshold for each.

### How Preset Scores Work

1. Raw audio features (e.g. `valence = 0.82`, `acousticness = 0.65`) are fetched from FreqBlog.
2. Some features are **derived**: `sadness = 1 - valence`, `vocalness = 1 - instrumentalness`.
3. Each preset has a **weighted formula** that combines relevant features into a single `0–1` score.
4. If a feature is `null` (missing from API), `_score()` redistributes its weight to present features — ensuring partial data still produces a valid score.
5. The score is compared against the preset's threshold. Songs above the threshold appear in that preset's playlist.
6. Songs are then **sequenced** by the greedy nearest-neighbor algorithm, not just sorted by score.

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
| Runtime | Node.js (ESM) | Pipeline execution (`feature_extraction.js`) |
| HTTP | Native `fetch` API | FreqBlog API calls (Node) + data loading (Browser) |
| Config | `dotenv` | Loads `FREQBLOG_API_KEY` from `.env` |
| Mock Server | `json-server` | Serves `music_features.json` as REST API on port 3001 |
| Front-End | Vanilla HTML + CSS + JS | All pages — no framework |
| Fonts | Google Fonts (Space Grotesk, Inter) | Typography |
| Icons | Material Symbols Outlined | UI icons across all pages |
| Auth Persistence | `localStorage` + `sessionStorage` | User accounts + session management |

### NPM Scripts

| Command | What it does |
|---|---|
| `npm run extract` | Runs `feature_extraction.js` — fetches audio features and populates `data/music_features.json` |
| `npm run serve` | Starts json-server on port 3001 — serves `data/music_features.json` as `GET /songs` |

### Environment Variables (`.env`)

| Variable | Purpose |
|---|---|
| `FREQBLOG_API_KEY` | API key for the FreqBlog audio features service (required for `npm run extract`) |

---

## 9. Page Navigation Map

```
landing.html
  → "Get Started" / "Launch App" ──────────────────────→ login.html
                                                               │
                                                    Login / Signup
                                                               │
                                                               ▼
                                                          library.html
                                                    (auth-guarded)
                                                               │
                                                    Click playlist card
                                                               │
                                                               ▼
                                                         playlists.html
                                                    (sequence engine)
                                                               │
                                                    Logout button
                                                               │
                                                               ▼
                                                          login.html
```

### Pages & Their Roles

| File | Route | Auth Required | Purpose |
|---|---|---|---|
| `landing.html` | `/` | No | Public home page with interactive preset demo |
| `login.html` | `/login.html` | No | Login / Signup / Forgot Password |
| `library.html` | `/library.html` | **Yes** | Post-login library — shows playlist cards |
| `playlists.html` | `/playlists.html` | **Yes** | Sequence engine — browse, select algorithm, generate |

### CSS Files

| File | Styles |
|---|---|
| `css/landing.css` | Bauhaus design system: tokens, typography, grid, navbar, hero, sequencer, footer |
| `css/login.css` | Login/signup form layout, input states, tab switching, password strength meter |
| `css/library.css` | Library grid, card layout, filter buttons, brutalist styling |
| `css/playlists.css` | Three-panel layout, song items, algorithm cards, sequence list, detail cards |

### Test & Reference Files (`tests/`)

| File | Purpose |
|---|---|
| `tests/fetching_data.js` | Original audio feature fetching prototype (reference implementation) |
| `tests/landing_proto.html` | Landing page prototype (design reference) |
| `tests/landing_proto.css` | Landing page prototype styles |
| `tests/landing_class_names.md` | CSS class name reference for landing page |
| `tests/tests.html` | Minimal test runner placeholder |

---

*Last updated: 2026-08-24 — Source: `c:\Users\LENOVO\Desktop\University\Sem5\Modus`*
