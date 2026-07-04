// ================= ELEMENTS =================
const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("search");
const musicList = document.getElementById("musicList");
const topMixGrid = document.getElementById("topMixGrid");

const playBtn = document.getElementById("playPauseBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const progressBar = document.getElementById("progressBar");
const volumeSlider = document.querySelector(".volume-slider");

const playerBar = document.getElementById("playerBar");
const playerThumb = document.getElementById("playerThumb");
const playerTitle = document.getElementById("playerTitle");
const playerArtist = document.getElementById("playerArtist");

const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const suggestionBox = document.getElementById("searchSuggestions");

// ================= PLAYER STATE =================
let currentAudio = new Audio();
let currentQueue = [];
let currentIndex = -1;
let currentVideoId = "";
let isPlaying = false;
let playHistory = {};
let currentTrackData = null;
let activePlaylistId = null;

document.addEventListener("DOMContentLoaded", () => {
    updateGreeting();
    loadTopMix();
    loadSidebarPlaylists(); // Ambil daftar playlist untuk ditaruh di sebelah kiri
    hidePlayer();

    // Double click listener di seluruh area playerBar untuk expand/collapse
    playerBar.addEventListener("dblclick", (e) => {
        // Jangan expand/collapse jika klik pada tombol kontrol, input range, atau link
        if (e.target.closest("button") || e.target.closest("input") || e.target.closest("a") || e.target.closest(".expanded-actions")) {
            return;
        }
        playerBar.classList.toggle("expanded");
    });

    // Event listener single click pada tombol collapse
    const collapseBtn = document.getElementById("collapsePlayerBtn");
    if (collapseBtn) {
        collapseBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            playerBar.classList.remove("expanded");
        });
    }

    // Event listener single click pada cover album besar
    const expandedCover = document.getElementById("expandedCover");
    if (expandedCover) {
        expandedCover.style.cursor = "pointer";
        expandedCover.addEventListener("click", (e) => {
            e.stopPropagation();
            playerBar.classList.remove("expanded");
        });
    }
});

// ================= LOAD PLAYLIST KE SIDEBAR LEFT =================
async function loadSidebarPlaylists() {
    try {
        const res = await fetch('/api/user_playlists');
        const playlists = await res.json();
        const sidebarContainer = document.getElementById("sidebarPlaylistContainer");
        if (!sidebarContainer) return;
        sidebarContainer.innerHTML = "";

        playlists.forEach(pl => {
            const item = document.createElement("div");
            item.className = "sidebar-playlist-item";
            // Tampilan list sidebar menggunakan nama playlist
            item.innerHTML = `<span class="icon-folder">📁</span> <span>${pl.name}</span>`;
            item.onclick = () => loadPlaylistDetailView(pl.id, pl.name);
            sidebarContainer.appendChild(item);
        });
    } catch (err) {
        console.error("Gagal load playlist sidebar:", err);
    }
}

// ================= FUNGSI NAVIGASI / SWITCH VIEW BERSIH =================
function switchView(targetViewId) {
    const views = ["homeSections", "playlistView", "profilePage", "playlistsListView"];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === targetViewId) {
                el.style.display = "block";
                setTimeout(() => {
                    el.classList.add("active");
                }, 10);
            } else {
                el.classList.remove("active");
                el.style.display = "none";
            }
        }
    });
}

function backToHome() {
    switchView("homeSections");

    // Hapus status aktif tombol pill sidebar saat balik ke home
    document.querySelectorAll(".sidebar .pill").forEach(p => p.classList.remove("active"));

    // Tampilkan kembali bagian Top Mix yang sempat disembunyikan saat search
    const topMixSection = document.getElementById("topMixSection");
    if (topMixSection) {
        topMixSection.style.display = "block";
    }

    // Kembalikan teks judul ke "Rekomendasi Untukmu" (atau judul default home kamu)
    const recTitle = document.getElementById("recommendationTitle");
    if (recTitle) {
        recTitle.textContent = "Rekomendasi Untukmu";
    }

    // FORCE load ulang lagu trending agar hasil search tertimpa kembali ke konten Home asli
    loadTopMix();
}

