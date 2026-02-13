// ============================================================================
// DEADCETERA WORKFLOW APP v2.4
// Last updated: 2026-02-13 - Added Learning Resources feature
// ============================================================================

let selectedSong = null;
let selectedVersion = null;
let currentFilter = 'all';
let currentInstrument = 'bass'; // Default instrument
let currentResourceType = null; // For modal state
let currentResourceIndex = null; // For editing resources

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
    const bandName = songData ? songData.band : 'Grateful Dead';
    
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
    const bandName = songData ? songData.band : 'Grateful Dead';
    
    if (resources.tab) {
        // Show saved tab/chart
        container.innerHTML = `
            <div class="resource-item">
                <a href="${resources.tab}" target="_blank" class="resource-link" title="${resources.tab}">
                    ${getResourceDisplayName(resources.tab)}
                </a>
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

function renderLessonsSection(songTitle, instrument, resources) {
    const container = document.getElementById('lessonsResourceContent');
    
    if (resources.lessons.length > 0) {
        container.innerHTML = resources.lessons.map((url, index) => `
            <div class="resource-item">
                <a href="${url}" target="_blank" class="resource-link" title="${url}">
                    ${getResourceDisplayName(url)}
                </a>
                <div class="resource-actions">
                    <button class="resource-btn remove-btn" onclick="removeLesson(${index})">✕</button>
                </div>
            </div>
        `).join('');
        
        // Add button if less than 2 lessons
        if (resources.lessons.length < 2) {
            container.innerHTML += `
                <button class="add-resource-btn" onclick="addLesson()">
                    + Add Lesson Video
                </button>
            `;
        }
    } else {
        container.innerHTML = `
            <button class="add-resource-btn" onclick="addLesson()">
                + Add Lesson Video
            </button>
        `;
    }
}

function renderReferencesSection(songTitle, instrument, resources) {
    const container = document.getElementById('referencesResourceContent');
    
    if (resources.references.length > 0) {
        container.innerHTML = resources.references.map((url, index) => `
            <div class="resource-item">
                <a href="${url}" target="_blank" class="resource-link" title="${url}">
                    ${getResourceDisplayName(url)}
                </a>
                <div class="resource-actions">
                    <button class="resource-btn remove-btn" onclick="removeReference(${index})">✕</button>
                </div>
            </div>
        `).join('');
        
        // Add button if less than 2 references
        if (resources.references.length < 2) {
            container.innerHTML += `
                <button class="add-resource-btn" onclick="addReference()">
                    + Add Reference Recording
                </button>
            `;
        }
    } else {
        container.innerHTML = `
            <button class="add-resource-btn" onclick="addReference()">
                + Add Reference Recording
            </button>
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

// ============================================================================
// TAB FUNCTIONS
// ============================================================================

function findTab() {
    if (!selectedSong) return;
    
    const songData = allSongs.find(s => s.title === selectedSong);
    const bandName = songData ? songData.band : 'Grateful Dead';
    
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
    
    // Clear input
    input.value = '';
    
    // Show modal
    modal.classList.remove('hidden');
    input.focus();
}

function closeAddResourceModal() {
    const modal = document.getElementById('addResourceModal');
    modal.classList.add('hidden');
    currentResourceType = null;
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
        const bandName = songData ? songData.band : 'Grateful Dead';
        
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
