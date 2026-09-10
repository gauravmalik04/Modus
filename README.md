# Modus 🎵

> **Mood-based, transition-aware music player** — *"Sequence Your Soul"*

🚀 **Live Demo / Deployment:** [https://modus-pearl.vercel.app/](https://modus-pearl.vercel.app/)

Modus is a browser-based music application that generates **mood-aware, harmonically-smooth playlists** from a curated song library. Instead of random shuffle, Modus scores every song against six emotional presets and sequences them using the **Camelot Wheel**, BPM proximity, and timbre matching to create seamless listening journeys.

---

## Table of Contents

1. [How It Works — Big Picture](#1-how-it-works--big-picture)
2. [Project Structure](#2-project-structure)
3. [The Data Pipeline (Back-End)](#3-the-data-pipeline-back-end)
4. [The Mood & Scoring System](#4-the-mood--scoring-system)
5. [The Sequencing Algorithm](#5-the-sequencing-algorithm)
6. [The Front-End Pages](#6-the-front-end-pages)
7. [Auth System](#7-auth-system)
8. [Persistent Storage](#8-persistent-storage)
9. [Tech Stack](#9-tech-stack)
10. [Getting Started](#10-getting-started)

---

## 1. How It Works — Big Picture

Modus is split into two distinct phases:

### Phase 1 — Offline Pipeline (run once by a developer)

```
SONGS array  →  FreqBlog API  →  Song objects  →  music_features.json
```

A Node.js script (`feature_extraction.js`) fetches audio features (BPM, key, valence, energy, etc.) for every song from the **FreqBlog API**. Each track is wrapped into a `Song` object that pre-computes six mood scores. The enriched data is saved to `data/music_features.json`.

### Phase 2 — Live App (runs entirely in the browser)

```
Login  →  Library  →  Playlist View  →  Resequence  →  Player
```

The browser loads `music_features.json` directly (no server needed for playback). The user picks a mood preset, the **PlaylistSequencer** filters and orders songs using the greedy nearest-neighbour algorithm, and the result plays in the built-in player with transport controls, queue management, shuffle, and repeat.

---

## 2. Project Structure

```
modus/
│
├── feature_extraction.js       # Pipeline entry point (Node.js)
│
├── pipeline/                   # Back-end modules (Node.js ESM)
│   ├── FreqBlogClient.js       # API client — bulk-fetches audio features
│   ├── Song.js                 # Data model + mood preset scoring
│   ├── SongStore.js            # JSON flat-file database (read/write)
│   ├── PlaylistSequencer.js    # Greedy nearest-neighbour sequencing engine
│   └── thresholds.js           # Minimum quality thresholds per preset
│
├── data/
│   └── music_features.json     # Persisted song database (pipeline output)
│
├── js/                         # Front-end ES Modules
│   ├── Playlist.js             # Playlist model + topMood / duration getters
│   ├── libraryStore.js         # localStorage store for user-saved playlists
│   ├── auth.js                 # Auth business logic (login / signup / recovery)
│   ├── storage.js              # AuthStorage — users in localStorage, session in sessionStorage
│   ├── validation.js           # Pure form validation (Validator IIFE)
│   ├── sequencer.js            # Front-end sequencer bridge (json-server path)
│   │
│   ├── pages/
│   │   ├── landing.js          # Landing page interactive demo
│   │   ├── login.js            # Login / signup / forgot-password form controller
│   │   ├── library.js          # Auth-guarded library — shows saved playlists
│   │   ├── playlist_view.js    # Playlist detail view + track list + play button
│   │   ├── resequence.js       # Three-panel sequence engine UI
│   │   └── player.js           # Full-screen player with transport controls
│   │
│   └── utils/
│       └── playerLauncher.js   # Shared helper — writes queue to sessionStorage & navigates to player.html
│
├── css/
│   ├── landing.css             # Bauhaus design system + landing page styles
│   ├── login.css               # Login/signup form styles
│   ├── library.css             # Library grid and card styles
│   └── resequence.css          # Three-panel sequence engine styles
│
├── static/
│   ├── logo.png
│   └── hero_image.png
│
├── landing.html                # Public home page
├── login.html                  # Login / signup / forgot password
├── library.html                # Auth-guarded library (post-login home)
├── playlist_view.html          # Playlist detail + track listing
├── resequence.html             # Sequence engine (mood algorithm + preview)
├── player.html                 # Music player with queue
│
├── package.json                # npm scripts: extract, serve
└── .env                        # FREQBLOG_API_KEY (required for pipeline)
```

---

## 3. The Data Pipeline (Back-End)

> **Run once** to populate `data/music_features.json`. Not needed for everyday use.

### Step-by-step

| Step | What happens |
|---|---|
| 1 | Developer adds `{ artist, title }` objects to the `SONGS` array in `feature_extraction.js` |
| 2 | `npm run extract` — Node.js runs `runPipeline()` |
| 3 | `FreqBlogClient.bulkGetFeatures()` chunks songs into batches of ≤ 50 and POSTs to the FreqBlog `/bulk` endpoint |
| 4 | The client retries on HTTP 429 using the `Retry-After` header and re-queues any tracks still in `"processing"` state |
| 5 | Raw API fields are normalized via `_mapToSchema()` — key strings like `"C#-Major"` are split into `keyName` + `modeName` |
| 6 | Each result becomes `new Song(result)`: metadata + audio features + six preset scores computed in the constructor |
| 7 | `SongStore.add()` upserts by song ID, and `SongStore.save()` atomically writes `data/music_features.json` |

### Currently loaded songs (20 tracks)

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

## 4. The Mood & Scoring System

Every song carries a `presets` object with six scores between `0.0` and `1.0`.

### How scores are computed

Raw audio features arrive from FreqBlog (valence, energy, BPM, danceability, acousticness, instrumentalness, loudness, timbre, genre). Some features are derived:

| Derived feature | Formula |
|---|---|
| `sadness` | `1 − valence` |
| `vocalness` | `1 − instrumentalness` |
| `electronicness` | Approximated from genre keywords + energy + danceability |
| `energy` | `aggression×0.35 + danceability×0.25 + electronicness×0.20 + loudnessScore×0.20` |

### Preset formulas

| Preset | Weighted formula |
|---|---|
| **Romantic** | happiness×0.30 + acousticness×0.25 + vocalness×0.20 + (1−aggression)×0.15 + (1−electronicness)×0.10 |
| **Energetic** | energy×0.35 + danceability×0.25 + electronicness×0.20 + aggression×0.10 + bpmScore(120–180)×0.10 |
| **Thrill** | aggression×0.35 + energy×0.30 + (1−happiness)×0.20 + electronicness×0.15 |
| **Chill** | (1−energy)×0.30 + acousticness×0.25 + (1−aggression)×0.20 + (1−danceability)×0.15 + bpmSlowScore×0.10 |
| **Feel Good** | happiness×0.35 + party×0.25 + danceability×0.25 + energy×0.15 |
| **Melancholic** | sadness×0.35 + acousticness×0.20 + vocalness×0.20 + (1−energy)×0.15 + (1−party)×0.10 |

If a feature is `null` (missing from the API), `_score()` redistributes its weight proportionally to the remaining features — so partial data still produces a valid score.

### Minimum quality thresholds

A song only appears in a preset's playlist if its score exceeds the threshold:

| Preset | Min Score |
|---|---|
| Romantic | 0.57 |
| Energetic | 0.58 |
| Thrill | 0.55 |
| Chill | 0.57 |
| Feel Good | 0.60 |
| Melancholic | 0.55 |

---

## 5. The Sequencing Algorithm

`PlaylistSequencer` uses a **greedy nearest-neighbour** approach to order filtered songs for the smoothest listening experience:

1. **Seed** — Sort eligible songs by preset score descending. The top scorer becomes track 1.
2. **Greedy step** — Score every remaining song against the current track using `_transitionScore()`. Pick the best.
3. **Repeat** until all songs are placed.

### Transition score formula

```
transitionScore = keyCompat   × 0.40
               + bpmCompat    × 0.35
               + timbreCompat × 0.15
               + presetScore  × 0.10
```

### Key compatibility (Camelot Wheel)

| Condition | Score |
|---|---|
| Same key & mode | 1.00 |
| Same number, different mode (relative major/minor) | 0.85 |
| Adjacent on wheel, same mode | 0.80 |
| Adjacent on wheel, different mode | 0.60 |
| Distance 2, same mode | 0.55 |
| Distance 2, different mode | 0.40 |
| Distance ≥ 3 | 0.20 |
| Unknown key | 0.65 |

**BPM compatibility:** `1 − min(1, |bpmA − bpmB| / 60)` — songs within 60 BPM of each other score > 0.

**Timbre compatibility:** same timbre label (`"bright"` / `"dark"`) = 1.0, different = 0.35, unknown = 0.70.

---

## 6. The Front-End Pages

The app is a multi-page vanilla HTML/CSS/JS app. All pages share the Bauhaus-inspired design system defined in `css/landing.css`.

### Navigation flow

```
landing.html
    └── "Get Started" ──────────── login.html
                                        │
                                  Login / Signup
                                        │
                                   library.html  ← auth-guarded
                                        │
                               Click playlist card
                                        │
                               playlist_view.html
                                 │           │
                          "Play" button  "Re-Sequence"
                                 │           │
                             player.html  resequence.html
                                                │
                                      "Export to Library"
                                                │
                                           library.html
```

### Page reference

| Page | File | Auth | Description |
|---|---|---|---|
| Landing | `landing.html` | No | Public home with interactive mood preset demo |
| Login | `login.html` | No | Login / signup / forgot password (tab-switching) |
| Library | `library.html` | **Yes** | Shows all saved playlists + the default collection |
| Playlist View | `playlist_view.html` | **Yes** | Playlist artwork, tags, track list, play / re-sequence / delete |
| Resequence | `resequence.html` | **Yes** | Three-panel sequence engine — source songs, algorithm selector, preview |
| Player | `player.html` | **Yes** | Full-screen now-playing panel with scrubber, queue, shuffle, repeat |

### Landing page (`landing.js`)

Interactive mood preset demo with 4 cards (Focus, Hype, Mellow, Chill). Clicking a card animates the track list out, swaps song metadata, and fades the new list in. The badge cycles presets on click. Play/pause buttons are fully interactive (single-track state enforced). CTAs redirect to `login.html`.

### Library page (`library.js`)

Fetches `data/music_features.json`, builds a default `Playlist.fromJSON()` plus any user-saved playlists from `LibraryStore` (localStorage). Clicking a card writes playlist metadata to `sessionStorage['modus_selected_playlist']` and navigates to `playlist_view.html`.

### Playlist view (`playlist_view.js`)

Reads `modus_selected_playlist` from sessionStorage. Renders a hero section (artwork, mood score badge, tags, duration, track count). The track list shows each song's track number, name, artist, mood score bar, and duration. Clicking a row launches the player at that track. The **Re-Sequence** button navigates to `resequence.html`. The **Delete** button removes the playlist from `LibraryStore`.

### Resequence page (`resequence.js`)

Three-panel layout:
- **Left** — Full song list with name, artist, BPM. Click to preview a song's details in the right panel.
- **Middle** — Six mood algorithm cards (Romantic, Energetic, Thrill, Chill, Feel Good, Melancholic). Selecting one updates a CSS `data-preset` attribute for mood-reactive accent colours.
- **Right** — Preview panel: shows either a selected song's detail card or the generated sequence. Clicking a sequence item expands an inline detail card.

The **Export to Library** button opens a modal where the user names the generated playlist. On confirm, `LibraryStore.add()` saves it and it appears in the Library next time.

### Player page (`player.js`)

Reads the queue from `sessionStorage['modus_player_queue']` (written by `playerLauncher.js`). Features:
- Mood-reactive panel colour (changes per song based on its highest preset score)
- Simulated playback progress with a clickable scrubber (seek by clicking)
- Skip previous — restarts the track if > 3 s have elapsed, otherwise goes to previous
- Shuffle (random next track, avoids repeating the same track)
- Repeat: off → repeat one → repeat all → off
- Volume bar (click to set level)
- Scrollable queue list with live "now playing" indicator (`equalizer` icon + highlight)
- Queue state persisted back to sessionStorage on every change

---

## 7. Auth System

Auth is entirely browser-side using three layered IIFE modules loaded as classic `<script>` tags on `login.html`.

```
login.html
    ├── js/validation.js   →  Validator    (pure validation, no side effects)
    ├── js/storage.js      →  AuthStorage  (localStorage / sessionStorage)
    └── js/auth.js         →  Auth         (business logic — depends on the above two)
```

| Flow | Steps |
|---|---|
| **Signup** | Validate all fields → check username & email not taken → `AuthStorage.addUser()` → `AuthStorage.setSession()` |
| **Login** | Validate fields → `AuthStorage.findUser()` → plain-text password check → `AuthStorage.setSession()` |
| **Forgot Password** | Validate email → check account exists → return confirmation message (no actual email sent) |

Session is stored as `{ id, username, email }` in `sessionStorage['modus_session']`. Every auth-guarded page runs an IIFE on load that reads the session and immediately redirects to `login.html` if absent.

> **Note:** Passwords are stored as plain text — intentional for this browser-only demo. Production use would require a real backend with hashing.

---

## 8. Persistent Storage

| Store | Key | Contents | Lifetime |
|---|---|---|---|
| `localStorage` | `modus_users` | Array of all registered user objects | Permanent |
| `localStorage` | `modus_library_playlists` | Array of user-saved / exported playlist objects | Permanent |
| `sessionStorage` | `modus_session` | `{ id, username, email }` of logged-in user | Tab lifetime |
| `sessionStorage` | `modus_selected_playlist` | Metadata of the playlist clicked in the Library | Tab lifetime |
| `sessionStorage` | `modus_player_queue` | `{ songs, currentIndex, shuffle, repeat, volume, playlist }` | Tab lifetime |

---

## 9. Tech Stack

| Category | Technology | Purpose |
|---|---|---|
| Runtime | Node.js (ESM) | Pipeline execution |
| HTTP | Native `fetch` | FreqBlog API calls (Node) + data loading (browser) |
| Config | `dotenv` | Loads `FREQBLOG_API_KEY` from `.env` |
| Mock server | `json-server` | Optionally serves `music_features.json` as REST API on port 3001 |
| Front-end | Vanilla HTML + CSS + JS | All pages — zero framework |
| Fonts | Google Fonts (Space Grotesk, Inter) | Typography |
| Icons | Material Symbols Outlined | UI icons across all pages |
| Auth persistence | `localStorage` + `sessionStorage` | User accounts + session management |

---

## 10. Getting Started

### Prerequisites

- Node.js ≥ 18
- A FreqBlog API key (only needed to re-run the pipeline)

### 1 — Install dependencies

```bash
npm install
```

### 2 — (Optional) Re-run the feature extraction pipeline

Add your `FREQBLOG_API_KEY` to `.env`:

```
FREQBLOG_API_KEY=your_key_here
```

Add songs to the `SONGS` array in `feature_extraction.js`, then run:

```bash
npm run extract
```

This populates / updates `data/music_features.json`.

### 3 — Open the app

Open `landing.html` in a browser via VS Code Live Server or any static file server. No build step is required.

> **Tip:** To use the json-server-backed sequencer bridge (`js/sequencer.js`), run `npm run serve` to expose `http://localhost:3001/songs`.

### 4 — Sign up and explore

1. Click **Get Started** on the landing page → create an account on `login.html`
2. Browse your library → click a playlist card
3. Hit **Play** to open the player, or **Re-Sequence** to choose a mood algorithm and generate a new sequence
4. Export a generated sequence back to your library with a custom name

---

*Last updated: September 2026*