// ================= MENU BARU DI SIDEBAR KIRI: LIKED & FAVORITES =================
async function loadLikedSongsView() {
    switchView("playlistView");

    // Set active button style di sidebar
    document.querySelectorAll(".sidebar .pill").forEach(p => p.classList.remove("active"));
    document.getElementById("pillLikedBtn").classList.add("active");

    document.getElementById("playlistViewName").textContent = "Liked Songs";
    document.getElementById("playlistDeleteBtn").style.display = "none";

    try {
        const res = await fetch('/api/liked_songs');
        const songs = await res.json();

        // Atur Cover Besar Halaman Playlist Berdasarkan Lagu Pertama
        const coverImg = document.getElementById("playlistViewCoverImg");
        if (songs.length > 0 && songs[0].thumbnail) {
            coverImg.src = songs[0].thumbnail;
        } else {
            coverImg.src = "/static/logo.png"; // fallback logo default
        }

        renderSongRows(songs);
    } catch (err) { console.error(err); }
}

async function loadFavoritesView() {
    switchView("playlistView");

    // Set active button style di sidebar
    document.querySelectorAll(".sidebar .pill").forEach(p => p.classList.remove("active"));
    document.getElementById("pillFavBtn").classList.add("active");

    document.getElementById("playlistViewName").textContent = "Favorites";
    document.getElementById("playlistDeleteBtn").style.display = "none";

    try {
        const res = await fetch('/api/favorite_songs');
        const songs = await res.json();

        // Atur Cover Besar Halaman Playlist Berdasarkan Lagu Pertama
        const coverImg = document.getElementById("playlistViewCoverImg");
        if (songs.length > 0 && songs[0].thumbnail) {
            coverImg.src = songs[0].thumbnail;
        } else {
            coverImg.src = "/static/logo.png";
        }

        renderSongRows(songs);
    } catch (err) { console.error(err); }
}

async function loadPlaylistsMainView() {
    switchView("playlistsListView");

    // Set active button style di sidebar
    document.querySelectorAll(".sidebar .pill").forEach(p => p.classList.remove("active"));
    document.getElementById("pillPlaylistBtn").classList.add("active");

    try {
        const res = await fetch('/api/user_playlists');
        const playlists = await res.json();
        displayPlaylistsInMain(playlists);
    } catch (err) {
        console.error("Gagal memuat playlists di halaman utama:", err);
    }
}

function displayPlaylistsInMain(playlists) {
    const grid = document.getElementById("playlistsGrid");
    if (!grid) return;
    grid.innerHTML = "";

    if (playlists.length === 0) {
        grid.innerHTML = `<p style="color: #b3b3b3; padding: 20px; grid-column: 1/-1; text-align: center;">Belum ada playlist. Klik tombol "+" di sebelah kiri atas untuk membuat playlist baru!</p>`;
        return;
    }

    playlists.forEach(pl => {
        const card = document.createElement("div");
        card.className = "music-card";
        card.style.position = "relative";

        card.innerHTML = `
            <div class="img-wrap" style="background: #282828; aspect-ratio: 1; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 64px; cursor: pointer;">
                📁
            </div>
            <p style="margin-top: 12px; cursor: pointer;"><strong>${pl.name}</strong></p>
        `;
        card.onclick = () => loadPlaylistDetailView(pl.id, pl.name);
        grid.appendChild(card);
    });
}

function renderSongRows(songs) {
    document.getElementById("playlistTrackCount").textContent = songs.length;
    const listContainer = document.getElementById("playlistSongsList");
    listContainer.innerHTML = "";

    if (songs.length === 0) {
        listContainer.innerHTML = `<p style="color: #b3b3b3; padding: 20px;">Belum ada track rekaman di sini.</p>`;
        return;
    }

    songs.forEach((song, idx) => {
        const row = document.createElement("div");
        row.className = "song-row-item";
        const thumb = song.thumbnail || `https://img.youtube.com/vi/${song.video_id}/mqdefault.jpg`;

        row.innerHTML = `
            <div class="row-number">${idx + 1}</div>
            <div class="row-main-info">
                <img class="row-thumb" src="${thumb}">
                <div class="row-metadata">
                    <span class="row-title">${song.title}</span>
                    <span class="row-artist">${song.artist || 'Now Playing'}</span>
                </div>
            </div>
            <div class="row-actions">
                <button class="btn-remove-song" title="Hapus">🗑️</button>
            </div>
        `;

        row.onclick = (e) => {
            if (e.target.classList.contains("btn-remove-song")) return;
            currentQueue = songs;
            currentIndex = idx;
            playSongFromQueue();
        };

        row.querySelector(".btn-remove-song").onclick = async (e) => {
            e.stopPropagation();
            // Panggil API remove jika diperlukan, atau sekadar UI remove:
            showToast("Lagu berhasil dikeluarkan.");
            row.remove();
        };

        listContainer.appendChild(row);
    });

    document.getElementById("playlistPlayBtn").onclick = () => {
        if (songs.length > 0) {
            currentQueue = songs;
            currentIndex = 0;
            playSongFromQueue();
        }
    };
}

