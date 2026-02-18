// ============================================================================
// DEADCETERA WORKFLOW APP v5.2.1 - MASTER FILE + iOS AUDIO + CLEANUP
// All fixes applied: Query escaping, delete buttons, metadata persistence
// Last updated: 2026-02-18
// ============================================================================

// Inject favicon to prevent 404 error
(function() {
    if (!document.querySelector('link[rel="icon"]')) {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        link.href = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+CjxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjE1IiBmaWxsPSIjNjY3ZWVhIi8+Cjx0ZXh0IHg9IjE2IiB5PSIyMiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxOCIgZmlsbD0id2hpdGUiPuKZqjwvdGV4dD4KPC9zdmc+';
        document.head.appendChild(link);
    }
})();

// Inject responsive CSS for consistent rendering across mobile/desktop/incognito
(function() {
    if (document.getElementById('deadcetera-responsive-css')) return;
    const style = document.createElement('style');
    style.id = 'deadcetera-responsive-css';
    style.textContent = `
        /* ===== SONG LIST ===== */
        .song-item {
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            min-height: 44px; /* iOS tap target */
            gap: 12px;
        }
        .song-name {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .song-badge {
            flex-shrink: 0;
            margin-left: auto;
            font-size: 0.8em;
            padding: 3px 10px;
            border-radius: 4px;
            font-weight: 700;
            text-align: center;
            min-width: 40px;
        }
        .harmony-badge {
            flex-shrink: 0;
        }
        .status-badge {
            flex-shrink: 0;
            white-space: nowrap;
        }

        /* ===== FILTER BUTTONS ===== */
        .status-filters, .harmony-filters {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 10px;
        }
        .filter-btn {
            padding: 8px 16px;
            border-radius: 20px;
            border: 2px solid #e2e8f0;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.85em;
            white-space: nowrap;
            transition: all 0.15s ease;
            -webkit-tap-highlight-color: transparent;
        }

        /* ===== PRACTICE TRACKS GRID ===== */
        .practice-tracks-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 16px;
        }
        .practice-track-card {
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            transition: box-shadow 0.15s ease;
        }
        .practice-track-card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .practice-track-card img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
        }

        /* ===== SPOTIFY VERSION CARDS ===== */
        .spotify-version-card {
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
        }
        .spotify-version-card.default {
            border-color: #667eea;
            background: #f5f7ff;
        }
        .votes-container {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 10px 0;
        }
        .vote-chip {
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
            -webkit-tap-highlight-color: transparent;
            border: 2px solid #e2e8f0;
        }
        .vote-chip.yes {
            background: #d1fae5;
            color: #065f46;
            border-color: #10b981;
        }
        .vote-chip.no {
            background: white;
            color: #6b7280;
        }
        .vote-chip:hover {
            transform: scale(1.05);
        }
        .version-badge {
            background: #667eea;
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.75em;
            font-weight: 700;
            display: inline-block;
            margin-bottom: 8px;
        }

        /* ===== MODALS ===== */
        .modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        /* ===== BUTTONS ===== */
        .chart-btn {
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            font-size: 0.9em;
            transition: all 0.15s ease;
            -webkit-tap-highlight-color: transparent;
        }
        .chart-btn-primary {
            background: #667eea;
            color: white;
        }
        .chart-btn-primary:hover {
            background: #5a6fd6;
        }
        .chart-btn-secondary {
            background: #f3f4f6;
            color: #374151;
        }
        .primary-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
        }

        /* ===== MOBILE RESPONSIVE ===== */
        @media (max-width: 640px) {
            .song-item {
                padding: 10px 12px;
                font-size: 0.95em;
            }
            .song-badge {
                font-size: 0.7em;
                padding: 2px 8px;
            }
            .practice-tracks-grid {
                grid-template-columns: 1fr;
            }
            .practice-track-card {
                padding: 12px;
            }
            .practice-track-card img {
                max-width: 100%;
            }
            .filter-btn {
                padding: 6px 12px;
                font-size: 0.8em;
            }
            .vote-chip {
                padding: 5px 10px;
                font-size: 0.8em;
            }
            .chart-btn {
                padding: 8px 14px;
                font-size: 0.85em;
            }
            /* Ensure modals don't overflow on mobile */
            .modal-overlay {
                padding: 10px;
            }
            /* Make ABC editor modal scrollable on mobile */
            #abcEditorModal > div {
                max-height: 90vh;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
            }
            /* BPM/Warp display fix for mobile */
            .abcjs-inline-audio {
                flex-wrap: wrap;
                gap: 4px;
            }
        }

        /* ===== TABLET ===== */
        @media (min-width: 641px) and (max-width: 1024px) {
            .practice-tracks-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        /* ===== TOUCH DEVICE IMPROVEMENTS ===== */
        @media (hover: none) and (pointer: coarse) {
            .song-item {
                min-height: 48px;
            }
            .filter-btn {
                min-height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .vote-chip {
                min-height: 36px;
                display: flex;
                align-items: center;
            }
            /* Prevent double-tap zoom on buttons */
            button, .filter-btn, .vote-chip, .chart-btn {
                touch-action: manipulation;
            }
        }

        /* ===== SCROLLBAR STYLING ===== */
        #songDropdown {
            max-height: 60vh;
            overflow-y: auto;
            scrollbar-width: thin;
        }
        #songDropdown::-webkit-scrollbar {
            width: 6px;
        }
        #songDropdown::-webkit-scrollbar-thumb {
            background: #cbd5e0;
            border-radius: 3px;
        }

        /* ===== SEARCH INPUT ===== */
        #songSearch {
            width: 100%;
            box-sizing: border-box;
        }

        /* ===== PRINT FRIENDLY ===== */
        @media print {
            .status-filters, .harmony-filters, .filter-btn,
            button, .chart-btn, #googleDriveAuthBtn {
                display: none !important;
            }
        }
    `;
    document.head.appendChild(style);
})();

console.log('🎸 Deadcetera v5.2.1 - MASTER FILE STATUS SYSTEM!');
console.log('⚡ Statuses load from 1 file instead of 358 API calls');
console.log('⚡ Filtering is INSTANT on page load');
console.log('🔄 First load migrates existing data automatically');
console.log('🎤 Harmonies also use master file (no more looping!)');
console.log('🎵 ABC playback: iOS AudioContext fix - SOUND NOW WORKS on iPhone!');
console.log('🎙️ Recording: Stops ABC playback first (no conflicts)');
console.log('🎙️ Recording: iOS-compatible format (MP4/M4A instead of WebM)');
console.log('🎙️ Recording: Better error messages for permissions');
console.log('🎸 Critical for gigs and practice - tested for mobile!');

let selectedSong = null;
let selectedVersion = null;
let currentFilter = 'all';
let currentInstrument = 'bass'; // Default instrument
let currentResourceType = null; // For modal state
let currentResourceIndex = null; // For editing resources
let activeStatusFilter = null; // Tracks which status filter is active
let activeHarmonyFilter = null; // Tracks which harmony filter is active

// Helper: find band member name from any identifier (email, key, etc.)
function getBandMemberName(identifier) {
    if (!identifier) return 'Unknown';
    // Direct key match
    if (bandMembers && bandMembers[identifier]?.name) return bandMembers[identifier].name;
    // Search by email property
    if (bandMembers) {
        const entry = Object.entries(bandMembers).find(([key, member]) => 
            member.email === identifier || 
            member.email?.toLowerCase() === identifier.toLowerCase() ||
            key.toLowerCase() === identifier.toLowerCase()
        );
        if (entry) return entry[1].name;
    }
    // Extract name from email (drewmerrill1029@gmail.com -> Drew)
    const emailName = identifier.split('@')[0].replace(/[0-9]/g, '').replace(/\./g, ' ');
    return emailName.charAt(0).toUpperCase() + emailName.slice(1);
}

// ============================================================================
// BAND NAME CONVERTER
// ============================================================================

function getFullBandName(bandAbbr) {
    const bandMap = {
        'GD': 'Grateful Dead',
        'JGB': 'Jerry Garcia Band',
        'WSP': 'Widespread Panic',
        'Phish': 'Phish'
    };
    return bandMap[bandAbbr] || bandAbbr;
}

// ============================================================================
// LEARNING RESOURCES STORAGE
// ============================================================================

// Get storage key for a song+instrument combination
function getStorageKey(songTitle, instrument) {
    return `deadcetera_resources_${songTitle}_${instrument}`;
}

// Load resources for current song and instrument
function loadResources(songTitle, instrument) {
    const key = getStorageKey(songTitle, instrument);
    const stored = localStorage.getItem(key);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Error parsing stored resources:', e);
            return getDefaultResources();
        }
    }
    return getDefaultResources();
}

// Save resources for current song and instrument
function saveResources(songTitle, instrument, resources) {
    const key = getStorageKey(songTitle, instrument);
    localStorage.setItem(key, JSON.stringify(resources));
}

// Default empty resources structure
function getDefaultResources() {
    return {
        tab: null,
        lessons: [],
        references: []
    };
}

// ============================================================================
// INITIALIZE APP
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    renderSongs();
    setupSearchAndFilters();
    setupInstrumentSelector();
    setupContinueButton();
    setupSpotifyAddButton();
    
    // Load saved instrument preference
    const savedInstrument = localStorage.getItem('deadcetera_instrument');
    if (savedInstrument) {
        currentInstrument = savedInstrument;
        const instrumentSelect = document.getElementById('instrumentSelect');
        if (instrumentSelect) instrumentSelect.value = savedInstrument;
    }
});

function setupSpotifyAddButton() {
    const btn = document.getElementById('addSpotifyVersionBtn');
    if (!btn) return;
    btn.addEventListener('click', addSpotifyVersion);
}

// ============================================================================
// INSTRUMENT SELECTOR
// ============================================================================

function setupInstrumentSelector() {
    const selector = document.getElementById('instrumentSelect');
    
    // Safety check - element might not exist on all pages
    if (!selector) return;
    
    selector.addEventListener('change', (e) => {
        currentInstrument = e.target.value;
        localStorage.setItem('deadcetera_instrument', currentInstrument);
        
        // If a song is selected, refresh the resources display
        if (selectedSong) {
            renderLearningResources(selectedSong, currentInstrument);
        }
        
        console.log('🎸 Instrument changed to:', currentInstrument);
    });
}

// ============================================================================
// RENDER SONGS
// ============================================================================

function renderSongs(filter = 'all', searchTerm = '') {
    console.log('renderSongs called - filter:', filter, 'searchTerm:', searchTerm);
    const dropdown = document.getElementById('songDropdown');
    
    let filtered = allSongs.filter(song => {
        const matchesFilter = filter === 'all' || song.band === filter;
        const matchesSearch = song.title.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });
    
    console.log('Filtered songs:', filtered.length);
    
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding: 20px; text-align: center; color: #718096;">No songs found</div>';
        return;
    }
    
    dropdown.innerHTML = filtered.map(song => `
        <div class="song-item" data-title="${song.title.replace(/"/g, '&quot;')}" style="display:flex;justify-content:space-between;align-items:center;" onclick="selectSong('${song.title.replace(/'/g, "\\'")}')">
            <span class="song-name">${song.title}</span>
            <span style="margin-left:auto;flex-shrink:0;" class="song-badge ${song.band.toLowerCase()}">${song.band}</span>
        </div>
    `).join('');
    
    // Add harmony badges and status badges after rendering
    setTimeout(() => {
        addHarmonyBadges();
        // Start loading statuses in background (only runs once)
        preloadAllStatuses();
        // If already cached, apply badges to current view
        if (statusCacheLoaded) {
            addStatusBadges();
        }
        // Re-apply active status filter if one is set
        if (activeStatusFilter && activeStatusFilter !== 'all') {
            applyStatusFilter(activeStatusFilter);
        }
        // Re-apply active harmony filter if one is set
        if (activeHarmonyFilter && activeHarmonyFilter !== 'all') {
            applyHarmonyFilter();
        }
    }, 50);
}

// ============================================================================
// SEARCH AND FILTERS
// ============================================================================

function setupSearchAndFilters() {
    const searchInput = document.getElementById('songSearch');
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    searchInput.addEventListener('input', (e) => {
        console.log('Search input changed:', e.target.value);
        renderSongs(currentFilter, e.target.value);
    });
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderSongs(currentFilter, searchInput.value);
        });
    });
}

// ============================================================================
// SONG SELECTION
// ============================================================================

function selectSong(songTitle) {
    // Store as object with title property for consistency
    selectedSong = {
        title: songTitle,
        band: allSongs.find(s => s.title === songTitle)?.band || 'GD'
    };
    
    // Get band info from allSongs
    const songData = allSongs.find(s => s.title === songTitle);
    const bandAbbr = songData ? songData.band : 'GD';
    const bandName = getFullBandName(bandAbbr);
    
    // Highlight selected song
    document.querySelectorAll('.song-item').forEach(item => {
        item.classList.remove('selected');
    });
    event.target.closest('.song-item').classList.add('selected');
    
    // Show Step 2: Band Resources
    showBandResources(songTitle);
    
    // Hide later steps until user continues
    document.getElementById('step3').classList.add('hidden');
    document.getElementById('step4').classList.add('hidden');
    document.getElementById('step5').classList.add('hidden');
    document.getElementById('resetContainer').classList.add('hidden');
    
    // Scroll to step 2
    setTimeout(() => {
        document.getElementById('step2').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// ============================================================================
// LEARNING RESOURCES
// ============================================================================

function showLearningResources(songTitle, bandName) {
    const step2 = document.getElementById('step2');
    step2.classList.remove('hidden');
    
    // Update title
    document.getElementById('resourcesSongTitle').textContent = 
        `Get tabs, chords, and lessons for "${songTitle}"`;
    
    // Render resources for current instrument
    renderLearningResources(songTitle, currentInstrument);
}

function renderLearningResources(songTitle, instrument) {
    console.log('📋 Rendering resources for:', songTitle, 'Instrument:', instrument);
    
    const resources = loadResources(songTitle, instrument);
    
    // Update tab type label based on instrument
    const tabTypeLabel = document.getElementById('tabTypeLabel');
    switch(instrument) {
        case 'bass':
            tabTypeLabel.textContent = 'Bass Tab';
            break;
        case 'rhythm_guitar':
        case 'keyboards':
        case 'vocals':
            tabTypeLabel.textContent = 'Chords';
            break;
        case 'lead_guitar':
            tabTypeLabel.textContent = 'Lead Tab';
            break;
    }
    
    // Render each section
    renderTabSection(songTitle, instrument, resources);
    renderLessonsSection(songTitle, instrument, resources);
    renderReferencesSection(songTitle, instrument, resources);
}

function renderTabSection(songTitle, instrument, resources) {
    const container = document.getElementById('tabResourceContent');
    const songData = allSongs.find(s => s.title === songTitle);
    const bandAbbr = songData ? songData.band : 'GD';
    
    if (resources.tab) {
        // Check if it's Ultimate Guitar
        const isUG = resources.tab.includes('ultimate-guitar.com');
        const displayName = getResourceDisplayName(resources.tab);
        
        // Show saved tab/chart with icon
        container.innerHTML = `
            <div class="resource-item">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    ${isUG ? '<span style="font-size: 1.5em;">🎸</span>' : ''}
                    <div style="flex: 1;">
                        <a href="${resources.tab}" target="_blank" class="resource-link" title="${resources.tab}">
                            ${displayName}
                        </a>
                        ${isUG ? '<div style="font-size: 0.85em; color: #718096; margin-top: 4px;">Ultimate Guitar</div>' : ''}
                    </div>
                </div>
                <div class="resource-actions">
                    <button class="resource-btn change-btn" onclick="findTab()">Change</button>
                </div>
            </div>
        `;
    } else {
        // Show find button
        container.innerHTML = `
            <button class="find-resource-btn" onclick="findTab()">
                🔍 Find on Ultimate Guitar 🎸
            </button>
        `;
    }
}

async function renderLessonsSection(songTitle, instrument, resources) {
    const container = document.getElementById('lessonsResourceContent');
    
    if (resources.lessons.length > 0) {
        // Fetch titles for all YouTube videos
        const lessonsWithTitles = await Promise.all(
            resources.lessons.map(async (url, index) => {
                const thumbnail = getYouTubeThumbnail(url);
                const videoId = getYouTubeVideoId(url);
                const spotifyId = getSpotifyTrackId(url);
                
                let title = 'Loading...';
                let platform = 'YouTube';
                
                if (videoId) {
                    const fetchedTitle = await getYouTubeTitle(url);
                    title = fetchedTitle || `YouTube: ${videoId}`;
                    platform = 'YouTube';
                } else if (spotifyId) {
                    const fetchedTitle = await getSpotifyTrackName(url); title = fetchedTitle || `Spotify Track: ${spotifyId}`;
                    platform = 'Spotify';
                }
                
                return { url, thumbnail, title, platform, index };
            })
        );
        
        container.innerHTML = lessonsWithTitles.map(({ url, thumbnail, title, platform, index }) => `
            <div class="resource-item-with-thumbnail">
                ${thumbnail ? `<img src="${thumbnail}" alt="Video thumbnail" class="youtube-thumbnail-small">` : ''}
                <div style="flex: 1;">
                    <a href="${url}" target="_blank" class="resource-link" title="${url}">
                        ${platform === 'YouTube' ? '📺' : '🎵'} ${title}
                    </a>
                    <div style="font-size: 0.85em; color: #718096; margin-top: 4px;">${platform} - Click to open</div>
                </div>
                <div class="resource-actions">
                    <button class="resource-btn remove-btn" onclick="removeLesson(${index})">🗑️</button>
                </div>
            </div>
        `).join('');
        
        // Add button if less than 2 lessons
        if (resources.lessons.length < 2) {
            container.innerHTML += `
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button class="add-resource-btn" onclick="searchYouTubeForLesson()" style="flex: 1;">
                        🔍 Search YouTube for Lessons
                    </button>
                    <button class="add-resource-btn" onclick="searchSpotifyForLesson()" style="flex: 1;">
                        🔍 Search Spotify
                    </button>
                    <button class="add-resource-btn" onclick="addLesson()" style="flex: 1;">
                        + Paste URL
                    </button>
                </div>
            `;
        }
    } else {
        container.innerHTML = `
            <div style="display: flex; gap: 10px;">
                <button class="add-resource-btn" onclick="searchYouTubeForLesson()" style="flex: 1;">
                    📺 YouTube Lessons
                </button>
                <button class="add-resource-btn" onclick="searchSpotifyForLesson()" style="flex: 1;">
                    🎵 Spotify
                </button>
                <button class="add-resource-btn" onclick="addLesson()" style="flex: 1;">
                    + Paste URL
                </button>
            </div>
        `;
    }
}

async function renderReferencesSection(songTitle, instrument, resources) {
    const container = document.getElementById('referencesResourceContent');
    
    if (resources.references.length > 0) {
        // Fetch titles for all videos/tracks
        const referencesWithTitles = await Promise.all(
            resources.references.map(async (url, index) => {
                const thumbnail = getYouTubeThumbnail(url);
                const videoId = getYouTubeVideoId(url);
                const spotifyId = getSpotifyTrackId(url);
                
                let title = 'Loading...';
                let platform = 'YouTube';
                
                if (videoId) {
                    const fetchedTitle = await getYouTubeTitle(url);
                    title = fetchedTitle || `YouTube: ${videoId}`;
                    platform = 'YouTube';
                } else if (spotifyId) {
                    const fetchedTitle = await getSpotifyTrackName(url); title = fetchedTitle || `Spotify Track: ${spotifyId}`;
                    platform = 'Spotify';
                }
                
                return { url, thumbnail, title, platform, index };
            })
        );
        
        container.innerHTML = referencesWithTitles.map(({ url, thumbnail, title, platform, index }) => `
            <div class="resource-item-with-thumbnail">
                ${thumbnail ? `<img src="${thumbnail}" alt="Thumbnail" class="youtube-thumbnail-small">` : ''}
                <div style="flex: 1;">
                    <a href="${url}" target="_blank" class="resource-link" title="${url}">
                        ${platform === 'YouTube' ? '📺' : '🎵'} ${title}
                    </a>
                    <div style="font-size: 0.85em; color: #718096; margin-top: 4px;">${platform} - Click to open</div>
                </div>
                <div class="resource-actions">
                    <button class="resource-btn remove-btn" onclick="removeReference(${index})">🗑️</button>
                </div>
            </div>
        `).join('');
        
        // Add button if less than 2 references
        if (resources.references.length < 2) {
            container.innerHTML += `
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button class="add-resource-btn" onclick="searchYouTubeForReference()" style="flex: 1;">
                        📺 YouTube Performances
                    </button>
                    <button class="add-resource-btn" onclick="searchSpotifyForReference()" style="flex: 1;">
                        🎵 Spotify
                    </button>
                    <button class="add-resource-btn" onclick="addReference()" style="flex: 1;">
                        + Paste URL
                    </button>
                </div>
            `;
        }
    } else {
        container.innerHTML = `
            <div style="display: flex; gap: 10px;">
                <button class="add-resource-btn" onclick="searchYouTubeForReference()" style="flex: 1;">
                    📺 YouTube Performances
                </button>
                <button class="add-resource-btn" onclick="searchSpotifyForReference()" style="flex: 1;">
                    🎵 Spotify
                </button>
                <button class="add-resource-btn" onclick="addReference()" style="flex: 1;">
                    + Paste URL
                </button>
            </div>
        `;
    }
}

function getResourceDisplayName(url) {
    // Extract a friendly name from URL
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace('www.', '');
        const path = urlObj.pathname;
        
        // For Ultimate Guitar
        if (hostname.includes('ultimate-guitar.com')) {
            return '🔗 ' + path.split('/').filter(p => p).pop().replace(/-/g, ' ');
        }
        
        // For YouTube
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            // Try to get video title from URL params or just show "YouTube Video"
            const videoId = urlObj.searchParams.get('v') || path.split('/').pop();
            return '📺 YouTube: ' + videoId;
        }
        
        // Generic
        return hostname;
    } catch (e) {
        return url.substring(0, 50) + '...';
    }
}

// Get YouTube video ID from URL
function getYouTubeVideoId(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace('www.', '');
        
        // youtube.com/watch?v=VIDEO_ID
        if (hostname.includes('youtube.com')) {
            return urlObj.searchParams.get('v');
        }
        
        // youtu.be/VIDEO_ID
        if (hostname.includes('youtu.be')) {
            return urlObj.pathname.substring(1);
        }
        
        return null;
    } catch (e) {
        return null;
    }
}

// Get YouTube thumbnail URL
function getYouTubeThumbnail(url) {
    const videoId = getYouTubeVideoId(url);
    if (videoId) {
        // Use high quality thumbnail
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
    return null;
}

// Fetch YouTube video title using oEmbed API
async function getYouTubeTitle(url) {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) return null;
    
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await fetch(oembedUrl);
        const data = await response.json();
        return data.title;
    } catch (e) {
        console.error('Error fetching YouTube title:', e);
        return null;
    }
}

// Get Spotify track ID from URL
function getSpotifyTrackId(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace('www.', '');
        
        // open.spotify.com/track/TRACK_ID
        if (hostname.includes('spotify.com')) {
            const match = urlObj.pathname.match(/\/track\/([a-zA-Z0-9]+)/);
            return match ? match[1] : null;
        }
        
        return null;
    } catch (e) {
        return null;
    }
}

