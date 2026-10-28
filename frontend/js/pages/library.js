/**
 * Modus - Library Page Controller
 *
 * Auth-guarded entry point after login.
 * Loads the user's playlists from the MongoDB backend via the centralized API client.
 */

import { api } from '../api.js';
import { launchPlayer } from '../utils/playerLauncher.js';

// ── Auth Guard ──────────────────────────────────────────────────────────────
if (!api.isAuthenticated()) {
    window.location.replace('login.html');
}

// ── Cover art fallback ───────────────────────────────────────────────────────
const DEFAULT_COVER = 'static/hero_image.png';

export function resolveCover(url) {
    if (!url || typeof url !== 'string' || url.includes('googleusercontent.com') || url.includes('example.com')) {
        return DEFAULT_COVER;
    }
    return url;
}

// ── DOM References ───────────────────────────────────────────────────────────
const grid       = document.getElementById('library-grid');
const filterBtns = document.querySelectorAll('.filter-btn, .filter-btn-active');
const logoutBtn  = document.getElementById('logout-btn');

let allPlaylists = [];
let currentFilter = 'recent';

// ── Load & Render Playlists ──────────────────────────────────────────────────
async function init() {
    try {
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 2rem; text-align: center; font-family: var(--font-headline); font-weight: 700;">
                    LOADING PLAYLISTS...
                </div>`;
        }

        const data = await api.getPlaylists();
        allPlaylists = Array.isArray(data.playlists) ? data.playlists : [];

        // Ensure Dummy Playlist exists for every user
        let dummy = allPlaylists.find(p => p.name === 'Dummy Playlist' || p.isDefault);
        if (!dummy) {
            try {
                const songsData = await api.getSongs('', 50);
                const songIds = (songsData.songs || []).map(s => s._id);
                const dummyRes = await api.createPlaylist({
                    name: 'Dummy Playlist',
                    description: 'Default curated starter playlist — ready to sequence.',
                    coverImage: DEFAULT_COVER,
                    tags: ['Mix', 'Default'],
                    isDefault: true,
                    songIds,
                });
                dummy = dummyRes.playlist || dummyRes;
                allPlaylists.unshift(dummy);
            } catch (err) {
                console.warn('Library: Could not create Dummy Playlist:', err);
            }
        }

        renderLibrary();

    } catch (err) {
        console.error('Library: failed to load playlists from API:', err);
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 2rem; font-family: var(--font-headline); font-weight: 700; text-transform: uppercase; color: #ff5c00;">
                    Unable to load playlists. ${err.message || ''}
                </div>`;
        }
    }
}