// ================= TAMPILKAN DETAIL ISI PLAYLIST =================
async function loadPlaylistDetailView(playlistId, playlistName) {
    activePlaylistId = playlistId;
    switchView("playlistView");

    document.getElementById("playlistViewName").textContent = playlistName;
    document.getElementById("playlistDeleteBtn").style.display = "block";

    try {
        const res = await fetch(`/api/playlist/${playlistId}/songs`);
        const songs = await res.json();

        document.getElementById("playlistTrackCount").textContent = songs.length;
        const listContainer = document.getElementById("playlistSongsList");
        listContainer.innerHTML = "";

        // Set Cover Berdasarkan Lagu Pertama di Playlist
        const coverImg = document.getElementById("playlistViewCoverImg");
        if (songs.length > 0 && (songs[0].thumbnail || songs[0].cover_url)) {
            coverImg.src = songs[0].thumbnail || songs[0].cover_url;
        } else {
            coverImg.src = "/static/logo.png";
        }

        if (songs.length === 0) {
            listContainer.innerHTML = `<p style="color: #b3b3b3; padding: 20px;">Belum ada lagu di dalam playlist ini.</p>`;
            return;
        }

        songs.forEach((song, idx) => {
            const row = document.createElement("div");
            row.className = "song-row-item";
            const thumb = song.thumbnail || song.cover_url || `https://img.youtube.com/vi/${song.video_id}/mqdefault.jpg`;

            row.innerHTML = `
                <div class="row-number">${idx + 1}</div>
                <div class="row-main-info">
                    <img class="row-thumb" src="${thumb}">
                    <div class="row-metadata">
                        <span class="row-title">${song.title}</span>
                        <span class="row-artist">${song.artist || 'Now Playing'}</span>
                    </div>
                </div>
                <div class="row-actions">
                    <button class="btn-remove-song" title="Hapus dari Playlist">🗑️</button>
                </div>
            `;

            row.onclick = (e) => {
                if (e.target.classList.contains("btn-remove-song")) return;
                currentQueue = songs.map(s => ({
                    title: s.title,
                    video_id: s.video_id,
                    thumbnail: s.thumbnail || s.cover_url
                }));
                currentIndex = idx;
                playSongFromQueue();
            };

            row.querySelector(".btn-remove-song").onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`Hapus "${song.title}" dari playlist ini?`)) {
                    await removeSongFromPlaylist(playlistId, song.video_id);
                }
            };

            listContainer.appendChild(row);
        });

        document.getElementById("playlistPlayBtn").onclick = () => {
            if (songs.length > 0) {
                currentQueue = songs.map(s => ({
                    title: s.title,
                    video_id: s.video_id,
                    thumbnail: s.thumbnail || s.cover_url
                }));
                currentIndex = 0;
                playSongFromQueue();
            }
        };

        document.getElementById("playlistDeleteBtn").onclick = async () => {
            if (confirm(`Apakah kamu yakin ingin menghapus playlist "${playlistName}"?`)) {
                await deletePlaylist(playlistId);
            }
        };

    } catch (err) {
        console.error("Gagal memuat isi playlist:", err);
    }
}

// ================= ACTION UTILITY PLAYLIST =================
async function removeSongFromPlaylist(playlistId, videoId) {
    try {
        const res = await fetch('/api/playlist/remove_song', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playlist_id: playlistId, video_id: videoId })
        });
        const data = await res.json();
        showToast(data.message);
        loadPlaylistDetailView(playlistId, document.getElementById("playlistViewName").textContent);
    } catch (err) { console.error(err); }
}

async function deletePlaylist(playlistId) {
    try {
        const res = await fetch(`/api/playlist/delete/${playlistId}`, { method: 'DELETE' });
        const data = await res.json();
        showToast(data.message);
        backToHome();
        loadSidebarPlaylists();
    } catch (err) { console.error(err); }
}

