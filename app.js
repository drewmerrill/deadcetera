// ============================================================================
// DEADCETERA WORKFLOW APP v2.4.4 FINAL
// Complete feature set with Learning Resources, YouTube/Spotify, Top 5 Database
// Last updated: 2026-02-14
// ============================================================================

let selectedSong = null;
let selectedVersion = null;
let currentFilter = 'all';
let currentInstrument = 'bass'; // Default instrument
let currentResourceType = null; // For modal state
let currentResourceIndex = null; // For editing resources

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
    
    // Load saved instrument preference
    const savedInstrument = localStorage.getItem('deadcetera_instrument');
    if (savedInstrument) {
        currentInstrument = savedInstrument;
        document.getElementById('instrumentSelect').value = savedInstrument;
    }
});

// ============================================================================
// INSTRUMENT SELECTOR
// ============================================================================

function setupInstrumentSelector() {
    const selector = document.getElementById('instrumentSelect');
    
    selector.addEventListener('change', (e) => {
        currentInstrument = e.target.value;
        localStorage.setItem('deadcetera_instrument', currentInstrument);
        
        // If a song is selected, refresh the resources display
        if (selectedSong) {
            renderLearningResources(selectedSong, currentInstrument);
        }
        
        console.log('✅ Instrument changed to:', currentInstrument);
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
        <div class="song-item" onclick="selectSong('${song.title.replace(/'/g, "\\'")}')">
            <span class="song-name">${song.title}</span>
            <span class="song-badge ${song.band.toLowerCase()}">${song.band}</span>
        </div>
    `).join('');
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
    selectedSong = songTitle;
    
    // Get band info from allSongs
    const songData = allSongs.find(s => s.title === songTitle);
    const bandAbbr = songData ? songData.band : 'GD';
    const bandName = getFullBandName(bandAbbr);
    
    // Highlight selected song
    document.querySelectorAll('.song-item').forEach(item => {
        item.classList.remove('selected');
    });
    event.target.closest('.song-item').classList.add('selected');
    
    // Show Step 2: Learning Resources
    showLearningResources(songTitle, bandName);
    
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
    console.log('📚 Rendering resources for:', songTitle, 'Instrument:', instrument);
    
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
                🔍 Find on Ultimate Guitar →
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
                        ${platform === 'YouTube' ? '🎥' : '🎵'} ${title}
                    </a>
                    <div style="font-size: 0.85em; color: #718096; margin-top: 4px;">${platform} • Click to open</div>
                </div>
                <div class="resource-actions">
                    <button class="resource-btn remove-btn" onclick="removeLesson(${index})">✕</button>
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
                        🎵 Search Spotify
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
                    🔍 YouTube Lessons
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
                        ${platform === 'YouTube' ? '🎥' : '🎵'} ${title}
                    </a>
                    <div style="font-size: 0.85em; color: #718096; margin-top: 4px;">${platform} • Click to open</div>
                </div>
                <div class="resource-actions">
                    <button class="resource-btn remove-btn" onclick="removeReference(${index})">✕</button>
                </div>
            </div>
        `).join('');
        
        // Add button if less than 2 references
        if (resources.references.length < 2) {
            container.innerHTML += `
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button class="add-resource-btn" onclick="searchYouTubeForReference()" style="flex: 1;">
                        🔍 YouTube Performances
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
                    🔍 YouTube Performances
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
            return '🎸 ' + path.split('/').filter(p => p).pop().replace(/-/g, ' ');
        }
        
        // For YouTube
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            // Try to get video title from URL params or just show "YouTube Video"
            const videoId = urlObj.searchParams.get('v') || path.split('/').pop();
            return '🎥 YouTube: ' + videoId;
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
    
    console.log('✅ Lesson removed');
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
    
    console.log('✅ Reference removed');
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
        modalTitle.textContent = '🎵 Search Spotify';
    }
    
    // Show Spotify instructions
    resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <p style="margin-bottom: 20px; color: #4a5568; font-size: 1.1em;">
                Search Spotify for: <strong>"${selectedSong}"</strong>
            </p>
            <button class="primary-btn" onclick="window.open('${searchUrl}', '_blank')" style="margin-bottom: 20px; background: #1db954;">
                🎵 Search on Spotify
            </button>
            <div style="margin-top: 30px; padding: 20px; background: #f7fafc; border-radius: 8px; text-align: left;">
                <strong style="color: #2d3748; display: block; margin-bottom: 10px;">How to use:</strong>
                <ol style="color: #4a5568; line-height: 1.8; margin-left: 20px;">
                    <li>Click "Search on Spotify" above</li>
                    <li>Find the track you want</li>
                    <li>Click the three dots (•••) on the track</li>
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
                        <strong style="color: #667eea;">📂 Track ${version.trackNumber}</strong> • 
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
            <strong style="color: #92400e;">📂 YOU NEED: Track ${version.trackNumber}</strong>
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
            alert(`🎯 DOWNLOADING FULL SHOW:

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
    console.log('🚀 Starting Smart Download for:', songTitle, version);
    
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