// Fetch Spotify track name using oEmbed API
async function getSpotifyTrackName(url) {
    const trackId = getSpotifyTrackId(url);
    if (!trackId) return null;
    
    try {
        const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
        const response = await fetch(oembedUrl);
        const data = await response.json();
        return data.title || null;
    } catch (e) {
        console.error('Error fetching Spotify track name:', e);
        return null;
    }
}

// ============================================================================
// TAB FUNCTIONS
// ============================================================================

function findTab() {
    if (!selectedSong) return;
    
    const songData = allSongs.find(s => s.title === selectedSong);
    const bandAbbr = songData ? songData.band : 'GD';
    const bandName = getFullBandName(bandAbbr);
    
    // Construct Ultimate Guitar search URL
    const searchQuery = encodeURIComponent(`${bandName} ${selectedSong}`);
    const ugUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${searchQuery}`;
    
    // Open in new tab
    window.open(ugUrl, '_blank');
    
    // Show modal to save URL
    currentResourceType = 'tab';
    showAddResourceModal('tab');
}

// ============================================================================
// LESSON FUNCTIONS
// ============================================================================

function addLesson() {
    currentResourceType = 'lesson';
    showAddResourceModal('lesson');
}

function searchYouTubeForLesson() {
    if (!selectedSong) return;
    
    const songData = allSongs.find(s => s.title === selectedSong);
    const bandAbbr = songData ? songData.band : 'GD';
    const bandName = getFullBandName(bandAbbr);
    
    // Determine instrument-specific search
    let searchTerm = '';
    switch(currentInstrument) {
        case 'bass':
            searchTerm = `${bandName} ${selectedSong} bass lesson`;
            break;
        case 'rhythm_guitar':
            searchTerm = `${bandName} ${selectedSong} rhythm guitar lesson`;
            break;
        case 'lead_guitar':
            searchTerm = `${bandName} ${selectedSong} lead guitar lesson`;
            break;
        case 'keyboards':
            searchTerm = `${bandName} ${selectedSong} keyboard lesson`;
            break;
        case 'vocals':
            searchTerm = `${bandName} ${selectedSong} vocals lesson`;
            break;
    }
    
    // Show YouTube search modal
    currentResourceType = 'lesson';
    showYouTubeSearchModal(searchTerm);
}

function searchSpotifyForLesson() {
    if (!selectedSong) return;
    
    const songData = allSongs.find(s => s.title === selectedSong);
    const bandAbbr = songData ? songData.band : 'GD';
    const bandName = getFullBandName(bandAbbr);
    
    const searchTerm = `${bandName} ${selectedSong}`;
    const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(searchTerm)}`;
    
    // Show manual paste modal with Spotify instructions
    currentResourceType = 'lesson';
    showSpotifyPasteModal(spotifyUrl, 'lesson');
}

function removeLesson(index) {
    if (!selectedSong) return;
    
    const resources = loadResources(selectedSong, currentInstrument);
    resources.lessons.splice(index, 1);
    saveResources(selectedSong, currentInstrument, resources);
    renderLearningResources(selectedSong, currentInstrument);
    
    console.log('🗑️ Lesson removed');
}

// ============================================================================
// REFERENCE FUNCTIONS
// ============================================================================

function addReference() {
    currentResourceType = 'reference';
    showAddResourceModal('reference');
}

function searchYouTubeForReference() {
    if (!selectedSong) return;
    
    const songData = allSongs.find(s => s.title === selectedSong);
    const bandAbbr = songData ? songData.band : 'GD';
    const bandName = getFullBandName(bandAbbr);
    
    // Search for live performances
    const searchTerm = `${bandName} ${selectedSong} live`;
    
    // Show YouTube search modal
    currentResourceType = 'reference';
    showYouTubeSearchModal(searchTerm);
}

function searchSpotifyForReference() {
    if (!selectedSong) return;
    
    const songData = allSongs.find(s => s.title === selectedSong);
    const bandAbbr = songData ? songData.band : 'GD';
    const bandName = getFullBandName(bandAbbr);
    
    const searchTerm = `${bandName} ${selectedSong}`;
    const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(searchTerm)}`;
    
    // Show manual paste modal with Spotify instructions
    currentResourceType = 'reference';
    showSpotifyPasteModal(spotifyUrl, 'reference');
}

function removeReference(index) {
    if (!selectedSong) return;
    
    const resources = loadResources(selectedSong, currentInstrument);
    resources.references.splice(index, 1);
    saveResources(selectedSong, currentInstrument, resources);
    renderLearningResources(selectedSong, currentInstrument);
    
    console.log('🗑️ Reference removed');
}

// ============================================================================
// ADD RESOURCE MODAL
// ============================================================================

function showAddResourceModal(type) {
    const modal = document.getElementById('addResourceModal');
    const title = document.getElementById('addResourceTitle');
    const instructions = document.getElementById('addResourceInstructions');
    const input = document.getElementById('resourceUrlInput');
    
    // Set title and instructions based on type
    switch(type) {
        case 'tab':
            title.textContent = 'Save Your Preferred Tab/Chart';
            instructions.textContent = 'Paste the URL of the Ultimate Guitar tab or chord chart you want to use:';
            break;
        case 'lesson':
            title.textContent = 'Add Lesson Video';
            instructions.textContent = 'Paste the URL of a YouTube lesson or tutorial:';
            break;
        case 'reference':
            title.textContent = 'Add Reference Recording';
            instructions.textContent = 'Paste the URL of a YouTube performance or reference recording:';
            break;
    }
    
    // Clear input and preview
    input.value = '';
    updateUrlPreview('');
    
    // Show modal
    modal.classList.remove('hidden');
    input.focus();
    
    // Add event listener for URL preview
    input.removeEventListener('input', handleUrlPreview);
    input.addEventListener('input', handleUrlPreview);
}

function handleUrlPreview(e) {
    updateUrlPreview(e.target.value);
}

function updateUrlPreview(url) {
    const previewContainer = document.getElementById('urlPreviewContainer');
    if (!previewContainer) return;
    
    if (!url || url.trim() === '') {
        previewContainer.innerHTML = '';
        return;
    }
    
    // Check if it's a YouTube URL
    const videoId = getYouTubeVideoId(url);
    if (videoId) {
        const thumbnail = getYouTubeThumbnail(url);
        previewContainer.innerHTML = `
            <div style="margin-top: 15px; padding: 15px; background: #f7fafc; border-radius: 8px; border: 2px solid #e2e8f0;">
                <div style="font-weight: 600; color: #4a5568; margin-bottom: 10px;">Preview:</div>
                <img src="${thumbnail}" alt="Video preview" style="width: 100%; max-width: 320px; border-radius: 8px;">
                <div style="margin-top: 8px; color: #718096; font-size: 0.9em;">Video ID: ${videoId}</div>
            </div>
        `;
    } else {
        previewContainer.innerHTML = `
            <div style="margin-top: 15px; padding: 10px; background: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <div style="color: #92400e; font-size: 0.9em;">URL detected (preview not available)</div>
            </div>
        `;
    }
}

function closeAddResourceModal() {
    const modal = document.getElementById('addResourceModal');
    modal.classList.add('hidden');
    currentResourceType = null;
}

// ============================================================================
// YOUTUBE SEARCH IN-APP
// ============================================================================

function showYouTubeSearchModal(searchTerm) {
    const modal = document.getElementById('youtubeSearchModal');
    const searchInput = document.getElementById('youtubeSearchInput');
    const resultsContainer = document.getElementById('youtubeSearchResultsContainer');
    
    // Reset modal title to "Search YouTube"
    const modalTitle = modal.querySelector('.modal-header h2');
    if (modalTitle) {
        modalTitle.textContent = '🔍 Search YouTube';
    }
    
    // Show and set search term
    searchInput.style.display = 'block';
    searchInput.value = searchTerm;
    
    // Show modal
    modal.classList.remove('hidden');
    
    // Perform search
    performYouTubeSearch(searchTerm, resultsContainer);
}

function closeYouTubeSearchModal() {
    const modal = document.getElementById('youtubeSearchModal');
    modal.classList.add('hidden');
}

async function performYouTubeSearch(query, resultsContainer) {
    resultsContainer.innerHTML = '<div class="spinner" style="margin: 40px auto;"></div>';
    
    try {
        // Use YouTube's simple search (no API key needed for basic search)
        // We'll open YouTube search and let user pick, then paste URL
        const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 30px;">
                <p style="margin-bottom: 20px; color: #4a5568;">
                    Click below to search YouTube for: <strong>"${query}"</strong>
                </p>
                <button class="primary-btn" onclick="window.open('${youtubeSearchUrl}', '_blank')" style="margin-bottom: 20px;">
                    🔍 Search on YouTube
                </button>
                <div style="margin-top: 30px; padding: 20px; background: #f7fafc; border-radius: 8px; text-align: left;">
                    <strong style="color: #2d3748; display: block; margin-bottom: 10px;">How to use:</strong>
                    <ol style="color: #4a5568; line-height: 1.8; margin-left: 20px;">
                        <li>Click "Search on YouTube" above</li>
                        <li>Find the video you want</li>
                        <li>Copy the URL from the address bar</li>
                        <li>Come back here and paste it below:</li>
                    </ol>
                    <input type="text" id="youtubeQuickPasteInput" class="search-input" placeholder="Paste YouTube URL here..." style="margin-top: 15px;">
                    <button class="primary-btn" onclick="saveFromYouTubeSearch()" style="margin-top: 10px; width: 100%;">
                        💾 Save This Video
                    </button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('YouTube search error:', error);
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #e53e3e;">
                ❌ Search failed. Please try again.
            </div>
        `;
    }
}

function saveFromYouTubeSearch() {
    const input = document.getElementById('youtubeQuickPasteInput');
    const url = input.value.trim();
    
    if (!url) {
        alert('Please paste a YouTube URL');
        return;
    }
    
    // Validate it's a YouTube URL
    const videoId = getYouTubeVideoId(url);
    if (!videoId) {
        alert('Please enter a valid YouTube URL');
        return;
    }
    
    // Save based on current resource type
    const resources = loadResources(selectedSong, currentInstrument);
    
    switch(currentResourceType) {
        case 'lesson':
            if (resources.lessons.length < 2) {
                resources.lessons.push(url);
            }
            break;
        case 'reference':
            if (resources.references.length < 2) {
                resources.references.push(url);
            }
            break;
    }
    
    saveResources(selectedSong, currentInstrument, resources);
    renderLearningResources(selectedSong, currentInstrument);
    closeYouTubeSearchModal();
    
    console.log('✅ Video saved from YouTube search:', url);
}

// ============================================================================
// SPOTIFY INTEGRATION
// ============================================================================

function showSpotifyPasteModal(searchUrl, type) {
    const modal = document.getElementById('youtubeSearchModal');
    const searchInput = document.getElementById('youtubeSearchInput');
    const resultsContainer = document.getElementById('youtubeSearchResultsContainer');
    
    // Hide the search input for Spotify (confusing UX)
    searchInput.style.display = 'none';
    
    // Show modal
    modal.classList.remove('hidden');
    
    // Change modal title to "Search Spotify"
    const modalTitle = modal.querySelector('.modal-header h2');
    if (modalTitle) {
        modalTitle.textContent = '🔍 Search Spotify';
    }
    
    // Show Spotify instructions
    resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <p style="margin-bottom: 20px; color: #4a5568; font-size: 1.1em;">
                Search Spotify for: <strong>"${selectedSong}"</strong>
            </p>
            <button class="primary-btn" onclick="window.open('${searchUrl}', '_blank')" style="margin-bottom: 20px; background: #1db954;">
                🔍 Search on Spotify
            </button>
            <div style="margin-top: 30px; padding: 20px; background: #f7fafc; border-radius: 8px; text-align: left;">
                <strong style="color: #2d3748; display: block; margin-bottom: 10px;">How to use:</strong>
                <ol style="color: #4a5568; line-height: 1.8; margin-left: 20px;">
                    <li>Click "Search on Spotify" above</li>
                    <li>Find the track you want</li>
                    <li>Click the three dots (---) on the track</li>
                    <li>Select "Share" → "Copy Song Link"</li>
                    <li>Come back here and paste it below:</li>
                </ol>
                <input type="text" id="youtubeQuickPasteInput" class="search-input" placeholder="Paste Spotify URL here..." style="margin-top: 15px;">
                <button class="primary-btn" onclick="saveFromSpotifySearch()" style="margin-top: 10px; width: 100%; background: #1db954;">
                    💾 Save This Track
                </button>
            </div>
        </div>
    `;
}

function saveFromSpotifySearch() {
    const input = document.getElementById('youtubeQuickPasteInput');
    const url = input.value.trim();
    
    if (!url) {
        alert('Please paste a Spotify URL');
        return;
    }
    
    // Validate it's a Spotify URL
    const trackId = getSpotifyTrackId(url);
    if (!trackId) {
        alert('Please enter a valid Spotify track URL');
        return;
    }
    
    // Save based on current resource type
    const resources = loadResources(selectedSong, currentInstrument);
    
    switch(currentResourceType) {
        case 'lesson':
            if (resources.lessons.length < 2) {
                resources.lessons.push(url);
            }
            break;
        case 'reference':
            if (resources.references.length < 2) {
                resources.references.push(url);
            }
            break;
    }
    
    saveResources(selectedSong, currentInstrument, resources);
    renderLearningResources(selectedSong, currentInstrument);
    closeYouTubeSearchModal();
    
    console.log('✅ Track saved from Spotify search:', url);
}

function saveResource() {
    if (!selectedSong || !currentResourceType) return;
    
    const input = document.getElementById('resourceUrlInput');
    const url = input.value.trim();
    
    if (!url) {
        alert('Please enter a URL');
        return;
    }
    
    // Validate URL
    try {
        new URL(url);
    } catch (e) {
        alert('Please enter a valid URL');
        return;
    }
    
    const resources = loadResources(selectedSong, currentInstrument);
    
    // Save based on type
    switch(currentResourceType) {
        case 'tab':
            resources.tab = url;
            break;
        case 'lesson':
            if (resources.lessons.length < 2) {
                resources.lessons.push(url);
            }
            break;
        case 'reference':
            if (resources.references.length < 2) {
                resources.references.push(url);
            }
            break;
    }
    
    saveResources(selectedSong, currentInstrument, resources);
    renderLearningResources(selectedSong, currentInstrument);
    closeAddResourceModal();
    
    console.log('✅ Resource saved:', currentResourceType, url);
}

// ============================================================================
// CONTINUE TO VERSION SELECTION
// ============================================================================

function setupContinueButton() {
    const btn = document.getElementById('continueToVersionsBtn');
    
    // Safety check - button might not exist on all pages
    if (!btn) return;
    
    btn.addEventListener('click', () => {
        if (!selectedSong) return;
        
        // Get band info from allSongs
        const songData = allSongs.find(s => s.title === selectedSong);
        const bandAbbr = songData ? songData.band : 'GD';
        const bandName = getFullBandName(bandAbbr);
        
        // Check if we have top 5 versions for this song
        if (top5Database[selectedSong]) {
            showTop5Versions(selectedSong);
        } else {
            showNoVersionsMessage(selectedSong, bandName);
        }
        
        // Scroll to step 3
        setTimeout(() => {
            document.getElementById('step3').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    });
}

// ============================================================================
// VERSION SELECTION (Renumbered Step 3)
// ============================================================================

// Show top 5 versions (now in step3 instead of step2)
function showTop5Versions(songTitle) {
    const step3 = document.getElementById('step3');
    const container = document.getElementById('versionsContainer');
    
    const versions = top5Database[songTitle];
    
    // Get band name for resource links
    const songData = allSongs.find(s => s.title === songTitle);
    const bandName = songData ? songData.band : 'Grateful Dead';
    
    container.innerHTML = versions.map(version => {
        const urls = generateArchiveUrls(version.archiveId, version.trackNumber);
        
        return `
            <div class="version-card" onclick="selectVersion('${songTitle.replace(/'/g, "\\'")}', ${version.rank})">
                <span class="version-rank rank-${version.rank}">#${version.rank}</span>
                <div class="version-info">
                    <div class="version-venue">${version.venue}</div>
                    <div class="version-date">${version.date}</div>
                    <div class="version-notes">${version.notes}</div>
                    <div style="margin-top: 10px; padding: 8px; background: #edf2f7; border-radius: 6px; border-left: 4px solid #667eea;">
                        <strong style="color: #667eea;">🎵 Track ${version.trackNumber}</strong> - 
                        <span class="version-quality">${version.quality} Quality</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    step3.classList.remove('hidden');
}

// Show message when no versions available yet
function showNoVersionsMessage(songTitle, bandName = 'Grateful Dead') {
    const step3 = document.getElementById('step3');
    const container = document.getElementById('versionsContainer');
    
    container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: #f7fafc; border-radius: 12px;">
            <p style="font-size: 1.2em; color: #4a5568; margin-bottom: 15px;">
                <strong>"${songTitle}"</strong> by <strong>${bandName}</strong> is in our catalog!
            </p>
            <p style="color: #718096; margin-bottom: 20px;">
                We haven't pre-loaded the top 5 versions for this song yet.
            </p>
            <button class="primary-btn" onclick="searchArchiveForSong('${songTitle.replace(/'/g, "\\'")}', '${bandName}')" style="margin-bottom: 15px;">
                🔍 Find Best Versions on Archive.org
            </button>
            <p style="color: #718096; font-size: 0.9em;">
                This will search Archive.org for popular downloadable versions
            </p>
        </div>
    `;
    
    step3.classList.remove('hidden');
}

// Select a version
function selectVersion(songTitle, rank) {
    const version = top5Database[songTitle][rank - 1];
    selectedVersion = version;
    
    // Highlight selected version
    document.querySelectorAll('.version-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.target.closest('.version-card').classList.add('selected');
    
    // Show download step
    showDownloadStep(songTitle, version);
    
    // Scroll to step 4
    setTimeout(() => {
        document.getElementById('step4').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// ============================================================================
// DOWNLOAD STEP (Now Step 4)
// ============================================================================

function showDownloadStep(songTitle, version) {
    const step4 = document.getElementById('step4');
    const step5 = document.getElementById('step5');
    const resetContainer = document.getElementById('resetContainer');
    const infoDiv = document.getElementById('selectedInfo');
    
    infoDiv.innerHTML = `
        <div class="selected-song-name">${songTitle}</div>
        <div class="selected-version-name">${version.venue} (${version.date})</div>
        <div style="margin-top: 15px; padding: 12px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <strong style="color: #92400e;">⚠️ YOU NEED: Track ${version.trackNumber}</strong>
            <div style="color: #78350f; font-size: 0.9em; margin-top: 5px;">
                Look for file: <code style="background: #fde68a; padding: 2px 6px; border-radius: 3px;">${version.archiveId}.mp3</code>
            </div>
        </div>
    `;
    
    // Setup Smart Download button
    const smartDownloadBtn = document.getElementById('smartDownloadBtn');
    smartDownloadBtn.onclick = () => handleSmartDownload(songTitle, version);
    
    // Setup regular download button
    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.onclick = () => {
        const urls = generateArchiveUrls(version.archiveId, version.trackNumber);
        window.open(urls.download, '_blank');
        
        setTimeout(() => {
            alert(`📥 DOWNLOADING FULL SHOW:

Look for the MP3 file (usually 100-200MB)
It will be named something like: ${version.archiveId}.mp3

Track ${version.trackNumber} is "${songTitle}"

Right-click the MP3 filename → Save Link As...`);
        }, 500);
        
        step5.classList.remove('hidden');
        resetContainer.classList.remove('hidden');
    };
    
    // Setup Moises button
    const moisesBtn = document.getElementById('moisesBtn');
    moisesBtn.onclick = () => {
        window.open('https://studio.moises.ai/', '_blank');
        step5.classList.remove('hidden');
        resetContainer.classList.remove('hidden');
    };
    
    // Setup Setlist.fm button
    const setlistBtn = document.getElementById('setlistBtn');
    setlistBtn.onclick = () => handleSetlistClick(version.archiveId);
    
    // Setup YouTube search button (if you have it)
    const youtubeBtn = document.getElementById('youtubeSearchBtn');
    if (youtubeBtn) {
        youtubeBtn.onclick = () => searchYouTube(songTitle);
    }
    
    step4.classList.remove('hidden');
    resetContainer.classList.remove('hidden');
}

// ============================================================================
// SMART DOWNLOAD
// ============================================================================

function handleSmartDownload(songTitle, version) {
    console.log('📥 Starting Smart Download for:', songTitle, version);
    
    // Show progress UI
    const progressContainer = document.getElementById('progressContainer');
    const progressMessage = document.getElementById('progressMessage');
    const progressBar = document.getElementById('progressBar');
    
    progressContainer.classList.remove('hidden');
    progressMessage.textContent = 'Initializing Smart Download...';
    progressBar.style.width = '0%';
    
    // Check if AudioSplitter is loaded
    if (typeof AudioSplitter === 'undefined') {
        alert('⚠️ Audio Splitter not loaded. Make sure audio-splitter.js is included.');
        progressContainer.classList.add('hidden');
        return;
    }
    
    const splitter = new AudioSplitter();
    
    // Start extraction
    splitter.extractSongFromShow(version.archiveId, version.trackNumber, songTitle)
        .then(blob => {
            console.log('✅ Smart Download complete!', blob);
            progressMessage.textContent = 'Download complete!';
            progressBar.style.width = '100%';
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${songTitle} - ${version.venue} - ${version.date}.mp3`;
            a.click();
            
            setTimeout(() => {
                progressContainer.classList.add('hidden');
                alert(`✅ Downloaded: ${songTitle}

Now upload to Moises.ai to separate stems!`);
            }, 1000);
        })
        .catch(error => {
            console.error('❌ Smart Download failed:', error);
            progressContainer.classList.add('hidden');
            alert(`❌ Smart Download failed: ${error.message}

Try the regular "Download Full Show" button instead.`);
        });
}

// ============================================================================
// SETLIST.FM INTEGRATION
// ============================================================================

function handleSetlistClick(archiveId) {
    // Detect band from archive ID
    let band = 'Grateful Dead';
    if (archiveId.toLowerCase().includes('phish') || archiveId.startsWith('pt')) {
        band = 'Phish';
    } else if (archiveId.toLowerCase().includes('jgb') || archiveId.toLowerCase().includes('garcia')) {
        band = 'Jerry Garcia Band';
    } else if (archiveId.toLowerCase().includes('wsp') || archiveId.toLowerCase().includes('widespread') || archiveId.toLowerCase().includes('panic')) {
        band = 'Widespread Panic';
    }
    
    // Extract date from archive ID (format: gd1981-03-14 or similar)
    const dateMatch = archiveId.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
        const [_, year, month, day] = dateMatch;
        const setlistUrl = `https://www.setlist.fm/search?query=${encodeURIComponent(band)}+${month}/${day}/${year}`;
        window.open(setlistUrl, '_blank');
    } else {
        const setlistUrl = `https://www.setlist.fm/search?query=${encodeURIComponent(band)}`;
        window.open(setlistUrl, '_blank');
    }
}

// ============================================================================
// YOUTUBE SEARCH (Optional)
// ============================================================================

function searchYouTube(songTitle) {
    const songData = allSongs.find(s => s.title === songTitle);
    const bandName = songData ? songData.band : 'Grateful Dead';
    const query = encodeURIComponent(`${bandName} ${songTitle} live`);
    const youtubeUrl = `https://www.youtube.com/results?search_query=${query}`;
    window.open(youtubeUrl, '_blank');
}

