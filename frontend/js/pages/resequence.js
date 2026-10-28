// ======================================================
// MODUS - PLAYLIST / SEQUENCE ENGINE
// ======================================================

import { api } from '../api.js';
import { PlaylistSequencer } from '../../pipeline/PlaylistSequencer.js';
import { PRESET_THRESHOLDS }  from '../../pipeline/thresholds.js';

// Auth Guard
if (!api.isAuthenticated()) {
    window.location.replace('login.html');
}

// ======================================================
// HTML ELEMENTS
// ======================================================

const songList      = document.getElementById("song-list");
const generateBtn   = document.getElementById("generate-btn");
const previewPanel  = document.getElementById("preview-panel");
const previewHeader = document.querySelector(".preview-header h2");
const previewMeta   = document.querySelector(".preview-header p");


// ======================================================
// GLOBAL DATA
// ======================================================

let songs             = [];
let selectedAlgorithm = "romantic";
let currentSequence   = [];
let currentPlaylistId = null;
let currentPlaylist   = null;
let userPlaylists     = [];


// ======================================================
// HELPER: ENSURE DUMMY PLAYLIST
// ======================================================

async function ensureDummyPlaylist(existingDummy = null) {
    try {
        let songsData = await api.getSongs('', 50);
        let songIds = (songsData.songs || []).map(s => s._id || s.id);

        if (existingDummy) {
            const dummyId = existingDummy._id || existingDummy.id;
            for (const sId of songIds) {
                try { await api.addSong(dummyId, sId); } catch (e) {}
            }
            const refreshed = await api.getPlaylist(dummyId);
            return refreshed.playlist || refreshed;
        }

        const res = await api.createPlaylist({
            name: 'Dummy Playlist',
            description: 'Default curated starter playlist — ready to sequence.',
            coverImage: 'static/hero_image.png',
            tags: ['Mix', 'Default', 'Demo'],
            isDefault: true,
            songIds,
        });
        return res.playlist || res;
    } catch (e) {
        console.warn('Could not auto-create Dummy Playlist:', e);
        return null;
    }
}


// ======================================================
// LOAD SONGS & PLAYLISTS
// ======================================================

async function loadSongs() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const manualPlaylistId = urlParams.get('id');

        // Fetch user's playlists
        try {
            const listRes = await api.getPlaylists();
            userPlaylists = Array.isArray(listRes.playlists) ? listRes.playlists : [];
        } catch (e) {
            console.warn('Could not load user playlists:', e);
            userPlaylists = [];
        }

        // Find or ensure Dummy Playlist
        let dummy = userPlaylists.find(p => p.name === 'Dummy Playlist' || p.isDefault);
        const dummySongsCount = dummy ? (dummy.songs?.length || dummy.trackCount || 0) : 0;
        if (!dummy || dummySongsCount === 0) {
            dummy = await ensureDummyPlaylist(dummySongsCount === 0 && dummy ? dummy : null);
            if (dummy) {
                const dummyId = dummy._id || dummy.id;
                const idx = userPlaylists.findIndex(p => (p._id || p.id) === dummyId);
                if (idx !== -1) {
                    userPlaylists[idx] = dummy;
                } else {
                    userPlaylists.unshift(dummy);
                }
            }
        }

        // Selection priority:
        // 1. Manual selection via URL query param (?id=...)
        // 2. Default: Dummy Playlist!
        let targetPlaylist = null;
        if (manualPlaylistId) {
            targetPlaylist = userPlaylists.find(p => (p._id || p.id) === manualPlaylistId);
            if (!targetPlaylist) {
                try {
                    const singleRes = await api.getPlaylist(manualPlaylistId);
                    targetPlaylist = singleRes.playlist;
                } catch (e) {}
            }
        }

        if (!targetPlaylist) {
            // Default to Dummy Playlist!
            targetPlaylist = dummy || userPlaylists[0] || null;
        }

        if (targetPlaylist) {
            currentPlaylistId = targetPlaylist._id || targetPlaylist.id;
            try {
                const pData = await api.getPlaylist(currentPlaylistId);
                songs = Array.isArray(pData.songs) ? pData.songs : (pData.playlist?.songs || []);
                currentPlaylist = pData.playlist || targetPlaylist;
            } catch (pErr) {
                console.warn('Could not load playlist by ID:', pErr);
                songs = Array.isArray(targetPlaylist.songs) ? targetPlaylist.songs : [];
                currentPlaylist = targetPlaylist;
            }
        }

        // If no playlist or playlist has no songs, load global catalog songs or local demo songs
        if (!songs || songs.length === 0) {
            try {
                const catalog = await api.getSongs('', 50);
                songs = Array.isArray(catalog.songs) ? catalog.songs : [];
            } catch (e) {}
        }
        if (!songs || songs.length === 0) {
            try {
                const localRes = await fetch('data/music_features.json');
                if (localRes.ok) {
                    const localJson = await localRes.json();
                    songs = Array.isArray(localJson.songs) ? localJson.songs : [];
                }
            } catch (e) {}
        }

        console.log("Songs Loaded for Sequence Engine:", songs.length);

        populatePlaylistSelector();
        displaySongs();
        updateSourceHeader();

    } catch (error) {
        console.error("Error loading songs:", error);
        songList.innerHTML = `
            <div style="padding: 20px; text-align: center; font-weight: 700; color: #ff5c00;">
                Unable to load songs
            </div>
        `;
    }
}

