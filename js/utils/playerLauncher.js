/**
 * Modus - Player Launcher Utility
 * Shared helper that writes the player queue to sessionStorage and navigates to player.html.
 * Import this in library.js and playlist_view.js.
 */

/**
 * @param {import('../Playlist.js').Playlist} playlist  — Playlist instance
 * @param {object[]} songs     — full raw song array (from music_features.json)
 * @param {number}   startIndex — index of the song to start playing (default 0)
 */
export function launchPlayer(playlist, songs, startIndex = 0) {
    try {
        sessionStorage.setItem('modus_player_queue', JSON.stringify({
            playlist: {
                id:        playlist.id,
                name:      playlist.name,
                coverImage: playlist.coverImage,
                topMood:   playlist.topMood,
                tags:      playlist.tags,
            },
            songs,           // full raw array — player.js reads this as the queue
            currentIndex: Math.max(0, Math.min(startIndex, songs.length - 1)),
            shuffle: false,
            repeat:  'off', // 'off' | 'one' | 'all'
            volume:  0.75,
        }));
    } catch (e) {
        console.error('launchPlayer: could not write queue to sessionStorage', e);
    }
    window.location.href = 'player.html';
}
