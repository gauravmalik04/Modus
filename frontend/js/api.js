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

function resolveApiBase() {
    if (typeof window !== 'undefined' && window.MODUS_API_BASE) {
        return window.MODUS_API_BASE.replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined') {
        const { hostname, port } = window.location;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return port === '5000' ? '' : 'http://localhost:5000';
        }
        // If frontend is on the same domain as backend (modus-ygx3 or unified deploy), use relative paths
        if (hostname.includes('modus-ygx3')) {
            return '';
        }
        // Fallback for cross-domain frontend deployment (e.g. modus-pearl.vercel.app)
        return 'https://modus-ygx3.vercel.app';
    }
    return 'https://modus-ygx3.vercel.app';
}

const API_BASE = resolveApiBase();

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
        console.error('[Modus API] Connection failed:', networkErr, 'URL:', url);
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
    signup: (body) => apiRequest('POST', '/api/auth/signup', body),
    login:  (body) => apiRequest('POST', '/api/auth/login', body),
    me:     ()     => apiRequest('GET',  '/api/auth/me'),
    forgotPassword: (body) => apiRequest('POST', '/api/auth/forgot-password', body),

    // ── Songs ─────────────────────────────────────────────────────────────────
    getSongs:   (q = '', limit = 20) => apiRequest('GET', `/api/songs?q=${encodeURIComponent(q)}&limit=${limit}`),
    getSong:    (id)                 => apiRequest('GET', `/api/songs/${id}`),
    searchSong: (body)               => apiRequest('POST', '/api/songs/search', body),
    bulkSongs:  (tracks)             => apiRequest('POST', '/api/songs/bulk', { tracks }),

    // ── Playlists ─────────────────────────────────────────────────────────────
    getPlaylists:   ()          => apiRequest('GET', '/api/playlists'),
    getPlaylist:    (id)        => apiRequest('GET', `/api/playlists/${id}`),
    createPlaylist: (body)      => apiRequest('POST', '/api/playlists', body),
    updatePlaylist: (id, body)  => apiRequest('PUT', `/api/playlists/${id}`, body),
    deletePlaylist: (id)        => apiRequest('DELETE', `/api/playlists/${id}`),

    addSong:    (playlistId, songId) => apiRequest('POST', `/api/playlists/${playlistId}/songs`, { songId }),
    removeSong: (playlistId, songId) => apiRequest('DELETE', `/api/playlists/${playlistId}/songs/${songId}`),

    resequence: (id, algorithm)      => apiRequest('POST', `/api/playlists/${id}/resequence`, { algorithm }),
    exportSequence: (idOrBody, maybeBody) => {
        if (typeof idOrBody === 'string' && idOrBody.trim().length > 0 && maybeBody) {
            return apiRequest('POST', `/api/playlists/${idOrBody.trim()}/export`, maybeBody);
        }
        return apiRequest('POST', '/api/playlists/export', maybeBody || idOrBody);
    },
};

// Also attach globally to window for non-module scripts
if (typeof window !== 'undefined') {
    window.api = api;
    window.ModusAPI = api;
}

export default api;