function closeYoutubeModal() {
    const modal = document.getElementById('youtubeModal');
    modal.classList.add('hidden');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateArchiveUrls(archiveId, trackNumber) {
    return {
        details: `https://archive.org/details/${archiveId}`,
        download: `https://archive.org/download/${archiveId}/`
    };
}

function searchArchiveForSong(songTitle, bandName) {
    const searchUrl = `https://archive.org/search.php?query=creator%3A%22${encodeURIComponent(bandName)}%22+AND+%22${encodeURIComponent(songTitle)}%22+soundboard&sort=-downloads`;
    window.open(searchUrl, '_blank');
}

// ============================================================================
// RESET WORKFLOW
// ============================================================================

function resetWorkflow() {
    selectedSong = null;
    selectedVersion = null;
    
    // Hide all steps except step 1
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.add('hidden');
    document.getElementById('step4').classList.add('hidden');
    document.getElementById('step5').classList.add('hidden');
    document.getElementById('resetContainer').classList.add('hidden');
    
    // Clear selections
    document.querySelectorAll('.song-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================================
// END OF APP.JS
// ============================================================================
// ============================================================================
// BAND RESOURCES SYSTEM
// Renders collaborative band resources from bandKnowledgeBase
// ============================================================================

function showBandResources(songTitle) {
    const step2 = document.getElementById('step2');
    step2.classList.remove('hidden');
    
    // Update subtitle
    document.getElementById('bandResourcesSubtitle').textContent = 
        `Collaborative resources for "${songTitle}"`;
    
    // Get band data from data.js if available
    const bandData = bandKnowledgeBase[songTitle] || {};
    
    // ALWAYS show the interface - even if no data yet!
    // Band members can add data collaboratively
    
    // Render each section IN PARALLEL for fast loading
    Promise.all([
        renderSpotifyVersionsWithMetadata(songTitle, bandData),
        renderPersonalTabs(songTitle),
        renderMoisesStems(songTitle, bandData),
        renderPracticeTracks(songTitle, bandData),
        renderHarmoniesEnhanced(songTitle, bandData),
        renderRehearsalNotesWithStorage(songTitle),
        renderSongStructure(songTitle),
        renderGigNotes(songTitle, bandData),
        populateSongMetadata(songTitle)
    ]).catch(error => {
        console.error('Error rendering sections:', error);
    });
}

function showNoBandResourcesMessage(songTitle) {
    const step2 = document.getElementById('step2');
    step2.innerHTML = `
        <div class="step-number">2</div>
        <h2>🎸 Band Resources</h2>
        <div class="empty-state">
            <div class="empty-state-icon">🎵</div>
            <div class="empty-state-text">No band resources yet for "${songTitle}"</div>
            <div class="empty-state-subtext">This song hasn't been set up with collaborative resources</div>
            <button class="primary-btn" style="margin-top: 20px;" onclick="skipToBandResources()">
                Skip to Version Selection ▶
            </button>
        </div>
    `;
}

function skipToBandResources() {
    document.getElementById('step3').classList.remove('hidden');
    document.getElementById('step3').scrollIntoView({ behavior: 'smooth' });
}

// ============================================================================
// SPOTIFY VERSIONS & VOTING
// ============================================================================

function renderSpotifyVersions(songTitle, bandData) {
    const container = document.getElementById('spotifyVersionsContainer');
    const versions = bandData.spotifyVersions || [];
    
    if (versions.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px;">No Spotify versions added yet</div>';
        return;
    }
    
    container.innerHTML = versions.map(version => {
        const voteCount = version.totalVotes || 0;
        const totalMembers = Object.keys(bandMembers).length;
        const isDefault = version.isDefault;
        
        return `
            <div class="spotify-version-card ${isDefault ? 'default' : ''}">
                <div class="version-header">
                    <div class="version-title">${version.title}</div>
                    ${isDefault ? '<div class="version-badge">👑 BAND CHOICE (' + voteCount + '/' + totalMembers + ')</div>' : ''}
                </div>
                
                <div class="votes-container">
                    ${Object.entries(version.votes).map(([member, voted]) => `
                        <span class="vote-chip ${voted ? 'yes' : 'no'}">
                            ${voted ? '✅ ' : ''}${bandMembers[member].name}
                        </span>
                    `).join('')}
                </div>
                
                ${version.notes ? `<p style="margin-bottom: 12px; font-style: italic; color: #6b7280;">${version.notes}</p>` : ''}
                
                <button class="spotify-play-btn" onclick="window.open('${version.spotifyUrl}', '_blank')">
                    ▶️ Play on Spotify
                </button>
            </div>
        `;
    }).join('');
}

// ============================================================================
// CHORD CHART
// ============================================================================

// ============================================================================
// PERSONAL TAB LINKS
// ============================================================================

async function renderPersonalTabs(songTitle) {
    const container = document.getElementById('personalTabsContainer');
    const tabs = await loadPersonalTabs(songTitle);
    
    if (!tabs || tabs.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px;">No tab links added yet. Be the first to add yours!</div>';
        return;
    }
    
    container.innerHTML = `
        <div style="display: grid; gap: 15px;">
            ${tabs.map((tab, index) => `
                <div style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 15px; position: relative;">
                    ${tab.addedBy === currentUserEmail ? `
                        <button onclick="deletePersonalTab('${songTitle}', ${index})" 
                            style="position: absolute; top: 10px; right: 10px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 14px;">✕</button>
                    ` : ''}
                    
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <span style="font-size: 1.2em;">👤</span>
                        <strong style="color: #667eea; font-size: 1.1em;">${getBandMemberName(tab.addedBy)}</strong>
                    </div>
                    
                    ${tab.notes ? `
                        <p style="color: #6b7280; font-size: 0.9em; margin-bottom: 12px; font-style: italic;">
                            "${tab.notes}"
                        </p>
                    ` : ''}
                    
                    <button onclick="window.open('${tab.url}', '_blank')" 
                        style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; width: 100%;">
                        🎸 Open ${getBandMemberName(tab.addedBy)}'s Tab
                    </button>
                    
                    <p style="margin-top: 8px; font-size: 0.85em; color: #9ca3af;">
                        Added ${tab.dateAdded || 'recently'}
                    </p>
                </div>
            `).join('')}
        </div>
    `;
}

async function addPersonalTab() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) {
        alert('Please select a song first!');
        return;
    }
    
    const urlInput = document.getElementById('tabUrlInput');
    const notesInput = document.getElementById('tabNotesInput');
    
    const url = urlInput.value.trim();
    if (!url) {
        alert('Please paste a tab URL!');
        return;
    }
    
    // Validate URL
    if (!url.startsWith('http')) {
        alert('Please paste a valid URL starting with http:// or https://');
        return;
    }
    
    const tab = {
        url: url,
        notes: notesInput.value.trim(),
        addedBy: currentUserEmail,
        dateAdded: new Date().toLocaleDateString()
    };
    
    // Load existing tabs
    let tabs = await loadPersonalTabs(songTitle) || [];
    
    // Add new tab
    tabs.push(tab);
    
    // Save to Drive
    await savePersonalTabs(songTitle, tabs);
    
    // Clear form
    urlInput.value = '';
    notesInput.value = '';
    
    // Re-render
    await renderPersonalTabs(songTitle);
}

async function deletePersonalTab(songTitle, index) {
    if (!confirm('Delete this tab link?')) return;
    
    let tabs = await loadPersonalTabs(songTitle) || [];
    tabs.splice(index, 1);
    
    await savePersonalTabs(songTitle, tabs);
    await renderPersonalTabs(songTitle);
}

// Storage functions
async function savePersonalTabs(songTitle, tabs) {
    return await saveBandDataToDrive(songTitle, 'personal_tabs', tabs);
}

async function loadPersonalTabs(songTitle) {
    return await loadBandDataFromDrive(songTitle, 'personal_tabs') || [];
}

console.log('📑 Personal tabs system loaded');

// ============================================================================
// MOISES STEMS
// ============================================================================

async function renderMoisesStems(songTitle, bandData) {
    const container = document.getElementById('moisesStemsContainer');
    
    // Load from Google Drive
    const stems = await loadMoisesStems(songTitle) || bandData.moisesParts || {};
    
    if (!stems.folderUrl && (!stems.stems || Object.keys(stems.stems).length === 0)) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 20px;">
                <p>No Moises stems uploaded yet</p>
                <button onclick="showMoisesUploadForm()" class="primary-btn" style="margin-top: 10px;">📤 Upload Stems from Computer</button>
                <p style="margin-top: 10px; color: #6b7280; font-size: 0.85em;">Or <a href="#" onclick="addMoisesStems(); return false;" style="color: #667eea;">paste Drive links</a> if already uploaded</p>
            </div>
        `;
        return;
    }
    
    // Check if we have individual stem links
    const stemKeys = ['bass', 'drums', 'guitar', 'keys', 'vocals', 'other'];
    const instrumentIcons = {
        bass: '🎸',
        drums: '🥁', 
        guitar: '🎸',
        keys: '🎹',
        vocals: '🎤',
        other: '🎵'
    };
    
    // Show stem buttons
    const stemButtons = stemKeys.map(key => {
        const url = stems.stems && stems.stems[key];
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        const icon = instrumentIcons[key] || '🎵';
        
        if (url) {
            // Has URL - clickable download
            return `
                <button class="stem-button" onclick="window.open('${url}', '_blank')" style="background: white; border: 2px solid #e2e8f0; padding: 12px; border-radius: 8px; cursor: pointer; text-align: center;">
                    <div class="stem-label" style="font-weight: 600; margin-bottom: 4px;">${icon} ${label}</div>
                    <div class="stem-info" style="font-size: 0.85em; color: #6b7280;">Click to download</div>
                </button>
            `;
        }
        return '';
    }).filter(Boolean).join('');
    
    container.innerHTML = `
        <div style="position: relative;">
            <button onclick="showMoisesUploadForm()" style="position: absolute; top: 0; right: 60px; background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">📤 Upload</button>
            <button onclick="editMoisesStems()" style="position: absolute; top: 0; right: 0; background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Edit</button>
            
            ${stems.sourceVersion ? `<p style="margin-bottom: 15px; color: #6b7280;">Source: <strong>${stems.sourceVersion}</strong></p>` : ''}
            
            ${stemButtons ? `
                <div class="stems-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 15px;">
                    ${stemButtons}
                </div>
            ` : '<p style="color: #6b7280; margin-bottom: 15px;">No individual stems added yet</p>'}
            
            ${stems.folderUrl ? `
                <button class="drive-folder-btn" onclick="window.open('${stems.folderUrl}', '_blank')" style="background: #4285f4; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; width: 100%;">
                    📂 Open Google Drive Folder
                </button>
            ` : ''}
            
            ${stems.notes ? `<p style="margin-top: 12px; color: #6b7280; font-size: 0.9em;">${stems.notes}</p>` : ''}
        </div>
    `;
}

function showMoisesUploadForm() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    
    const container = document.getElementById('moisesStemsContainer');
    container.innerHTML = `
        <div style="background: #f9fafb; padding: 20px; border-radius: 12px; border: 2px solid #667eea;">
            <h4 style="margin: 0 0 15px 0; color: #667eea;">📤 Upload Moises Stems</h4>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1f2937;">
                    Source Version (optional)
                </label>
                <input type="text" id="stemsSourceInput" 
                    placeholder="e.g., Cornell 5/8/77, Studio version, etc."
                    style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-family: inherit;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1f2937;">
                    Select Stem Files
                </label>
                <p style="font-size: 0.85em; color: #6b7280; margin-bottom: 10px;">
                    Select all your Moises-separated tracks (bass.mp3, drums.mp3, etc.)
                </p>
                <input type="file" id="stemsFileInput" multiple accept="audio/*,.mp3,.wav,.m4a,.aac"
                    style="width: 100%; padding: 10px; border: 2px dashed #d1d5db; border-radius: 6px; background: white; cursor: pointer;">
                <p style="font-size: 0.85em; color: #6b7280; margin-top: 5px;">
                    💡 Name your files clearly (e.g., bass.mp3, drums.mp3, guitar.mp3, keys.mp3, vocals.mp3)
                </p>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1f2937;">
                    Notes (optional)
                </label>
                <textarea id="stemsNotesInput" 
                    placeholder="e.g., Bass is really clear in this version"
                    style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-family: inherit; resize: vertical;"
                    rows="2"></textarea>
            </div>
            
            <div id="uploadProgress" style="display: none; margin-bottom: 15px;">
                <div style="background: #e5e7eb; height: 30px; border-radius: 6px; overflow: hidden; position: relative;">
                    <div id="uploadProgressBar" style="background: #10b981; height: 100%; width: 0%; transition: width 0.3s;"></div>
                    <div id="uploadProgressText" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: 600; color: #1f2937;"></div>
                </div>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button onclick="uploadMoisesStems()" 
                    style="flex: 1; background: #10b981; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1em;">
                    📤 Upload Stems
                </button>
                <button onclick="renderMoisesStems('${songTitle.replace(/'/g, "\\'")}', {})" 
                    style="background: #6b7280; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer;">
                    Cancel
                </button>
            </div>
        </div>
    `;
}

async function uploadMoisesStems() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    
    const fileInput = document.getElementById('stemsFileInput');
    const sourceInput = document.getElementById('stemsSourceInput');
    const notesInput = document.getElementById('stemsNotesInput');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select at least one stem file!');
        return;
    }
    
    // Show progress
    const progressDiv = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');
    progressDiv.style.display = 'block';
    
    try {
        // Create folder name
        const folderName = `${songTitle} - Moises Stems`;
        
        progressText.textContent = 'Creating folder...';
        progressBar.style.width = '10%';
        
        // Create folder in shared Drive folder
        const folderId = await createDriveFolder(folderName, SHARED_FOLDER_ID);
        
        if (!folderId) {
            throw new Error('Failed to create folder');
        }
        
        console.log(`📁 Created folder: ${folderId}`);
        
        // Upload each file
        const files = Array.from(fileInput.files);
        const uploadedStems = {};
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const progress = ((i + 1) / files.length) * 80 + 10; // 10-90%
            
            progressText.textContent = `Uploading ${file.name}... (${i + 1}/${files.length})`;
            progressBar.style.width = `${progress}%`;
            
            console.log(`Uploading ${file.name}...`);
            
            // Upload file to folder
            const fileId = await uploadFileToDrive(file, folderId);
            
            if (fileId) {
                // Determine instrument type from filename
                const fileName = file.name.toLowerCase();
                let instrument = 'other';
                
                if (fileName.includes('bass')) instrument = 'bass';
                else if (fileName.includes('drum')) instrument = 'drums';
                else if (fileName.includes('guitar')) instrument = 'guitar';
                else if (fileName.includes('key') || fileName.includes('piano')) instrument = 'keys';
                else if (fileName.includes('vocal') || fileName.includes('voice')) instrument = 'vocals';
                
                // Create shareable link
                const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;
                uploadedStems[instrument] = fileUrl;
                
                console.log(`✅ Uploaded ${file.name} as ${instrument}: ${fileId}`);
            }
        }
        
        progressText.textContent = 'Saving metadata...';
        progressBar.style.width = '95%';
        
        // Save stems metadata
        const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
        const stemsData = {
            folderUrl: folderUrl,
            folderId: folderId,
            sourceVersion: sourceInput.value.trim(),
            stems: uploadedStems,
            notes: notesInput.value.trim(),
            uploadedBy: currentUserEmail,
            dateAdded: new Date().toLocaleDateString()
        };
        
        await saveMoisesStems(songTitle, stemsData);
        
        progressText.textContent = 'Complete! ✅';
        progressBar.style.width = '100%';
        
        console.log('✅ All stems uploaded successfully!');
        
        setTimeout(async () => {
            const bandData = bandKnowledgeBase[songTitle] || {};
            await renderMoisesStems(songTitle, bandData);
        }, 1000);
        
    } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed: ' + error.message);
        progressDiv.style.display = 'none';
    }
}

async function createDriveFolder(folderName, parentFolderId) {
    try {
        const metadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId]
        };
        
        const response = await gapi.client.drive.files.create({
            resource: metadata,
            fields: 'id'
        });
        
        return response.result.id;
    } catch (error) {
        console.error('Error creating folder:', error);
        return null;
    }
}

async function uploadFileToDrive(file, parentFolderId) {
    try {
        // Use multipart upload for files
        const metadata = {
            name: file.name,
            parents: [parentFolderId]
        };
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);
        
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${gapi.auth.getToken().access_token}`
            },
            body: form
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result.id;
    } catch (error) {
        console.error('Error uploading file:', error);
        return null;
    }
}

async function addMoisesStems() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    
    editMoisesStems();
}

async function editMoisesStems() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    
    const stems = await loadMoisesStems(songTitle) || {};
    
    const folderUrl = prompt('Google Drive folder URL (where all stems are):', stems.folderUrl || '');
    if (folderUrl === null) return; // Canceled
    
    const sourceVersion = prompt('Source version (optional, e.g., "11/3/1985 Richmond"):', stems.sourceVersion || '');
    
    // Individual stem URLs
    const bass = prompt('Bass track URL (optional):', stems.stems?.bass || '');
    const drums = prompt('Drums track URL (optional):', stems.stems?.drums || '');
    const guitar = prompt('Guitar track URL (optional):', stems.stems?.guitar || '');
    const keys = prompt('Keys track URL (optional):', stems.stems?.keys || '');
    const vocals = prompt('Vocals track URL (optional):', stems.stems?.vocals || '');
    const other = prompt('Other/Mix track URL (optional):', stems.stems?.other || '');
    
    const notes = prompt('Notes (optional):', stems.notes || '');
    
    const newStems = {
        folderUrl: folderUrl.trim(),
        sourceVersion: sourceVersion.trim(),
        stems: {
            bass: bass.trim(),
            drums: drums.trim(),
            guitar: guitar.trim(),
            keys: keys.trim(),
            vocals: vocals.trim(),
            other: other.trim()
        },
        notes: notes.trim(),
        uploadedBy: currentUserEmail,
        dateAdded: new Date().toLocaleDateString()
    };
    
    await saveMoisesStems(songTitle, newStems);
    
    const bandData = bandKnowledgeBase[songTitle] || {};
    await renderMoisesStems(songTitle, bandData);
}

async function saveMoisesStems(songTitle, stems) {
    return await saveBandDataToDrive(songTitle, 'moises_stems', stems);
}

async function loadMoisesStems(songTitle) {
    return await loadBandDataFromDrive(songTitle, 'moises_stems');
}

console.log('🎵 Moises stems editor loaded');

// ============================================================================
// PRACTICE TRACKS
// ============================================================================

async function renderPracticeTracks(songTitle, bandData) {
    // Use the Google Drive version instead
    await renderPracticeTracksSimplified(songTitle);
}

// ============================================================================
// HARMONIES
// ============================================================================

