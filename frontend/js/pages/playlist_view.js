/**
 * Modus - Playlist Detail Page Controller
 *
 * Auth-guarded page that loads the selected playlist and its populated songs
 * from the Express + MongoDB backend using the centralized api.js client.
 */

import { api } from '../api.js';
import { launchPlayer } from '../utils/playerLauncher.js';

// ── Global Mood Palette ──────────────────────────────────────────────────────
export const MOOD_COLORS = {
    romantic:    { bg: '#ff6b9d', text: '#1a1a1a', label: 'Romantic' },
    energetic:   { bg: '#ff5c00', text: '#ffffff', label: 'Energetic' },
    thrill:      { bg: '#a855f7', text: '#ffffff', label: 'Thrill' },
    chill:       { bg: '#00cfff', text: '#1a1a1a', label: 'Chill' },
    feel_good:   { bg: '#ffe600', text: '#1a1a1a', label: 'Feel Good' },
    melancholic: { bg: '#7b8cff', text: '#ffffff', label: 'Melancholic' },
    mix:         { bg: '#ffcc00', text: '#1a1a1a', label: 'Mix' },
};

export function getMoodStyle(keyOrName) {
    const k = String(keyOrName).toLowerCase().replace(/[^a-z0-9]/g, '_');
    for (const [key, val] of Object.entries(MOOD_COLORS)) {
        if (k.includes(key)) return val;
    }
    return { bg: '#d6d1c9', text: '#1a1a1a', label: keyOrName };
}

// ── Auth Guard ──────────────────────────────────────────────────────────────
if (!api.isAuthenticated()) {
    window.location.replace('login.html');
}

// ── Fallback Cover Art ───────────────────────────────────────────────────────
const DEFAULT_COVER = 'static/hero_image.png';

export function resolveCover(url) {
    if (!url || typeof url !== 'string' || url.includes('googleusercontent.com') || url.includes('example.com')) {
        return DEFAULT_COVER;
    }
    return url;
}

// ── DOM Elements ─────────────────────────────────────────────────────────────
const artworkEl     = document.getElementById('playlist-artwork');
const scoreBadgeEl  = document.getElementById('playlist-score-badge');
const moodScoreEl   = document.getElementById('playlist-mood-score');
const titleEl       = document.getElementById('playlist-title');
const descEl        = document.getElementById('playlist-description');
const tagsEl        = document.getElementById('playlist-tags');
const durationEl    = document.getElementById('playlist-duration');
const trackCountEl  = document.getElementById('playlist-tracks');
const engineEl      = document.getElementById('playlist-engine');
const trackListEl   = document.getElementById('track-list');
const playBtn       = document.getElementById('play-btn');
const resequenceBtn = document.getElementById('resequence-btn');
const deleteBtn     = document.getElementById('delete-btn');
const logoutBtn     = document.getElementById('logout-btn');

// ── State ────────────────────────────────────────────────────────────────────
let currentPlaylist = null;
let currentSongs    = [];