// ================= UPDATE AUDIO ENGINE & PLAYSONG =================
async function playSong(videoId, title, thumbnail) {
    currentVideoId = videoId;
    currentTrackData = {
        video_id: videoId,
        title: title,
        thumbnail: thumbnail,
        artist: "Now Playing"
    };

    openRightPanel();

    // Set UI awal selagi loading data tambahan
    document.getElementById("panelCover").src = thumbnail;
    document.getElementById("panelTitle").textContent = title;
    document.getElementById("panelArtist").textContent = "Now Playing";
    document.getElementById("panelAuthor").textContent = "Loading...";
    document.getElementById("panelPublished").textContent = "Loading...";

    document.getElementById("expandedCover").src = thumbnail;
    document.getElementById("expandedTitle").textContent = title;

    const iconLike = document.getElementById("iconLike");
    const iconFav = document.getElementById("iconFav");
    const iconPlaylist = document.getElementById("iconPlaylist");
    if (iconLike) iconLike.setAttribute("data-icon", "mdi:heart");
    if (iconFav) iconFav.setAttribute("data-icon", "mdi:star");
    if (iconPlaylist) iconPlaylist.setAttribute("data-icon", "mdi:plus");

    fetch(`/api/track_status/${videoId}`)
        .then(res => res.json())
        .then(data => {
            if (data.liked && iconLike) iconLike.setAttribute("data-icon", "mdi:heart-broken");
            if (data.favorited && iconFav) iconFav.setAttribute("data-icon", "mdi:star-off");
            if (data.in_playlist && iconPlaylist) iconPlaylist.setAttribute("data-icon", "mdi:minus");
        })
        .catch(err => console.error("Error fetching track status:", err));

    playerBar.classList.add("active");
    playerThumb.src = thumbnail;
    playerTitle.textContent = title;
    playerArtist.textContent = "Now Playing";
    setDynamicBackground(thumbnail);

    try {
        const res = await fetch(`/stream/${videoId}`);
        const data = await res.json();
        const audioUrl = data.data?.url || data.url;

        if (!audioUrl) {
            showToast("Stream gagal diputar");
            return;
        }

        // Tampilkan info tambahan jika disediakan oleh API YouTube backend-mu
        // Catatan: Pastikan endpoint /stream/{id} di backend Flask/Express-mu mengirim data author & isi tanggal.
        if (data.data?.author || data.author) {
            const authorName = data.data?.author || data.author;
            document.getElementById("panelArtist").textContent = authorName;
            document.getElementById("panelAuthor").textContent = authorName;
            playerArtist.textContent = authorName;
            if (currentTrackData) currentTrackData.artist = authorName;
        } else {
            document.getElementById("panelAuthor").textContent = "Unknown Artist";
        }

        if (data.data?.published || data.published) {
            document.getElementById("panelPublished").textContent = data.data?.published || data.published;
        } else {
            document.getElementById("panelPublished").textContent = "-";
        }

        currentAudio.pause();
        currentAudio.src = audioUrl;
        currentAudio.load();
        trackPlay(videoId);
        await currentAudio.play();

        isPlaying = true;
        playBtn.textContent = "⏸";
        loadRecommendations(videoId);
    } catch (err) {
        console.error("Play error:", err);
    }
}

// ================= UTILS FOR RIGHT PANEL LAYOUT =================
function openRightPanel() {
    document.getElementById("appContainer").classList.add("show-right-panel");
}

function closeRightPanel() {
    // Menghapus class ini akan membuat CSS grid mengembalikan ukuran kolom panel kanan ke 0px
    // Sehingga halaman Home (.main) otomatis melebar kembali!
    document.getElementById("appContainer").classList.remove("show-right-panel");
}

function playSongFromQueue() {
    if (currentQueue.length === 0) return;
    if (currentIndex < 0) return;
    const song = currentQueue[currentIndex];
    playSong(song.video_id || song.videoId, song.title, song.thumbnail || song.cover_url);
}