function renderHarmonies(songTitle, bandData) {
    const container = document.getElementById('harmoniesContainer');
    const harmonies = bandData.harmonies;
    
    if (!harmonies || !harmonies.sections || harmonies.sections.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px;">No harmony parts documented yet</div>';
        return;
    }
    
    const sections = harmonies.sections.map(section => {
        const statusClass = section.workedOut ? 'worked-out' : 'needs-work';
        const statusText = section.workedOut ? (section.soundsGood ? '✅ Sounds Great' : '⚠️ Needs Polish') : '🔴 Needs Work';
        const statusBadgeClass = section.soundsGood ? 'status-good' : 'status-needs-work';
        
        return `
            <div class="harmony-card ${statusClass}">
                <div class="harmony-header">
                    <div class="harmony-lyric">"${section.lyric}"</div>
                    <div class="harmony-status ${statusBadgeClass}">${statusText}</div>
                </div>
                
                <div class="harmony-timing">${section.timing}</div>
                
                <div class="parts-list">
                    ${section.parts.map(part => `
                        <div class="part-row">
                            <div class="part-singer">${bandMembers[part.singer]?.name || part.singer}</div>
                            <div class="part-role">${part.part.replace('_', ' ')}</div>
                            <div class="part-notes">${part.notes}</div>
                        </div>
                    `).join('')}
                </div>
                
                ${section.practiceNotes && section.practiceNotes.length > 0 ? `
                    <div class="practice-notes-box">
                        <strong>Practice Notes:</strong>
                        <ul style="margin-left: 20px; margin-top: 8px;">
                            ${section.practiceNotes.map(note => `<li>${note}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${section.referenceRecording ? `
                    <button class="chart-btn chart-btn-primary" style="margin-top: 12px;" onclick="window.open('${section.referenceRecording}', '_blank')">
                        ▶️ Play Reference Recording
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
    
    let generalNotesHTML = '';
    if (harmonies.generalNotes && harmonies.generalNotes.length > 0) {
        generalNotesHTML = `
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <strong>General Harmony Notes:</strong>
                <ul style="margin-left: 20px; margin-top: 8px;">
                    ${harmonies.generalNotes.map(note => `<li>${note}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    container.innerHTML = sections + generalNotesHTML;
}

// ============================================================================
// REHEARSAL NOTES
// ============================================================================

function renderRehearsalNotes(songTitle, bandData) {
    const container = document.getElementById('rehearsalNotesContainer');
    const notes = bandData.rehearsalNotes;
    
    if (!notes || notes.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px;">No rehearsal notes yet</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="rehearsal-notes-list">
            ${notes.map(note => `
                <div class="rehearsal-note-card ${note.priority === 'high' ? 'high' : ''}">
                    <div class="note-header">
                        <span>${note.author} - ${note.date}</span>
                        <span style="color: ${note.priority === 'high' ? '#ef4444' : '#667eea'}; font-weight: 600;">
                            ${note.priority.toUpperCase()} PRIORITY
                        </span>
                    </div>
                    <div class="note-content">${note.note}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================================================
// GIG NOTES
// ============================================================================

async function renderGigNotes(songTitle, bandData) {
    const container = document.getElementById('gigNotesContainer');
    const notes = await loadGigNotes(songTitle) || bandData.gigNotes || [];
    
    if (notes.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 20px;">
                <p>No performance tips yet</p>
                <button onclick="addGigNote()" class="secondary-btn" style="margin-top: 10px;">+ Add First Tip</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="gig-notes-box">
            <ul>
                ${notes.map((note, index) => `
                    <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                        <span>${note}</span>
                        <button onclick="deleteGigNote(${index})" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px;">Delete</button>
                    </li>
                `).join('')}
            </ul>
            <button onclick="addGigNote()" class="secondary-btn" style="margin-top: 12px;">+ Add Tip</button>
        </div>
    `;
}

async function addGigNote() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    
    const note = prompt('Performance tip / gig note:');
    if (!note || !note.trim()) return;
    
    let notes = await loadGigNotes(songTitle) || [];
    notes.push(note.trim());
    
    await saveGigNotes(songTitle, notes);
    
    const bandData = bandKnowledgeBase[songTitle] || {};
    await renderGigNotes(songTitle, bandData);
}

async function deleteGigNote(index) {
    if (!confirm('Delete this performance tip?')) return;
    
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    
    let notes = await loadGigNotes(songTitle) || [];
    notes.splice(index, 1);
    
    await saveGigNotes(songTitle, notes);
    
    const bandData = bandKnowledgeBase[songTitle] || {};
    await renderGigNotes(songTitle, bandData);
}

async function saveGigNotes(songTitle, notes) {
    return await saveBandDataToDrive(songTitle, 'gig_notes', notes);
}

async function loadGigNotes(songTitle) {
    return await loadBandDataFromDrive(songTitle, 'gig_notes');
}

console.log('📝 Gig notes editor loaded');

// ============================================================================
// ============================================================================
// SIMPLIFIED PRACTICE TRACK SYSTEM
// Auto-fetch titles, thumbnails, save to localStorage - NO GITHUB NEEDED!
// ============================================================================

// Store practice tracks in Google Drive (shared with all band members)
async function savePracticeTrack(songTitle, track) {
    const tracks = await loadPracticeTracksFromDrive(songTitle);
    tracks.push(track);
    await savePracticeTracksToDrive(songTitle, tracks);
}

async function loadPracticeTracksFromStorage(songTitle) {
    return await loadPracticeTracksFromDrive(songTitle);
}

async function deletePracticeTrack(songTitle, index) {
    const tracks = await loadPracticeTracksFromDrive(songTitle);
    tracks.splice(index, 1);
    await savePracticeTracksToDrive(songTitle, tracks);
    
    // Refresh display
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) {
        renderPracticeTracks(songTitle, bandData);
    }
}

// Extract YouTube video ID from any YouTube URL format
function extractYouTubeId(url) {
    if (!url) return null;
    url = url.trim();
    
    // Handle youtube.com/watch?v=
    const match1 = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match1) return match1[1];
    
    // Handle youtu.be/VIDEO_ID
    const match2 = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (match2) return match2[1];
    
    // Handle youtube.com/shorts/VIDEO_ID
    const match3 = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (match3) return match3[1];
    
    // Handle youtube.com/embed/VIDEO_ID
    const match4 = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    if (match4) return match4[1];
    
    // Handle youtube.com/v/VIDEO_ID
    const match5 = url.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/);
    if (match5) return match5[1];
    
    // Handle mobile m.youtube.com
    const match6 = url.match(/m\.youtube\.com.*[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match6) return match6[1];
    
    // Handle music.youtube.com
    const match7 = url.match(/music\.youtube\.com.*[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match7) return match7[1];
    
    // Last resort - look for 11-char alphanumeric string after common patterns
    const match8 = url.match(/(?:\/|%2F)([a-zA-Z0-9_-]{11})(?:[?&]|$)/);
    if (match8 && url.includes('youtube')) return match8[1];
    
    return null;
}

// Auto-fetch video title and thumbnail from URL
async function fetchVideoMetadata(url) {
    try {
        // For YouTube videos and Shorts
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = extractYouTubeId(url);
            if (videoId) {
                // Use oEmbed API to get title
                const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
                const data = await response.json();
                
                return {
                    title: data.title,
                    thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                    success: true
                };
            }
        }
        
        // For other URLs, try to extract domain
        try {
            const urlObj = new URL(url);
            return {
                title: `Video from ${urlObj.hostname}`,
                thumbnail: null,
                success: false
            };
        } catch {
            return {
                title: 'Video Track',
                thumbnail: null,
                success: false
            };
        }
    } catch (error) {
        console.error('Error fetching video metadata:', error);
        return {
            title: 'Video Track',
            thumbnail: null,
            success: false
        };
    }
}

// Simple add track flow with auto-fetch
async function addPracticeTrackSimple() {
    const url = document.getElementById('practiceTrackUrlInput').value.trim();
    const instrument = document.getElementById('practiceTrackInstrument').value;
    const notes = document.getElementById('practiceTrackNotes').value.trim();
    
    if (!url) {
        alert('Please paste a video URL');
        return;
    }
    
    if (!instrument) {
        alert('Please select an instrument');
        return;
    }
    
    // Show loading
    const addButton = document.getElementById('addPracticeTrackBtn');
    const originalText = addButton.innerHTML;
    addButton.innerHTML = '⏳ Fetching video info...';
    addButton.disabled = true;
    
    try {
        // Fetch metadata
        const metadata = await fetchVideoMetadata(url);
        
        const track = {
            title: metadata.title,
            videoUrl: url,
            instrument: instrument,
            notes: notes,
            uploadedBy: 'drew',
            dateAdded: new Date().toISOString().split('T')[0],
            thumbnail: metadata.thumbnail
        };
        
        // Check for duplicate URL
        const existingTracks = await loadPracticeTracksFromDrive(selectedSong.title);
        if (existingTracks.some(t => t.videoUrl === url)) {
            alert('This video has already been added as a practice track!');
            addButton.innerHTML = originalText;
            addButton.disabled = false;
            return;
        }
        
        // Save to Drive (await to prevent race conditions)
        await savePracticeTrack(selectedSong.title, track);
        
        // Show success message
        const message = document.createElement('div');
        message.style.cssText = 'background: #d1fae5; padding: 12px; border-radius: 8px; margin-top: 10px; color: #065f46; font-weight: 600;';
        message.textContent = `✅ Added: ${metadata.title}`;
        document.getElementById('practiceTrackAddForm').appendChild(message);
        
        // Clear form
        document.getElementById('practiceTrackUrlInput').value = '';
        document.getElementById('practiceTrackNotes').value = '';
        
        // Remove success message after 2 seconds
        setTimeout(() => message.remove(), 2000);
        
        // Refresh the practice tracks display
        await renderPracticeTracksSimplified(selectedSong.title);
        
    } catch (error) {
        alert('Error adding track: ' + error.message);
    } finally {
        addButton.innerHTML = originalText;
        addButton.disabled = false;
    }
}

// Render practice tracks (combines localStorage + data.js)
async function renderPracticeTracksSimplified(songTitle) {
    const container = document.getElementById('practiceTracksContainer');
    const bandData = bandKnowledgeBase[songTitle];
    
    // Get tracks from both sources
    const storedTracks = await loadPracticeTracksFromStorage(songTitle);
    const dataTracks = [];
    
    // Get tracks from data.js if they exist
    if (bandData && bandData.practiceTracks) {
        Object.entries(bandData.practiceTracks).forEach(([instrument, trackList]) => {
            trackList.forEach(track => {
                dataTracks.push({ ...track, instrument, source: 'data.js' });
            });
        });
    }
    
    // Add source marker to stored tracks
    const storedWithSource = (storedTracks || []).map(t => ({ ...t, source: 'Google Drive' }));
    
    // Combine all tracks
    const allTracks = [...dataTracks, ...storedWithSource];
    
    if (allTracks.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px;">No practice tracks yet - add your first one above!</div>';
        return;
    }
    
    // Instrument icons and names
    const instrumentIcons = {
        bass: '🎸',
        leadGuitar: '🎸',
        lead_guitar: '🎸',
        rhythmGuitar: '🎸',
        rhythm_guitar: '🎸',
        keys: '🎹',
        keyboards: '🎹',
        drums: '🥁',
        vocals: '🎤'
    };
    
    const instrumentNames = {
        bass: 'Bass',
        leadGuitar: 'Lead Guitar',
        lead_guitar: 'Lead Guitar',
        rhythmGuitar: 'Rhythm Guitar',
        rhythm_guitar: 'Rhythm Guitar',
        keys: 'Keys',
        keyboards: 'Keyboards',
        drums: 'Drums',
        vocals: 'Vocals'
    };
    
    container.innerHTML = `
        <div class="practice-tracks-grid">
            ${allTracks.map((track, index) => {
                const url = track.videoUrl || track.youtubeUrl;
                const thumbnail = track.thumbnail || getYouTubeThumbnail(url);
                const icon = instrumentIcons[track.instrument] || '🎵';
                const instName = instrumentNames[track.instrument] || track.instrument.replace('_', ' ');
                const isUserAdded = track.source !== 'data.js';
                
                return `
                    <div class="practice-track-card" style="position: relative;">
                        ${isUserAdded ? `
                            <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 5px; z-index: 10;">
                                <button onclick="editPracticeTrack('${songTitle}', ${index - dataTracks.length})" 
                                    style="background: #667eea; color: white; border: none; border-radius: 4px; width: 28px; height: 24px; cursor: pointer; font-size: 12px;"
                                    title="Edit track">✏️</button>
                                <button onclick="deletePracticeTrackConfirm('${songTitle}', ${index - dataTracks.length})" 
                                    style="background: #ef4444; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 14px;"
                                    title="Delete track">✕</button>
                            </div>
                        ` : ''}
                        
                        ${thumbnail ? `
                            <div style="position: relative; margin-bottom: 12px; border-radius: 8px; overflow: hidden; max-width: 200px;">
                                <img src="${thumbnail}" alt="Video thumbnail" style="width: 100%; height: auto; display: block;">
                                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                    <span style="color: white; font-size: 20px;">▶</span>
                                </div>
                            </div>
                        ` : ''}
                        
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <span style="font-size: 1.5em;">${icon}</span>
                            <div style="font-weight: 600; color: #667eea;">${instName}</div>
                        </div>
                        
                        <h4 style="margin: 0 0 8px 0; font-size: 0.95em; color: #2d3748; line-height: 1.4;">
                            ${track.title}
                        </h4>
                        
                        ${track.notes ? `<p style="font-size: 0.85em; margin-bottom: 10px; color: #6b7280;">${track.notes}</p>` : ''}
                        
                        <button class="chart-btn chart-btn-primary" style="width: 100%;" onclick="window.open('${url}', '_blank')">
                            📺 Watch Video
                        </button>
                        
                        <p style="margin-top: 8px; font-size: 0.8em; color: #9ca3af;">
                            Added by ${track.uploadedBy || 'unknown'}
                            ${track.source === 'Google Drive' ? ' <span style="color: #10b981;">- Google Drive</span>' : ''}
                        </p>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

async function deletePracticeTrackConfirm(songTitle, index) {
    if (confirm('Delete this practice track?')) {
        await deletePracticeTrack(songTitle, index);
        await renderPracticeTracksSimplified(songTitle);
    }
}

async function editPracticeTrack(songTitle, index) {
    const tracks = await loadPracticeTracksFromDrive(songTitle) || [];
    const track = tracks[index];
    if (!track) return;
    
    const newUrl = prompt('Edit video URL:', track.videoUrl || track.youtubeUrl || '');
    if (newUrl === null) return; // Canceled
    
    const newNotes = prompt('Edit notes:', track.notes || '');
    if (newNotes === null) return;
    
    // Re-fetch metadata with new URL
    const metadata = await fetchVideoMetadata(newUrl);
    
    tracks[index] = {
        ...track,
        videoUrl: newUrl,
        title: metadata.title || track.title,
        thumbnail: metadata.thumbnail || track.thumbnail,
        notes: newNotes.trim()
    };
    
    await savePracticeTracksToDrive(songTitle, tracks);
    await renderPracticeTracksSimplified(songTitle);
}
// ============================================================================
// SPOTIFY API INTEGRATION
// Fetch real track names and metadata from Spotify
// ============================================================================

// Spotify API - Client Credentials Flow (public API)
async function fetchSpotifyTrackInfo(trackUrl) {
    try {
        // Extract track ID from Spotify URL
        const trackId = extractSpotifyTrackId(trackUrl);
        if (!trackId) {
            return { title: 'Spotify Track', success: false };
        }
        
        // Use Spotify oEmbed endpoint (no auth required!)
        const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl)}`);
        const data = await response.json();
        
        return {
            title: data.title, // Returns "Song Name by Artist Name"
            thumbnail: data.thumbnail_url,
            success: true
        };
    } catch (error) {
        console.error('Error fetching Spotify metadata:', error);
        return { title: 'Spotify Track', success: false };
    }
}

function extractSpotifyTrackId(url) {
    const match = url.match(/track\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

// Update Spotify version rendering to fetch metadata
async function renderSpotifyVersionsWithMetadata(songTitle, bandData) {
    const container = document.getElementById('spotifyVersionsContainer');
    const versions = await loadSpotifyVersions(songTitle) || bandData.spotifyVersions || [];
    
    if (versions.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px;">No Spotify versions added yet</div>';
        return;
    }
    
    // Show loading
    container.innerHTML = '<p style="padding: 15px; color: #667eea;">⏳ Loading track info from Spotify...</p>';
    
    // Fetch metadata for all versions
    const versionsWithMetadata = await Promise.all(
        versions.map(async version => {
            const metadata = await fetchSpotifyTrackInfo(version.spotifyUrl);
            return {
                ...version,
                fetchedTitle: metadata.title,
                thumbnail: metadata.thumbnail
            };
        })
    );
    
    // Render with real titles
    container.innerHTML = versionsWithMetadata.map((version, index) => {
        const voteCount = version.totalVotes || 0;
        const totalMembers = Object.keys(bandMembers).length;
        const isDefault = version.isDefault;
        const displayTitle = version.fetchedTitle || version.title;
        const hasVoted = version.votes && version.votes[currentUserEmail];
        
        return `
            <div class="spotify-version-card ${isDefault ? 'default' : ''}" style="position: relative;">
                ${version.addedBy === currentUserEmail ? `
                    <button onclick="deleteSpotifyVersion(${index})" 
                        style="position: absolute; top: 10px; right: 10px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 14px; z-index: 10;">✕</button>
                ` : ''}
                
                ${version.thumbnail ? `
                    <div style="margin-bottom: 12px; text-align: center;">
                        <img src="${version.thumbnail}" alt="Album art" style="max-width: 200px; max-height: 200px; width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    </div>
                ` : ''}
                
                <div class="version-header">
                    <div class="version-title">${displayTitle}</div>
                    ${isDefault ? `<div class="version-badge">👑 BAND CHOICE (${voteCount}/${totalMembers})</div>` : ''}
                </div>
                
                <div class="votes-container">
                    ${Object.entries(bandMembers).map(([email, member]) => {
                        const voted = version.votes && version.votes[email];
                        return `
                            <span class="vote-chip ${voted ? 'yes' : 'no'}" onclick="toggleSpotifyVote(${index}, '${email}')" style="cursor: pointer;">
                                ${voted ? '✅ ' : ''}${member.name}
                            </span>
                        `;
                    }).join('')}
                </div>
                
                ${version.notes ? `<p style="margin-bottom: 12px; font-style: italic; color: #6b7280;">${version.notes}</p>` : ''}
                
                <button class="spotify-play-btn" onclick="window.open('${version.spotifyUrl}', '_blank')">
                    ▶️ Play on Spotify
                </button>
            </div>
        `;
    }).join('');
}

async function addSpotifyVersion() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) {
        alert('Please select a song first!');
        return;
    }
    
    const url = prompt('Paste Spotify track URL:');
    if (!url || !url.includes('spotify.com')) {
        if (url) alert('Please paste a valid Spotify URL');
        return;
    }
    
    const notes = prompt('Notes about this version (optional):');
    
    const version = {
        id: 'version_' + Date.now(),
        title: 'Loading...',
        spotifyUrl: url,
        votes: {},
        totalVotes: 0,
        isDefault: false,
        addedBy: currentUserEmail,
        notes: notes || '',
        dateAdded: new Date().toLocaleDateString()
    };
    
    // Initialize votes for all band members
    Object.keys(bandMembers).forEach(email => {
        version.votes[email] = false;
    });
    
    // Load existing versions
    let versions = await loadSpotifyVersions(songTitle) || [];
    versions.push(version);
    
    // Save
    await saveSpotifyVersions(songTitle, versions);
    
    // Re-render
    const bandData = bandKnowledgeBase[songTitle] || {};
    await renderSpotifyVersionsWithMetadata(songTitle, bandData);
}

async function toggleSpotifyVote(versionIndex, voterEmail) {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    
    // Note: any signed-in band member can toggle votes
    // (email mismatch between bandMembers keys and Google OAuth made the old check too strict)
    
    let versions = await loadSpotifyVersions(songTitle) || [];
    if (!versions[versionIndex]) return;
    
    // Toggle vote
    versions[versionIndex].votes[voterEmail] = !versions[versionIndex].votes[voterEmail];
    
    // Recalculate total votes
    versions[versionIndex].totalVotes = Object.values(versions[versionIndex].votes).filter(v => v).length;
    
    // Check if this becomes default (majority = 3+ votes)
    const totalMembers = Object.keys(bandMembers).length;
    const majority = Math.ceil(totalMembers / 2);
    versions[versionIndex].isDefault = versions[versionIndex].totalVotes >= majority;
    
    // Save
    await saveSpotifyVersions(songTitle, versions);
    
    // Re-render
    const bandData = bandKnowledgeBase[songTitle] || {};
    await renderSpotifyVersionsWithMetadata(songTitle, bandData);
}

async function deleteSpotifyVersion(versionIndex) {
    if (!confirm('Delete this Spotify version?')) return;
    
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    
    let versions = await loadSpotifyVersions(songTitle) || [];
    versions.splice(versionIndex, 1);
    
    await saveSpotifyVersions(songTitle, versions);
    
    const bandData = bandKnowledgeBase[songTitle] || {};
    await renderSpotifyVersionsWithMetadata(songTitle, bandData);
}

async function saveSpotifyVersions(songTitle, versions) {
    return await saveBandDataToDrive(songTitle, 'spotify_versions', versions);
}

async function loadSpotifyVersions(songTitle) {
    return await loadBandDataFromDrive(songTitle, 'spotify_versions');
}

console.log('🎵 Spotify versions system loaded');

// Search helpers
function searchSpotify() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) {
        alert('Please select a song first!');
        return;
    }
    
    // Get band name
    const songData = allSongs.find(s => s.title === songTitle);
    const bandAbbr = songData ? songData.band : 'GD';
    const bandName = getFullBandName(bandAbbr);
    
    // Open Spotify search
    const query = encodeURIComponent(`${songTitle} ${bandName}`);
    window.open(`spotify:search:${query}`, '_blank');
    
    // Fallback to web if app doesn't open
    setTimeout(() => {
        window.open(`https://open.spotify.com/search/${query}`, '_blank');
    }, 1000);
}

function searchUltimateGuitar() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) {
        alert('Please select a song first!');
        return;
    }
    
    // Get band name  
    const songData = allSongs.find(s => s.title === songTitle);
    const bandAbbr = songData ? songData.band : 'GD';
    const bandName = getFullBandName(bandAbbr);
    
    // Open Ultimate Guitar search
    const query = encodeURIComponent(`${songTitle} ${bandName}`);
    window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}`, '_blank');
}

console.log('🔍 Search helper functions loaded');

// ============================================================================
// REHEARSAL NOTES FORM
// Collaborative note-taking with band member attribution
// ============================================================================

function showRehearsalNoteForm() {
    const formHTML = `
        <div style="background: white; padding: 20px; border-radius: 12px; border: 2px solid #667eea; margin-bottom: 15px;">
            <h4 style="margin: 0 0 15px 0;">Add Rehearsal Note</h4>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Band Member:</label>
                <select id="rehearsalNoteAuthor" style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px;">
                    <option value="">-- Who's saying this? --</option>
                    ${Object.entries(bandMembers).map(([key, member]) => `
                        <option value="${key}">${member.name}</option>
                    `).join('')}
                </select>
            </div>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Priority:</label>
                <select id="rehearsalNotePriority" style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px;">
                    <option value="low">🟢 Low - Nice to have</option>
                    <option value="medium" selected>🟡 Medium - Should address</option>
                    <option value="high">🔴 High - Must fix before gig</option>
                </select>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Note:</label>
                <textarea id="rehearsalNoteText" placeholder="E.g., Need to work on harmony entries - Chris coming in too early"
                    style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; min-height: 80px; font-family: inherit; font-size: 0.95em;"></textarea>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button class="chart-btn chart-btn-primary" onclick="addRehearsalNote()" style="flex: 1;">
                    ➕ Add Note
                </button>
                <button class="chart-btn chart-btn-secondary" onclick="hideRehearsalNoteForm()">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('rehearsalNoteFormContainer').innerHTML = formHTML;
}

function hideRehearsalNoteForm() {
    document.getElementById('rehearsalNoteFormContainer').innerHTML = '';
}

async function addRehearsalNote() {
    const author = document.getElementById('rehearsalNoteAuthor').value;
    const priority = document.getElementById('rehearsalNotePriority').value;
    const text = document.getElementById('rehearsalNoteText').value.trim();
    
    if (!author) {
        alert('Please select who is making this note');
        return;
    }
    
    if (!text) {
        alert('Please enter a note');
        return;
    }
    
    const note = {
        author: author,
        date: new Date().toISOString().split('T')[0],
        priority: priority,
        note: text
    };
    
    // Save to Google Drive (shared with all band members)
    const notes = await loadRehearsalNotesFromDrive(selectedSong.title);
    notes.push(note);
    await saveRehearsalNotesToDrive(selectedSong.title, notes);
    
    // Show success
    alert(`✅ Note added by ${bandMembers[author].name} - saved to Google Drive!`);
    
    // Clear form
    hideRehearsalNoteForm();
    
    // Refresh display
    renderRehearsalNotesWithStorage(selectedSong.title);
}

async function renderRehearsalNotesWithStorage(songTitle) {
    const container = document.getElementById('rehearsalNotesContainer');
    const bandData = bandKnowledgeBase[songTitle];
    
    // Get notes from both sources
    const dataJsNotes = (bandData && bandData.rehearsalNotes) || [];
    const storedNotes = await loadRehearsalNotesFromDrive(songTitle);
    
    // Combine and sort by date (newest first)
    const allNotes = [...dataJsNotes, ...storedNotes].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    if (allNotes.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px;">No rehearsal notes yet - add your first one above!</div>';
        return;
    }
    
    const priorityColors = {
        high: '#ef4444',
        medium: '#f59e0b',
        low: '#10b981'
    };
    
    const priorityEmojis = {
        high: '🔴',
        medium: '🟡',
        low: '🟢'
    };
    
    container.innerHTML = `
        <div class="rehearsal-notes-list">
            ${allNotes.map(note => {
                const memberName = bandMembers[note.author]?.name || note.author;
                const priorityColor = priorityColors[note.priority] || '#667eea';
                const priorityEmoji = priorityEmojis[note.priority] || '-';
                
                return `
                    <div class="rehearsal-note-card ${note.priority === 'high' ? 'high' : ''}">
                        <div class="note-header">
                            <span><strong>${memberName}</strong> - ${note.date}</span>
                            <span style="color: ${priorityColor}; font-weight: 600;">
                                ${priorityEmoji} ${note.priority.toUpperCase()} PRIORITY
                            </span>
                        </div>
                        <div class="note-content">${note.note}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}
// ============================================================================
// HARMONY AUDIO SNIPPETS
// Upload audio files (Voice Memos, Soundtrap, etc.) with custom naming
// Uses localStorage with base64 for immediate functionality
// ============================================================================

