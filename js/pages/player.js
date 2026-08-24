/**
 * Modus - Player Page Controller
 * Reads the queue from sessionStorage['modus_player_queue'] and drives
 * the Now Playing panel, transport controls, progress simulation, and queue list.
 */

// ── Global Mood Palette ──────────────────────────────────────────────────────
const MOOD_COLORS = {
    romantic:    { bg: '#ff6b9d', text: '#1a1a1a' },
    energetic:   { bg: '#ff5c00', text: '#ffffff' },
    thrill:      { bg: '#a855f7', text: '#ffffff' },
    chill:       { bg: '#00cfff', text: '#1a1a1a' },
    feel_good:   { bg: '#ffe600', text: '#1a1a1a' },
    melancholic: { bg: '#7b8cff', text: '#ffffff' },
    mix:         { bg: '#ffcc00', text: '#1a1a1a' },
};

const PANEL_COLORS = {
    romantic:    '#c9316e',
    energetic:   '#c23700',
    thrill:      '#7c22c8',
    chill:       '#0099cc',
    feel_good:   '#c4a800',
    melancholic: '#3a4acc',
    mix:         '#0055ff',
};

function getMoodStyle(keyOrName) {
    const k = String(keyOrName).toLowerCase().replace(/[^a-z0-9]/g, '_');
    for (const [key, val] of Object.entries(MOOD_COLORS)) {
        if (k.includes(key)) return { ...val, key };
    }
    return { bg: '#0055ff', text: '#ffffff', key: 'mix' };
}

function getSongTopMood(song) {
    const presets = ['romantic', 'energetic', 'thrill', 'chill', 'feel_good', 'melancholic'];
    let bestKey = 'feel_good';
    let bestScore = 0;
    presets.forEach(p => {
        const v = Number(song.presets?.[p] ?? 0);
        if (v > bestScore) { bestScore = v; bestKey = p; }
    });
    return { key: bestKey, score: Math.round(bestScore * 100) };
}

// ── Auth Guard ──────────────────────────────────────────────────────────────
(function guardSession() {
    try {
        const session = JSON.parse(sessionStorage.getItem('modus_session'));
        if (!session) window.location.replace('login.html');
    } catch {
        window.location.replace('login.html');
    }
})();

// ── Load Queue ───────────────────────────────────────────────────────────────
let queueData = null;
try {
    const raw = sessionStorage.getItem('modus_player_queue');
    if (raw) queueData = JSON.parse(raw);
} catch (e) {
    console.error('player.js: failed to parse queue', e);
}

if (!queueData || !Array.isArray(queueData.songs) || !queueData.songs.length) {
    // No queue — send back to library
    window.location.replace('library.html');
}

// ── State ────────────────────────────────────────────────────────────────────
const songs        = queueData.songs;
const playlist     = queueData.playlist ?? {};
let currentIndex   = Math.max(0, Math.min(Number(queueData.currentIndex ?? 0), songs.length - 1));
let shuffle        = Boolean(queueData.shuffle ?? false);
let repeat         = queueData.repeat ?? 'off';  // 'off' | 'one' | 'all'
let volume         = Number(queueData.volume ?? 0.75);
let isPlaying      = true;   // auto-play on open
let elapsed        = 0;      // seconds elapsed in current track
let progressTimer  = null;

