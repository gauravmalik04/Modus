// ======================================================
// MODUS - PLAYLIST / SEQUENCE ENGINE
// ======================================================


// ======================================================
// HTML ELEMENTS
// ======================================================

const songList = document.getElementById("song-list");
const generateBtn = document.getElementById("generate-btn");
const previewPanel = document.getElementById("preview-panel");


// ======================================================
// GLOBAL DATA
// ======================================================

let songs = [];
let selectedAlgorithm = "romantic";


// ======================================================
// LOAD SONGS FROM data/songs.json
// ======================================================

async function loadSongs() {

    try {

        const response = await fetch("./data/songs.json");

        if (!response.ok) {
            throw new Error(
                `songs.json could not be loaded. Status: ${response.status}`
            );
        }

        const data = await response.json();

        // Your JSON structure is:
        // {
        //     "songs": [...]
        // }

        songs = Array.isArray(data.songs)
            ? data.songs
            : [];


        console.log("Songs Loaded:", songs.length);


        // Display songs on left
        displaySongs();


        // Update "10 TRACKS • 32M"
        updateSourceHeader();


    } catch (error) {

        console.error("Error loading songs.json:", error);


        songList.innerHTML = `
            <div style="
                padding: 20px;
                text-align: center;
                font-weight: 700;
            ">
                Unable to load songs
            </div>
        `;

    }

}


// ======================================================
// DISPLAY SONGS IN LEFT PANEL
// ======================================================

function displaySongs() {

    songList.innerHTML = "";


    if (songs.length === 0) {

        songList.innerHTML = `
            <div style="
                padding: 20px;
                text-align: center;
                font-weight: 700;
            ">
                No songs found
            </div>
        `;

        return;

    }


    songs.forEach((song) => {

        const songItem =
            document.createElement("div");


        songItem.classList.add("song-item");


        const bpm = song.features?.bpm;


        songItem.innerHTML = `

            <div class="song-item-title">
                ${song.name || "Unknown Song"}
            </div>

            <div class="song-item-artist">
                ${song.artist || "Unknown Artist"}
            </div>

            <div class="song-item-bpm">
                ${
                    typeof bpm === "number"
                        ? `${bpm.toFixed(2)} BPM`
                        : "BPM N/A"
                }
            </div>

        `;


        // ==================================================
        // CLICK SONG
        // ==================================================

        songItem.addEventListener("click", () => {

            // Remove active from all songs
            document
                .querySelectorAll(".song-item")
                .forEach((item) => {

                    item.classList.remove("active");

                });


            // Make clicked song active
            songItem.classList.add("active");


            // Show song in preview panel
            showSongPreview(song);

        });


        songList.appendChild(songItem);

    });

}


// ======================================================
// SHOW SELECTED SONG IN PREVIEW PANEL
// ======================================================

function showSongPreview(song) {

    if (!previewPanel) {
        return;
    }


    // Duration
    const durationMs =
        Number(song.duration_ms) || 0;


    const minutes =
        Math.floor(durationMs / 60000);


    const seconds =
        Math.floor(
            (durationMs % 60000) / 1000
        );


    const durationText =
        `${minutes}:${String(seconds).padStart(2, "0")}`;


    // BPM
    const bpm =
        song.features?.bpm;


    // Energy
    const energy =
        song.features?.energy;


    // Danceability
    const danceability =
        song.features?.danceability;


    // Happiness
    const happiness =
        song.features?.happiness;


    previewPanel.innerHTML = `

        <!-- NOW PLAYING -->

        <div class="now-playing">

            <div class="song-stat yellow">
                SELECTED SONG
            </div>


            <div class="now-playing-title">
                ${song.name || "Unknown Song"}
            </div>


            <div class="now-playing-artist">
                ${song.artist || "Unknown Artist"}
            </div>


            <div class="song-stats">


                <div class="song-stat yellow">

                    ${
                        typeof bpm === "number"
                            ? bpm.toFixed(2) + " BPM"
                            : "BPM N/A"
                    }

                </div>


                <div class="song-stat">

                    ${durationText}

                </div>


                <div class="song-stat">

                    ${song.genre || "UNKNOWN"}

                </div>


                <div class="song-stat">

                    ${song.features?.key || "N/A"}

                </div>


            </div>

        </div>


        <!-- SONG DETAILS -->

        <div class="next-song">

            <h3>
                SONG DETAILS
            </h3>


            <div class="next-song-title">

                ${song.album || "Unknown Album"}

            </div>


            <div class="next-song-artist">

                ${
                    song.release_date ||
                    "Unknown Release Date"
                }

            </div>


            <div class="transition-cost">

                ENERGY:
                ${
                    typeof energy === "number"
                        ? Math.round(energy * 100) + "%"
                        : "N/A"
                }

            </div>


            <div class="transition-cost">

                DANCEABILITY:
                ${
                    typeof danceability === "number"
                        ? Math.round(danceability * 100) + "%"
                        : "N/A"
                }

            </div>


            <div class="transition-cost">

                HAPPINESS:
                ${
                    typeof happiness === "number"
                        ? Math.round(happiness * 100) + "%"
                        : "N/A"
                }

            </div>

        </div>

    `;

}