function showHarmonyAudioUploadForm(sectionIndex) {
    const formHTML = `
        <div style="background: white; padding: 20px; border-radius: 12px; border: 2px solid #667eea; margin-top: 15px;">
            <h4 style="margin: 0 0 15px 0;">Upload Harmony Audio Snippet</h4>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Audio File:</label>
                <input type="file" id="harmonyAudioFile" accept="audio/*"
                    style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px;">
                <p style="font-size: 0.85em; color: #6b7280; margin-top: 5px;">
                    📎 Accepts: MP3, M4A, WAV, Voice Memos, Soundtrap exports, etc. (Max 5MB)
                </p>
            </div>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Snippet Name:</label>
                <input type="text" id="harmonySnippetName" 
                    placeholder="E.g., Drew lead vocal - first try"
                    style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Notes:</label>
                <input type="text" id="harmonySnippetNotes" 
                    placeholder="E.g., Recorded on iPhone after practice"
                    style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px;">
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button class="chart-btn chart-btn-primary" onclick="uploadHarmonyAudio(${sectionIndex})" style="flex: 1;">
                    📤 Upload Audio
                </button>
                <button class="chart-btn chart-btn-secondary" onclick="hideHarmonyAudioForm()">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('harmonyAudioFormContainer' + sectionIndex).innerHTML = formHTML;
}

function hideHarmonyAudioForm() {
    // Hide all forms
    document.querySelectorAll('[id^="harmonyAudioFormContainer"]').forEach(el => {
        el.innerHTML = '';
    });
}

async function uploadHarmonyAudio(sectionIndex) {
    const fileInput = document.getElementById('harmonyAudioFile');
    const name = document.getElementById('harmonySnippetName').value.trim();
    const notes = document.getElementById('harmonySnippetNotes').value.trim();
    
    if (!fileInput.files || !fileInput.files[0]) {
        alert('Please select an audio file');
        return;
    }
    
    if (!name) {
        alert('Please enter a name for this snippet');
        return;
    }
    
    const file = fileInput.files[0];
    
    // Check file size (5MB limit for localStorage)
    if (file.size > 5 * 1024 * 1024) {
        alert('File too large! Please use a file under 5MB.\n\nTip: You can compress audio files or use shorter clips.');
        return;
    }
    
    // Show loading
    const uploadButton = event.target;
    const originalText = uploadButton.innerHTML;
    uploadButton.innerHTML = '⏳ Uploading...';
    uploadButton.disabled = true;
    
    try {
        // Convert to base64
        const base64 = await fileToBase64(file);
        
        const snippet = {
            name: name,
            notes: notes,
            filename: file.name,
            type: file.type,
            size: file.size,
            data: base64,
            uploadedBy: 'drew', // Could make this selectable
            uploadedDate: new Date().toISOString().split('T')[0]
        };
        
        // Save to Google Drive (shared with band!)
        const key = `harmony_audio_section_${sectionIndex}`;
        const existing = await loadBandDataFromDrive(selectedSong.title, key) || [];
        existing.push(snippet);
        await saveBandDataToDrive(selectedSong.title, key, existing);
        
        // Also save to localStorage as backup
        const localKey = `deadcetera_harmony_audio_${selectedSong.title}_section${sectionIndex}`;
        localStorage.setItem(localKey, JSON.stringify(existing));
        
        alert(`✅ Audio uploaded to Google Drive! All band members can now hear it.`);
        
        // Clear form
        hideHarmonyAudioForm();
        
        // Refresh harmony display
        const bandData = bandKnowledgeBase[selectedSong.title];
        if (bandData) {
            renderHarmoniesEnhanced(selectedSong.title, bandData);
        } else {
            
        }
    } catch (error) {
        alert('Error uploading file: ' + error.message);
    } finally {
        uploadButton.innerHTML = originalText;
        uploadButton.disabled = false;
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function loadHarmonyAudioSnippets(songTitle, sectionIndex) {
    // Load from Google Drive first
    const key = `harmony_audio_section_${sectionIndex}`;
    const driveData = await loadBandDataFromDrive(songTitle, key);
    if (driveData && Array.isArray(driveData)) return driveData;
    
    // Fallback to localStorage
    const localKey = `deadcetera_harmony_audio_${songTitle}_section${sectionIndex}`;
    const stored = localStorage.getItem(localKey);
    return stored ? JSON.parse(stored) : [];
}

function playHarmonySnippet(base64Data) {
    const audio = new Audio(base64Data);
    audio.play().catch(err => {
        alert('Error playing audio: ' + err.message);
    });
}

async function deleteHarmonySnippet(songTitle, sectionIndex, snippetIndex) {
    if (!confirm('Delete this audio snippet?')) return;
    
    // Load from Drive
    const key = `harmony_audio_section_${sectionIndex}`;
    const snippets = await loadBandDataFromDrive(songTitle, key) || [];
    
    snippets.splice(snippetIndex, 1);
    
    // Save back to Drive
    await saveBandDataToDrive(songTitle, key, snippets);
    
    // Update localStorage backup
    const localKey = `deadcetera_harmony_audio_${songTitle}_section${sectionIndex}`;
    localStorage.setItem(localKey, JSON.stringify(snippets));
    
    // Refresh display
    const bandData = bandKnowledgeBase[selectedSong.title];
    if (bandData) {
        renderHarmoniesEnhanced(selectedSong.title, bandData);
    }
}
// ============================================================================
// ENHANCED HARMONY SYSTEM
// 1. Browser microphone recording
// 2. Collaborative delete/rename
// 3. Sheet music generation from notes
// ============================================================================

// ============================================================================
// MICROPHONE RECORDING
// ============================================================================

let mediaRecorder = null;
let audioChunks = [];
let recordingStream = null;

async function startMicrophoneRecording(sectionIndex) {
    try {
        // MOBILE FIX: Stop ALL audio playback first
        // 1. Stop ABC synth if playing
        if (window.currentSynthControl) {
            try {
                window.currentSynthControl.pause();
                console.log('⏹️ Stopped ABC playback');
            } catch (e) {
                console.warn('Could not stop ABC playback:', e);
            }
        }
        
        // 2. Pause all <audio> elements on page
        document.querySelectorAll('audio').forEach(audio => {
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (e) {
                console.warn('Could not stop audio element:', e);
            }
        });
        
        // 3. Wait a moment for audio to fully stop
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Request microphone access with better error handling
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        };
        
        recordingStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // iOS FIX: Use compatible MIME type
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            mimeType = 'audio/ogg';
        }
        
        console.log('🎙️ Using MIME type:', mimeType);
        
        // Create recorder with compatible MIME type
        mediaRecorder = new MediaRecorder(recordingStream, { mimeType });
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            try {
                // Create blob from chunks
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                
                if (audioBlob.size === 0) {
                    throw new Error('Recording failed - no audio data captured');
                }
                
                // Convert to base64
                const base64 = await blobToBase64(audioBlob);
                
                // Show save form with recorded audio
                showSaveRecordingForm(sectionIndex, base64, audioBlob.size, mimeType);
                
                // Stop all tracks
                recordingStream.getTracks().forEach(track => track.stop());
            } catch (error) {
                console.error('Recording save error:', error);
                alert('Recording failed to save: ' + error.message);
                // Clean up
                if (recordingStream) {
                    recordingStream.getTracks().forEach(track => track.stop());
                }
            }
        };
        
        mediaRecorder.onerror = (error) => {
            console.error('MediaRecorder error:', error);
            alert('Recording error: ' + (error.error?.message || 'Unknown error'));
        };
        
        // Start recording
        mediaRecorder.start();
        
        // Show recording UI
        showRecordingUI(sectionIndex);
        
    } catch (error) {
        console.error('Microphone access error:', error);
        let errorMessage = 'Microphone access denied or not available.';
        
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Please allow microphone access in your browser settings.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'No microphone found. Please check your device.';
        } else if (error.name === 'NotReadableError') {
            errorMessage = 'Microphone is already in use by another app.';
        }
        
        alert(errorMessage + '\n\nError: ' + error.message);
    }
}

function stopMicrophoneRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
}

function showRecordingUI(sectionIndex) {
    const container = document.getElementById('harmonyAudioFormContainer' + sectionIndex);
    
    let seconds = 0;
    const timerInterval = setInterval(() => {
        seconds++;
        const display = document.getElementById('recordingTimer');
        if (display) {
            display.textContent = formatTime(seconds);
        }
    }, 1000);
    
    container.innerHTML = `
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 25px; border-radius: 12px; color: white; text-align: center; margin-top: 15px;">
            <div style="font-size: 3em; margin-bottom: 10px;">🎙️</div>
            <div style="font-size: 1.5em; font-weight: 600; margin-bottom: 10px;">Recording...</div>
            <div id="recordingTimer" style="font-size: 2em; font-weight: 700; font-family: monospace;">0:00</div>
            <button onclick="stopMicrophoneRecording(); clearInterval(${timerInterval})" 
                style="background: white; color: #ef4444; border: none; padding: 12px 30px; border-radius: 25px; font-weight: 600; margin-top: 20px; cursor: pointer; font-size: 1em;">
                ⏹️ Stop Recording
            </button>
        </div>
    `;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showSaveRecordingForm(sectionIndex, base64Audio, fileSize, mimeType) {
    const container = document.getElementById('harmonyAudioFormContainer' + sectionIndex);
    
    // Get file extension from MIME type
    let extension = 'webm';
    if (mimeType.includes('mp4')) extension = 'm4a';
    else if (mimeType.includes('ogg')) extension = 'ogg';
    
    container.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 12px; border: 2px solid #10b981; margin-top: 15px;">
            <h4 style="margin: 0 0 15px 0; color: #10b981;">✅ Recording Complete!</h4>
            
            <div style="margin-bottom: 15px; text-align: center;">
                <audio controls src="${base64Audio}" style="width: 100%; max-width: 400px;"></audio>
                <p style="font-size: 0.85em; color: #6b7280; margin-top: 5px;">Format: ${extension.toUpperCase()} - Size: ${(fileSize / 1024).toFixed(1)} KB</p>
            </div>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Who recorded this?</label>
                <select id="recordingAuthor" style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px;">
                    ${Object.entries(bandMembers).map(([key, member]) => `
                        <option value="${key}">${member.name}</option>
                    `).join('')}
                </select>
            </div>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Name this recording:</label>
                <input type="text" id="recordingName" 
                    placeholder="E.g., Drew lead vocal - harmony practice"
                    style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Notes (optional):</label>
                <input type="text" id="recordingNotes" 
                    placeholder="E.g., Trying the high harmony part"
                    style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px;">
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button class="chart-btn chart-btn-primary" onclick="saveRecording(${sectionIndex}, '${base64Audio}', ${fileSize})" style="flex: 1;">
                    💾 Save Recording
                </button>
                <button class="chart-btn chart-btn-secondary" onclick="discardRecording(${sectionIndex})">
                    🗑️ Discard
                </button>
            </div>
        </div>
    `;
}

// blobToBase64 defined later in Google Drive section

async function saveRecording(sectionIndex, base64Audio, fileSize) {
    const author = document.getElementById('recordingAuthor').value;
    const name = document.getElementById('recordingName').value.trim();
    const notes = document.getElementById('recordingNotes').value.trim();
    
    if (!name) {
        alert('Please enter a name for this recording');
        return;
    }
    
    const snippet = {
        name: name,
        notes: notes,
        filename: 'recording.webm',
        type: 'audio/webm',
        size: fileSize,
        data: base64Audio,
        uploadedBy: author,
        uploadedDate: new Date().toISOString().split('T')[0],
        isRecording: true
    };
    
    // Save to localStorage
    const key = `deadcetera_harmony_audio_${selectedSong.title}_section${sectionIndex}`;
    const existing = localStorage.getItem(key);
    const snippets = existing ? JSON.parse(existing) : [];
    snippets.push(snippet);
    localStorage.setItem(key, JSON.stringify(snippets));
    
    alert(`✅ Recording saved: ${name}`);
    
    // Clear form
    hideHarmonyAudioForm();
    
    // Refresh harmony display
    const bandData = bandKnowledgeBase[selectedSong.title];
    renderHarmoniesEnhanced(selectedSong.title, bandData);
}

function discardRecording(sectionIndex) {
    if (confirm('Discard this recording?')) {
        hideHarmonyAudioForm();
    }
}

// ============================================================================
// COLLABORATIVE EDIT (DELETE/RENAME BY ANYONE)
// ============================================================================

function renameHarmonySnippet(songTitle, sectionIndex, snippetIndex) {
    const key = `deadcetera_harmony_audio_${songTitle}_section${sectionIndex}`;
    const snippets = JSON.parse(localStorage.getItem(key) || '[]');
    const snippet = snippets[snippetIndex];
    
    const newName = prompt('Rename this audio snippet:', snippet.name);
    if (newName && newName.trim()) {
        snippet.name = newName.trim();
        localStorage.setItem(key, JSON.stringify(snippets));
        
        const bandData = bandKnowledgeBase[songTitle];
        if (bandData) {
            renderHarmoniesEnhanced(songTitle, bandData);
        } else {
            
        }
    }
}

function deleteHarmonySnippetEnhanced(songTitle, sectionIndex, snippetIndex) {
    if (!confirm('Delete this audio snippet? Anyone can delete.')) return;
    
    const key = `deadcetera_harmony_audio_${songTitle}_section${sectionIndex}`;
    const snippets = JSON.parse(localStorage.getItem(key) || '[]');
    snippets.splice(snippetIndex, 1);
    localStorage.setItem(key, JSON.stringify(snippets));
    
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) {
        renderHarmoniesEnhanced(songTitle, bandData);
    } else {
        
    }
}

// ============================================================================
// SHEET MUSIC GENERATION
// ============================================================================

// ============================================================================
// ENHANCED ABC EDITOR - Integrated
// ============================================================================

// generateSheetMusic wrapper defined later (after enhanced version)

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('✅ ABC notation copied to clipboard!\n\nPaste it into https://abcjs.net/abcjs-editor.html to see the sheet music.');
    }).catch(err => {
        alert('Could not copy. Please select and copy manually.');
    });
}

// Render audio snippets section even when there's no harmony data
async function renderAudioSnippetsOnly(songTitle, container) {
    // Check if there are any audio snippets saved
    let hasAnySnippets = false;
    let snippetsHTML = '';
    
    // Check all possible section indices (0-9 should be enough)
    for (let sectionIndex = 0; sectionIndex < 10; sectionIndex++) {
        const audioSnippets = await loadHarmonyAudioSnippets(songTitle, sectionIndex);
        
        if (audioSnippets.length > 0) {
            hasAnySnippets = true;
            
            snippetsHTML += `
                <div style="margin-bottom: 30px; padding: 20px; background: #f9fafb; border-radius: 12px; border: 2px solid #e2e8f0;">
                    <h4 style="margin: 0 0 15px 0; color: #2d3748;">🎵 Audio Snippets - Section ${sectionIndex + 1}</h4>
                    
                    <div style="display: flex; gap: 8px; margin-bottom: 15px;">
                        <button class="chart-btn chart-btn-primary" onclick="startMicrophoneRecording(${sectionIndex})" 
                            style="padding: 8px 16px; font-size: 0.9em;">
                            🎙️ Record Now
                        </button>
                        <button class="chart-btn chart-btn-secondary" onclick="showHarmonyAudioUploadForm(${sectionIndex})" 
                            style="padding: 8px 16px; font-size: 0.9em;">
                            📤 Upload File
                        </button>
                    </div>
                    
                    <div id="harmonyAudioFormContainer${sectionIndex}"></div>
                    
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 15px;">
                        ${audioSnippets.map((snippet, snippetIndex) => `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 2px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                                    <div>
                                        <strong style="color: #2d3748;">${snippet.name}</strong>
                                        ${snippet.notes ? `<p style="margin: 5px 0 0 0; font-size: 0.85em; color: #6b7280;">${snippet.notes}</p>` : ''}
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <button onclick="renameHarmonySnippet('${songTitle}', ${sectionIndex}, ${snippetIndex})" 
                                            style="background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85em;">
                                            ✏️ Rename
                                        </button>
                                        <button onclick="deleteHarmonySnippetEnhanced('${songTitle}', ${sectionIndex}, ${snippetIndex})" 
                                            style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85em;">
                                            ✕
                                        </button>
                                    </div>
                                </div>
                                <audio controls src="${snippet.data}" style="width: 100%; margin-bottom: 8px;"></audio>
                                <p style="margin: 0; font-size: 0.8em; color: #9ca3af;">
                                    ${bandMembers[snippet.uploadedBy]?.name || snippet.uploadedBy} - ${snippet.uploadedDate}
                                    ${snippet.isRecording ? ' - ? Recorded in browser' : ''}
                                </p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }
    
    if (hasAnySnippets) {
        container.innerHTML = `
            <div style="margin-bottom: 20px; padding: 15px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; font-size: 0.9em;"><strong>Note:</strong> This song doesn't have harmony parts documented yet, but you have audio snippets saved below.</p>
            </div>
            ${snippetsHTML}
        `;
    } else {
        // No harmony data and no snippets - show a helpful message with record button
        container.innerHTML = `
            <div style="padding: 30px; text-align: center; background: #f9fafb; border-radius: 12px; border: 2px dashed #e2e8f0;">
                <p style="color: #6b7280; margin-bottom: 20px;">No harmony parts documented yet, but you can still record audio snippets!</p>
                
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button class="chart-btn chart-btn-primary" onclick="startMicrophoneRecording(0)">
                        🎙️ Record Now
                    </button>
                    <button class="chart-btn chart-btn-secondary" onclick="showHarmonyAudioUploadForm(0)">
                        📤 Upload File
                    </button>
                </div>
                
                <div id="harmonyAudioFormContainer0" style="margin-top: 20px;"></div>
            </div>
        `;
    }
}

// Enhanced harmony rendering with audio snippets, recording, and sheet music
async function renderHarmoniesEnhanced(songTitle, bandData) {
    let container = document.getElementById('harmoniesContainer');
    
    // Fallback: look for the section by other means
    if (!container) {
        // Try to find it within the harmony parts section
        const allContainers = document.querySelectorAll('[id*="harmoni"], [id*="Harmoni"]');
        if (allContainers.length > 0) {
            container = allContainers[0];
            console.log('Found harmony container via fallback:', container.id);
        }
    }
    
    if (!container) {
        console.warn('harmoniesContainer not found - creating one');
        // Try to find the Harmony Parts section header and add container after it
        const headers = document.querySelectorAll('h2, h3');
        for (const h of headers) {
            if (h.textContent.includes('Harmony Parts')) {
                container = document.createElement('div');
                container.id = 'harmoniesContainer';
                h.parentElement.appendChild(container);
                console.log('Created harmoniesContainer after Harmony Parts header');
                break;
            }
        }
    }
    
    if (!container) {
        console.error('Could not find or create harmoniesContainer');
        return;
    }
    
    // Check if song has harmonies - use cache first, then Drive
    let hasHarmonies = harmonyBadgeCache[songTitle] || harmonyCache[songTitle];
    if (hasHarmonies === undefined) {
        try {
            hasHarmonies = await loadHasHarmonies(songTitle);
        } catch (e) {
            console.warn('Error loading hasHarmonies:', e);
            hasHarmonies = false;
        }
    }
    
    if (!hasHarmonies) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <p style="color: #9ca3af; font-style: italic; margin-bottom: 15px;">No harmony parts documented yet.</p>
                <button onclick="addFirstHarmonySection('${songTitle.replace(/'/g, "\\'")}')" 
                    class="chart-btn chart-btn-primary" style="background: #667eea;">
                    🎤 Add Harmony Section
                </button>
                <p style="color: #9ca3af; font-size: 0.85em; margin-top: 10px;">This will also mark the song as having harmonies.</p>
            </div>
        `;
        return;
    }
    
    if (!bandData || !bandData.harmonies) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <p style="color: #6b7280; margin-bottom: 15px;">This song is marked as having harmonies but no parts have been added yet.</p>
                <button onclick="addFirstHarmonySection('${songTitle.replace(/'/g, "\\'")}')" 
                    class="chart-btn chart-btn-primary" style="background: #667eea;">
                    🎤 Add Harmony Section
                </button>
            </div>
        `;
        return;
    }
    
    const sections = bandData.harmonies.sections;
    
    const sectionsHTML = await Promise.all(sections.map(async (section, sectionIndex) => {
        const audioSnippets = await loadHarmonyAudioSnippets(songTitle, sectionIndex);
        // Load ABC from Google Drive first, fallback to localStorage
        const savedAbc = await loadABCNotation(songTitle, sectionIndex);
        const sheetMusicExists = savedAbc && savedAbc.length > 0;
        const sheetMusicButtonText = sheetMusicExists ? '🎼 👁️ View Sheet Music' : '🎼 Create Sheet Music';
        const sheetMusicButtonStyle = sheetMusicExists ? 
            'padding: 6px 12px; font-size: 0.85em; background: #10b981; color: white;' : 
            'padding: 6px 12px; font-size: 0.85em;';
        
        // Render parts with metadata
        const partsHTML = await renderHarmonyPartsWithMetadata(songTitle, sectionIndex, section.parts);
        
        return `
            <div class="harmony-card" style="background: #fff5f5; border: 2px solid #fecaca; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <div class="harmony-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div class="harmony-lyric" style="font-size: 1.2em; font-weight: 600; font-style: italic; color: #991b1b;">"${section.lyric}"</div>
                    <button class="chart-btn ${sheetMusicExists ? '' : 'chart-btn-secondary'}" 
                        onclick="generateSheetMusic(${sectionIndex}, ${JSON.stringify(section).replace(/"/g, '&quot;')})" 
                        style="${sheetMusicButtonStyle}">
                        ${sheetMusicButtonText}
                    </button>
                </div>
                
                ${partsHTML}
                
                ${section.practiceNotes && section.practiceNotes.length > 0 ? `
                    <div class="practice-notes-box" style="background: #fffbeb; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #f59e0b;">
                        <strong style="color: #92400e;">📝 General Practice Notes:</strong>
                        <ul style="margin: 8px 0 0 20px; padding: 0;">
                            ${section.practiceNotes.map(note => `<li style="margin: 4px 0; color: #78350f;">${note}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <!-- Audio Snippets -->
                <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #fee2e2;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <strong style="color: #991b1b;">🎵 Audio Snippets</strong>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="startMicrophoneRecording(${sectionIndex})" 
                                style="background: #667eea; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.9em;">
                                🎙️ Record Now
                            </button>
                            <button onclick="showHarmonyAudioUploadForm(${sectionIndex})" 
                                style="background: #4b5563; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.9em;">
                                📤 Upload File
                            </button>
                        </div>
                    </div>
                    
                    <div id="harmonyAudioFormContainer${sectionIndex}"></div>
                    
                    ${audioSnippets.length > 0 ? `
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${audioSnippets.map((snippet, snippetIndex) => `
                                <div style="background: #f9fafb; padding: 15px; border-radius: 8px; border: 2px solid #e5e7eb;">
                                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                                        <div>
                                            <strong style="color: #1f2937;">${snippet.name}</strong>
                                            ${snippet.notes ? `<p style="margin: 5px 0 0 0; font-size: 0.85em; color: #6b7280;">${snippet.notes}</p>` : ''}
                                        </div>
                                        <div style="display: flex; gap: 8px;">
                                            <button onclick="renameHarmonySnippet('${songTitle}', ${sectionIndex}, ${snippetIndex})" 
                                                style="background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85em;">✏️</button>
                                            <button onclick="deleteHarmonySnippetEnhanced('${songTitle}', ${sectionIndex}, ${snippetIndex})" 
                                                style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85em;">✕</button>
                                        </div>
                                    </div>
                                    <audio controls src="${snippet.data}" style="width: 100%; margin-bottom: 8px;"></audio>
                                    <p style="margin: 0; font-size: 0.8em; color: #9ca3af;">
                                        ${bandMembers[snippet.uploadedBy]?.name || snippet.uploadedBy} - ${snippet.uploadedDate}
                                        ${snippet.isRecording ? ' - ? Recorded' : ''}
                                    </p>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 0.9em;">
                            No audio snippets yet. Record now or upload a file!
                        </div>
                    `}
                </div>
            </div>
        `;
    }));
    
    container.innerHTML = (await Promise.all(sectionsHTML)).join('');
}

async function renderHarmonyPartsWithMetadata(songTitle, sectionIndex, parts) {
    // Load metadata from Drive
    const metadata = await loadHarmonyMetadataFromDrive(songTitle, sectionIndex) || {};
    
    // Sort parts by order (highest to lowest pitch)
    const sortedParts = [...parts].sort((a, b) => {
        const orderA = metadata[a.singer]?.order !== undefined ? metadata[a.singer].order : 999;
        const orderB = metadata[b.singer]?.order !== undefined ? metadata[b.singer].order : 999;
        return orderA - orderB;
    });
    
    const partsHTML = await Promise.all(sortedParts.map(async (part, partIndex) => {
        const customNotes = await loadPartNotes(songTitle, sectionIndex, part.singer);
        const partMeta = metadata[part.singer] || {};
        const isLead = partMeta.isLead || false;
        const startingNote = partMeta.startingNote || '';
        
        return `
        <div class="part-row" style="display: flex; flex-direction: column; gap: 12px; padding: 15px; background: #ffffff; border-radius: 8px; margin-bottom: 12px; border: 2px solid #e5e7eb;">
            <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 10px; flex-wrap: wrap;">
                        <div style="font-weight: 700; font-size: 1.1em; color: #667eea;">${bandMembers[part.singer]?.name || part.singer}</div>
                    </div>
                    
                    <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                            <input type="checkbox" ${isLead ? 'checked' : ''} 
                                onchange="updatePartMetadata('${songTitle}', ${sectionIndex}, '${part.singer}', 'isLead', this.checked)"
                                style="width: 16px; height: 16px; cursor: pointer;">
                            <span style="font-size: 0.9em; color: #6b7280; font-weight: 600;">🎤 Lead</span>
                        </label>
                        
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.9em; color: #6b7280; font-weight: 600;">Starting Note:</span>
                            <select onchange="updatePartMetadata('${songTitle}', ${sectionIndex}, '${part.singer}', 'startingNote', this.value)"
                                style="padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; font-size: 0.9em;">
                                <option value="">-</option>
                                ${['A', 'A#/Bb', 'B', 'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab'].map(note => 
                                    `<option value="${note}" ${startingNote === note ? 'selected' : ''}>${note}</option>`
                                ).join('')}
                            </select>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.85em; color: #6b7280;">Sort:</span>
                            <button onclick="movePartUp('${songTitle}', ${sectionIndex}, '${part.singer}')" 
                                style="background: #e5e7eb; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: bold;">▲</button>
                            <button onclick="movePartDown('${songTitle}', ${sectionIndex}, '${part.singer}')" 
                                style="background: #e5e7eb; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: bold;">▼</button>
                        </div>
                    </div>
                </div>
                
                <button onclick="addPartNote('${songTitle}', ${sectionIndex}, '${part.singer}')" 
                    style="background: #667eea; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.9em; white-space: nowrap;">
                    + Note
                </button>
            </div>
            
            ${customNotes && customNotes.length > 0 ? `
                <div style="margin-top: 8px; background: #f9fafb; padding: 12px; border-radius: 6px;">
                    <strong style="font-size: 0.9em; color: #374151;">📝 Practice Notes:</strong>
                    <ul style="margin: 8px 0 0 20px; padding: 0;">
                        ${customNotes.map((note, noteIndex) => `
                            <li style="margin: 6px 0; font-size: 0.9em; color: #4b5563;">
                                ${note}
                                <button onclick="editPartNote('${songTitle}', ${sectionIndex}, '${part.singer}', ${noteIndex})" 
                                    style="margin-left: 8px; background: none; border: none; cursor: pointer; color: #667eea; font-size: 0.85em;">✏️</button>
                                <button onclick="deletePartNote('${songTitle}', ${sectionIndex}, '${part.singer}', ${noteIndex})" 
                                    style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 0.9em;">✕</button>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;
    }));
    
    return (await Promise.all(partsHTML)).join('');
}

// Helper functions for part metadata
async function updatePartMetadata(songTitle, sectionIndex, singer, field, value) {
    const metadata = await loadHarmonyMetadataFromDrive(songTitle, sectionIndex) || {};
    
    if (!metadata[singer]) metadata[singer] = {};
    metadata[singer][field] = value;
    
    await saveHarmonyMetadataToDrive(songTitle, sectionIndex, metadata);
    
    // Refresh display
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) {
        renderHarmoniesEnhanced(songTitle, bandData);
    }
}

async function movePartUp(songTitle, sectionIndex, singer) {
    const metadata = await loadHarmonyMetadataFromDrive(songTitle, sectionIndex) || {};
    const currentOrder = metadata[singer]?.order !== undefined ? metadata[singer].order : 0;
    
    if (!metadata[singer]) metadata[singer] = {};
    metadata[singer].order = currentOrder - 1;
    
    await saveHarmonyMetadataToDrive(songTitle, sectionIndex, metadata);
    
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) {
        renderHarmoniesEnhanced(songTitle, bandData);
    }
}

async function movePartDown(songTitle, sectionIndex, singer) {
    const metadata = await loadHarmonyMetadataFromDrive(songTitle, sectionIndex) || {};
    const currentOrder = metadata[singer]?.order !== undefined ? metadata[singer].order : 0;
    
    if (!metadata[singer]) metadata[singer] = {};
    metadata[singer].order = currentOrder + 1;
    
    await saveHarmonyMetadataToDrive(songTitle, sectionIndex, metadata);
    
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) {
        renderHarmoniesEnhanced(songTitle, bandData);
    }
}