// ── Format Duration ──────────────────────────────────────────────────────────
function formatDuration(ms) {
    const totalSeconds = Math.floor((Number(ms) || 0) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatTotalDuration(ms) {
    const totalSeconds = Math.floor((Number(ms) || 0) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// ── Initialize & Load Playlist Data ──────────────────────────────────────────
async function init() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        let playlistId = urlParams.get('id');

        // Check fallback session storage if URL param not passed
        if (!playlistId) {
            try {
                const stored = JSON.parse(sessionStorage.getItem('modus_selected_playlist'));
                if (stored && stored.id && stored.id.length === 24) {
                    playlistId = stored.id;
                }
            } catch (e) {}
        }

        // If still no ID, query user's playlists to pick first
        if (!playlistId) {
            const listData = await api.getPlaylists();
            if (listData.playlists && listData.playlists.length > 0) {
                playlistId = listData.playlists[0]._id;
            } else {
                window.location.replace('library.html');
                return;
            }
        }

        // Fetch populated playlist from backend
        const res = await api.getPlaylist(playlistId);
        currentPlaylist = res.playlist;
        currentSongs    = Array.isArray(res.songs) ? res.songs : (res.playlist.songs || []);

        if (deleteBtn && !currentPlaylist.isDefault) {
            deleteBtn.classList.remove('hidden');
        }

        renderHero(currentPlaylist);
        renderTracks(currentSongs);

    } catch (err) {
        console.error('PlaylistView: failed to load playlist from API:', err);
        if (trackListEl) {
            trackListEl.innerHTML = `
                <div class="p-8 brutal-border bg-surface-container-lowest font-headline font-bold text-center uppercase" style="color: #ff5c00;">
                    Unable to load playlist. ${err.message || ''}
                    <div style="margin-top: 1rem;">
                        <a href="library.html" class="px-4 py-2 brutal-border bg-primary text-surface font-bold uppercase inline-block">Back to Library</a>
                    </div>
                </div>`;
        }
    }
}

// ── Render Hero Section ──────────────────────────────────────────────────────
function renderHero(playlist) {
    const topMood = playlist.topMood || { key: 'mix', name: 'Mix', score: 0 };
    const moodStyle = getMoodStyle(topMood.key || topMood.name);

    if (artworkEl) {
        artworkEl.src = resolveCover(playlist.coverImage);
        artworkEl.onerror = () => {
            artworkEl.onerror = null;
            artworkEl.src = DEFAULT_COVER;
        };
    }

    if (moodScoreEl) {
        moodScoreEl.textContent = `MS: ${topMood.score || 0}`;
    }

    if (scoreBadgeEl) {
        scoreBadgeEl.style.backgroundColor = moodStyle.bg;
        scoreBadgeEl.style.color = moodStyle.text;
    }

    if (titleEl) {
        titleEl.textContent = playlist.name || 'Untitled Playlist';
    }

    if (descEl) {
        descEl.textContent = playlist.description || '';
    }

    if (tagsEl) {
        tagsEl.innerHTML = '';
        const rawTags = Array.isArray(playlist.tags) && playlist.tags.length ? playlist.tags : ['Mix'];
        const displayTags = [...new Set([...rawTags, `${topMood.name} ${topMood.score || 0}`])];

        displayTags.forEach(t => {
            const style = getMoodStyle(t);
            const span = document.createElement('span');
            span.className = 'px-3 py-1 text-xs font-headline font-bold uppercase brutal-border';
            span.style.backgroundColor = style.bg;
            span.style.color = style.text;
            span.textContent = t;
            tagsEl.appendChild(span);
        });
    }

    if (durationEl) {
        durationEl.textContent = formatTotalDuration(playlist.totalDurationMs);
    }

    if (trackCountEl) {
        trackCountEl.textContent = `${playlist.trackCount ?? currentSongs.length} Nodes`;
    }

    if (engineEl) {
        engineEl.textContent = playlist.algorithm ? `Engine: ${playlist.algorithm.toUpperCase()}` : 'v2.4.1';
    }
}

// ── Render Track List ────────────────────────────────────────────────────────
function renderTracks(songs) {
    if (!trackListEl) return;
    trackListEl.innerHTML = '';

    if (!songs || songs.length === 0) {
        trackListEl.innerHTML = `
            <div class="p-8 brutal-border bg-surface-container-lowest font-headline font-bold text-center uppercase">
                No tracks found in this playlist.
            </div>`;
        return;
    }

    const presets = ['romantic', 'energetic', 'thrill', 'chill', 'feel_good', 'melancholic'];

    songs.forEach((song, index) => {
        const row = document.createElement('div');
        const trackNumber = String(index + 1).padStart(2, '0');
        const durationText = formatDuration(song.duration_ms);

        // Find song's highest preset mood
        let bestPreset = 'feel_good';
        let bestScore = 0;
        presets.forEach(p => {
            const val = Number(song.presets?.[p] ?? 0);
            if (val > bestScore) {
                bestScore = val;
                bestPreset = p;
            }
        });

        const songMoodStyle = MOOD_COLORS[bestPreset] || MOOD_COLORS.feel_good;
        const score = Math.round(bestScore * 100);

        row.className = 'grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center p-4 brutal-border bg-surface-container-lowest hover:bg-primary hover:text-surface-container-lowest transition-colors group cursor-pointer relative overflow-hidden';

        row.innerHTML = `
            <div class="w-8 font-headline font-bold text-xl flex items-center justify-center">
                ${trackNumber}
            </div>
            <div class="flex flex-col min-w-0 pr-2">
                <span class="font-headline font-bold text-lg leading-tight truncate group-hover:text-primary-container">${song.name || 'Untitled Track'}</span>
                <span class="font-body text-sm opacity-80 truncate">${song.artist || 'Unknown Artist'}</span>
            </div>
            <div class="hidden sm:flex items-center gap-2 pr-8 justify-end">
                <div class="w-16 h-2 bg-outline-variant brutal-border">
                    <div class="h-full" style="width: ${Math.min(100, Math.max(0, score))}%; background-color: ${songMoodStyle.bg};"></div>
                </div>
                <span class="font-label font-bold">${score}</span>
            </div>
            <div class="font-body font-bold text-right group-hover:text-primary-container">${durationText}</div>
            <div class="absolute right-0 top-0 bottom-0 w-24 bg-primary-container flex items-center justify-center translate-x-full group-hover:translate-x-0 transition-transform brutal-border border-l-4">
                <span class="material-symbols-outlined text-primary text-3xl" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
            </div>
        `;

        row.addEventListener('click', () => {
            if (currentPlaylist) {
                launchPlayer(currentPlaylist, currentSongs, index);
            }
        });

        trackListEl.appendChild(row);
    });
}

// ── Play Playlist Button Handler ─────────────────────────────────────────────
if (playBtn) {
    playBtn.addEventListener('click', () => {
        if (!currentPlaylist || !currentSongs.length) return;
        launchPlayer(currentPlaylist, currentSongs, 0);
    });
}

// ── Re-Sequence Button Handler ───────────────────────────────────────────────
if (resequenceBtn) {
    resequenceBtn.addEventListener('click', () => {
        const id = currentPlaylist ? (currentPlaylist._id || currentPlaylist.id) : '';
        window.location.href = `resequence.html?id=${id}`;
    });
}

// ── Delete Button Handler ────────────────────────────────────────────────────
if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
        if (!currentPlaylist || currentPlaylist.isDefault) return;

        if (confirm(`Are you sure you want to delete "${currentPlaylist.name}"?`)) {
            try {
                await api.deletePlaylist(currentPlaylist._id || currentPlaylist.id);
                sessionStorage.removeItem('modus_selected_playlist');
                window.location.replace('library.html');
            } catch (err) {
                alert('Failed to delete playlist: ' + err.message);
            }
        }
    });
}

// ── Logout Button Handler ───────────────────────────────────────────────────
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        api.logout();
    });
}

// ── Start ───────────────────────────────────────────────────────────────────
init();