// ======================================================
// UPDATE SOURCE HEADER
// ======================================================

function updateSourceHeader() {

    const header =
        document.querySelector(
            ".source-panel .panel-header p"
        );


    if (!header) {
        return;
    }


    let totalMilliseconds = 0;


    songs.forEach((song) => {

        totalMilliseconds +=
            Number(song.duration_ms) || 0;

    });


    const totalMinutes =
        Math.floor(
            totalMilliseconds / 60000
        );


    const remainingSeconds =
        Math.floor(
            (totalMilliseconds % 60000) / 1000
        );


    header.textContent =
        `${songs.length} TRACKS • ${totalMinutes}M ${remainingSeconds}S`;

}


// ======================================================
// ALGORITHM CARDS
// ======================================================

const algorithmCards =
    document.querySelectorAll(
        ".algorithm-card"
    );


algorithmCards.forEach((card) => {

    card.addEventListener("click", () => {


        // Remove active from all
        algorithmCards.forEach((item) => {

            item.classList.remove("active");

        });


        // Add active to clicked
        card.classList.add("active");


        // Get algorithm name
        const text =
            card
                .querySelector("span:last-child")
                ?.textContent
                ?.trim()
                ?.toLowerCase();


        if (!text) {
            return;
        }


        selectedAlgorithm =
            text.replace(/\s+/g, "_");


        console.log(
            "Selected Algorithm:",
            selectedAlgorithm
        );

    });

});


// ======================================================
// GET PRESET SCORE
// ======================================================

function getPresetScore(song) {

    return Number(
        song.presets?.[selectedAlgorithm]
    ) || 0;

}


// ======================================================
// GENERATE SEQUENCE
// ======================================================

function generateSequence() {

    if (songs.length === 0) {

        alert("No songs available.");
        return;

    }


    // Songs ki copy banao
    const sequence = [...songs];


    // Har baar random order
    sequence.sort(() => Math.random() - 0.5);


    console.log(
        "Generated Sequence:",
        sequence
    );


    // Preview mein show karo
    displaySequence(sequence);

}


// ======================================================
// DISPLAY GENERATED SEQUENCE
// ======================================================

function displaySequence(sequence) {

    if (!previewPanel) {
        return;
    }


    if (!sequence || sequence.length === 0) {

        previewPanel.innerHTML = "";

        return;

    }


    const firstSong =
        sequence[0];


    const algorithmTitle =
        selectedAlgorithm
            .replace(/_/g, " ")
            .toUpperCase();


    // Clear preview
    previewPanel.innerHTML = "";


    // ==================================================
    // FIRST SONG / NOW PLAYING
    // ==================================================

    const nowPlaying =
        document.createElement("div");


    nowPlaying.classList.add(
        "now-playing"
    );


    nowPlaying.innerHTML = `

        <div class="song-stat yellow">

            ${algorithmTitle}

        </div>


        <div class="now-playing-title">

            ${firstSong.name}

        </div>


        <div class="now-playing-artist">

            ${firstSong.artist}

        </div>


        <div class="song-stats">

            <div class="song-stat yellow">

                ${sequence.length} TRACKS

            </div>


            <div class="song-stat">

                ${
                    firstSong.features?.bpm
                        ? firstSong.features.bpm.toFixed(2)
                          + " BPM"
                        : "BPM N/A"
                }

            </div>

        </div>

    `;


    previewPanel.appendChild(
        nowPlaying
    );


    // ==================================================
    // GENERATED SEQUENCE
    // ==================================================

    const sequenceList =
        document.createElement("div");


    sequenceList.style.marginTop =
        "12px";


    sequence.forEach((song, index) => {

        const item =
            document.createElement("div");


        item.classList.add(
            "sequence-item"
        );


        const bpm =
            song.features?.bpm;


        const score =
            getPresetScore(song);


        item.innerHTML = `

            <div class="sequence-number">

                ${String(index + 1).padStart(2, "0")}

            </div>


            <div class="sequence-title">

                ${song.name}

                <div style="
                    font-size: 9px;
                    font-weight: 400;
                    margin-top: 2px;
                ">

                    ${song.artist}

                </div>

            </div>


            <div class="sequence-bpm">

                ${
                    typeof bpm === "number"
                        ? bpm.toFixed(2) + " BPM"
                        : ""
                }

                <br>

                ${Math.round(score * 100)}%

            </div>

        `;


        sequenceList.appendChild(
            item
        );

    });


    previewPanel.appendChild(
        sequenceList
    );

}


// ======================================================
// GENERATE BUTTON
// ======================================================

if (generateBtn) {

    generateBtn.addEventListener(
        "click",
        generateSequence
    );

}


// ======================================================
// START APPLICATION
// ======================================================

loadSongs();