console.log('🎵 Comprehensive harmony parts rendering loaded');

// ============================================================================
// ENHANCED ABC EDITOR
// Edit ABC notation in-app, preview rendered sheet music, save to harmony
// ============================================================================

async function generateSheetMusicEnhanced(sectionIndex, section) {
    const parts = section.parts || [];
    
    // Map part types to ABC notation notes
    const partToNote = {
        'lead': 'C',           
        'harmony_high': 'E',   
        'harmony_low': 'A,',   
        'doubling': 'C'        
    };
    
    // Check if we have saved ABC notation - load from Drive first
    const savedAbc = await loadABCNotation(selectedSong.title, sectionIndex);
    
    let abcNotation = savedAbc || generateDefaultABC(section, parts, partToNote);
    
    // Show editor modal
    showABCEditorModal(section.lyric, abcNotation, sectionIndex);
}

function generateDefaultABC(section, parts, partToNote) {
    let abc = `X:1
T:${section.lyric || 'Harmony Section'}
M:4/4
L:1/4
K:Dmaj
`;
    
    parts.forEach(part => {
        const note = partToNote[part.part] || 'C';
        const memberName = bandMembers[part.singer]?.name || part.singer;
        abc += `%${memberName} (${part.part.replace('_', ' ')})
${note}4 |
`;
    });
    
    return abc;
}

function showABCEditorModal(title, initialAbc, sectionIndex) {
    const modal = document.createElement('div');
    modal.id = 'abcEditorModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; max-width: 1200px; width: 100%; max-height: 95vh; overflow: hidden; display: flex; flex-direction: column;">
            <div style="padding: 25px; border-bottom: 2px solid #e2e8f0;">
                <h3 style="margin: 0 0 10px 0;">🎼 Edit Sheet Music: ${title}</h3>
                <p style="margin: 0; color: #6b7280; font-size: 0.9em;">
                    Edit ABC notation below, then click "Preview" to see the rendered sheet music
                    - <a href="https://abcnotation.com/wiki/abc:standard:v2.1" target="_blank" style="color: #667eea;">📖 ABC Tutorial</a>
                    - <a href="https://abcjs.net/abcjs-editor.html" target="_blank" style="color: #667eea;">🎼 Full ABC Editor</a>
                </p>
            </div>
            
            <div style="flex: 1; overflow: auto; padding: 25px; display: flex; gap: 20px; flex-wrap: wrap;">
                <!-- Left: Editor -->
                <div style="flex: 1; min-width: 280px; display: flex; flex-direction: column;">
                    <label style="font-weight: 600; margin-bottom: 8px; color: #2d3748;">📝 ABC Notation:</label>
                    <textarea id="abcEditorTextarea" 
                        style="flex: 1; min-height: 200px; font-family: 'Courier New', monospace; font-size: 0.95em; padding: 15px; border: 2px solid #e2e8f0; border-radius: 8px; resize: none;"
                    >${initialAbc}</textarea>
                    
                    <div style="margin-top: 15px; padding: 12px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <strong style="font-size: 0.9em;">💡 Quick Tips:</strong>
                        <ul style="margin: 8px 0 0 20px; font-size: 0.85em; line-height: 1.6;">
                            <li>C D E F G A B = Notes</li>
                            <li>2 = half note, 4 = quarter note</li>
                            <li>| = bar line</li>
                            <li>' = octave up, , = octave down</li>
                        </ul>
                    </div>
                </div>
                
                <!-- Right: Preview -->
                <div style="flex: 1; min-width: 280px; display: flex; flex-direction: column;">
                    <label style="font-weight: 600; margin-bottom: 8px; color: #2d3748;">👁️ Preview:</label>
                    <div id="abcPreviewContainer" style="flex: 1; min-height: 300px; background: #f9fafb; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; overflow: auto;">
                        <p style="color: #9ca3af; text-align: center; margin-top: 40px;">Click "Preview" to render sheet music</p>
                    </div>
                </div>
            </div>
            
            <div style="padding: 20px; border-top: 2px solid #e2e8f0; display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
                <button class="chart-btn chart-btn-secondary" onclick="document.getElementById('abcEditorModal').remove()" style="background: #ef4444; color: white; border: none;">
                    ❌ Cancel
                </button>
                <button class="chart-btn chart-btn-primary" onclick="previewABC()">
                    👁️ Preview Sheet Music
                </button>
                <button class="chart-btn chart-btn-primary" onclick="saveABCNotation(${sectionIndex})" style="background: #10b981;">
                    💾 Save & Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-preview after a short delay
    setTimeout(() => previewABC(), 500);
}

function previewABC() {
    const abc = document.getElementById('abcEditorTextarea').value;
    const container = document.getElementById('abcPreviewContainer');
    
    container.innerHTML = '<p style="color: #667eea; text-align: center;">Rendering...</p>';
    
    try {
        // Load abcjs library if not already loaded
        if (typeof ABCJS === 'undefined') {
            loadABCJS(() => renderABCPreview(abc, container));
        } else {
            renderABCPreview(abc, container);
        }
    } catch (error) {
        container.innerHTML = `<p style="color: #ef4444;">Error rendering: ${error.message}</p>`;
    }
}

function loadABCJS(callback) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/abcjs@6.4.0/dist/abcjs-basic-min.js';
    script.onload = callback;
    script.onerror = () => {
        alert('Could not load sheet music renderer. Check your internet connection.');
    };
    document.head.appendChild(script);
}

async function renderABCPreview(abc, container) {
    container.innerHTML = '';
    
    // Load ABCjs audio CSS if not already loaded
    if (!document.getElementById('abcjs-audio-css')) {
        const cssLink = document.createElement('link');
        cssLink.id = 'abcjs-audio-css';
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://cdn.jsdelivr.net/npm/abcjs@6.4.0/abcjs-audio.css';
        document.head.appendChild(cssLink);
    }
    
    try {
        // Create container for sheet music
        const sheetContainer = document.createElement('div');
        sheetContainer.id = 'abcSheetMusic';
        container.appendChild(sheetContainer);
        
        // Parse ABC to detect voices
        const voiceMatches = abc.match(/V:\d+\s+clef=treble\s+name="([^"]+)"/g) || [];
        const voices = voiceMatches.map((match, index) => {
            const nameMatch = match.match(/name="([^"]+)"/);
            return {
                index: index,
                name: nameMatch ? nameMatch[1] : `Voice ${index + 1}`
            };
        });
        
        // Render the sheet music
        const visualObj = ABCJS.renderAbc(sheetContainer, abc, {
            responsive: 'resize',
            staffwidth: container.offsetWidth - 40,
            scale: 1.2,
            add_classes: true
        })[0];
        
        // Add voice selection if multiple voices
        let voiceControlsHTML = '';
        if (voices.length > 1) {
            voiceControlsHTML = `
                <div style="margin-bottom: 15px; padding: 12px; background: white; border-radius: 6px; border: 2px solid #e2e8f0;">
                    <strong style="color: #2d3748;">🎵 Select Parts to Play:</strong>
                    <div style="display: flex; gap: 15px; margin-top: 10px; flex-wrap: wrap;">
                        ${voices.map(voice => `
                            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                <input type="checkbox" class="voice-checkbox" data-voice="${voice.index}" checked 
                                    style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="color: #4b5563; font-weight: 500;">${voice.name}</span>
                            </label>
                        `).join('')}
                    </div>
                    <button onclick="updateVoiceSelection()" 
                        style="margin-top: 10px; background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9em;">
                        🔄 Update Playback
                    </button>
                </div>
            `;
        }
        
        // Add playback controls
        const controlsContainer = document.createElement('div');
        controlsContainer.style.cssText = 'margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 8px;';
        controlsContainer.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: 600; color: #2d3748;">🎵 Playback Controls:</div>
            ${voiceControlsHTML}
            <div id="abcAudioControls"></div>
            <div id="abcAudioWarnings" style="margin-top: 10px; color: #f59e0b; font-size: 0.85em;"></div>
        `;
        container.appendChild(controlsContainer);
        
        // Store for voice selection updates
        window.currentVisualObj = visualObj;
        window.currentSynthControl = null;
        
        // Initialize synth for playback
        if (window.ABCJS && window.ABCJS.synth && visualObj) {
            try {
                // iOS FIX: Create AudioContext early via user gesture
                // We wrap synth init in a function triggered by first tap
                const initSynth = async () => {
                    try {
                        // Force-create and resume AudioContext (iOS requires user gesture)
                        if (window.AudioContext || window.webkitAudioContext) {
                            const AudioCtx = window.AudioContext || window.webkitAudioContext;
                            if (!window._deadceteraAudioCtx) {
                                window._deadceteraAudioCtx = new AudioCtx();
                            }
                            if (window._deadceteraAudioCtx.state === 'suspended') {
                                await window._deadceteraAudioCtx.resume();
                            }
                        }
                        
                        const synthControl = new ABCJS.synth.SynthController();
                        window.currentSynthControl = synthControl;
                        
                        synthControl.load('#abcAudioControls', null, {
                            displayLoop: true,
                            displayRestart: true,
                            displayPlay: true,
                            displayProgress: true,
                            displayWarp: true
                        });
                        
                        const selectedVoices = getSelectedVoices();
                        
                        await synthControl.setTune(visualObj, false, {
                            chordsOff: true,
                            voicesOff: selectedVoices.length > 0 ? 
                                voices.map((v, i) => !selectedVoices.includes(i)).reduce((acc, off, i) => {
                                    if (off) acc.push(i);
                                    return acc;
                                }, []) : []
                        });
                        
                        console.log('🔊 Audio ready for playback');
                        
                        // Resume AudioContext if still suspended
                        if (synthControl.audioContext && synthControl.audioContext.state === 'suspended') {
                            await synthControl.audioContext.resume();
                            console.log('🔊 AudioContext resumed');
                        }
                    } catch (error) {
                        console.warn('Audio setup failed:', error);
                        document.getElementById('abcAudioWarnings').textContent = 
                            '⚠️ Audio playback may not work in all browsers. The sheet music is still valid.';
                    }
                };
                
                // On iOS, we need user interaction first. Show a tap-to-play prompt.
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                if (isIOS) {
                    const tapPrompt = document.createElement('div');
                    tapPrompt.id = 'iosTapPrompt';
                    tapPrompt.style.cssText = 'padding: 15px; text-align: center; background: #fff7ed; border: 2px solid #f59e0b; border-radius: 8px; margin-bottom: 10px; cursor: pointer;';
                    tapPrompt.innerHTML = '<strong style="color: #92400e;">🔊 Tap here to enable audio playback</strong><br><span style="font-size: 0.85em; color: #78716c;">Required on iPhone/iPad</span>';
                    tapPrompt.addEventListener('click', async () => {
                        tapPrompt.innerHTML = '<span style="color: #667eea;">⏳ Loading audio...</span>';
                        await initSynth();
                        tapPrompt.remove();
                    });
                    document.getElementById('abcAudioControls').before(tapPrompt);
                    
                    // Still show the controls (they just won't work until tapped)
                    const synthControl = new ABCJS.synth.SynthController();
                    window.currentSynthControl = synthControl;
                    synthControl.load('#abcAudioControls', null, {
                        displayLoop: true,
                        displayRestart: true,
                        displayPlay: true,
                        displayProgress: true,
                        displayWarp: true
                    });
                    synthControl.setTune(visualObj, false, { chordsOff: true }).catch(() => {});
                } else {
                    // Non-iOS: init immediately
                    await initSynth();
                }
            } catch (error) {
                console.warn('Synth not available:', error);
                document.getElementById('abcAudioWarnings').textContent = 
                    '⚠️ Audio playback not available. You can still edit and save the notation.';
            }
        }
    } catch (error) {
        container.innerHTML = `
            <div style="color: #ef4444; padding: 20px;">
                <strong>Error rendering sheet music:</strong>
                <p>${error.message}</p>
                <p style="font-size: 0.9em; margin-top: 10px;">Check your ABC notation syntax.</p>
            </div>
        `;
    }
}

// Helper functions for voice selection
function getSelectedVoices() {
    const checkboxes = document.querySelectorAll('.voice-checkbox:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.dataset.voice));
}

function updateVoiceSelection() {
    // Get the textarea with ABC notation
    const textarea = document.getElementById('abcEditorTextarea');
    if (!textarea) {
        console.warn('No ABC textarea found');
        return;
    }
    
    try {
        const selectedVoices = getSelectedVoices();
        const abc = textarea.value;
        const lines = abc.split('\n');
        
        // Process each line to add/remove comments
        const newLines = lines.map(line => {
            // Check for voice definition: V:1 or V:2, etc.
            const voiceDefMatch = line.match(/^(% )?V:(\d+)/);
            // Check for voice content: [V:1] or [V:2], etc.
            const voiceContentMatch = line.match(/^(% )?\[V:(\d+)\]/);
            
            if (voiceDefMatch || voiceContentMatch) {
                const voiceNum = parseInt(voiceDefMatch ? voiceDefMatch[2] : voiceContentMatch[2]) - 1;
                const shouldMute = !selectedVoices.includes(voiceNum);
                const isCommented = line.trim().startsWith('%');
                
                if (shouldMute && !isCommented) {
                    // Mute: add % comment
                    return '% ' + line;
                } else if (!shouldMute && isCommented) {
                    // Unmute: remove % comment
                    return line.replace(/^% /, '');
                }
            }
            
            return line;
        });
        
        const newABC = newLines.join('\n');
        
        // Update textarea
        textarea.value = newABC;
        
        // Store for later use
        window.currentABCText = newABC;
        
        // Re-render preview
        const previewContainer = document.getElementById('abcPreviewContainer');
        if (previewContainer) {
            renderABCPreview(newABC, previewContainer);
        }
        
        console.log('🎵 Voice selection updated via ABC comments');
    } catch (error) {
        console.error('Error updating voice selection:', error);
    }
}

async function saveABCNotation(sectionIndex) {
    const abc = document.getElementById('abcEditorTextarea').value;
    const songTitle = selectedSong?.title || selectedSong;
    
    // Save to Google Drive (shared with all band members!)
    const key = `abc_section_${sectionIndex}`;
    await saveBandDataToDrive(songTitle, key, { abc, sectionIndex, updatedBy: currentUserEmail, updatedAt: new Date().toISOString() });
    
    // Also keep localStorage as fallback
    const localKey = `deadcetera_abc_${songTitle}_section${sectionIndex}`;
    localStorage.setItem(localKey, abc);
    
    alert('✅ Sheet music saved to Google Drive! All band members can now see it.');
    
    // Close modal
    const modal = document.getElementById('abcEditorModal');
    if (modal) modal.remove();
    
    // Refresh harmony display
    const bandData = bandKnowledgeBase[songTitle] || {};
    renderHarmoniesEnhanced(songTitle, bandData);
}

async function loadABCNotation(songTitle, sectionIndex) {
    // Try Google Drive first
    const key = `abc_section_${sectionIndex}`;
    const driveData = await loadBandDataFromDrive(songTitle, key);
    if (driveData && driveData.abc) return driveData.abc;
    
    // Fall back to localStorage
    const localKey = `deadcetera_abc_${songTitle}_section${sectionIndex}`;
    return localStorage.getItem(localKey);
}

// Update the original generateSheetMusic to use the enhanced version
function generateSheetMusic(sectionIndex, section) {
    generateSheetMusicEnhanced(sectionIndex, section);
}
// ============================================================================
// ============================================================================
// GOOGLE DRIVE INTEGRATION - NEW GOOGLE IDENTITY SERVICES (GIS)
// Using the modern Google Auth library instead of deprecated gapi.auth2
// ============================================================================

const GOOGLE_DRIVE_CONFIG = {
    apiKey: 'REDACTED',
    clientId: '177899334738-6rcrst4nccsdol4g5t12923ne4duruub.apps.googleusercontent.com',
    scope: 'https://www.googleapis.com/auth/drive.file'
};

let isGoogleDriveInitialized = false;
let isUserSignedIn = false;
let accessToken = null;
let tokenClient = null;
let sharedFolderId = null; // ID of the "Deadcetera Band Resources" folder
let currentUserEmail = null; // Current signed-in user's email

// ============================================================================
// INITIALIZATION WITH NEW GOOGLE IDENTITY SERVICES
// ============================================================================

function loadGoogleDriveAPI() {
    return new Promise((resolve, reject) => {
        console.log('☁️ Loading Google Drive API...');
        
        // Load both Google API and Google Identity Services
        const loadGAPI = new Promise((res, rej) => {
            if (window.gapi) {
                res();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = res;
            script.onerror = rej;
            document.head.appendChild(script);
        });
        
        const loadGIS = new Promise((res, rej) => {
            if (window.google?.accounts?.oauth2) {
                res();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = res;
            script.onerror = rej;
            document.head.appendChild(script);
        });
        
        Promise.all([loadGAPI, loadGIS])
            .then(() => {
                console.log('✅ Google scripts loaded');
                initGoogleDrive().then(resolve).catch(reject);
            })
            .catch(reject);
    });
}

async function initGoogleDrive() {
    try {
        console.log('⚙️ Initializing Google Drive API...');
        
        // Initialize gapi client
        await new Promise((resolve, reject) => {
            gapi.load('client', {
                callback: resolve,
                onerror: reject
            });
        });
        
        await gapi.client.init({
            apiKey: GOOGLE_DRIVE_CONFIG.apiKey,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
        });
        
        console.log('✅ gapi.client initialized');
        
        // Initialize Google Identity Services token client
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_DRIVE_CONFIG.clientId,
            scope: GOOGLE_DRIVE_CONFIG.scope,
            callback: (response) => {
                if (response.error) {
                    console.error('Token error:', response);
                    updateSignInStatus(false);
                    return;
                }
                accessToken = response.access_token;
                gapi.client.setToken({ access_token: accessToken });
                updateSignInStatus(true);
                console.log('✅ User signed in');
                
                // Get user email
                getCurrentUserEmail();
                
                // Create or find the shared folder
                initializeSharedFolder();
            }
        });
        
        isGoogleDriveInitialized = true;
        console.log('✅ Google Drive API initialized');
        
        return true;
    } catch (error) {
        console.error('❌ Google Drive initialization failed:', error);
        throw error;
    }
}

function updateSignInStatus(signedIn) {
    isUserSignedIn = signedIn;
    updateDriveAuthButton();
}

async function getCurrentUserEmail() {
    try {
        const response = await gapi.client.drive.about.get({
            fields: 'user'
        });
        currentUserEmail = response.result.user.emailAddress;
        console.log('👤 Signed in as:', currentUserEmail);
    } catch (error) {
        console.error('Could not get user email:', error);
        currentUserEmail = 'unknown';
    }
}

function updateDriveAuthButton() {
    const button = document.getElementById('googleDriveAuthBtn');
    if (!button) return;
    
    if (isUserSignedIn) {
        button.textContent = '✅ Connected to Google Drive';
        button.style.background = '#10b981';
    } else {
        button.textContent = '☁️ Connect Google Drive';
        button.style.background = '#667eea';
    }
}

// ============================================================================
// AUTHENTICATION WITH NEW GOOGLE IDENTITY SERVICES
// ============================================================================

async function handleGoogleDriveAuth() {
    if (!isGoogleDriveInitialized) {
        try {
            console.log('☁️ Loading Google Drive API...');
            await loadGoogleDriveAPI();
        } catch (error) {
            console.error('Failed to load Google Drive:', error);
            alert('Failed to load Google Drive.\n\nError: ' + error.message);
            return;
        }
    }
    
    if (isUserSignedIn) {
        // Sign out
        google.accounts.oauth2.revoke(accessToken, () => {
            console.log('👋 User signed out');
            accessToken = null;
            gapi.client.setToken(null);
            updateSignInStatus(false);
        });
    } else {
        // Sign in - request access token
        try {
            console.log('🔑 Requesting access token...');
            tokenClient.requestAccessToken({ prompt: '' });
        } catch (error) {
            console.error('Sign-in failed:', error);
            alert('Google Drive sign-in failed.\n\nError: ' + error.message);
        }
    }
}

// ============================================================================
// UPLOAD AUDIO TO GOOGLE DRIVE (Using new auth)
// ============================================================================

async function uploadAudioToDrive(audioBlob, fileName, metadata) {
    if (!isUserSignedIn) {
        alert('Please connect to Google Drive first!');
        return null;
    }
    
    try {
        console.log('📤 Uploading to Google Drive:', fileName);
        
        // Create file metadata
        const fileMetadata = {
            name: fileName,
            description: JSON.stringify(metadata)
        };
        
        // Convert blob to base64
        const base64Data = await blobToBase64(audioBlob);
        
        // Upload using Google Drive API v3
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";
        
        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(fileMetadata) +
            delimiter +
            'Content-Type: ' + audioBlob.type + '\r\n' +
            'Content-Transfer-Encoding: base64\r\n\r\n' +
            base64Data.split(',')[1] +
            close_delim;
        
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'multipart/related; boundary=' + boundary
            },
            body: multipartRequestBody
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error?.message || 'Upload failed');
        }
        
        console.log('✅ Upload successful:', result);
        
        return {
            id: result.id,
            name: result.name,
            webViewLink: `https://drive.google.com/file/d/${result.id}/view`
        };
    } catch (error) {
        console.error('Upload failed:', error);
        alert('Failed to upload to Google Drive: ' + error.message);
        return null;
    }
}

