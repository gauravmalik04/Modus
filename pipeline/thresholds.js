// =============================================================================
// pipeline/thresholds.js
//
// Minimum scores a song must achieve to qualify for a given preset playlist.
// Calibrated from sample data to ensure quality and prevent mood dilution.
// =============================================================================

export const PRESET_THRESHOLDS = {
    romantic:    0.57,
    energetic:   0.58,
    thrill:      0.55,
    chill:       0.57,
    feel_good:   0.60,
    melancholic: 0.55,
};

/**
 * Returns an array of preset names that this song qualifies for.
 * @param {object} song - Song JSON representation (with .presets)
 * @returns {Array<string>}
 */
export function getQualifyingPresets(song) {
    if (!song || !song.presets) return [];

    return Object.entries(PRESET_THRESHOLDS)
        .filter(([preset, threshold]) => (song.presets[preset] ?? 0) >= threshold)
        .map(([preset]) => preset);
}
