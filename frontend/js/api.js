/**
 * frontend/js/api.js
 *
 * Centralized API client for Modus.
 * Replaces all localStorage plain-text data & mock JSON fetches with real Express REST calls.
 *
 * Features:
 *   - Auto-attaches JWT Bearer token from localStorage
 *   - Automatic 401 handling (redirect to login on expired session)
 *   - Configurable base URL (dev fallback to http://localhost:5000/api, prod fallback to relative or window.MODUS_API_BASE)
 *   - Supports both ES module `import { api } from ...` and global `window.api`
 */

const API_BASE = 'https://modus-ygx3.vercel.app/api';

const TOKEN_KEY = 'modus_token';
const USER_KEY  = 'modus_user';

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

export function getCurrentUser() {
    try {
        const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

export function setCurrentUser(user) {
    if (user) {
        const serialized = JSON.stringify(user);
        sessionStorage.setItem(USER_KEY, serialized);
        localStorage.setItem(USER_KEY, serialized);
    } else {
        sessionStorage.removeItem(USER_KEY);
        localStorage.removeItem(USER_KEY);
    }
}

export function isAuthenticated() {
    return Boolean(getToken());
}

export function logout() {
    clearToken();
    setCurrentUser(null);
    sessionStorage.removeItem('modus_session');
    sessionStorage.removeItem('modus_selected_playlist');
    window.location.replace('login.html');
}

/**
 * Universal fetch wrapper with authorization and unified error normalization.
 */
async function apiRequest(method, path, body = null) {
    const headers = {};
    if (body !== null) {
        headers['Content-Type'] = 'application/json';
    }

    const token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

    let res;
    try {
        res = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null,
        });
    } catch (networkErr) {
        const err = new Error('Unable to connect to Modus server. Please ensure the backend is running.');
        err.status = 0;
        err.network = true;
        throw err;
    }

    let data;
    try {
        data = await res.json();
    } catch (parseErr) {
        data = { message: res.statusText || 'Unexpected server response.' };
    }

    if (!res.ok) {
        // Handle expired / invalid token
        if (res.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/signup')) {
            clearToken();
            setCurrentUser(null);
            if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('landing.html')) {
                window.location.replace('login.html');
            }
        }

        const message = data.message || `Request failed with status ${res.status}`;
        const error = new Error(message);
        error.status  = res.status;
        error.details = data.details || null;
        error.data    = data;
        throw error;
    }

    return data;
}

export const api = {
    // Config & Auth Helpers
    getBaseUrl: () => API_BASE,
    getToken,
    setToken,
    clearToken,
    getCurrentUser,
    setCurrentUser,
    isAuthenticated,
    logout,

    // ── Auth ──────────────────────────────────────────────────────────────────
    signup: (body) => apiRequest('POST', '/auth/signup', body),
    login:  (body) => apiRequest('POST', '/auth/login', body),
    me:     ()     => apiRequest('GET',  '/auth/me'),
    forgotPassword: (body) => apiRequest('POST', '/auth/forgot-password', body),

    // ── Songs ─────────────────────────────────────────────────────────────────
    getSongs:   (q = '', limit = 20) => apiRequest('GET', `/songs?q=${encodeURIComponent(q)}&limit=${limit}`),
    getSong:    (id)                 => apiRequest('GET', `/songs/${id}`),
    searchSong: (body)               => apiRequest('POST', '/songs/search', body),
    bulkSongs:  (tracks)             => apiRequest('POST', '/songs/bulk', { tracks }),

    // ── Playlists ─────────────────────────────────────────────────────────────
    getPlaylists:   ()          => apiRequest('GET', '/playlists'),
    getPlaylist:    (id)        => apiRequest('GET', `/playlists/${id}`),
    createPlaylist: (body)      => apiRequest('POST', '/playlists', body),
    updatePlaylist: (id, body)  => apiRequest('PUT', `/playlists/${id}`, body),
    deletePlaylist: (id)        => apiRequest('DELETE', `/playlists/${id}`),

    addSong:    (playlistId, songId) => apiRequest('POST', `/playlists/${playlistId}/songs`, { songId }),
    removeSong: (playlistId, songId) => apiRequest('DELETE', `/playlists/${playlistId}/songs/${songId}`),

    resequence: (id, algorithm)      => apiRequest('POST', `/playlists/${id}/resequence`, { algorithm }),
    exportSequence: (idOrBody, maybeBody) => {
        if (typeof idOrBody === 'string' && idOrBody.trim().length > 0 && maybeBody) {
            return apiRequest('POST', `/playlists/${idOrBody.trim()}/export`, maybeBody);
        }
        return apiRequest('POST', '/playlists/export', maybeBody || idOrBody);
    },
};

// Also attach globally to window for non-module scripts
if (typeof window !== 'undefined') {
    window.api = api;
    window.ModusAPI = api;
}

export default api;
