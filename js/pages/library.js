/**
 * Modus - Library Page Controller
 * Auth-guarded entry point after login.
 * Fetches songs, builds a Playlist instance, and renders one playlist card.
 */

import { Playlist } from '../Playlist.js';

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
        const response = await fetch('./data/music_features.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        const playlist = Playlist.fromJSON(data, {
            id:          'playlist_default',
            name:        'Dummy Playlist',
            description: 'Your full collection — ready to sequence.',
            coverImage:  COVER_IMAGE,
            tags:        ['Focus', 'Ambient'],
        });

        renderCard(playlist);
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

function renderCard(playlist) {
    if (!grid) return;
    grid.innerHTML = '';

    const article = document.createElement('article');
    article.className = 'library-card brutalist-border brutalist-shadow';
    article.setAttribute('role', 'button');
    article.setAttribute('tabindex', '0');
    article.setAttribute('aria-label', `Open playlist: ${playlist.name}`);

    article.innerHTML = `
        <div class="card-image-container">
            <div class="card-image brutalist-border"
                 style="background-image: url('${playlist.coverImage}');"
                 role="img" aria-label="Cover art for ${playlist.name}">
            </div>
            <div class="card-score brutalist-border">MS: ${playlist.moodScore}</div>
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
                ${playlist.tags.map((tag, i) =>
                    `<span class="card-tag ${i === 0 ? 'card-tag-focus' : 'card-tag-ambient'} brutalist-border">${tag}</span>`
                ).join('')}
            </div>
            <p class="card-description">${playlist.description}</p>
        </div>
    `;

    const navigate = () => { window.location.href = 'playlists.html'; };
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