function renderLibrary() {
    if (!grid) return;
    grid.innerHTML = '';

    if (allPlaylists.length === 0) {
        renderEmptyState();
        return;
    }

    let displayed = [...allPlaylists];

    if (currentFilter === 'mood') {
        displayed.sort((a, b) => (b.topMood?.score || 0) - (a.topMood?.score || 0));
    } else {
        // recent, keeping default Dummy Playlist prominent
        displayed.sort((a, b) => {
            if (a.isDefault || a.name === 'Dummy Playlist') return -1;
            if (b.isDefault || b.name === 'Dummy Playlist') return 1;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
    }

    displayed.forEach(playlist => renderCard(playlist));
}

function renderEmptyState() {
    grid.innerHTML = `
        <div class="empty-state brutalist-border brutalist-shadow" style="grid-column: 1 / -1; padding: 3rem 2rem; text-align: center; background: #fff;">
            <span class="material-symbols-outlined" style="font-size: 3rem; margin-bottom: 1rem;">queue_music</span>
            <h2 style="font-family: var(--font-headline); font-size: 1.5rem; margin-bottom: 0.5rem; font-weight: 900;">YOUR LIBRARY IS EMPTY</h2>
            <p style="margin-bottom: 1.5rem; color: #666; font-size: 0.95rem;">Create a starter playlist with catalog tracks or generate mood sequences.</p>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                <button id="create-starter-btn" class="brutalist-button filter-btn-active" style="padding: 0.75rem 1.5rem; cursor: pointer;">
                    <span class="material-symbols-outlined" style="vertical-align: middle; font-size: 1.25rem;">add</span>
                    CREATE STARTER PLAYLIST
                </button>
                <a href="resequence.html" class="brutalist-button filter-btn" style="padding: 0.75rem 1.5rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-outlined" style="font-size: 1.25rem;">tune</span>
                    OPEN SEQUENCER
                </a>
            </div>
        </div>
    `;

    const starterBtn = document.getElementById('create-starter-btn');
    if (starterBtn) {
        starterBtn.addEventListener('click', createStarterPlaylist);
    }
}

async function createStarterPlaylist() {
    try {
        const starterBtn = document.getElementById('create-starter-btn');
        if (starterBtn) {
            starterBtn.disabled = true;
            starterBtn.textContent = 'CREATING...';
        }

        // Fetch catalog songs
        const songsData = await api.getSongs('', 50);
        const songIds = (songsData.songs || []).map(s => s._id);

        const newPlaylist = await api.createPlaylist({
            name: 'Dummy Playlist',
            description: 'Default curated starter playlist — ready to sequence.',
            coverImage: DEFAULT_COVER,
            tags: ['Mix', 'Default'],
            isDefault: true,
            songIds,
        });

        allPlaylists.push(newPlaylist.playlist || newPlaylist);
        renderLibrary();
    } catch (e) {
        alert('Could not create starter playlist: ' + (e.message || 'Error'));
        init();
    }
}

function getTagClass(tag) {
    const key = String(tag).toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (key.includes('romantic')) return 'card-tag-romantic';
    if (key.includes('energetic')) return 'card-tag-energetic';
    if (key.includes('thrill')) return 'card-tag-thrill';
    if (key.includes('chill')) return 'card-tag-chill';
    if (key.includes('feel_good') || key.includes('feelgood')) return 'card-tag-feel_good';
    if (key.includes('melancholic')) return 'card-tag-melancholic';
    if (key.includes('mix')) return 'card-tag-mix';
    return 'card-tag-ambient';
}

function formatDuration(ms) {
    const totalSeconds = Math.floor((Number(ms) || 0) / 1000);
    const hours   = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function renderCard(playlist) {
    if (!grid) return;

    const topMood = playlist.topMood || { name: 'Mix', score: 0 };
    const moodTagLabel = `${topMood.name} ${topMood.score || 0}`;
    const rawTags = Array.isArray(playlist.tags) ? playlist.tags : [];
    const displayTags = [...new Set([...rawTags, moodTagLabel])];

    const article = document.createElement('article');
    article.className = 'library-card brutalist-border brutalist-shadow';
    article.setAttribute('role', 'button');
    article.setAttribute('tabindex', '0');
    article.setAttribute('aria-label', `Open playlist: ${playlist.name}`);

    const moodClass = getTagClass(topMood.name);
    const coverUrl = resolveCover(playlist.coverImage);
    const imageHTML = coverUrl
        ? `<div class="card-image brutalist-border" style="background-image: url('${coverUrl}');" role="img" aria-label="Cover art for ${playlist.name}"></div>`
        : `<div class="card-image brutalist-border no-cover ${moodClass}" role="img" aria-label="No cover available"></div>`;

    const deleteHTML = !playlist.isDefault
        ? `<button class="card-delete-btn brutalist-border" aria-label="Delete playlist" title="Delete playlist">
               <span class="material-symbols-outlined">close</span>
           </button>`
        : '';

    const durationText = playlist.totalDurationLabel || formatDuration(playlist.totalDurationMs);
    const trackCount = playlist.trackCount ?? (Array.isArray(playlist.songs) ? playlist.songs.length : 0);

    article.innerHTML = `
        <div class="card-image-container">
            ${imageHTML}
            ${deleteHTML}
            <button id="library-play-btn" class="card-play-btn brutalist-border" aria-label="Play playlist" title="Play playlist">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
            </button>
        </div>
        <div class="card-content">
            <h3 class="card-title">${playlist.name}</h3>
            <div class="card-meta">
                <span class="card-meta-item">
                    <span class="material-symbols-outlined card-meta-icon">album</span>
                    ${trackCount} Tracks
                </span>
                <span class="card-meta-item">
                    <span class="material-symbols-outlined card-meta-icon">timer</span>
                    ${durationText}
                </span>
            </div>
            <div class="card-tags">
                ${displayTags.map(tag =>
                    `<span class="card-tag ${getTagClass(tag)} brutalist-border">${tag}</span>`
                ).join('')}
            </div>
            <p class="card-description">${playlist.description || ''}</p>
        </div>
    `;

    // Play button
    const playBtn = article.querySelector('#library-play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const songs = Array.isArray(playlist.songs) ? playlist.songs : [];
            launchPlayer(playlist, songs, 0);
        });
    }

    // Delete button
    const deleteBtn = article.querySelector('.card-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${playlist.name}"?`)) {
                try {
                    await api.deletePlaylist(playlist._id);
                    allPlaylists = allPlaylists.filter(p => p._id !== playlist._id);
                    renderLibrary();
                } catch (delErr) {
                    alert('Failed to delete playlist: ' + delErr.message);
                }
            }
        });
    }

    // Navigate to playlist_view with ?id=
    const navigate = () => {
        try {
            sessionStorage.setItem('modus_selected_playlist', JSON.stringify({
                id:          playlist._id,
                name:        playlist.name,
                description: playlist.description,
                coverImage:  coverUrl,
                moodScore:   topMood.score,
                topMood:     topMood,
                tags:        displayTags,
            }));
        } catch (e) {}

        window.location.href = `playlist_view.html?id=${playlist._id}`;
    };

    article.addEventListener('click', navigate);
    article.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(); }
    });

    grid.appendChild(article);
}

// ── Filter Buttons ────────────────────────────────────────────────────────────
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => {
            b.classList.remove('filter-btn-active');
            b.classList.add('filter-btn');
        });
        btn.classList.remove('filter-btn');
        btn.classList.add('filter-btn-active');

        const text = btn.textContent.toLowerCase();
        if (text.includes('mood')) {
            currentFilter = 'mood';
        } else {
            currentFilter = 'recent';
        }
        renderLibrary();
    });
});

// ── Logout ────────────────────────────────────────────────────────────────────
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        api.logout();
    });
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
