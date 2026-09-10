/**
 * Modus - Landing Page Script
 * Interactive Mood Sequencer and Preset Selector
 */

document.addEventListener('DOMContentLoaded', () => {
    // --------------------------------------------------------------------------
    // 1. PRESET CONFIGURATIONS & TRACK DATA
    // --------------------------------------------------------------------------
    const PRESETS = {
        focus: {
            id: 'focus',
            name: 'Focus',
            containerClass: 'bg-primary-container',
            badgeBgClass: 'bg-secondary',
            badgeTextClass: 'text-on-primary',
            tracks: [
                {
                    title: 'Synaptic Resonance',
                    artist: 'Cortex Node',
                    bpm: '112 BPM',
                    bpmColor: 'text-secondary',
                    meterFill: 'bg-secondary',
                    meterWidth: '70%',
                    hoverBg: 'hover:bg-secondary-container'
                },
                {
                    title: 'Deep Monolith',
                    artist: 'Kavinsky Lab',
                    bpm: '106 BPM',
                    bpmColor: 'text-secondary',
                    meterFill: 'bg-secondary',
                    meterWidth: '64%',
                    hoverBg: 'hover:bg-secondary-container'
                }
            ]
        },
        hype: {
            id: 'hype',
            name: 'Hype',
            containerClass: 'bg-primary-container',
            badgeBgClass: 'bg-error',
            badgeTextClass: 'text-on-primary',
            tracks: [
                {
                    title: 'Overdrive Riot',
                    artist: 'Volt Distortion',
                    bpm: '142 BPM',
                    bpmColor: 'text-error',
                    meterFill: 'bg-error',
                    meterWidth: '94%',
                    hoverBg: 'hover:bg-error-container'
                },
                {
                    title: 'Subsonic Velocity',
                    artist: 'Bass pressure 909',
                    bpm: '138 BPM',
                    bpmColor: 'text-error',
                    meterFill: 'bg-error',
                    meterWidth: '88%',
                    hoverBg: 'hover:bg-error-container'
                }
            ]
        },
        mellow: {
            id: 'mellow',
            name: 'Mellow',
            containerClass: 'bg-primary-container',
            badgeBgClass: 'bg-primary',
            badgeTextClass: 'text-on-primary',
            tracks: [
                {
                    title: 'Midnight Drift',
                    artist: 'Artist Name',
                    bpm: '85 BPM',
                    bpmColor: 'text-secondary',
                    meterFill: 'bg-secondary',
                    meterWidth: '75%',
                    hoverBg: 'hover:bg-primary-container'
                },
                {
                    title: 'Echoes of Slate',
                    artist: 'Producer X',
                    bpm: '72 BPM',
                    bpmColor: 'text-tertiary',
                    meterFill: 'bg-tertiary',
                    meterWidth: '60%',
                    hoverBg: 'hover:bg-tertiary-container'
                }
            ]
        },
        chill: {
            id: 'chill',
            name: 'Chill',
            containerClass: 'bg-primary-container',
            badgeBgClass: 'bg-tertiary',
            badgeTextClass: 'text-on-tertiary',
            tracks: [
                {
                    title: 'Velvet Horizon',
                    artist: 'Lo-Fi Collective',
                    bpm: '64 BPM',
                    bpmColor: 'text-tertiary',
                    meterFill: 'bg-tertiary',
                    meterWidth: '46%',
                    hoverBg: 'hover:bg-tertiary-container'
                },
                {
                    title: 'Astral Drift',
                    artist: 'Soma Dreams',
                    bpm: '58 BPM',
                    bpmColor: 'text-tertiary',
                    meterFill: 'bg-tertiary',
                    meterWidth: '38%',
                    hoverBg: 'hover:bg-tertiary-container'
                }
            ]
        }
    };

    const PRESET_KEYS = Object.keys(PRESETS);
    const ALL_CONTAINER_CLASSES = [
        'bg-primary-container',
        'bg-secondary-container',
        'bg-tertiary-container',
        'bg-error-container',
        'bg-surface-container-lowest'
    ];
    const ALL_BADGE_BG_CLASSES = ['bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-error'];
    const ALL_BADGE_TEXT_CLASSES = ['text-on-primary', 'text-on-tertiary'];
    const ALL_COLOR_CLASSES = ['text-secondary', 'text-tertiary', 'text-error'];
    const ALL_METER_FILL_CLASSES = ['bg-secondary', 'bg-tertiary', 'bg-error'];
    const ALL_HOVER_BG_CLASSES = [
        'hover:bg-primary-container',
        'hover:bg-secondary-container',
        'hover:bg-tertiary-container',
        'hover:bg-error-container'
    ];
    const INACTIVE_PRESET_CLASSES = [
        'bg-surface-container-lowest',
        'shadow-brutal',
        'hover:bg-surface-container',
        'active:translate-x-1',
        'active:translate-y-1',
        'active:shadow-none'
    ];

    const ACTIVE_PRESET_CLASSES = [
        'bg-primary-container',
        'shadow-brutal-lg',
        'sequencer-preset-card-active'
    ];

    // --------------------------------------------------------------------------
    // 2. DOM ELEMENTS CACHE
    // --------------------------------------------------------------------------
    const presetButtons = document.querySelectorAll('.sequencer-preset-card');
    const presetBadge = document.querySelector('.sequencer-preset-badge');
    const presetBadgeText = document.querySelector('.sequencer-preset-badge-text');
    const trackItems = document.querySelectorAll('.sequencer-track-item');
    let currentPresetId = 'mellow';
    let currentlyPlayingIndex = null;

    // --------------------------------------------------------------------------
    // 3. PRESET SWITCHING LOGIC
    // --------------------------------------------------------------------------
    function selectPreset(presetId) {
        const preset = PRESETS[presetId];
        if (!preset) return;

        currentPresetId = presetId;

        // A. Update Preset Selection Buttons (Exact same behavior & styling across all presets)
        presetButtons.forEach((btn) => {
            const btnPreset = btn.dataset.preset || getPresetFromClasses(btn);
            const desc = btn.querySelector('.sequencer-preset-desc');

            if (btnPreset === presetId) {
                // Active Button styling - identical to Mellow
                btn.classList.remove(...INACTIVE_PRESET_CLASSES, ...ALL_CONTAINER_CLASSES);
                btn.classList.add(...ACTIVE_PRESET_CLASSES);

                if (desc) {
                    desc.classList.remove('font-medium');
                    desc.classList.add('font-bold');
                }
            } else {
                // Inactive Button styling - identical across all unselected buttons
                btn.classList.remove(...ACTIVE_PRESET_CLASSES, ...ALL_CONTAINER_CLASSES);
                btn.classList.add(...INACTIVE_PRESET_CLASSES);

                if (desc) {
                    desc.classList.remove('font-bold');
                    desc.classList.add('font-medium');
                }
            }
        });

        // B. Update Sequencer Conceptual UI Header Badge
        if (presetBadge) {
            presetBadge.classList.remove(...ALL_BADGE_BG_CLASSES, ...ALL_BADGE_TEXT_CLASSES);
            presetBadge.classList.add(preset.badgeBgClass, preset.badgeTextClass);
        }
        if (presetBadgeText) {
            presetBadgeText.textContent = preset.name;
        }

        // C. Update Tracks in Tracklist with Animation
        updateTracklist(preset);
    }

    // Helper to determine preset key if data-preset isn't present
    function getPresetFromClasses(element) {
        if (element.classList.contains('sequencer-preset-card-focus')) return 'focus';
        if (element.classList.contains('sequencer-preset-card-hype')) return 'hype';
        if (element.classList.contains('sequencer-preset-card-mellow')) return 'mellow';
        if (element.classList.contains('sequencer-preset-card-chill')) return 'chill';
        return null;
    }

    // --------------------------------------------------------------------------
    // 4. TRACKLIST ANIMATION & RENDER
    // --------------------------------------------------------------------------
    function updateTracklist(preset) {
        // Step 1: Fade / Slide out existing tracks
        trackItems.forEach((trackItem) => {
            trackItem.classList.add('track-swap-out');
        });

        // Step 2: Swap content after slight delay for visual smoothness
        setTimeout(() => {
            preset.tracks.forEach((trackData, index) => {
                const trackItem = trackItems[index];
                if (!trackItem) return;

                const titleEl = trackItem.querySelector('.sequencer-track-title');
                const artistEl = trackItem.querySelector('.sequencer-track-artist');
                const bpmEl = trackItem.querySelector('.sequencer-track-bpm');
                const meterFillEl = trackItem.querySelector('.sequencer-track-meter-fill');
                const playIconEl = trackItem.querySelector('.sequencer-track-play-icon');

                // Update text content
                if (titleEl) titleEl.textContent = trackData.title;
                if (artistEl) artistEl.textContent = trackData.artist;

                // Update BPM & Color
                if (bpmEl) {
                    bpmEl.textContent = trackData.bpm;
                    bpmEl.classList.remove(...ALL_COLOR_CLASSES);
                    bpmEl.classList.add(trackData.bpmColor);
                }

                // Update Meter fill width and color
                if (meterFillEl) {
                    meterFillEl.classList.remove(...ALL_METER_FILL_CLASSES);
                    meterFillEl.classList.add(trackData.meterFill);
                    meterFillEl.style.width = trackData.meterWidth;
                }

                // Update hover state background
                trackItem.classList.remove(...ALL_HOVER_BG_CLASSES);
                trackItem.classList.add(trackData.hoverBg);

                // Reset play button icon
                if (playIconEl) {
                    playIconEl.textContent = 'play_arrow';
                }
            });

            currentlyPlayingIndex = null;

            // Step 3: Animate in new tracks
            trackItems.forEach((trackItem) => {
                trackItem.classList.remove('track-swap-out');
                trackItem.classList.add('track-swap-in');
            });

            // Cleanup animation class after transition completes
            setTimeout(() => {
                trackItems.forEach((trackItem) => {
                    trackItem.classList.remove('track-swap-in');
                });
            }, 300);
        }, 150);
    }

    // --------------------------------------------------------------------------
    // 5. PLAY / PAUSE INTERACTIVITY
    // --------------------------------------------------------------------------
    function initPlaybackControls() {
        trackItems.forEach((trackItem, index) => {
            const playBox = trackItem.querySelector('.sequencer-track-play-box');
            const playIcon = trackItem.querySelector('.sequencer-track-play-icon');

            if (!playBox || !playIcon) return;

            playBox.style.cursor = 'pointer';
            playBox.addEventListener('click', (e) => {
                e.stopPropagation();

                if (currentlyPlayingIndex === index) {
                    // Pause currently playing track
                    playIcon.textContent = 'play_arrow';
                    currentlyPlayingIndex = null;
                } else {
                    // Reset all track play icons
                    trackItems.forEach((item) => {
                        const icon = item.querySelector('.sequencer-track-play-icon');
                        if (icon) icon.textContent = 'play_arrow';
                    });

                    // Set this track to playing
                    playIcon.textContent = 'pause';
                    currentlyPlayingIndex = index;
                }
            });
        });
    }

    // --------------------------------------------------------------------------
    // 6. EVENT BINDINGS
    // --------------------------------------------------------------------------
    // Preset Card click handlers
    presetButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const presetId = btn.dataset.preset || getPresetFromClasses(btn);
            if (presetId) {
                selectPreset(presetId);
            }
        });
    });

    // Preset Badge click cycles to next preset
    if (presetBadge) {
        presetBadge.addEventListener('click', () => {
            const currentIndex = PRESET_KEYS.indexOf(currentPresetId);
            const nextIndex = (currentIndex + 1) % PRESET_KEYS.length;
            const nextPresetId = PRESET_KEYS[nextIndex];
            selectPreset(nextPresetId);
        });
    }

    // Navigation & CTA button hooks
    const ctaButtons = document.querySelectorAll('.hero-btn-primary, .navbar-cta-btn');
    ctaButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            window.location.href = 'login.html';
        });
    });

    const learnMoreBtn = document.querySelector('.hero-btn-secondary');
    if (learnMoreBtn) {
        learnMoreBtn.addEventListener('click', () => {
            const sequencerSection = document.querySelector('.sequencer-section');
            if (sequencerSection) {
                sequencerSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // --------------------------------------------------------------------------
    // 7. INITIALIZATION
    // --------------------------------------------------------------------------
    initPlaybackControls();
    selectPreset('mellow');
});