// Helper function
async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

console.log('☁️ Google Drive integration loaded (New GIS)');

// ============================================================================
// EDITABLE HARMONY PART NOTES
// ============================================================================

async function loadPartNotes(songTitle, sectionIndex, singer) {
    return await loadPartNotesFromDrive(songTitle, sectionIndex, singer);
}

async function savePartNotes(songTitle, sectionIndex, singer, notes) {
    await savePartNotesToDrive(songTitle, sectionIndex, singer, notes);
}

async function addPartNote(songTitle, sectionIndex, singer) {
    const note = prompt(`Add practice note for ${singer}:`);
    if (!note || note.trim() === '') return;
    
    const notes = await loadPartNotes(songTitle, sectionIndex, singer);
    notes.push(note.trim());
    await savePartNotes(songTitle, sectionIndex, singer, notes);
    
    // Refresh display
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) {
        renderHarmoniesEnhanced(songTitle, bandData);
    }
}

async function editPartNote(songTitle, sectionIndex, singer, noteIndex) {
    const notes = await loadPartNotes(songTitle, sectionIndex, singer);
    const currentNote = notes[noteIndex];
    const newNote = prompt('Edit note:', currentNote);
    
    if (newNote === null) return; // Cancelled
    if (newNote.trim() === '') {
        // Delete if empty
        deletePartNote(songTitle, sectionIndex, singer, noteIndex);
        return;
    }
    
    notes[noteIndex] = newNote.trim();
    await savePartNotes(songTitle, sectionIndex, singer, notes);
    
    // Refresh display
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) {
        renderHarmoniesEnhanced(songTitle, bandData);
    }
}

async function deletePartNote(songTitle, sectionIndex, singer, noteIndex) {
    if (!confirm('Delete this note?')) return;
    
    const notes = await loadPartNotes(songTitle, sectionIndex, singer);
    notes.splice(noteIndex, 1);
    await savePartNotes(songTitle, sectionIndex, singer, notes);
    
    // Refresh display
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) {
        renderHarmoniesEnhanced(songTitle, bandData);
    }
}

// ============================================================================
// LEAD SINGER & HARMONY METADATA
// ============================================================================

async function updateLeadSinger(singer) {
    if (!selectedSong || !selectedSong.title) return;
    
    await saveBandDataToDrive(selectedSong.title, 'lead_singer', { singer });
    console.log(`🎤 Lead singer updated: ${singer} - saved to Google Drive!`);
}

async function loadLeadSinger(songTitle) {
    const data = await loadBandDataFromDrive(songTitle, 'lead_singer');
    return data ? data.singer : '';
}

async function addFirstHarmonySection(songTitle) {
    const sectionName = prompt('Name this harmony section (e.g., "Chorus", "Verse 1", "Bridge"):');
    if (!sectionName) return;
    
    // Create initial harmony structure
    const harmonies = {
        sections: [{
            name: sectionName,
            parts: []
        }]
    };
    
    // Update bandKnowledgeBase
    if (!bandKnowledgeBase[songTitle]) bandKnowledgeBase[songTitle] = {};
    bandKnowledgeBase[songTitle].harmonies = harmonies;
    
    // Mark song as having harmonies
    harmonyCache[songTitle] = true;
    harmonyBadgeCache[songTitle] = true;
    
    // Update the checkbox if it exists
    const harmoniesCheckbox = document.getElementById('hasHarmoniesCheckbox');
    if (harmoniesCheckbox) harmoniesCheckbox.checked = true;
    
    // Save both has_harmonies flag and harmony data to Drive
    try {
        await saveBandDataToDrive(songTitle, 'has_harmonies', { hasHarmonies: true });
        
        // Save harmony structure
        await saveBandDataToDrive(songTitle, 'harmonies_data', harmonies);
        
        // Update master harmonies file
        await saveMasterFile(MASTER_HARMONIES_FILE, harmonyBadgeCache);
    } catch (e) {
        console.warn('Could not save harmony data to Drive:', e);
    }
    
    // Re-render
    const bandData = bandKnowledgeBase[songTitle];
    await renderHarmoniesEnhanced(songTitle, bandData);
    
    // Update badges
    addHarmonyBadges();
}

async function updateHasHarmonies(hasHarmonies) {
    if (!selectedSong || !selectedSong.title) {
        console.error('Cannot update has harmonies - no song selected');
        return;
    }
    
    console.log(`Updating has harmonies for "${selectedSong.title}": ${hasHarmonies}`);
    
    await saveBandDataToDrive(selectedSong.title, 'has_harmonies', { hasHarmonies });
    
    // Update caches immediately
    harmonyCache[selectedSong.title] = hasHarmonies;
    harmonyBadgeCache[selectedSong.title] = hasHarmonies;
    
    // Save updated master harmonies file
    saveMasterFile(MASTER_HARMONIES_FILE, harmonyBadgeCache).then(() => {
        console.log('Master harmonies file updated');
    });
    
    // Update badge on song list
    addHarmonyBadges();
    
    // Refresh harmonies display
    const bandData = bandKnowledgeBase[selectedSong.title];
    if (bandData) {
        renderHarmoniesEnhanced(selectedSong.title, bandData);
    }
    
    console.log(`Has harmonies: ${hasHarmonies} - saved to Google Drive!`);
}

async function loadHasHarmonies(songTitle) {
    const data = await loadBandDataFromDrive(songTitle, 'has_harmonies');
    return data ? data.hasHarmonies : false;
}

// ============================================================================
// SONG STATUS SYSTEM - Gig Ready, Needs Polish, On Deck, This Week
// ============================================================================

async function updateSongStatus(status) {
    if (!selectedSong || !selectedSong.title) return;
    
    const statusNames = {
        '': 'Not Started',
        'on_deck': 'On Deck',
        'this_week': 'This Week',
        'needs_polish': 'Needs Polish',
        'gig_ready': 'Gig Ready'
    };
    
    // Save to individual file (backward compatibility)
    await saveBandDataToDrive(selectedSong.title, 'song_status', { status, updatedAt: new Date().toISOString(), updatedBy: currentUserEmail });
    
    // Update cache immediately
    statusCache[selectedSong.title] = status;
    
    // Save updated master file (so next page load is instant)
    saveMasterFile(MASTER_STATUS_FILE, statusCache).then(() => {
        console.log('Master status file updated');
    });
    
    console.log(`Song status updated: ${statusNames[status] || 'Not Started'}`);
    
    // Update badge on song list
    await addStatusBadges();
}

async function loadSongStatus(songTitle) {
    const data = await loadBandDataFromDrive(songTitle, 'song_status');
    return data ? data.status : '';
}

async function filterByStatus(status) {
    console.log('Filtering by status:', status);
    
    if (!statusCacheLoaded) {
        alert('Song statuses are still loading. Please wait a moment.');
        return;
    }
    
    // Toggle: if clicking the same filter again, reset to 'all'
    if (status !== 'all' && activeStatusFilter === status) {
        status = 'all';
    }
    
    // Update button styles - reset all buttons first
    document.querySelectorAll('.status-filters .filter-btn').forEach(btn => {
        const originalColor = btn.dataset.color || btn.style.color || '#667eea';
        btn.dataset.color = originalColor;
        btn.style.background = 'white';
        btn.style.color = originalColor;
    });
    // Only highlight clicked button if we're NOT toggling off
    if (status !== 'all' && event && event.target) {
        const btn = event.target.closest('.filter-btn');
        if (btn) {
            const originalColor = btn.dataset.color || btn.style.color || '#667eea';
            btn.dataset.color = originalColor;
            btn.style.background = originalColor;
            btn.style.color = 'white';
        }
    }
    
    // Track active filter so renderSongs can re-apply it
    activeStatusFilter = status;
    
    if (status === 'all') {
        activeStatusFilter = null;
        // Re-render if song list was replaced with a message
        if (document.querySelectorAll('.song-item').length === 0) {
            renderSongs(currentFilter, document.getElementById('songSearch')?.value || '');
        } else {
            document.querySelectorAll('.song-item').forEach(item => {
                item.style.display = 'flex';
            });
        }
        return;
    }
    
    applyStatusFilter(status);
}

// Separate function so renderSongs can call it after re-rendering
function applyStatusFilter(status) {
    if (!status || status === 'all') return;
    
    const songItems = document.querySelectorAll('.song-item');
    let visibleCount = 0;
    
    songItems.forEach(item => {
        const songNameElement = item.querySelector('.song-name');
        const songTitle = item.dataset.title || (songNameElement ? songNameElement.textContent.trim() : '');
        
        if (getStatusFromCache(songTitle) === status) {
            item.style.display = 'flex';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    console.log('Showing ' + visibleCount + ' songs with status: ' + status);
    
    if (visibleCount === 0) {
        const statusNames = {
            'this_week': 'This Week',
            'gig_ready': 'Gig Ready',
            'needs_polish': 'Needs Polish',
            'on_deck': 'On Deck'
        };
        document.getElementById('songDropdown').innerHTML = 
            '<div style="padding: 40px; text-align: center; color: #6b7280;">' +
            '<div style="font-size: 2em; margin-bottom: 15px;">🎸</div>' +
            '<div style="font-size: 1.2em; font-weight: 600; margin-bottom: 10px; color: #2d3748;">No songs marked as "' + (statusNames[status] || status) + '"</div>' +
            '<div style="margin-bottom: 20px;">Click any song and set its status!</div>' +
            '<button onclick="filterByStatus(\'all\')" style="background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">Show All Songs</button>' +
            '</div>';
    }
}

async function addStatusBadges() {
    if (!statusCacheLoaded) {
        console.log('⏳ Status cache not loaded yet, skipping badges');
        return;
    }
    
    const songItems = document.querySelectorAll('.song-item');
    songItems.forEach(item => {
        const songNameElement = item.querySelector('.song-name');
        
        // Remove existing status badge FIRST (before reading title)
        const existingStatus = item.querySelector('.status-badge');
        if (existingStatus) existingStatus.remove();
        
        const songTitle = item.dataset.title || (songNameElement ? songNameElement.textContent.trim() : '');
        if (!songTitle) return;
        
        const status = getStatusFromCache(songTitle);
        
        if (status) {
            const badges = {
                'this_week': { text: '🎯 THIS WEEK', color: '#ef4444', bg: '#fee2e2' },
                'gig_ready': { text: '✅ READY', color: '#10b981', bg: '#d1fae5' },
                'needs_polish': { text: '⚠️ POLISH', color: '#f59e0b', bg: '#fef3c7' },
                'on_deck': { text: '📚 ON DECK', color: '#3b82f6', bg: '#dbeafe' }
            };
            
            const badge = badges[status];
            if (badge) {
                const badgeEl = document.createElement('span');
                badgeEl.className = 'status-badge';
                badgeEl.textContent = badge.text;
                badgeEl.style.cssText = `
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 0.7em;
                    font-weight: 700;
                    color: ${badge.color};
                    background: ${badge.bg};
                    margin-left: 8px;
                    vertical-align: middle;
                `;
                songNameElement.appendChild(badgeEl);
            }
        }
    });
}

// ============================================================================
// BPM SYSTEM - Song BPM + ABC Player BPM with memory
// ============================================================================

async function updateSongBpm(bpm) {
    if (!selectedSong || !selectedSong.title) return;
    
    const bpmNum = parseInt(bpm);
    if (isNaN(bpmNum) || bpmNum < 40 || bpmNum > 240) {
        console.warn('Invalid BPM:', bpm);
        return;
    }
    
    await saveBandDataToDrive(selectedSong.title, 'song_bpm', { bpm: bpmNum, updatedAt: new Date().toISOString() });
    console.log(`🎵 Song BPM updated: ${bpmNum}`);
}

async function loadSongBpm(songTitle) {
    const data = await loadBandDataFromDrive(songTitle, 'song_bpm');
    return data ? data.bpm : null;
}

async function populateSongMetadata(songTitle) {
    const leadSinger = await loadLeadSinger(songTitle);
    const hasHarmonies = await loadHasHarmonies(songTitle);
    const songStatus = await loadSongStatus(songTitle);
    const songBpm = await loadSongBpm(songTitle);
    
    const leadSelect = document.getElementById('leadSingerSelect');
    if (leadSelect) leadSelect.value = leadSinger;
    
    const harmoniesCheckbox = document.getElementById('hasHarmoniesCheckbox');
    if (harmoniesCheckbox) harmoniesCheckbox.checked = hasHarmonies;
    
    const statusSelect = document.getElementById('songStatusSelect');
    if (statusSelect) statusSelect.value = songStatus || '';
    
    const bpmInput = document.getElementById('songBpmInput');
    if (bpmInput && songBpm) bpmInput.value = songBpm;
}

// ============================================================================
// HARMONY SONG FILTERING
// ============================================================================

// Cache for harmony states - loads on demand
let harmonyCache = {};

// Cache for song statuses - loaded from single master file
let statusCache = {};
let statusCacheLoaded = false;
let statusPreloadRunning = false;

// ============================================================================
// MASTER STATUS FILE - Single Drive file for ALL song statuses (FAST!)
// Instead of 358 individual Drive calls, we load ONE file on startup.
// ============================================================================

const MASTER_STATUS_FILE = '_master_song_statuses.json';
const MASTER_HARMONIES_FILE = '_master_harmonies.json';

async function preloadAllStatuses() {
    if (statusPreloadRunning) return;
    if (statusCacheLoaded) {
        addStatusBadges();
        return;
    }
    
    statusPreloadRunning = true;
    console.log('Loading song statuses from master file...');
    
    try {
        // Load master status file (1 API call instead of 358!)
        const masterData = await loadMasterFile(MASTER_STATUS_FILE);
        
        if (masterData && typeof masterData === 'object' && Object.keys(masterData).length > 0) {
            // Master file exists - use it!
            Object.assign(statusCache, masterData);
            const count = Object.values(masterData).filter(v => v).length;
            console.log(`Loaded ${count} song statuses from master file (1 API call!)`);
            statusCacheLoaded = true;
        } else if (isUserSignedIn && sharedFolderId) {
            // Drive is ready but no master file - migrate
            console.log('No master status file found. Migrating from individual files...');
            await migrateStatusesToMaster();
            statusCacheLoaded = true;
        } else {
            // Drive not ready yet - try localStorage, don't mark as loaded
            const localData = localStorage.getItem('deadcetera__master_song_statuses.json');
            if (localData) {
                try {
                    Object.assign(statusCache, JSON.parse(localData));
                    const count = Object.values(statusCache).filter(v => v).length;
                    console.log(`Loaded ${count} statuses from localStorage (Drive not ready yet)`);
                    statusCacheLoaded = true;
                } catch (e) {}
            }
            // Will retry on next render cycle
        }
    } catch (error) {
        console.error('Error loading master statuses:', error);
        const localData = localStorage.getItem('deadcetera__master_song_statuses.json');
        if (localData) {
            try {
                Object.assign(statusCache, JSON.parse(localData));
                console.log('Loaded statuses from localStorage fallback');
                statusCacheLoaded = true;
            } catch (e) {}
        }
    }
    statusPreloadRunning = false;
    console.log('All song statuses ready! Filtering is now instant.');
    
    addStatusBadges();
}

// Load a master file from Drive (single API call)
async function loadMasterFile(fileName) {
    if (!isUserSignedIn || !sharedFolderId) {
        // Try localStorage
        const key = `deadcetera_${fileName}`;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }
    
    try {
        const metadataFolderId = await findOrCreateFolder('Metadata', sharedFolderId);
        const file = await findFileInFolder(fileName, metadataFolderId);
        
        if (!file) return null;
        
        const response = await gapi.client.drive.files.get({
            fileId: file.id,
            alt: 'media'
        });
        
        return response.result;
    } catch (error) {
        console.log(`Could not load master file: ${fileName}`);
        return null;
    }
}

// Save a master file to Drive (single API call)
async function saveMasterFile(fileName, data) {
    // Always save to localStorage as backup
    const key = `deadcetera_${fileName}`;
    localStorage.setItem(key, JSON.stringify(data));
    
    if (!isUserSignedIn || !sharedFolderId) return false;
    
    try {
        const metadataFolderId = await findOrCreateFolder('Metadata', sharedFolderId);
        const content = JSON.stringify(data, null, 2);
        const existingFile = await findFileInFolder(fileName, metadataFolderId);
        
        if (existingFile) {
            await gapi.client.request({
                path: `/upload/drive/v3/files/${existingFile.id}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                body: content
            });
        } else {
            const fileMetadata = {
                name: fileName,
                parents: [metadataFolderId],
                mimeType: 'application/json'
            };
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";
            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(fileMetadata) +
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                content +
                close_delim;
            
            await gapi.client.request({
                path: '/upload/drive/v3/files',
                method: 'POST',
                params: { uploadType: 'multipart' },
                headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
                body: multipartRequestBody
            });
        }
        
        console.log(`Saved master file: ${fileName}`);
        return true;
    } catch (error) {
        console.error('Error saving master file:', error);
        return false;
    }
}

// One-time migration: read individual status files and combine into master
async function migrateStatusesToMaster() {
    console.log('Starting one-time status migration...');
    const migrated = {};
    let count = 0;
    
    // Load statuses in small batches to avoid throttling
    for (let i = 0; i < allSongs.length; i += 5) {
        const batch = allSongs.slice(i, i + 5);
        
        await Promise.all(batch.map(async (song) => {
            try {
                const data = await loadBandDataFromDrive(song.title, 'song_status');
                if (data && data.status) {
                    migrated[song.title] = data.status;
                    count++;
                }
            } catch (e) {
                // Skip failures
            }
        }));
        
        if (i % 50 === 0 && i > 0) {
            console.log(`Migration progress: ${i}/${allSongs.length}...`);
        }
    }
    
    // Save master file
    if (count > 0) {
        await saveMasterFile(MASTER_STATUS_FILE, migrated);
        console.log(`Migration complete! ${count} statuses saved to master file.`);
    } else {
        console.log('No existing statuses found to migrate.');
        // Save empty master so we don\'t re-migrate
        await saveMasterFile(MASTER_STATUS_FILE, {});
    }
    
    Object.assign(statusCache, migrated);
}

// Get status from cache (instant!)
function getStatusFromCache(songTitle) {
    return statusCache[songTitle] || '';
}

// Don't pre-load - too slow! Just cache as songs are clicked
async function cacheHarmonyState(songTitle) {
    // Use the master harmony badge cache first (instant!)
    if (harmonyBadgeCache[songTitle] !== undefined) {
        return harmonyBadgeCache[songTitle];
    }
    // Fallback to old per-song cache
    if (harmonyCache[songTitle] === undefined) {
        harmonyCache[songTitle] = await loadHasHarmonies(songTitle);
        // Also update master cache
        harmonyBadgeCache[songTitle] = harmonyCache[songTitle];
    }
    return harmonyCache[songTitle];
}

async function filterSongsAsync(type) {
    console.log('Filtering songs:', type);
    
    // Toggle: if clicking the same filter again, reset to 'all'
    if (type === 'harmonies' && activeHarmonyFilter === 'harmonies') {
        type = 'all';
    }
    
    activeHarmonyFilter = type;
    
    // Update button states - reset all harmony buttons
    document.querySelectorAll('.harmony-filters .filter-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'white';
        btn.style.color = '#667eea';
    });
    
    // Highlight clicked button only if filter is active (not toggling off)
    if (type !== 'all' && event && event.target) {
        const btn = event.target.closest('.filter-btn');
        if (btn) {
            btn.classList.add('active');
            btn.style.background = '#667eea';
            btn.style.color = 'white';
        }
    }
    
    if (type === 'all') {
        activeHarmonyFilter = null;
        document.querySelectorAll('.song-item').forEach(item => {
            item.style.display = 'flex';
        });
        return;
    }
    
    applyHarmonyFilter();
}

// Separate function so renderSongs can re-apply after re-rendering
function applyHarmonyFilter() {
    const items = document.querySelectorAll('.song-item');
    let visibleCount = 0;
    
    items.forEach(item => {
        const songNameElement = item.querySelector('.song-name');
        const songTitle = item.dataset.title || (songNameElement ? songNameElement.textContent.trim() : '');
        
        if (harmonyBadgeCache[songTitle] || harmonyCache[songTitle]) {
            item.style.display = 'flex';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    console.log('Harmony filter: ' + visibleCount + ' songs');
    
    if (visibleCount === 0) {
        document.getElementById('songDropdown').innerHTML = 
            '<div style="padding: 40px; text-align: center; color: #6b7280;">' +
            '<div style="font-size: 2em; margin-bottom: 15px;">🎵</div>' +
            '<div style="font-size: 1.2em; font-weight: 600; margin-bottom: 10px; color: #2d3748;">No harmony songs marked yet</div>' +
            '<div style="margin-bottom: 20px;">Click any song and check the "Has Harmonies" box to mark it!</div>' +
            '<button onclick="filterSongsSync(\'all\')" style="background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">Show All Songs</button>' +
            '</div>';
    }
}

function filterSongsSync(type) {
    // Re-render the song list first in case it was replaced with a message
    if (document.querySelectorAll('.song-item').length === 0) {
        renderSongs(currentFilter, document.getElementById('songSearch')?.value || '');
    }
    filterSongsAsync(type);
}

// Old async version - redirect to new version
async function filterSongs(type) {
    filterSongsAsync(type);
}

// Cache for harmony data - loaded from master file
let harmonyBadgeCache = {};
let harmonyBadgeCacheLoaded = false;
let harmonyBadgeLoading = false;

async function addHarmonyBadges() {
    // Don't run multiple times simultaneously
    if (harmonyBadgeLoading) return;
    
    // Load master harmony file if not cached yet
    if (!harmonyBadgeCacheLoaded) {
        harmonyBadgeLoading = true;
        try {
            const masterData = await loadMasterFile(MASTER_HARMONIES_FILE);
            if (masterData && typeof masterData === 'object' && Object.keys(masterData).length > 0) {
                harmonyBadgeCache = masterData;
                harmonyBadgeCacheLoaded = true;
                console.log('Loaded harmonies from master file');
            } else if (isUserSignedIn && sharedFolderId) {
                // Drive is ready but no data found - mark as loaded (no harmonies set yet)
                harmonyBadgeCacheLoaded = true;
                console.log('No harmony data found in master file');
            }
            // If Drive not ready yet, DON'T mark as loaded - will retry on next render
        } catch (e) {
            console.error('Error loading harmony master:', e);
            if (isUserSignedIn && sharedFolderId) {
                harmonyBadgeCacheLoaded = true; // Drive was ready, real error
            }
        }
        harmonyBadgeLoading = false;
    }
    
    // Apply badges from cache (instant, no Drive calls!)
    const songItems = document.querySelectorAll('.song-item');
    songItems.forEach(item => {
        const songNameElement = item.querySelector('.song-name');
        
        // Remove existing badge FIRST (before reading title)
        const existingBadge = item.querySelector('.harmony-badge');
        if (existingBadge) existingBadge.remove();
        
        const songTitle = item.dataset.title || (songNameElement ? songNameElement.textContent.trim() : '');
        if (!songTitle) return;
        
        // Add badge if song has harmonies
        if (harmonyBadgeCache[songTitle]) {
            const badge = document.createElement('span');
            badge.className = 'harmony-badge';
            badge.textContent = '🎤';
            badge.style.cssText = 'margin-left: 8px; font-size: 0.8em; opacity: 0.6;';
            badge.title = 'This song has harmonies';
            // Append inside the song-name span so it sits next to the title
            if (songNameElement) {
                songNameElement.appendChild(badge);
            } else {
                item.appendChild(badge);
            }
        }
    });
}

console.log('✅ All 4 features loaded');
// ============================================================================
// COMPREHENSIVE GOOGLE DRIVE STORAGE - ALL BAND DATA SHARED
// ============================================================================

// Central storage for all band data types
const BAND_DATA_TYPES = {
    PRACTICE_TRACKS: 'practice_tracks',
    REHEARSAL_NOTES: 'rehearsal_notes', 
    SPOTIFY_URLS: 'spotify_urls',
    HARMONY_METADATA: 'harmony_metadata',
    PART_NOTES: 'part_notes',
    LEAD_SINGER: 'lead_singer',
    HAS_HARMONIES: 'has_harmonies'
};

// ============================================================================
// SAVE TO GOOGLE DRIVE (Shared with all band members)
// ============================================================================

async function saveBandDataToDrive(songTitle, dataType, data) {
    // Fallback to localStorage if not signed in
    if (!isUserSignedIn) {
        console.log('⚠️ Not signed in, using localStorage fallback');
        const key = `deadcetera_${dataType}_${songTitle}`;
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    }
    
    // Wait for shared folder to be initialized
    if (!sharedFolderId) {
        console.log('⏳ Waiting for shared folder to be initialized...');
        await initializeSharedFolder();
        
        // If still no folder, fall back to localStorage
        if (!sharedFolderId) {
            console.log('⚠️ Could not initialize folder, using localStorage');
            const key = `deadcetera_${dataType}_${songTitle}`;
            localStorage.setItem(key, JSON.stringify(data));
            return false;
        }
    }
    
    try {
        const fileName = `${songTitle}_${dataType}.json`;
        const content = JSON.stringify(data, null, 2);
        
        // Get or create metadata folder
        const metadataFolderId = await findOrCreateFolder('Metadata', sharedFolderId);
        
        // Check if file exists
        const existingFile = await findFileInFolder(fileName, metadataFolderId);
        
        if (existingFile) {
            // Update existing file
            await gapi.client.request({
                path: `/upload/drive/v3/files/${existingFile.id}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                body: content
            });
            console.log(`✅ Updated ${dataType} for ${songTitle} in Drive`);
        } else {
            // Create new file
            const fileMetadata = {
                name: fileName,
                parents: [metadataFolderId],
                mimeType: 'application/json'
            };
            
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";
            
            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(fileMetadata) +
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                content +
                close_delim;
            
            await gapi.client.request({
                path: '/upload/drive/v3/files',
                method: 'POST',
                params: { uploadType: 'multipart' },
                headers: {
                    'Content-Type': 'multipart/related; boundary=' + boundary
                },
                body: multipartRequestBody
            });
            
            console.log(`✅ Created ${dataType} for ${songTitle} in Drive`);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Failed to save to Drive:', error);
        // Fallback to localStorage
        const key = `deadcetera_${dataType}_${songTitle}`;
        localStorage.setItem(key, JSON.stringify(data));
        return false;
    }
}

// ============================================================================
// LOAD FROM GOOGLE DRIVE (Shared with all band members)
// ============================================================================

async function loadBandDataFromDrive(songTitle, dataType) {
    // Try Drive first
    if (isUserSignedIn) {
        // Wait for shared folder to be initialized
        if (!sharedFolderId) {
            console.log('⏳ Waiting for shared folder to be initialized...');
            await initializeSharedFolder();
        }
        
        // If still no folder, fall back to localStorage
        if (!sharedFolderId) {
            console.log('⚠️ Could not initialize folder, using localStorage');
            return loadFromLocalStorageFallback(songTitle, dataType);
        }
        
        try {
            const metadataFolderId = await findOrCreateFolder('Metadata', sharedFolderId);
            const fileName = `${songTitle}_${dataType}.json`;
            
            const file = await findFileInFolder(fileName, metadataFolderId);
            if (!file) {
                console.log(`No Drive data for ${dataType}`);
                return loadFromLocalStorageFallback(songTitle, dataType);
            }
            
            const response = await gapi.client.drive.files.get({
                fileId: file.id,
                alt: 'media'
            });
            
            console.log(`✅ Loaded ${dataType} from Drive`);
            return response.result;
        } catch (error) {
            console.log(`⚠️ No Drive data for ${dataType}, using localStorage`);
            return loadFromLocalStorageFallback(songTitle, dataType);
        }
    }
    
    // Fallback to localStorage
    return loadFromLocalStorageFallback(songTitle, dataType);
}

function loadFromLocalStorageFallback(songTitle, dataType) {
    const key = `deadcetera_${dataType}_${songTitle}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

// ============================================================================
// SPECIFIC DATA TYPE WRAPPERS
// ============================================================================

// Practice Tracks
async function savePracticeTracksToDrive(songTitle, tracks) {
    return await saveBandDataToDrive(songTitle, BAND_DATA_TYPES.PRACTICE_TRACKS, tracks);
}

async function loadPracticeTracksFromDrive(songTitle) {
    return await loadBandDataFromDrive(songTitle, BAND_DATA_TYPES.PRACTICE_TRACKS) || [];
}

// Rehearsal Notes
async function saveRehearsalNotesToDrive(songTitle, notes) {
    return await saveBandDataToDrive(songTitle, BAND_DATA_TYPES.REHEARSAL_NOTES, notes);
}

async function loadRehearsalNotesFromDrive(songTitle) {
    return await loadBandDataFromDrive(songTitle, BAND_DATA_TYPES.REHEARSAL_NOTES) || [];
}

// Spotify URLs
async function saveSpotifyUrlsToDrive(songTitle, urls) {
    return await saveBandDataToDrive(songTitle, BAND_DATA_TYPES.SPOTIFY_URLS, urls);
}

async function loadSpotifyUrlsFromDrive(songTitle) {
    return await loadBandDataFromDrive(songTitle, BAND_DATA_TYPES.SPOTIFY_URLS) || {};
}

// Part Notes
async function savePartNotesToDrive(songTitle, sectionIndex, singer, notes) {
    const key = `${songTitle}_section${sectionIndex}_${singer}`;
    return await saveBandDataToDrive(key, BAND_DATA_TYPES.PART_NOTES, notes);
}

async function loadPartNotesFromDrive(songTitle, sectionIndex, singer) {
    const key = `${songTitle}_section${sectionIndex}_${singer}`;
    return await loadBandDataFromDrive(key, BAND_DATA_TYPES.PART_NOTES) || [];
}

// Harmony Metadata (starting notes, lead markers, sorting)
async function saveHarmonyMetadataToDrive(songTitle, sectionIndex, metadata) {
    const key = `${songTitle}_section${sectionIndex}`;
    return await saveBandDataToDrive(key, BAND_DATA_TYPES.HARMONY_METADATA, metadata);
}

async function loadHarmonyMetadataFromDrive(songTitle, sectionIndex) {
    const key = `${songTitle}_section${sectionIndex}`;
    return await loadBandDataFromDrive(key, BAND_DATA_TYPES.HARMONY_METADATA) || {};
}

console.log('☁️ Comprehensive Google Drive storage system loaded');

// ============================================================================
// GOOGLE DRIVE HELPER FUNCTIONS
// ============================================================================

async function findOrCreateFolder(folderName, parentFolderId) {
    try {
        // Escape single quotes and backslashes for Drive API
        const escapedFolderName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escapedParentId = parentFolderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        
        // Search for existing folder
        const response = await gapi.client.drive.files.list({
            q: `name='${escapedFolderName}' and '${escapedParentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id;
        }
        
        // Create folder if it doesn't exist
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId]
        };
        
        const folder = await gapi.client.drive.files.create({
            resource: fileMetadata,
            fields: 'id'
        });
        
        return folder.result.id;
    } catch (error) {
        console.error('Error finding/creating folder:', error);
        throw error;
    }
}