// ================= SEARCH & SUGGESTIONS =================
async function searchMusic(query) {
    if (!query) return;

    musicList.innerHTML = "<p>Loading...</p>";

    // 1. Pastikan view pindah/tetap di homeSections
    switchView("homeSections");

    // 2. Sembunyikan bagian Top Mix (lagu paling atas) sesuai request-mu
    const topMixSection = document.getElementById("topMixSection");
    if (topMixSection) {
        topMixSection.style.display = "none";
    }

    // 3. Ubah teks judul rekomendasi menjadi "Hasil dari {nama lagu}"
    const recTitle = document.getElementById("recommendationTitle");
    if (recTitle) {
        recTitle.textContent = `Hasil dari "${query}"`;
    }

    try {
        const res = await fetch(`/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        const items = Array.isArray(data) ? data.map(item => ({
            title: item.title,
            video_id: item.video_id || item.videoId || item.id,
            thumbnail: item.thumbnail
        })) : [];

        displaySongs(items);
    } catch (err) {
        console.error("Search error:", err);
        musicList.innerHTML = "<p>Error saat search</p>";
    }
}

function displaySongs(items) {
    musicList.innerHTML = "";
    if (!items || items.length === 0) {
        musicList.innerHTML = "<p>Lagu tidak ditemukan</p>";
        return;
    }

    items.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "music-card";
        const thumb = item.thumbnail || `https://img.youtube.com/vi/${item.video_id}/mqdefault.jpg`;

        card.innerHTML = `
            <div class="img-wrap">
                <img src="${thumb}">
                <div class="play-overlay">▶</div>
            </div>
            <p><strong>${item.title}</strong></p>
        `;

        card.querySelector(".play-overlay").addEventListener("click", (e) => {
            e.stopPropagation();
            currentQueue = items;
            currentIndex = index;
            playSongFromQueue();
        });

        // Double-click listener pada cover gambar untuk langsung memutar lagu
        card.querySelector("img").addEventListener("dblclick", (e) => {
            e.stopPropagation();
            currentQueue = items;
            currentIndex = index;
            playSongFromQueue();
        });

        musicList.appendChild(card);
    });
}

// Input Listener Search Suggestions & Right Action Button (Clear / Search)
searchInput.addEventListener("input", async () => {
    const query = searchInput.value.trim();
    const rightBtn = document.getElementById("searchRightBtn");

    if (rightBtn) {
        if (query.length > 0) {
            rightBtn.textContent = "❌";
            rightBtn.title = "Clear search";
        } else {
            rightBtn.textContent = "🔍";
            rightBtn.title = "Search";
        }
    }

    if (!query) {
        suggestionBox.style.display = "none";
        return;
    }

    const res = await fetch(`/search?q=${query}`);
    const data = await res.json();

    suggestionBox.innerHTML = "";
    suggestionBox.style.display = "block";

    // Di-limit ke 5 rekomendasi agar lebih ringan
    data.slice(0, 5).forEach(item => {
        const div = document.createElement("div");
        div.className = "suggestion-item";
        div.textContent = item.title;

        div.onclick = () => {
            searchInput.value = item.title;
            if (rightBtn) {
                rightBtn.textContent = "❌";
                rightBtn.title = "Clear search";
            }
            suggestionBox.style.display = "none";
            searchMusic(item.title);
        };
        suggestionBox.appendChild(div);
    });
});

// Listener tombol kanan (Clear jika ada teks, Search jika kosong)
const searchRightBtn = document.getElementById("searchRightBtn");
if (searchRightBtn) {
    searchRightBtn.addEventListener("click", () => {
        const query = searchInput.value.trim();
        if (query.length > 0) {
            searchInput.value = "";
            searchRightBtn.textContent = "🔍";
            searchRightBtn.title = "Search";
            suggestionBox.style.display = "none";
            backToHome();
        } else {
            searchMusic("");
        }
    });
}

// Listener Enter keypress untuk memicu pencarian langsung
searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        const query = searchInput.value.trim();
        if (query) {
            searchMusic(query);
            suggestionBox.style.display = "none";
        }
    }
});

// Klik luar search bar hilangkan kotak saran
document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-area") && suggestionBox) {
        suggestionBox.style.display = "none";
    }
});

// ================= TOP MIX & RECOMMENDATIONS =================
async function loadTopMix() {
    try {
        const res = await fetch(`/trending`);
        const data = await res.json();
        let items = Array.isArray(data) ? data.map(item => ({
            title: item.title,
            video_id: item.video_id || item.videoId || item.id,
            thumbnail: item.thumbnail
        })) : [];

        items.sort(() => Math.random() - 0.5);
        if (items.length === 0) {
            musicList.innerHTML = "<p>Tidak ada lagu trending</p>";
            return;
        }
        currentQueue = items;
        displayTopMix(items.slice(0, 6));
        displaySongs(items);
    } catch (err) {
        console.error("Trending error:", err);
    }
}