// ── DOM ──────────────────────────────────────────────────────────────────────
const panelEl        = document.getElementById('now-playing-panel');
const artworkEl      = document.getElementById('player-artwork');
const moodBadgeEl    = document.getElementById('player-mood-badge');
const genreEl        = document.getElementById('player-genre');
const titleEl        = document.getElementById('player-track-title');
const artistEl       = document.getElementById('player-artist');
const elapsedEl      = document.getElementById('player-elapsed');
const totalEl        = document.getElementById('player-total');
const scrubberEl     = document.getElementById('player-scrubber');
const progressFillEl = document.getElementById('player-progress-fill');
const scrubThumbEl   = document.getElementById('player-scrubber-thumb');
const playPauseBtn   = document.getElementById('player-play-pause');
const playIcon       = document.getElementById('player-play-icon');
const skipPrevBtn    = document.getElementById('player-skip-prev');
const skipNextBtn    = document.getElementById('player-skip-next');
const shuffleBtn     = document.getElementById('player-shuffle');
const repeatBtn      = document.getElementById('player-repeat');
const volumeBar      = document.getElementById('player-volume-bar');
const volumeFill     = document.getElementById('player-volume-fill');
const queueListEl    = document.getElementById('queue-list');
const logoutBtn      = document.getElementById('logout-btn');

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(seconds) {
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function currentDurationSec() {
    return Math.floor((Number(songs[currentIndex]?.duration_ms) || 0) / 1000);
}

function saveQueue() {
    try {
        queueData.currentIndex = currentIndex;
        queueData.shuffle = shuffle;
        queueData.repeat  = repeat;
        queueData.volume  = volume;
        sessionStorage.setItem('modus_player_queue', JSON.stringify(queueData));
    } catch (e) {}
}

// ── Render Current Track ─────────────────────────────────────────────────────
function renderTrack() {
    const song = songs[currentIndex];
    if (!song) return;

    const mood = getSongTopMood(song);
    const moodStyle = MOOD_COLORS[mood.key] || MOOD_COLORS.mix;
    const panelColor = PANEL_COLORS[mood.key] || PANEL_COLORS.mix;

    // Panel mood-reactive background
    if (panelEl) panelEl.style.backgroundColor = panelColor;

    // Artwork — use playlist cover (songs have no individual art)
    if (artworkEl) artworkEl.src = playlist.coverImage || artworkEl.src;

    // Mood badge
    if (moodBadgeEl) {
        moodBadgeEl.textContent = `MS: ${mood.score}`;
        moodBadgeEl.style.backgroundColor = moodStyle.bg;
        moodBadgeEl.style.color = moodStyle.text;
    }

    // Genre / tag — use song genre if available, else playlist top mood name
    if (genreEl) {
        const label = song.genre
            ? song.genre.toUpperCase()
            : (playlist.topMood?.name ?? 'Modus').toUpperCase();
        genreEl.textContent = label;
    }

    // Title / Artist
    if (titleEl) titleEl.textContent = (song.name || 'Untitled').toUpperCase();
    if (artistEl) artistEl.textContent = (song.artist || 'Unknown Artist').toUpperCase();

    // Reset elapsed
    elapsed = 0;
    updateProgress();
    renderQueue();
    updateTransportUI();
    saveQueue();
}

// ── Progress ─────────────────────────────────────────────────────────────────
function updateProgress() {
    const dur = currentDurationSec();
    const pct = dur > 0 ? (elapsed / dur) * 100 : 0;

    if (elapsedEl) elapsedEl.textContent = fmtTime(elapsed);
    if (totalEl)   totalEl.textContent   = fmtTime(dur);
    if (progressFillEl) progressFillEl.style.width = `${Math.min(pct, 100)}%`;
    if (scrubThumbEl)   scrubThumbEl.style.left    = `${Math.min(pct, 100)}%`;
}

function startTimer() {
    stopTimer();
    progressTimer = setInterval(() => {
        elapsed++;
        const dur = currentDurationSec();
        if (elapsed >= dur) {
            elapsed = dur;
            updateProgress();
            onTrackEnd();
        } else {
            updateProgress();
        }
    }, 1000);
}

function stopTimer() {
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
}

function onTrackEnd() {
    stopTimer();
    if (repeat === 'one') {
        elapsed = 0;
        if (isPlaying) startTimer();
        return;
    }
    const next = getNextIndex(1);
    if (next === null) {
        isPlaying = false;
        updateTransportUI();
        return;
    }
    currentIndex = next;
    elapsed = 0;
    renderTrack();
    if (isPlaying) startTimer();
}

// ── Navigation Logic ─────────────────────────────────────────────────────────
function getNextIndex(direction) {
    if (shuffle) {
        let idx;
        do { idx = Math.floor(Math.random() * songs.length); }
        while (idx === currentIndex && songs.length > 1);
        return idx;
    }
    const next = currentIndex + direction;
    if (next < 0) {
        return repeat === 'all' ? songs.length - 1 : null;
    }
    if (next >= songs.length) {
        return repeat === 'all' ? 0 : null;
    }
    return next;
}

// ── Transport Controls ───────────────────────────────────────────────────────
function updateTransportUI() {
    // Play / Pause icon
    if (playIcon) playIcon.textContent = isPlaying ? 'pause' : 'play_arrow';

    // Shuffle highlight
    if (shuffleBtn) {
        shuffleBtn.classList.toggle('active-toggle', shuffle);
    }

    // Repeat icon & highlight
    if (repeatBtn) {
        const span = repeatBtn.querySelector('.material-symbols-outlined');
        if (span) span.textContent = repeat === 'one' ? 'repeat_one' : 'repeat';
        repeatBtn.classList.toggle('active-toggle', repeat !== 'off');
    }

    // Volume fill
    if (volumeFill) volumeFill.style.width = `${Math.round(volume * 100)}%`;
}

// Play / Pause
if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
        isPlaying = !isPlaying;
        if (isPlaying) {
            startTimer();
        } else {
            stopTimer();
        }
        updateTransportUI();
    });
}

