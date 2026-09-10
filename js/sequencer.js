// =============================================================================
// js/sequencer.js
//
// Front-end wrapper to fetch the extracted songs from json-server and 
// generate all sequenced playlists for the UI.
// =============================================================================

import { PlaylistSequencer } from '../pipeline/PlaylistSequencer.js';

/**
 * Fetches all songs from json-server and returns the generated sequenced playlists.
 * @returns {Promise<Object<string, Array<object>>>}
 */
export async function getSequencedPlaylists() {
    try {
        const response = await fetch('http://localhost:3001/songs');
        if (!response.ok) {
            throw new Error(`Failed to fetch songs: ${response.statusText}`);
        }
        
        const songs = await response.json();
        const sequencer = new PlaylistSequencer(songs);
        
        return sequencer.getAllPlaylists();
    } catch (error) {
        console.error('[Sequencer] Error generating playlists:', error);
        return null;
    }
}