function displayTopMix(items) {
    topMixGrid.innerHTML = "";
    items.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "mix-item";
        const thumb = item.thumbnail || `https://img.youtube.com/vi/${item.video_id}/mqdefault.jpg`;
        div.innerHTML = `<img src="${thumb}"> <span>${item.title}</span>`;
        div.onclick = () => {
            currentQueue = items;
            currentIndex = index;
            playSongFromQueue();
        };
        topMixGrid.appendChild(div);
    });
}

async function loadRecommendations(videoId = null) {
    try {
        let url = videoId ? `/recommendations/${videoId}` : `/trending`;
        const res = await fetch(url);
        const data = await res.json();
        let rawItems = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);

        let items = rawItems.map(item => ({
            title: item.title,
            video_id: item.video_id || item.videoId || item.id,
            thumbnail: item.thumbnail
        }));

        displayRecommendations(items);
    } catch (err) { console.error(err); }
}

function displayRecommendations(items) {
    const container = document.getElementById("recommendList");
    if (!container) return;
    container.innerHTML = "";
    items.slice(0, 5).forEach(item => {
        const div = document.createElement("div");
        div.className = "rec-item";
        div.innerHTML = `<img src="${item.thumbnail}"> <span>${item.title}</span>`;
        div.onclick = () => playSong(item.video_id, item.title, item.thumbnail);
        container.appendChild(div);
    });
}

// ================= CONTROLS ACTION (PLAY, NEXT, PREV) =================
playBtn.addEventListener("click", () => {
    if (!currentAudio.src) return;
    if (isPlaying) {
        currentAudio.pause();
        playBtn.textContent = "▶";
    } else {
        currentAudio.play();
        playBtn.textContent = "⏸";
    }
    isPlaying = !isPlaying;
});

nextBtn.addEventListener("click", () => {
    if (currentQueue.length === 0) return;
    currentIndex = (currentIndex + 1) % currentQueue.length;
    playSongFromQueue();
});

prevBtn.addEventListener("click", () => {
    if (currentQueue.length === 0) return;
    currentIndex = (currentIndex - 1 + currentQueue.length) % currentQueue.length;
    playSongFromQueue();
});

currentAudio.addEventListener("ended", () => {
    if (currentQueue.length > 0) {
        currentIndex = (currentIndex + 1) % currentQueue.length;
        playSongFromQueue();
    }
});

// ================= PROGRESS BAR & UTILS =================
currentAudio.addEventListener("timeupdate", () => {
    const current = currentAudio.currentTime;
    const total = currentAudio.duration;
    if (!isNaN(total) && total > 0) {
        progressBar.value = (current / total) * 100;
        currentTimeEl.textContent = formatTime(current);
        durationEl.textContent = formatTime(total);
    }
});

progressBar.addEventListener("input", () => {
    if (!currentAudio.duration) return;
    currentAudio.currentTime = (progressBar.value / 100) * currentAudio.duration;
});

volumeSlider.addEventListener("input", () => {
    currentAudio.volume = volumeSlider.value / 100;
});

function setDynamicBackground(imageUrl) {
    const main = document.querySelector(".main");
    if (!main) return;
    main.style.background = `linear-gradient(to bottom, rgba(0,0,0,0.3), #121212 60%), url(${imageUrl})`;
    main.style.backgroundSize = "cover";
    main.style.backgroundPosition = "center";
}