function populatePlaylistSelector() {
    const selector = document.getElementById("playlist-selector");
    if (!selector) return;

    selector.innerHTML = "";

    userPlaylists.forEach(pl => {
        const opt = document.createElement("option");
        opt.value = pl._id || pl.id;
        opt.textContent = pl.name;
        if ((pl._id || pl.id) === currentPlaylistId) {
            opt.selected = true;
        }
        selector.appendChild(opt);
    });

    selector.onchange = async (e) => {
        const selectedId = e.target.value;
        if (!selectedId || selectedId === currentPlaylistId) return;
        await switchPlaylist(selectedId);
    };
}

async function switchPlaylist(playlistId) {
    try {
        currentPlaylistId = playlistId;
        const res = await api.getPlaylist(playlistId);
        songs = Array.isArray(res.songs) ? res.songs : (res.playlist?.songs || []);
        currentPlaylist = res.playlist || userPlaylists.find(p => (p._id || p.id) === playlistId);

        displaySongs();
        updateSourceHeader();

        // Reset sequence preview panel
        currentSequence = [];
        if (previewPanel) {
            previewPanel.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--text-muted); font-family: 'Space Grotesk', sans-serif;">
                    <p style="font-weight: 700; margin-bottom: 0.5rem; text-transform: uppercase;">Source: ${currentPlaylist?.name || 'Playlist'}</p>
                    <p style="font-size: 0.85rem;">Select an algorithm and click "Generate Sequence" to sequence these tracks.</p>
                </div>
            `;
        }
        if (previewHeader) previewHeader.textContent = "Preview: Mood Flow";
        if (previewMeta)   previewMeta.textContent   = "ALGORITHM APPLIED";

    } catch (err) {
        console.error("Failed to switch playlist:", err);
    }
}


// ======================================================
// DISPLAY SONGS IN LEFT PANEL
// ======================================================

function displaySongs() {

    songList.innerHTML = "";

    if (songs.length === 0) {
        songList.innerHTML = `
            <div style="padding: 20px; text-align: center; font-weight: 700;">
                No songs found
            </div>
        `;
        return;
    }

    songs.forEach((song) => {

        const songItem = document.createElement("div");
        songItem.classList.add("song-item");

        const bpm = song.features?.bpm;

        songItem.innerHTML = `
            <div class="song-item-title">${song.name || "Unknown Song"}</div>
            <div class="song-item-artist">${song.artist || "Unknown Artist"}</div>
            <div class="song-item-bpm">${
                typeof bpm === "number" ? `${bpm.toFixed(2)} BPM` : "BPM N/A"
            }</div>
        `;

        songItem.addEventListener("click", () => {

            document.querySelectorAll(".song-item").forEach((item) => {
                item.classList.remove("active");
            });

            songItem.classList.add("active");

            // Restore preview header to default
            if (previewHeader) previewHeader.textContent = "Preview: Song Detail";
            if (previewMeta)   previewMeta.textContent   = "SELECTED TRACK";

            showSongPreview(song);

        });

        songList.appendChild(songItem);

    });

}


// ======================================================
// SHOW SELECTED SONG IN PREVIEW PANEL
// ======================================================

function showSongPreview(song) {

    if (!previewPanel) return;

    const durationMs  = Number(song.duration_ms) || 0;
    const minutes     = Math.floor(durationMs / 60000);
    const seconds     = Math.floor((durationMs % 60000) / 1000);
    const durationText = `${minutes}:${String(seconds).padStart(2, "0")}`;

    const bpm         = song.features?.bpm;
    const energy      = song.features?.energy;
    const danceability = song.features?.danceability;
    const happiness   = song.features?.happiness;

    previewPanel.innerHTML = `

        <!-- NOW PLAYING -->
        <div class="now-playing">

            <div class="song-stat yellow">SELECTED SONG</div>

            <div class="now-playing-title">${song.name || "Unknown Song"}</div>
            <div class="now-playing-artist">${song.artist || "Unknown Artist"}</div>

            <div class="song-stats">
                <div class="song-stat yellow">
                    ${typeof bpm === "number" ? bpm.toFixed(2) + " BPM" : "BPM N/A"}
                </div>
                <div class="song-stat">${durationText}</div>
                <div class="song-stat">${song.genre || "UNKNOWN"}</div>
                <div class="song-stat">${song.features?.key || "N/A"}</div>
            </div>

        </div>


        <!-- SONG DETAILS -->
        <div class="next-song">

            <h3>SONG DETAILS</h3>

            <div class="next-song-title">${song.album || "Unknown Album"}</div>
            <div class="next-song-artist">${song.release_date || "Unknown Release Date"}</div>

            <div class="transition-cost">
                ENERGY: ${typeof energy === "number" ? Math.round(energy * 100) + "%" : "N/A"}
            </div>
            <div class="transition-cost">
                DANCEABILITY: ${typeof danceability === "number" ? Math.round(danceability * 100) + "%" : "N/A"}
            </div>
            <div class="transition-cost">
                HAPPINESS: ${typeof happiness === "number" ? Math.round(happiness * 100) + "%" : "N/A"}
            </div>

        </div>

    `;

}


// ======================================================
// UPDATE SOURCE HEADER
// ======================================================

function updateSourceHeader() {
    const titleEl = document.getElementById("source-playlist-title") || document.querySelector(".source-panel .panel-header h2");
    const metaEl  = document.getElementById("source-playlist-meta")  || document.querySelector(".source-panel .panel-header p");

    if (titleEl) {
        titleEl.textContent = `Source: ${currentPlaylist?.name || 'Dummy Playlist'}`;
    }

    if (metaEl) {
        let totalMs = 0;
        songs.forEach((song) => { totalMs += Number(song.duration_ms) || 0; });

        const totalMinutes      = Math.floor(totalMs / 60000);
        const remainingSeconds  = Math.floor((totalMs % 60000) / 1000);

        metaEl.textContent = `${songs.length} TRACKS • ${totalMinutes}M ${remainingSeconds}S`;
    }
}


// ======================================================
// ALGORITHM CARDS
// ======================================================

const algorithmCards = document.querySelectorAll(".algorithm-card");

algorithmCards.forEach((card) => {

    card.addEventListener("click", () => {

        algorithmCards.forEach((item) => item.classList.remove("active"));
        card.classList.add("active");

        const text = card
            .querySelector("span:last-child")
            ?.textContent
            ?.trim()
            ?.toLowerCase();

        if (!text) return;

        selectedAlgorithm = text.replace(/\s+/g, "_");

        // Drive the mood-reactive CSS accent system
        document.body.dataset.preset = selectedAlgorithm;

        console.log("Selected Algorithm:", selectedAlgorithm);

    });

});


// ======================================================
// GET PRESET SCORE (helper)
// ======================================================

function getPresetScore(song) {
    return Number(song.presets?.[selectedAlgorithm]) || 0;
}


// ======================================================
// GENERATE SEQUENCE  — uses real PlaylistSequencer
// ======================================================

async function generateSequence() {

    if (songs.length === 0) {
        alert("No songs loaded.");
        return;
    }

    // Show loading state while sequencing
    if (previewPanel) {
        previewPanel.innerHTML = `<div class="seq-loading">Sequencing…</div>`;
    }

    let sequence = [];
    if (currentPlaylistId) {
        try {
            const res = await api.resequence(currentPlaylistId, selectedAlgorithm);
            sequence = res.sequence;
        } catch (apiErr) {
            console.warn('API resequence failed, using local sequencer:', apiErr);
            const sequencer = new PlaylistSequencer(songs);
            sequence = sequencer.getPlaylist(selectedAlgorithm);
        }
    } else {
        const sequencer = new PlaylistSequencer(songs);
        sequence = sequencer.getPlaylist(selectedAlgorithm);
    }

    // Update right-panel header
    const prettyName = selectedAlgorithm.replace(/_/g, " ").toUpperCase();
    if (previewHeader) previewHeader.textContent = `Preview: ${prettyName}`;
    if (previewMeta)   previewMeta.textContent   = "GENERATED SEQUENCE";

    displaySequence(sequence);

}


// ======================================================
// DISPLAY GENERATED SEQUENCE IN RIGHT PANEL
// ======================================================

function displaySequence(sequence) {
    currentSequence = sequence;

    if (!previewPanel) return;

    previewPanel.innerHTML = "";


    // ── Empty state ──────────────────────────────────────
    if (!sequence || sequence.length === 0) {

        const threshold  = PRESET_THRESHOLDS[selectedAlgorithm] ?? 0;
        const prettyName = selectedAlgorithm.replace(/_/g, " ").toUpperCase();

        previewPanel.innerHTML = `
            <div class="seq-empty">
                <span class="material-symbols-outlined" style="font-size: 32px;">music_off</span>
                <div>NO SONGS QUALIFY</div>
                <div style="font-size: 9px; margin-top: 4px; font-weight: 400;">
                    Threshold for ${prettyName}: ${Math.round(threshold * 100)}%
                </div>
            </div>
        `;

        return;

    }


    // ── Header card ──────────────────────────────────────

    const prettyName = selectedAlgorithm.replace(/_/g, " ").toUpperCase();
    const threshold  = PRESET_THRESHOLDS[selectedAlgorithm] ?? 0;

    // Total duration of sequence
    let totalMs = 0;
    sequence.forEach((s) => { totalMs += Number(s.duration_ms) || 0; });
    const totalMins = Math.floor(totalMs / 60000);
    const totalSecs = Math.floor((totalMs % 60000) / 1000);

    // First song (seed)
    const seed = sequence[0];

    const header = document.createElement("div");
    header.classList.add("seq-header");
    header.innerHTML = `
        <div class="seq-header-top">
            <div class="seq-preset-badge">${prettyName}</div>
            <button id="seq-export-btn" class="seq-export-btn">Export to Library</button>
        </div>
        <div class="seq-header-title">${seed.name || "—"}</div>
        <div class="seq-header-artist">${seed.artist || "—"}</div>
        <div class="seq-meta">
            <span>${sequence.length} TRACKS</span>
            <span>${totalMins}M ${totalSecs}S</span>
            <span>MIN SCORE ${Math.round(threshold * 100)}%</span>
        </div>
    `;
    previewPanel.appendChild(header);

    const exportBtn = header.querySelector("#seq-export-btn");
    if (exportBtn) {
        exportBtn.addEventListener("click", openExportModal);
    }


    // ── Sequence list ────────────────────────────────────

    const list = document.createElement("div");
    list.classList.add("seq-list");

    sequence.forEach((song, index) => {

        const bpm   = song.features?.bpm;
        const score = Number(song.presets?.[selectedAlgorithm]) || 0;
        const scorePct = Math.round(score * 100);

        const key  = song.features?.key  || "—";
        const mode = song.features?.mode ? song.features.mode.slice(0, 3).toUpperCase() : "";

        const item = document.createElement("div");
        item.classList.add("seq-item");

        // Staggered entrance animation
        item.style.animationDelay = `${index * 40}ms`;

        item.innerHTML = `
            <div class="seq-num">${String(index + 1).padStart(2, "0")}</div>

            <div class="seq-info">
                <div class="seq-title">${song.name || "Unknown"}</div>
                <div class="seq-artist">${song.artist || "Unknown"}</div>
                <div class="seq-score-bar-wrap">
                    <div class="seq-score-bar" style="width: ${scorePct}%;"></div>
                </div>
            </div>

            <div class="seq-right">
                <div class="seq-bpm">${typeof bpm === "number" ? bpm.toFixed(1) : "—"} BPM</div>
                <div class="seq-key">${key} ${mode}</div>
                <div class="seq-pct">${scorePct}%</div>
            </div>
        `;

        // Clicking a sequence item toggles its full song detail
        item.addEventListener("click", () => {
            const isActive = item.classList.contains("seq-item-active");
            
            // Remove active classes and any existing detail card
            document.querySelectorAll(".seq-item").forEach((el) => el.classList.remove("seq-item-active"));
            const existingCard = previewPanel.querySelector(".seq-detail-card");
            if (existingCard) existingCard.remove();

            // If it wasn't active, activate it and show details
            if (!isActive) {
                item.classList.add("seq-item-active");
                showSongPreviewInline(song, item);
            }
        });

        list.appendChild(item);

    });

    previewPanel.appendChild(list);

}


// ======================================================
// INLINE SONG DETAIL  (click inside sequence list)
// ======================================================

function showSongPreviewInline(song, itemEl) {

    // Remove any existing inline card
    const existing = previewPanel.querySelector(".seq-detail-card");
    if (existing) existing.remove();

    const durationMs   = Number(song.duration_ms) || 0;
    const minutes      = Math.floor(durationMs / 60000);
    const seconds      = Math.floor((durationMs % 60000) / 1000);
    const durationText = `${minutes}:${String(seconds).padStart(2, "0")}`;

    const energy       = song.features?.energy;
    const danceability = song.features?.danceability;
    const happiness    = song.features?.happiness;

    const card = document.createElement("div");
    card.classList.add("seq-detail-card");
    card.innerHTML = `
        <div class="seq-detail-row">
            <span>ALBUM</span><span>${song.album || "—"}</span>
        </div>
        <div class="seq-detail-row">
            <span>RELEASED</span><span>${song.release_date || "—"}</span>
        </div>
        <div class="seq-detail-row">
            <span>DURATION</span><span>${durationText}</span>
        </div>
        <div class="seq-detail-row">
            <span>GENRE</span><span>${song.genre || "—"}</span>
        </div>
        <div class="seq-detail-row">
            <span>ENERGY</span><span>${typeof energy === "number" ? Math.round(energy * 100) + "%" : "—"}</span>
        </div>
        <div class="seq-detail-row">
            <span>DANCEABILITY</span><span>${typeof danceability === "number" ? Math.round(danceability * 100) + "%" : "—"}</span>
        </div>
        <div class="seq-detail-row">
            <span>HAPPINESS</span><span>${typeof happiness === "number" ? Math.round(happiness * 100) + "%" : "—"}</span>
        </div>
    `;

    // Insert immediately after the clicked item
    itemEl.insertAdjacentElement("afterend", card);

}


// ======================================================
// EXPORT TO LIBRARY MODAL
// ======================================================

const exportModal = document.getElementById("export-modal");
const exportNameInput = document.getElementById("export-name-input");
const exportConfirmBtn = document.getElementById("export-confirm-btn");
const exportCancelBtn = document.getElementById("export-cancel-btn");
const exportErrorMsg = document.getElementById("export-error-msg");

function openExportModal() {
    if (!currentSequence || currentSequence.length === 0) return;
    
    if (exportModal) {
        exportModal.hidden = false;
        const prettyName = selectedAlgorithm.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
        exportNameInput.value = `${prettyName} Mix`;
        exportNameInput.focus();
        exportNameInput.select();
        exportErrorMsg.style.display = "none";
    }
}

function closeExportModal() {
    if (exportModal) exportModal.hidden = true;
    exportErrorMsg.style.display = "none";
}

async function confirmExport() {
    const name = exportNameInput.value.trim();
    if (!name) {
        exportErrorMsg.textContent = "Please enter a playlist name.";
        exportErrorMsg.style.display = "block";
        return;
    }

    if (!currentSequence || currentSequence.length === 0) {
        exportErrorMsg.textContent = "Please generate a sequence first.";
        exportErrorMsg.style.display = "block";
        return;
    }

    try {
        exportConfirmBtn.disabled = true;
        exportConfirmBtn.textContent = "Saving...";

        const songIds = currentSequence.map(s => s._id || s.id);
        const res = await api.exportSequence(currentPlaylistId || '', {
            name,
            algorithm: selectedAlgorithm,
            songIds,
        });

        closeExportModal();

        // Show temporary toast on the export button
        const exportBtn = document.getElementById("seq-export-btn");
        if (exportBtn) {
            const originalText = exportBtn.textContent;
            exportBtn.textContent = "Saved to Library!";
            exportBtn.style.color = "var(--accent-active)";
            exportBtn.style.borderColor = "var(--accent-active)";
            setTimeout(() => {
                exportBtn.textContent = originalText;
                exportBtn.style.color = "";
                exportBtn.style.borderColor = "";
            }, 2000);
        }

        const newId = res.playlist?._id || res._id;
        if (newId) {
            setTimeout(() => {
                window.location.href = `playlist_view.html?id=${newId}`;
            }, 800);
        }
    } catch (err) {
        exportErrorMsg.textContent = err.message || "Failed to save playlist.";
        exportErrorMsg.style.display = "block";
        exportConfirmBtn.disabled = false;
        exportConfirmBtn.textContent = "Save to Library";
    }
}

if (exportCancelBtn) exportCancelBtn.addEventListener("click", closeExportModal);
if (exportConfirmBtn) exportConfirmBtn.addEventListener("click", confirmExport);
if (exportNameInput) {
    exportNameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") confirmExport();
        if (e.key === "Escape") closeExportModal();
    });
}

// ======================================================
// LOGOUT BUTTON
// ======================================================

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        api.logout();
    });
}

// ======================================================
// GENERATE BUTTON
// ======================================================

if (generateBtn) {
    generateBtn.addEventListener("click", generateSequence);
}



// ======================================================
// START APPLICATION
// ======================================================

// Initialize accent to match default selectedAlgorithm
document.body.dataset.preset = selectedAlgorithm;

loadSongs();