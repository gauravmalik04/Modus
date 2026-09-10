const LIBRARY_KEY = 'modus_library_playlists';

export const LibraryStore = {
    /** @returns {object[]} saved playlist plain objects */
    getAll() {
        try {
            return JSON.parse(localStorage.getItem(LIBRARY_KEY)) || [];
        } catch {
            return [];
        }
    },

    /** 
     * Checks if a playlist name is already in use
     * @param {string} name 
     * @returns {boolean}
     */
    isNameTaken(name) {
        const lowerName = name.trim().toLowerCase();
        return this.getAll().some(p => p.name.trim().toLowerCase() === lowerName);
    },

    /** 
     * Adds a new playlist to the store
     * @param {object} playlist - plain serialisable object 
     */
    add(playlist) {
        const playlists = this.getAll();
        playlists.push(playlist);
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(playlists));
    },

    /** 
     * Removes a playlist by ID
     * @param {string} id 
     */
    remove(id) {
        const playlists = this.getAll().filter(p => p.id !== id);
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(playlists));
    },

    /** Clears all playlists from the store */
    clear() {
        localStorage.removeItem(LIBRARY_KEY);
    }
};