function openRightPanel() { document.getElementById("appContainer").classList.add("show-right-panel"); }
function closeRightPanel() { document.getElementById("appContainer").classList.remove("show-right-panel"); }
function hidePlayer() { playerBar.classList.remove("active"); }
function trackPlay(videoId) { playHistory[videoId] = (playHistory[videoId] || 0) + 1; }
function formatTime(sec) {
    const min = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${min}:${s < 10 ? "0" : ""}${s}`;
}

function updateGreeting() {
    const el = document.getElementById("greetingText");
    if (!el) return;
    const hour = new Date().getHours();
    el.textContent = hour < 12 ? "Good Morning ☀️" : hour < 18 ? "Good Afternoon 🌤️" : "Good Evening 🌙";
}

// ================= CUSTOM TOAST NOTIFICATION =================
function showToast(message) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "custom-toast";
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

// ================= INTERACTIONS (LIKE, FAVORITE, MODAL) =================
async function toggleLike() {
    if (!currentTrackData) return showToast("Putar lagu terlebih dahulu!");
    try {
        const res = await fetch('/api/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentTrackData)
        });
        const d = await res.json();
        const iconLike = document.getElementById("iconLike");
        if (d.action === 'liked') {
            showToast("Ditambahkan ke Lagu Disukai ❤️");
            if (iconLike) iconLike.setAttribute("data-icon", "mdi:heart-broken");
        } else {
            showToast("Dihapus dari Lagu Disukai 💔");
            if (iconLike) iconLike.setAttribute("data-icon", "mdi:heart");
        }
    } catch (err) { console.error(err); }
}

async function toggleFav() {
    if (!currentTrackData) return showToast("Putar lagu terlebih dahulu!");
    try {
        const res = await fetch('/api/favorite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentTrackData)
        });
        const d = await res.json();
        const iconFav = document.getElementById("iconFav");
        if (d.action === 'favorited') {
            showToast("Ditambahkan ke Favorit ⭐");
            if (iconFav) iconFav.setAttribute("data-icon", "mdi:star-off");
        } else {
            showToast("Dihapus dari Favorit 🗑️");
            if (iconFav) iconFav.setAttribute("data-icon", "mdi:star");
        }
    } catch (err) { console.error(err); }
}

async function openCreatePlaylistModal() {
    const modal = document.getElementById("customPlaylistModal");
    modal.style.display = "flex";
    setTimeout(() => modal.classList.add("show"), 10);

    try {
        const res = await fetch('/api/user_playlists');
        const playlists = await res.json();
        const optionsBox = document.getElementById("modalPlaylistOptions");
        optionsBox.innerHTML = "";

        playlists.forEach(pl => {
            const btn = document.createElement("button");
            btn.className = "modal-item-btn";
            btn.textContent = `📁 ${pl.name}`;
            btn.onclick = () => addSongToExistingPlaylist(pl.id, pl.name);
            optionsBox.appendChild(btn);
        });
    } catch (err) { console.error(err); }
}

function closeCustomModal() {
    const modal = document.getElementById("customPlaylistModal");
    modal.classList.remove("show");
    setTimeout(() => modal.style.display = "none", 300);
    document.getElementById("customPlaylistInput").value = "";
}

async function submitNewPlaylistWithSong() {
    const input = document.getElementById("customPlaylistInput");
    const name = input.value.trim();
    if (!name) return showToast("Nama playlist tidak boleh kosong!");

    try {
        const res = await fetch('/api/playlist/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        const data = await res.json();

        if (data.status === 'success') {
            const plRes = await fetch('/api/user_playlists');
            const playlists = await plRes.json();
            const createdPlaylist = playlists.find(p => p.name === name);

            if (currentTrackData && createdPlaylist) {
                await fetch('/api/playlist/add_song', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        playlist_id: createdPlaylist.id,
                        video_id: currentTrackData.video_id,
                        title: currentTrackData.title,
                        thumbnail: currentTrackData.thumbnail,
                        artist: currentTrackData.artist
                    })
                });
                showToast(`Playlist "${name}" dibuat & lagu ditambahkan! 🚀`);
                const iconPlaylist = document.getElementById("iconPlaylist");
                if (iconPlaylist) iconPlaylist.setAttribute("data-icon", "mdi:minus");
            } else {
                showToast(`Playlist "${name}" berhasil dibuat! 📁`);
            }
            closeCustomModal();
            loadSidebarPlaylists();
        }
    } catch (err) { showToast("Gagal memproses pembuatan playlist."); }
}

async function addSongToExistingPlaylist(playlistId, playlistName) {
    if (!currentTrackData) return showToast("Putar lagu terlebih dahulu!");
    try {
        const res = await fetch('/api/playlist/add_song', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playlist_id: playlistId,
                video_id: currentTrackData.video_id,
                title: currentTrackData.title,
                thumbnail: currentTrackData.thumbnail,
                artist: currentTrackData.artist
            })
        });
        const data = await res.json();
        showToast(`Lagu ditambahkan ke ${playlistName}! ✅`);
        const iconPlaylist = document.getElementById("iconPlaylist");
        if (iconPlaylist) iconPlaylist.setAttribute("data-icon", "mdi:minus");
        closeCustomModal();
    } catch (err) { console.error(err); }
}