// Skip Next
if (skipNextBtn) {
    skipNextBtn.addEventListener('click', () => {
        const next = getNextIndex(1);
        if (next === null) return;
        currentIndex = next;
        elapsed = 0;
        renderTrack();
        if (isPlaying) startTimer();
    });
}

// Skip Previous — restart if > 3s, else go to previous
if (skipPrevBtn) {
    skipPrevBtn.addEventListener('click', () => {
        if (elapsed > 3) {
            elapsed = 0;
            updateProgress();
            return;
        }
        const prev = getNextIndex(-1);
        if (prev === null) { elapsed = 0; updateProgress(); return; }
        currentIndex = prev;
        elapsed = 0;
        renderTrack();
        if (isPlaying) startTimer();
    });
}

// Shuffle
if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
        shuffle = !shuffle;
        updateTransportUI();
        saveQueue();
    });
}

// Repeat — cycle: off → one → all → off
if (repeatBtn) {
    repeatBtn.addEventListener('click', () => {
        if (repeat === 'off')      repeat = 'one';
        else if (repeat === 'one') repeat = 'all';
        else                       repeat = 'off';
        updateTransportUI();
        saveQueue();
    });
}

// Scrubber click → seek
if (scrubberEl) {
    scrubberEl.addEventListener('click', (e) => {
        const rect = scrubberEl.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        elapsed    = Math.floor(pct * currentDurationSec());
        updateProgress();
    });
}

// Volume click
if (volumeBar) {
    volumeBar.addEventListener('click', (e) => {
        const rect = volumeBar.getBoundingClientRect();
        volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        updateTransportUI();
        saveQueue();
    });
}

// ── Queue Rendering ──────────────────────────────────────────────────────────
function renderQueue() {
    if (!queueListEl) return;
    queueListEl.innerHTML = '';

    songs.forEach((song, idx) => {
        const mood = getSongTopMood(song);
        const moodStyle = MOOD_COLORS[mood.key] || MOOD_COLORS.mix;
        const isCurrent = idx === currentIndex;
        const dur = fmtTime(Math.floor((Number(song.duration_ms) || 0) / 1000));

        const item = document.createElement('div');
        item.className = `queue-item brutal-border-3 p-4 flex justify-between items-start gap-4 ${isCurrent ? 'is-current' : 'bg-white'}`;

        item.innerHTML = `
            <div class="flex items-start gap-4 min-w-0 flex-1">
                <span class="qi-num font-headline font-bold text-xl flex-shrink-0 ${isCurrent ? 'opacity-50' : 'text-on-surface-variant'}">
                    ${isCurrent ? '<span class="material-symbols-outlined text-xl animate-pulse" style="font-variation-settings:\'FILL\' 1;">equalizer</span>' : String(idx + 1).padStart(2, '0')}
                </span>
                <div class="min-w-0 flex-1">
                    <p class="font-headline font-bold text-lg uppercase truncate leading-tight">${song.name || 'Untitled'}</p>
                    <p class="qi-artist font-body text-sm mt-0.5 uppercase truncate ${isCurrent ? '' : 'text-on-surface-variant'}">${song.artist || 'Unknown Artist'}</p>
                </div>
            </div>
            <div class="flex flex-col items-end gap-2 flex-shrink-0">
                <span class="font-headline text-xs px-2 py-1 uppercase font-bold brutal-border-3" style="background-color:${moodStyle.bg};color:${moodStyle.text};">MS: ${mood.score}</span>
                <span class="font-label text-xs font-bold uppercase opacity-70">${dur}</span>
            </div>
        `;

        item.addEventListener('click', () => {
            if (isCurrent) return;
            currentIndex = idx;
            elapsed = 0;
            renderTrack();
            if (isPlaying) startTimer();
        });

        queueListEl.appendChild(item);
    });

    // Scroll current item into view
    const currentItem = queueListEl.children[currentIndex];
    if (currentItem) currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Logout ────────────────────────────────────────────────────────────────────
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('modus_session');
        sessionStorage.removeItem('modus_player_queue');
        sessionStorage.removeItem('modus_selected_playlist');
        window.location.replace('login.html');
    });
}

// ── Boot ─────────────────────────────────────────────────────────────────────
renderTrack();
if (isPlaying) startTimer();
