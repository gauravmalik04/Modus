/**
 * Modus - Library Page Controller
 * Auth-guarded entry point after login.
 * Fetches songs, builds a Playlist instance, and renders one playlist card.
 */

import { Playlist } from '../Playlist.js';
import { launchPlayer } from '../utils/playerLauncher.js';
import { LibraryStore } from '../libraryStore.js';

// ── Auth Guard ──────────────────────────────────────────────────────────────
(function guardSession() {
    try {
        const session = JSON.parse(sessionStorage.getItem('modus_session'));
        if (!session) window.location.replace('login.html');
    } catch {
        window.location.replace('login.html');
    }
})();

// ── Cover art (existing Bauhaus image from the original hardcoded card) ──────
const COVER_IMAGE =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBO-v4EocXCZVkSmp6zpiXXSfmEb88JsQgyQwzP7-p1cnOFBF4CCJb8B6E5HrdtxFyN_I1qEnh6Ph12muW1VJvXQSa8pxquOEVQuFtnUXiHs7LbJjLovwx8FN21Tfy9Jpr5AdYKMojGjnwYeORpVtL0z4Zx02zTK1AlYsZIdPDnbB3fy6TQ56da4WHyeKUmQgdYfk09sS25Js6oEM4xBwwH519qIvwSpjMvn_IG8pkw4u-Dlrpkj1lt3A';

// ── DOM ──────────────────────────────────────────────────────────────────────
const grid       = document.getElementById('library-grid');
const filterBtns = document.querySelectorAll('.filter-btn, .filter-btn-active');

// ── Load & Render ─────────────────────────────────────────────────────────────
async function init() {
    try {
        if (grid) grid.innerHTML = '';

        const response = await fetch('./data/music_features.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        // 1. Default Playlist
        const defaultPlaylist = Playlist.fromJSON(data, {
            id:          'playlist_default',
            name:        'Dummy Playlist',
            description: 'Your full collection — ready to sequence.',
            coverImage:  COVER_IMAGE,
            tags:        ['Mix'],
        });
        renderCard(defaultPlaylist);

        // 2. Saved Playlists from LibraryStore
        const savedPlaylists = LibraryStore.getAll();
        savedPlaylists.forEach(savedData => {
            const playlist = new Playlist(savedData);
            renderCard(playlist);
        });

    } catch (err) {
        console.error('Library: failed to load data:', err);
        if (grid) {
            grid.innerHTML = `
                <div style="padding:2rem;font-family:var(--font-headline);font-weight:700;text-transform:uppercase;">
                    Unable to load playlist data.
                </div>`;
        }
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

function renderCard(playlist) {
    if (!grid) return;

    const topMood = playlist.topMood;
    const moodTagLabel = `${topMood.name} ${topMood.score}`;
    const displayTags = [...new Set([...playlist.tags, moodTagLabel])];

    const article = document.createElement('article');
    article.className = 'library-card brutalist-border brutalist-shadow';
    article.setAttribute('role', 'button');
    article.setAttribute('tabindex', '0');
    article.setAttribute('aria-label', `Open playlist: ${playlist.name}`);

    const moodClass = getTagClass(topMood.name);
    const imageHTML = playlist.coverImage 
        ? `<div class="card-image brutalist-border" style="background-image: url('${playlist.coverImage}');" role="img" aria-label="Cover art for ${playlist.name}"></div>`
        : `<div class="card-image brutalist-border no-cover ${moodClass}" role="img" aria-label="No cover available"></div>`;

    const deleteHTML = playlist.id !== 'playlist_default'
        ? `<button class="card-delete-btn brutalist-border" aria-label="Delete playlist" title="Delete playlist">
               <span class="material-symbols-outlined">close</span>
           </button>`
        : '';

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
                    ${playlist.trackCount} Tracks
                </span>
                <span class="card-meta-item">
                    <span class="material-symbols-outlined card-meta-icon">timer</span>
                    ${playlist.totalDurationLabel}
                </span>
            </div>
            <div class="card-tags">
                ${displayTags.map((tag) =>
                    `<span class="card-tag ${getTagClass(tag)} brutalist-border">${tag}</span>`
                ).join('')}
            </div>
            <p class="card-description">${playlist.description}</p>
        </div>
    `;

    // Wire play button — stops propagation so card click still goes to playlist_view
    const playBtn = article.querySelector('#library-play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            launchPlayer(playlist, playlist.songs, 0);
        });
    }

    // Wire delete button
    const deleteBtn = article.querySelector('.card-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${playlist.name}"?`)) {
                LibraryStore.remove(playlist.id);
                // Re-render library
                init();
            }
        });
    }

    const navigate = () => {
        try {
            sessionStorage.setItem('modus_selected_playlist', JSON.stringify({
                id:          playlist.id,
                name:        playlist.name,
                description: playlist.description,
                coverImage:  playlist.coverImage,
                moodScore:   topMood.score,
                topMood:     topMood,
                tags:        displayTags,
            }));
        } catch (e) {}
        window.location.href = 'playlist_view.html';
    };
    article.addEventListener('click', navigate);
    article.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(); }
    });

    grid.appendChild(article);
}

// ── Filter Buttons — visual toggle only ──────────────────────────────────────
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => {
            b.classList.remove('filter-btn-active');
            b.classList.add('filter-btn');
        });
        btn.classList.remove('filter-btn');
        btn.classList.add('filter-btn-active');
    });
});

// ── Logout ────────────────────────────────────────────────────────────────────
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('modus_session');
        window.location.replace('login.html');
    });
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