async function findFileInFolder(fileName, folderId) {
    try {
        // Escape single quotes and backslashes for Drive API
        const escapedFileName = fileName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escapedFolderId = folderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        
        const response = await gapi.client.drive.files.list({
            q: `name='${escapedFileName}' and '${escapedFolderId}' in parents and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0];
        }
        
        return null;
    } catch (error) {
        console.log(`⚠️ Could not find file: ${fileName}`);
        return null;
    }
}

console.log('✅ Google Drive helper functions loaded');

// ============================================================================
// SONG STRUCTURE - Who starts, how it starts, who cues ending, how it ends
// ============================================================================

async function renderSongStructure(songTitle) {
    const container = document.getElementById('songStructureContainer');
    
    // Load from Google Drive
    const structure = await loadBandDataFromDrive(songTitle, 'song_structure') || {};
    
    if (!structure.whoStarts && !structure.howStarts && !structure.whoCuesEnding && !structure.howEnds) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 20px;">
                <p>No song structure info yet</p>
                <button onclick="editSongStructure()" class="secondary-btn" style="margin-top: 10px;">+ Add Structure</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border: 2px solid #e5e7eb; position: relative;">
            <button onclick="editSongStructure()" style="position: absolute; top: 10px; right: 10px; background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Edit</button>
            
            ${structure.whoStarts && structure.whoStarts.length > 0 ? `
                <div style="margin-bottom: 15px;">
                    <strong style="color: #1f2937; display: block; margin-bottom: 8px;">🎤 Who Starts the Song:</strong>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        ${structure.whoStarts.map(member => 
                            `<span style="background: #667eea; color: white; padding: 6px 12px; border-radius: 6px; font-size: 0.9em;">
                                ${bandMembers[member]?.name || member}
                            </span>`
                        ).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${structure.howStarts ? `
                <div style="margin-bottom: 15px;">
                    <strong style="color: #1f2937; display: block; margin-bottom: 8px;">🎵 How It Starts:</strong>
                    <div style="background: white; padding: 12px; border-radius: 6px; color: #4b5563;">
                        ${structure.howStarts}
                    </div>
                </div>
            ` : ''}
            
            ${structure.whoCuesEnding ? `
                <div style="margin-bottom: 15px;">
                    <strong style="color: #1f2937; display: block; margin-bottom: 8px;">🎤 Who Cues the Ending:</strong>
                    <div style="background: #fef3c7; color: #92400e; padding: 6px 12px; border-radius: 6px; display: inline-block; font-weight: 600;">
                        ${bandMembers[structure.whoCuesEnding]?.name || structure.whoCuesEnding}
                    </div>
                </div>
            ` : ''}
            
            ${structure.howEnds ? `
                <div>
                    <strong style="color: #1f2937; display: block; margin-bottom: 8px;">🎵 How It Ends:</strong>
                    <div style="background: white; padding: 12px; border-radius: 6px; color: #4b5563;">
                        ${structure.howEnds}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

async function editSongStructure() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    
    const structure = await loadBandDataFromDrive(songTitle, 'song_structure') || {};
    
    const whoStarts = prompt('Who starts the song? (comma-separated names, e.g., Jay, Drew):', 
        structure.whoStarts ? structure.whoStarts.map(email => bandMembers[email]?.name).join(', ') : '');
    if (whoStarts === null) return; // Canceled
    
    const howStarts = prompt('How does it start? (e.g., Count off, Cold start, Guitar intro):', structure.howStarts || '');
    if (howStarts === null) return;
    
    const whoCuesEnding = prompt('Who cues the ending? (name):', 
        structure.whoCuesEnding ? bandMembers[structure.whoCuesEnding]?.name : '');
    if (whoCuesEnding === null) return;
    
    const howEnds = prompt('How does it end? (e.g., Big finish, Fade out, Abrupt stop):', structure.howEnds || '');
    if (howEnds === null) return;
    
    // Convert names back to emails
    const whoStartsEmails = whoStarts.split(',').map(name => {
        const trimmed = name.trim();
        const entry = Object.entries(bandMembers).find(([email, member]) => 
            member.name.toLowerCase() === trimmed.toLowerCase()
        );
        return entry ? entry[0] : null;
    }).filter(Boolean);
    
    const whoCuesEndingEmail = Object.entries(bandMembers).find(([email, member]) => 
        member.name.toLowerCase() === whoCuesEnding.trim().toLowerCase()
    )?.[0];
    
    const newStructure = {
        whoStarts: whoStartsEmails,
        howStarts: howStarts.trim(),
        whoCuesEnding: whoCuesEndingEmail || '',
        howEnds: howEnds.trim()
    };
    
    await saveBandDataToDrive(songTitle, 'song_structure', newStructure);
    await renderSongStructure(songTitle);
}

function showSongStructureForm() {
    if (!selectedSong || !selectedSong.title) return;
    
    const formContainer = document.getElementById('songStructureFormContainer');
    const button = document.getElementById('editSongStructureBtn');
    
    // Load existing data
    loadBandDataFromDrive(selectedSong.title, 'song_structure').then(structure => {
        structure = structure || {};
        
        formContainer.innerHTML = `
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border: 2px solid #667eea;">
                <h4 style="margin-top: 0; color: #667eea;">Edit Song Structure</h4>
                
                <div style="margin-bottom: 15px;">
                    <strong style="display: block; margin-bottom: 8px; color: #1f2937;">🎤 Who Starts the Song? (check all)</strong>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${Object.keys(bandMembers).map(key => `
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" value="${key}" 
                                    ${structure.whoStarts && structure.whoStarts.includes(key) ? 'checked' : ''}
                                    class="who-starts-checkbox"
                                    style="width: 16px; height: 16px; cursor: pointer;">
                                <span>${bandMembers[key].name}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #1f2937; font-weight: 600;">
                        🎵 How Is It Started?
                    </label>
                    <textarea id="howStartsInput" 
                        style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-family: inherit; resize: vertical;"
                        rows="2"
                        placeholder="E.g., Count off by Drew, Cold start, Guitar intro...">${structure.howStarts || ''}</textarea>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <strong style="display: block; margin-bottom: 8px; color: #1f2937;">🎤 Who Cues the Ending? (select one)</strong>
                    <select id="whoCuesEndingSelect" 
                        style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;">
                        <option value="">- Select -</option>
                        ${Object.keys(bandMembers).map(key => `
                            <option value="${key}" ${structure.whoCuesEnding === key ? 'selected' : ''}>
                                ${bandMembers[key].name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #1f2937; font-weight: 600;">
                        🎵 How Does the Song End?
                    </label>
                    <textarea id="howEndsInput" 
                        style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-family: inherit; resize: vertical;"
                        rows="2"
                        placeholder="E.g., Big finish on 1, Fade out, Abrupt stop...">${structure.howEnds || ''}</textarea>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="saveSongStructure()" 
                        style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        💾 Save
                    </button>
                    <button onclick="hideSongStructureForm()" 
                        style="background: #6b7280; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        formContainer.style.display = 'block';
        button.style.display = 'none';
    });
}

function hideSongStructureForm() {
    document.getElementById('songStructureFormContainer').style.display = 'none';
    document.getElementById('editSongStructureBtn').style.display = 'block';
}

async function saveSongStructure() {
    if (!selectedSong || !selectedSong.title) return;
    
    // Get all checked "who starts"
    const whoStarts = Array.from(document.querySelectorAll('.who-starts-checkbox:checked'))
        .map(cb => cb.value);
    
    const structure = {
        whoStarts: whoStarts,
        howStarts: document.getElementById('howStartsInput').value.trim(),
        whoCuesEnding: document.getElementById('whoCuesEndingSelect').value,
        howEnds: document.getElementById('howEndsInput').value.trim()
    };
    
    // Save to Google Drive
    await saveBandDataToDrive(selectedSong.title, 'song_structure', structure);
    
    alert('✅ Song structure saved to Google Drive!');
    
    // Hide form and refresh display
    hideSongStructureForm();
    renderSongStructure(selectedSong.title);
}

console.log('📋 Song Structure functions loaded');

// Initialize the shared band resources folder
// ============================================================================
// SHARED FOLDER CONFIGURATION
// ============================================================================

// IMPORTANT: Set this to the folder ID after the owner creates it
// Leave as null for the first person (owner) to create the folder
// After creation, copy the folder ID here so everyone uses the SAME folder
const SHARED_FOLDER_ID = null; // Owner will update this after creating folder

// Band member emails who should have access (owner should update this list)
const BAND_MEMBER_EMAILS = [
    'drew.merrill@gmail.com',     // Drew
    'pierce@example.com',          // Pierce - UPDATE THIS
    'brian@example.com',           // Brian - UPDATE THIS
    'chris@example.com'            // Chris - UPDATE THIS
];

async function initializeSharedFolder() {
    try {
        console.log('📁 Initializing shared band folder...');
        
        // If we have a hardcoded folder ID, use it
        if (SHARED_FOLDER_ID) {
            sharedFolderId = SHARED_FOLDER_ID;
            console.log('📁 Using configured shared folder:', sharedFolderId);
            return;
        }
        
        // Otherwise, search for existing folder
        const response = await gapi.client.drive.files.list({
            q: "name='Deadcetera Band Resources' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields: 'files(id, name, owners)',
            spaces: 'drive'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            sharedFolderId = response.result.files[0].id;
            console.log('📁 Found existing folder:', sharedFolderId);
            console.log('📋 OWNER: Copy this folder ID to SHARED_FOLDER_ID in app.js');
            console.log('📁 Folder ID:', sharedFolderId);
        } else {
            // Create folder as OWNER
            console.log('📁 Creating NEW shared folder (you are the OWNER)...');
            
            const fileMetadata = {
                name: 'Deadcetera Band Resources',
                mimeType: 'application/vnd.google-apps.folder'
            };
            
            const folder = await gapi.client.drive.files.create({
                resource: fileMetadata,
                fields: 'id'
            });
            
            sharedFolderId = folder.result.id;
            console.log('📁 Created new folder:', sharedFolderId);
            console.log('');
            console.log('═══════════════════════════════════════════════════════');
            console.log('👑 YOU ARE THE FOLDER OWNER!');
            console.log('═══════════════════════════════════════════════════════');
            console.log('');
            console.log('📋 COPY THIS FOLDER ID:');
            console.log(sharedFolderId);
            console.log('');
            console.log('📋 NEXT STEPS:');
            console.log('1. Copy the folder ID above');
            console.log('2. Update SHARED_FOLDER_ID in app.js');
            console.log('3. Update band member emails in BAND_MEMBER_EMAILS');
            console.log('4. Re-upload app.js');
            console.log('5. Click "Share Folder with Band" button below');
            console.log('');
            console.log('═══════════════════════════════════════════════════════');
            
            // Show UI to share folder
            showFolderSharingInstructions(sharedFolderId);
        }
    } catch (error) {
        console.error('❌ Failed to initialize shared folder:', error);
    }
}

async function shareFolderWithBand() {
    if (!sharedFolderId) {
        alert('No folder to share yet! Please connect to Google Drive first.');
        return;
    }
    
    console.log('📤 Sharing folder with band members...');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const email of BAND_MEMBER_EMAILS) {
        try {
            // Skip placeholder emails
            if (email.includes('example.com')) {
                console.log(`⚠️ Skipping placeholder: ${email}`);
                continue;
            }
            
            // Create permission for this band member
            const permission = {
                type: 'user',
                role: 'writer', // Can edit files
                emailAddress: email
            };
            
            await gapi.client.drive.permissions.create({
                fileId: sharedFolderId,
                resource: permission,
                sendNotificationEmail: true,
                emailMessage: '🎸 You now have access to the Deadcetera Band Resources folder! Open the app and connect your Google Drive to start collaborating.'
            });
            
            console.log(`✅ Shared with: ${email}`);
            successCount++;
        } catch (error) {
            console.error(`? Failed to share with ${email}:`, error);
            failCount++;
        }
    }
    
    const message = `
Folder shared!

✅ Success: ${successCount} members
${failCount > 0 ? `❌ Failed: ${failCount} members (check console)` : ''}

Band members will receive an email invitation.
    `.trim();
    
    alert(message);
}

function showFolderSharingInstructions(folderId) {
    // Add a temporary banner at the top of the page
    const banner = document.createElement('div');
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #667eea;
        color: white;
        padding: 20px;
        text-align: center;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    
    banner.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto;">
            <h2 style="margin: 0 0 10px 0;">📁 You Created the Shared Folder!</h2>
            <p style="margin: 0 0 15px 0;">Folder ID: <code style="background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 4px;">${folderId}</code></p>
            <p style="margin: 0 0 15px 0; font-size: 0.9em;">Copy this ID and update <code>SHARED_FOLDER_ID</code> in app.js, then update band member emails and re-upload.</p>
            <button onclick="shareFolderWithBand()" style="background: white; color: #667eea; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-right: 10px;">
                📤 Share Folder with Band
            </button>
            <button onclick="this.parentElement.parentElement.remove()" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer;">
                Close
            </button>
        </div>
    `;
    
    document.body.insertBefore(banner, document.body.firstChild);
}

console.log('📁 Shared folder initialization loaded');
