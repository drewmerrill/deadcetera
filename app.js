// =============================================================================
// DEADCETERA - Grateful Dead Practice Tool
// =============================================================================

let selectedSong = null;
let selectedVersion = null;
let currentFilter = 'all';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    renderSongs();
    setupSearchAndFilters();
});

// Render songs in dropdown
function renderSongs(filter = 'all', searchTerm = '') {
    const dropdown = document.getElementById('songDropdown');
    
    let filtered = allSongs.filter(song => {
        const matchesFilter = filter === 'all' || song.band === filter;
        const matchesSearch = song.title.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding: 20px; text-align: center; color: #718096;">No songs found</div>';
        return;
    }

    dropdown.innerHTML = filtered.map(song => `
        <div class="song-item" onclick="selectSong('${song.title}')">
            <span class="song-name">${song.title}</span>
            <span class="song-badge ${song.band.toLowerCase()}">${song.band}</span>
        </div>
    `).join('');
}

// Setup search and filter handlers
function setupSearchAndFilters() {
    const searchInput = document.getElementById('searchInput');
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    searchInput.addEventListener('input', (e) => {
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

// Select a song
function selectSong(songTitle) {
    selectedSong = songTitle;
    
    // Hide step 1
    document.getElementById('step1').style.display = 'none';
    
    // Show step 2
    const step2 = document.getElementById('step2');
    step2.style.display = 'block';
    
    // Check if we have curated versions
    if (top5Database[songTitle]) {
        showCuratedVersions(songTitle);
    } else {
        // No curated versions - show Archive.org search
        showArchiveSearch(songTitle);
    }
    
    // Scroll to step 2
    setTimeout(() => {
        step2.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// Show curated top 5 versions
function showCuratedVersions(songTitle) {
    const container = document.getElementById('versionsContainer');
    const versions = top5Database[songTitle];
    
    container.innerHTML = `
        <div style="margin-bottom: 25px;">
            <p style="color: #4a5568; margin-bottom: 15px;">
                🎸 <strong>Top 5 Live Versions</strong> - Based on community rankings and sound quality
            </p>
        </div>
        ${versions.map((version, index) => {
            const qualityBadge = version.quality === 'SBD' ? 
                '<span class="version-quality">SBD Quality</span>' : 
                '<span class="version-quality" style="background: #fbbf24;">AUD Quality</span>';
            
            return `
                <div class="version-card" onclick="selectVersion('${songTitle}', ${version.rank})">
                    <span class="version-rank rank-${version.rank}">#${version.rank}</span>
                    <div class="version-info">
                        <div class="version-venue">${version.venue}</div>
                        <div class="version-date">${version.date}</div>
                        <div class="version-notes">
                            ${version.notes}
                            ${qualityBadge}
                        </div>
                    </div>
                </div>
            `;
        }).join('')}
        <div style="text-align: center; margin-top: 30px;">
            <button class="secondary-btn" onclick="showArchiveSearch('${songTitle}')">
                🔍 Search Archive.org for More Versions
            </button>
        </div>
    `;
}

// Show Archive.org search interface
async function showArchiveSearch(songTitle) {
    const container = document.getElementById('versionsContainer');
    
    // Show loading state
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="spinner"></div>
            <p style="margin-top: 20px; color: #4a5568;">Searching Archive.org for "${songTitle}"...</p>
        </div>
    `;
    
    try {
        // Get band name for the selected song
        const song = allSongs.find(s => s.title === songTitle);
        const bandName = song ? song.band : 'GD';
        
        console.log(`Searching Archive.org for: ${songTitle} by ${bandName}`);
        
        // Search Archive.org for this song
        const shows = await searchArchiveForSong(songTitle, bandName);
        
        if (!shows || shows.length === 0) {
            showNoResultsFound(songTitle, bandName);
            return;
        }
        
        // Display results
        displayArchiveResults(shows, songTitle);
        
    } catch (error) {
        console.error('Archive search error:', error);
        showSearchError(songTitle);
    }
}

// Search Archive.org for a song
async function searchArchiveForSong(songTitle, bandName = 'GD') {
    try {
        // Map band abbreviations to full names for Archive.org
        const bandNameMapping = {
            'GD': 'Grateful Dead',
            'WSP': 'Widespread Panic',
            'JGB': 'Jerry Garcia Band',
            'Phish': 'Phish'
        };
        
        const fullBandName = bandNameMapping[bandName] || bandName;
        
        console.log(`Searching Archive.org for: ${songTitle} by ${fullBandName}`);
        
        // Search Archive.org for shows containing this song
        // Using Archive.org's advanced search API
        const searchUrl = `https://archive.org/advancedsearch.php?` +
            `q=creator:"${encodeURIComponent(fullBandName)}" AND "${encodeURIComponent(songTitle)}"&` +
            `fl[]=identifier,title,date,downloads,avg_rating,format&` +
            `sort[]=downloads+desc&` +
            `rows=10&` +
            `output=json`;
        
        console.log('Archive search URL:', searchUrl);
        
        const response = await fetch(searchUrl);
        
        if (!response.ok) {
            throw new Error(`Archive.org search failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Archive.org response:', data);
        
        if (!data.response || !data.response.docs) {
            return [];
        }
        
        // Filter for shows that have audio files (SBD recordings preferred)
        const shows = data.response.docs.filter(show => {
            const formats = show.format || [];
            return formats.includes('VBR MP3') || formats.includes('Flac') || formats.includes('Ogg Vorbis');
        });
        
        console.log(`Found ${shows.length} shows with audio files`);
        
        return shows;
        
    } catch (error) {
        console.error('Archive.org search error:', error);
        throw error;
    }
}

// Display Archive.org search results
function displayArchiveResults(shows, songTitle) {
    const container = document.getElementById('versionsContainer');
    
    container.innerHTML = `
        <div style="margin-bottom: 25px;">
            <p style="color: #4a5568; margin-bottom: 10px;">
                ✨ <strong>Live search results</strong> from Archive.org for "${songTitle}"
                <br><span style="color: #718096; font-size: 0.9em;">Sorted by popularity (downloads + ratings)</span>
            </p>
        </div>
        ${shows.map((show, index) => {
            const archiveId = show.identifier;
            const venue = show.title || 'Unknown Venue';
            const date = show.date ? formatDate(show.date) : 'Unknown Date';
            const downloads = show.downloads ? show.downloads.toLocaleString() : 'N/A';
            const rating = show.avg_rating ? `⭐ ${show.avg_rating.toFixed(1)}` : '';
            
            return `
                <div class="version-card" onclick="selectArchiveVersion('${archiveId}', '${songTitle}')">
                    <span class="version-rank rank-${index + 1}">#${index + 1}</span>
                    <div class="version-info">
                        <div class="version-venue">${venue}</div>
                        <div class="version-date">${date}</div>
                        <div class="version-notes">
                            ${downloads} downloads ${rating}
                            <span class="version-quality">SBD Quality</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('')}
        <div style="text-align: center; margin-top: 20px; padding: 15px; background: #fff8dc; border-radius: 8px;">
            <p style="color: #744210; margin: 0; font-size: 0.9em;">
                💡 <strong>Tip:</strong> These are auto-discovered versions sorted by popularity. 
                For curated "best versions," we recommend checking 
                <a href="https://headyversion.com" target="_blank" style="color: #9333ea;">HeadyVersion.com</a>
            </p>
        </div>
    `;
}

function selectArchiveVersion(archiveId, songTitle) {
    console.log('Selected Archive version:', archiveId, songTitle);
    
    // Create a version object similar to curated versions
    const version = {
        archiveId: archiveId,
        trackNumber: '01', // Placeholder - will use sequential counting instead
        venue: 'Archive.org Search Result',
        date: archiveId,
        notes: 'Auto-discovered from Archive.org search',
        quality: 'SBD',
        isArchiveSearchResult: true // Flag to skip individual track search
    };
    
    selectedVersion = version;
    
    // Highlight selected version
    document.querySelectorAll('.version-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.target.closest('.version-card').classList.add('selected');
    
    // Show download step (same function used for curated versions)
    showDownloadStep(songTitle, version);
    
    // Scroll to step 3
    setTimeout(() => {
        document.getElementById('step3').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// Format date from Archive.org
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    } catch (e) {
        return dateString;
    }
}

// Show no results message
function showNoResultsFound(songTitle, bandName = 'Grateful Dead') {
    const container = document.getElementById('versionsContainer');
    container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: #fff5f5; border-radius: 12px; border: 2px dashed #fc8181;">
            <p style="font-size: 1.2em; color: #c53030; margin-bottom: 15px;">
                😕 No soundboard recordings found
            </p>
            <p style="color: #744210; margin-bottom: 20px;">
                Archive.org doesn't have any downloadable soundboard versions of "${songTitle}" by ${bandName} in their database.
            </p>
            <button class="primary-btn" onclick="window.open('https://archive.org/search.php?query=creator%3A%22${encodeURIComponent(bandName)}%22+AND+%22${encodeURIComponent(songTitle)}%22', '_blank')">
                🔍 Search All Versions on Archive.org
            </button>
        </div>
    `;
}

// Show search error
function showSearchError(songTitle, bandName = 'Grateful Dead') {
    const container = document.getElementById('versionsContainer');
    container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: #fff5f5; border-radius: 12px;">
            <p style="font-size: 1.2em; color: #c53030; margin-bottom: 15px;">
                ⚠️ Search Error
            </p>
            <p style="color: #744210; margin-bottom: 20px;">
                Couldn't connect to Archive.org. Please try again or search manually.
            </p>
            <button class="primary-btn" onclick="searchArchiveForSong('${songTitle}', '${bandName}')">
                🔄 Try Again
            </button>
        </div>
    `;
}

// Select a version from top 5
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
    
    // Scroll to step 3
    setTimeout(() => {
        document.getElementById('step3').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// Show download and Moises step
function showDownloadStep(songTitle, version) {
    const step3 = document.getElementById('step3');
    const step4 = document.getElementById('step4');
    const resetContainer = document.getElementById('resetContainer');
    const infoDiv = document.getElementById('selectedInfo');
    
    infoDiv.innerHTML = `
        <div class="selected-song-name">${songTitle}</div>
        <div class="selected-version-name">${version.venue} (${version.date})</div>
        <div style="margin-top: 15px; padding: 12px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <strong style="color: #92400e;">📂 YOU NEED: Track ${version.trackNumber}</strong>
            <p style="margin: 5px 0 0 0; color: #78350f; font-size: 0.9em;">
                Look for file: <code style="background: #fde68a; padding: 2px 6px; border-radius: 4px;">${version.archiveId}.mp3</code>
            </p>
        </div>
    `;
    
    // Generate Archive.org URLs
    const urls = generateArchiveUrls(version.archiveId, version.trackNumber);
    
    // Update button handlers
    const smartDownloadBtn = document.getElementById('smartDownloadBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const moisesBtn = document.getElementById('moisesBtn');
    const setlistBtn = document.getElementById('setlistBtn');
    const youtubeSearchBtn = document.getElementById('youtubeSearchBtn');
    
    smartDownloadBtn.onclick = () => handleSmartDownload(songTitle, version);
    downloadBtn.onclick = () => window.open(urls.archivePage, '_blank');
    moisesBtn.onclick = () => handleMoisesUpload();
    setlistBtn.onclick = () => window.open(urls.setlistFm, '_blank');
    youtubeSearchBtn.onclick = () => handleYouTubeSearch(songTitle);
    
    // Show step 3
    step3.classList.remove('hidden');
    
    // Show step 4
    step4.classList.remove('hidden');
    
    // Show reset container
    resetContainer.classList.remove('hidden');
}

// Generate Archive.org URLs
function generateArchiveUrls(archiveId, trackNumber) {
    // Extract date from archiveId (e.g., "gd1981-03-14" -> "1981-03-14")
    const dateMatch = archiveId.match(/(\d{4})-(\d{2})-(\d{2})/);
    const searchDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';
    
    return {
        archivePage: `https://archive.org/details/${archiveId}`,
        setlistFm: `https://www.setlist.fm/search?query=grateful+dead+${searchDate}`,
        download: `https://archive.org/download/${archiveId}/${archiveId}t${trackNumber}.mp3`
    };
}

// Initialize audio splitter
let audioSplitter = null;

function initializeAudioSplitter() {
    if (!audioSplitter) {
        audioSplitter = new AudioSplitter();
        console.log('AudioSplitter initialized');
    }
}

// Handle Smart Download
async function handleSmartDownload(songTitle, version) {
    try {
        initializeAudioSplitter();
        
        if (!audioSplitter) {
            alert('❌ Audio Splitter not loaded. Please refresh the page.');
            return;
        }
        
        // Confirm action
        const confirm = window.confirm(
            `⚡ SMART DOWNLOAD\n\n` +
            `This will extract just "${songTitle}" from the full show:\n` +
            `${version.venue} (${version.date})\n\n` +
            `Estimated time: 1-2 minutes\n` +
            `File size: ~10-15 MB\n\n` +
            `This clip will be perfect for Moises (under 20-min limit)!\n\n` +
            `Continue?`
        );
        
        if (!confirm) return;
        
        // For Archive search results, get track position from Setlist.fm
        let trackPosition = parseInt(version.trackNumber);
        if (version.isArchiveSearchResult && !version._skipPositionDialog) {
            console.log(`Archive search result - fetching setlist from Setlist.fm...`);
            
            // Show loading message
            const loadingMsg = document.createElement('div');
            loadingMsg.id = 'setlistLoading';
            loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; text-align: center;';
            loadingMsg.innerHTML = '<div class="spinner"></div><p style="margin-top: 15px; color: #4a5568;">Fetching setlist from Setlist.fm...</p>';
            document.body.appendChild(loadingMsg);
            
            try {
                // Extract date from archiveId (e.g., "gd1981-03-14" -> "1981-03-14")
                const dateMatch = version.archiveId.match(/(\d{4})-(\d{2})-(\d{2})/);
                if (!dateMatch) {
                    throw new Error('Could not extract date from Archive ID');
                }
                
                const [_, year, month, day] = dateMatch;
                const showDate = `${day}-${month}-${year}`; // Setlist.fm format: dd-mm-yyyy
                
                // Get band name (default to Grateful Dead)
                const bandName = 'Grateful Dead';
                const bandSlug = 'grateful-dead'; // Setlist.fm URL slug
                
                // Construct Setlist.fm URL
                const setlistUrl = `https://www.setlist.fm/setlist/${bandSlug}/${showDate}.html`;
                console.log(`Fetching setlist from: ${setlistUrl}`);
                
                // Fetch the page (this will fail due to CORS, so we'll use a proxy or direct search)
                // Instead, let's use Setlist.fm's search page which doesn't require API key
                const searchUrl = `https://www.setlist.fm/search?query=${encodeURIComponent(bandName + ' ' + year + '-' + month + '-' + day)}`;
                
                // Since we can't scrape due to CORS, let's just open Setlist.fm and ask user
                console.log(`Opening Setlist.fm for user to check: ${searchUrl}`);
                
                // Show a more helpful dialog
                const showSetlistDialog = () => {
                    // Remove loading message
                    const loadingEl = document.getElementById('setlistLoading');
                    if (loadingEl) document.body.removeChild(loadingEl);
                    
                    // Create custom dialog
                    const dialog = document.createElement('div');
                    dialog.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; max-width: 500px;';
                    dialog.innerHTML = `
                        <h3 style="margin: 0 0 15px 0; color: #2d3748;">🎵 Find Track Position</h3>
                        <p style="margin-bottom: 15px; color: #4a5568;">
                            We need to know which track "${songTitle}" is in this show.
                        </p>
                        <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <p style="margin: 0 0 10px 0; color: #2d3748; font-weight: 600;">
                                Show: ${bandName} - ${showDate}
                            </p>
                            <button onclick="window.open('${searchUrl}', '_blank')" style="background: #9333ea; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                                📋 Open Setlist.fm
                            </button>
                        </div>
                        <p style="margin-bottom: 15px; color: #718096; font-size: 14px;">
                            Enter the track number (1 = first song, 2 = second song, etc.):
                        </p>
                        <input type="number" id="trackPositionInput" min="1" value="1" style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 16px; margin-bottom: 15px;">
                        <div style="display: flex; gap: 10px;">
                            <button id="cancelBtn" style="flex: 1; background: #e2e8f0; color: #4a5568; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                                Cancel
                            </button>
                            <button id="confirmBtn" style="flex: 1; background: #10b981; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                                Continue
                            </button>
                        </div>
                    `;
                    document.body.appendChild(dialog);
                    
                    return new Promise((resolve, reject) => {
                        document.getElementById('confirmBtn').onclick = () => {
                            const position = parseInt(document.getElementById('trackPositionInput').value);
                            document.body.removeChild(dialog);
                            if (isNaN(position) || position < 1) {
                                reject(new Error('Invalid position'));
                            } else {
                                resolve(position);
                            }
                        };
                        
                        document.getElementById('cancelBtn').onclick = () => {
                            document.body.removeChild(dialog);
                            reject(new Error('User cancelled'));
                        };
                        
                        // Focus input and select it
                        const input = document.getElementById('trackPositionInput');
                        input.focus();
                        input.select();
                        
                        // Allow Enter key to submit
                        input.addEventListener('keypress', (e) => {
                            if (e.key === 'Enter') {
                                document.getElementById('confirmBtn').click();
                            }
                        });
                    });
                };
                
                trackPosition = await showSetlistDialog();
                console.log(`User specified track position: ${trackPosition}`);
                
            } catch (error) {
                console.warn('Setlist lookup error:', error);
                
                // Remove loading message if still present
                const loadingEl = document.getElementById('setlistLoading');
                if (loadingEl) document.body.removeChild(loadingEl);
                
                if (error.message === 'User cancelled') {
                    return; // User cancelled, stop here
                }
                
                // Fallback to simple manual entry
                const userPosition = prompt(
                    `⚠️ Please enter track position\n\n` +
                    `Which track is "${songTitle}"?\n` +
                    `(1 = first song, 2 = second song, etc.)`,
                    '1'
                );
                
                if (!userPosition) return;
                
                trackPosition = parseInt(userPosition);
                if (isNaN(trackPosition) || trackPosition < 1) {
                    alert('❌ Invalid track position. Please try again.');
                    return;
                }
                
                console.log(`Using manual track position: ${trackPosition}`);
            }
        }
        
        // Extract song
        const audioBlob = await audioSplitter.extractSongFromArchive(
            version.archiveId,
            songTitle,
            trackPosition,
            7, // estimated duration in minutes
            version.isArchiveSearchResult // Flag to skip individual track search
        );
        
        // Show preview dialog with audio player
        const filename = `${songTitle.replace(/[^a-z0-9]/gi, '-')}-${version.date.replace(/[^a-z0-9]/gi, '-')}.mp3`;
        const url = URL.createObjectURL(audioBlob);
        const fileSizeMB = (audioBlob.size / (1024 * 1024)).toFixed(1);
        
        console.log(`Preview: ${filename}, Size: ${fileSizeMB}MB, Type: ${audioBlob.type}`);
        
        const showPreviewDialog = () => {
            const dialog = document.createElement('div');
            dialog.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; max-width: 550px;';
            dialog.innerHTML = `
                <h3 style="margin: 0 0 15px 0; color: #2d3748;">🎵 Preview Track #${trackPosition}</h3>
                <p style="margin-bottom: 15px; color: #4a5568;">
                    <strong>Listen to verify this is the correct song:</strong>
                </p>
                <audio controls autoplay style="width: 100%; margin-bottom: 20px;" id="previewAudio">
<<<<<<< HEAD
                    <source src="${url}">
=======
                    <source src="${url}" type="audio/mpeg">
>>>>>>> c539e96d338601b7c3982b45f82eddd47d9ce092
                </audio>
                <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin-bottom: 15px; font-size: 14px;">
                    <div style="color: #2d3748; margin-bottom: 5px;"><strong>Song:</strong> ${songTitle}</div>
                    <div style="color: #2d3748; margin-bottom: 5px;"><strong>Position:</strong> Track #${trackPosition}</div>
                    <div style="color: #2d3748; margin-bottom: 5px;"><strong>Show:</strong> ${version.venue}</div>
                    <div style="color: #2d3748; margin-bottom: 5px;"><strong>Date:</strong> ${version.date}</div>
                    <div style="color: ${fileSizeMB < 1 ? '#dc2626' : '#10b981'}; font-weight: 600; margin-top: 8px;"><strong>Size:</strong> ${fileSizeMB} MB ${fileSizeMB < 1 ? '⚠️ TOO SMALL!' : '✓'}</div>
                </div>
                <p style="margin-bottom: 15px; color: #dc2626; font-size: 13px; font-weight: 600;">
                    ⚠️ <strong>Wrong song?</strong> Try the next or previous track:
                </p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <button id="prevBtn" style="background: #f59e0b; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                        ⬅️ Track ${trackPosition - 1}
                    </button>
                    <button id="nextBtn" style="background: #f59e0b; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                        Track ${trackPosition + 1} ➡️
                    </button>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="cancelBtn" style="flex: 1; background: #ef4444; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                        ❌ Cancel
                    </button>
                    <button id="downloadBtn" style="flex: 1; background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                        💾 Download
                    </button>
                    <button id="moisesBtn" style="flex: 1; background: #10b981; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                        🎛️ Moises
                    </button>
                </div>
            `;
            document.body.appendChild(dialog);
            
            return new Promise((resolve) => {
                document.getElementById('cancelBtn').onclick = () => {
                    const audio = document.getElementById('previewAudio');
                    audio.pause();
                    document.body.removeChild(dialog);
                    URL.revokeObjectURL(url);
                    resolve('cancel');
                };
                
                document.getElementById('prevBtn').onclick = () => {
                    const audio = document.getElementById('previewAudio');
                    audio.pause();
                    document.body.removeChild(dialog);
                    URL.revokeObjectURL(url);
                    resolve('prev');
                };
                
                document.getElementById('nextBtn').onclick = () => {
                    const audio = document.getElementById('previewAudio');
                    audio.pause();
                    document.body.removeChild(dialog);
                    URL.revokeObjectURL(url);
                    resolve('next');
                };
                
                document.getElementById('downloadBtn').onclick = () => {
                    const audio = document.getElementById('previewAudio');
                    audio.pause();
                    document.body.removeChild(dialog);
                    resolve('download');
                };
                
                document.getElementById('moisesBtn').onclick = () => {
                    const audio = document.getElementById('previewAudio');
                    audio.pause();
                    document.body.removeChild(dialog);
                    resolve('moises');
                };
            });
        };
        
        const action = await showPreviewDialog();
        
        if (action === 'cancel') {
            console.log('User cancelled after preview');
            URL.revokeObjectURL(url);
            return;
        }
        
        if (action === 'prev') {
            console.log('User wants previous track');
            URL.revokeObjectURL(url);
            // Create modified version with new position and skip dialog
            const newVersion = {
                ...version,
                trackNumber: String(trackPosition - 1),
                _skipPositionDialog: true // Skip asking for position again
            };
            return handleSmartDownload(songTitle, newVersion);
        }
        
        if (action === 'next') {
            console.log('User wants next track');
            URL.revokeObjectURL(url);
            // Create modified version with new position and skip dialog
            const newVersion = {
                ...version,
                trackNumber: String(trackPosition + 1),
                _skipPositionDialog: true // Skip asking for position again
            };
            return handleSmartDownload(songTitle, newVersion);
        }
        
        // Download the file
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        if (action === 'download') {
            // Just download, don't open Moises
            URL.revokeObjectURL(url);
            alert('✅ File downloaded! You can upload it to Moises.ai manually.');
            return;
        }
        
        // action === 'moises' - show success and continue
        URL.revokeObjectURL(url);
        
        // Show success
        setTimeout(() => {
            alert(
                `✅ SUCCESS!\n\n` +
                `Downloaded: ${songTitle}\n` +
                `Format: MP3 audio\n\n` +
                `NEXT STEPS:\n` +
                `1. Click "Open Moises.ai Studio" below\n` +
                `2. Upload the MP3 file\n` +
                `3. Separate stems (6 stems = $4/month)\n` +
                `4. Practice!\n\n` +
                `💡 TIP: MP3 files work great in Moises!`
            );
        }, 500);
        
    } catch (error) {
        console.error('Smart download error:', error);
        alert(
            `❌ EXTRACTION FAILED\n\n` +
            `Error: ${error.message}\n\n` +
            `TRY INSTEAD:\n` +
            `• Click "Download Full Show" button\n` +
            `• Find track #${version.trackNumber} in the downloaded files\n` +
            `• Upload that track to Moises.ai`
        );
    }
}

// Handle Moises upload
function handleMoisesUpload() {
    const moisesUrl = 'https://studio.moises.ai/';
    window.open(moisesUrl, '_blank');
}

// Handle YouTube search
function handleYouTubeSearch(songTitle) {
    const song = allSongs.find(s => s.title === songTitle);
    const bandName = song ? (song.band === 'GD' ? 'Grateful Dead' : song.band === 'JGB' ? 'Jerry Garcia Band' : song.band) : 'Grateful Dead';
    const searchQuery = `${songTitle} ${bandName} lesson tutorial`;
    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    window.open(youtubeUrl, '_blank');
}

// Reset and start over
function resetApp() {
    selectedSong = null;
    selectedVersion = null;
    
    document.getElementById('step1').style.display = 'block';
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').classList.add('hidden');
    document.getElementById('step4').classList.add('hidden');
    document.getElementById('resetContainer').classList.add('hidden');
    
    document.querySelectorAll('.version-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
