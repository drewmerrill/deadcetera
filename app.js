// ============================================================================
// DEADCETERA WORKFLOW APP
// ============================================================================

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
    const searchInput = document.getElementById('songSearch');
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
    
    // Highlight selected song
    document.querySelectorAll('.song-item').forEach(item => {
        item.classList.remove('selected');
    });
    event.target.closest('.song-item').classList.add('selected');
    
    // Check if we have top 5 versions for this song
    if (top5Database[songTitle]) {
        showTop5Versions(songTitle);
    } else {
        showNoVersionsMessage(songTitle);
    }
    
    // Scroll to step 2
    setTimeout(() => {
        document.getElementById('step2').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// Show top 5 versions
function showTop5Versions(songTitle) {
    const step2 = document.getElementById('step2');
    const container = document.getElementById('versionsContainer');
    
    const versions = top5Database[songTitle];
    
    container.innerHTML = versions.map(version => {
        const urls = generateArchiveUrls(version.archiveId, version.trackNumber);
        return `
            <div class="version-card" onclick="selectVersion('${songTitle}', ${version.rank})">
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
    
    step2.classList.remove('hidden');
}

// Show message when no versions available yet
function showNoVersionsMessage(songTitle) {
    const step2 = document.getElementById('step2');
    const container = document.getElementById('versionsContainer');
    
    container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: #f7fafc; border-radius: 12px;">
            <p style="font-size: 1.2em; color: #4a5568; margin-bottom: 15px;">
                <strong>"${songTitle}"</strong> is in our catalog!
            </p>
            <p style="color: #718096; margin-bottom: 20px;">
                We haven't pre-loaded the top 5 versions for this song yet.
            </p>
            <button class="primary-btn" onclick="searchArchiveForSong('${songTitle}')" style="margin-bottom: 15px;">
                🔍 Find Best Versions on Archive.org
            </button>
            <p style="color: #718096; font-size: 0.9em;">
                This will search Archive.org for popular downloadable versions
            </p>
            <a href="https://archive.org/search.php?query=creator%3A%22Grateful+Dead%22+AND+%22${encodeURIComponent(songTitle)}%22+soundboard&sort=-downloads" 
               target="_blank" 
               style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 10px; font-weight: 600;">
                🔍 Search Archive.org
            </a>
        </div>
    `;
    
    step2.classList.remove('hidden');
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
            <div style="color: #78350f; font-size: 0.9em; margin-top: 5px;">
                Look for file: <code style="background: #fde68a; padding: 2px 6px; border-radius: 3px;">${version.archiveId}.mp3</code>
            </div>
        </div>
    `;
    
    // Setup download button
    const downloadBtn = document.getElementById('downloadBtn');
    const urls = generateArchiveUrls(version.archiveId, version.trackNumber);
    
    downloadBtn.onclick = () => {
        // Open Archive.org download page
        window.open(urls.download, '_blank');
        
        // Show VERY CLEAR instructions
        setTimeout(() => {
            alert(`🎯 CRYSTAL CLEAR DOWNLOAD STEPS:

📂 FIND THIS FILE: ${version.archiveId}.mp3

✅ STEP 1: On Archive.org page
   → Look for "${version.archiveId}.mp3" in the file list
   → It's usually one of the larger files (100-200MB)

✅ STEP 2: Download the MP3
   → Right-click on the filename
   → Select "Save Link As..." or "Download Linked File"
   → Save to your Downloads folder

✅ STEP 3: Note the Track Number
   → You need Track ${version.trackNumber} (${songTitle})
   → The full show MP3 contains all tracks
   → Moises will let you isolate just this track!

📍 NEXT: Click "Open Moises.ai Studio" below to upload!`);
        }, 500);
        
        // Show step 4
        step4.classList.remove('hidden');
        resetContainer.classList.remove('hidden');
    };
    
    // Setup Moises button
    const moisesBtn = document.getElementById('moisesBtn');
    moisesBtn.onclick = () => {
        window.open('https://studio.moises.ai/', '_blank');
        
        // Show DETAILED, CLEAR Moises workflow
        setTimeout(() => {
            alert(`🎛️ MOISES.AI UPLOAD & PRACTICE WORKFLOW:

📤 STEP 1: Upload Your MP3
   → Click "Upload" or drag the MP3 into Moises
   → Select: ${version.archiveId}.mp3 from your Downloads

⚙️ STEP 2: Choose Stem Separation
   → Select "6 Stems" (recommended for practice)
   → Click "Separate"
   → Wait 1-2 minutes for AI processing

🎸 STEP 3: Isolate Your Instrument
   → Click "Solo" on your part:
      • Vocals → Lead vocals & harmonies
      • Guitar 1 → Jerry Garcia's lead guitar
      • Guitar 2 → Bob Weir's rhythm guitar
      • Bass → Phil Lesh's bass line
      • Drums → Full drum kit
      • Keys → Brent/Vince keyboard parts

🎵 STEP 4: Practice!
   → Adjust tempo (slow it down to learn)
   → Loop difficult sections
   → Adjust volume to hear your part better
   → Play along and nail it!

💡 PRO TIP: The MP3 has the full show. Track ${version.trackNumber} is "${songTitle}". 
You can use Moises timeline to jump to that track, or just play through!

🔐 Save your work: Create a free Moises account to keep your separated tracks!`);
        }, 1000);
        
        step4.classList.remove('hidden');
        resetContainer.classList.remove('hidden');
    };
    
    step3.classList.remove('hidden');
}

// Reset workflow
function resetWorkflow() {
    selectedSong = null;
    selectedVersion = null;
    
    // Hide steps
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.add('hidden');
    document.getElementById('step4').classList.add('hidden');
    document.getElementById('resetContainer').classList.add('hidden');
    
    // Clear selections
    document.querySelectorAll('.song-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    document.getElementById('songSearch').value = '';
    renderSongs();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Utility: Search Archive.org for a song
function searchArchive(songTitle) {
    const url = `https://archive.org/search.php?query=creator%3A%22Grateful+Dead%22+AND+%22${encodeURIComponent(songTitle)}%22+soundboard&sort=-downloads`;
    window.open(url, '_blank');
}

// ============================================================================
// ARCHIVE.ORG AUTO-SEARCH FUNCTIONALITY
// ============================================================================

// Search Archive.org API for best versions of a song
async function searchArchiveForSong(songTitle) {
    const container = document.getElementById('versionsContainer');
    
    // Show loading state
    container.innerHTML = `
        <div style="text-align: center; padding: 60px;">
            <div class="spinner"></div>
            <p style="color: #718096; margin-top: 20px; font-size: 1.1em;">
                Searching Archive.org for best versions of "${songTitle}"...
            </p>
            <p style="color: #a0aec0; margin-top: 10px; font-size: 0.9em;">
                Looking for soundboard recordings with MP3 downloads
            </p>
        </div>
    `;
    
    try {
        // Query Archive.org API for Grateful Dead shows with this song
        // Sorted by downloads (popularity), filtered for soundboard quality
        const query = `creator:"Grateful Dead" AND "${songTitle}" AND soundboard AND format:MP3`;
        const apiUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl=identifier,title,date,downloads,avg_rating&sort[]=downloads+desc&sort[]=avg_rating+desc&rows=10&output=json`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (!data.response || !data.response.docs || data.response.docs.length === 0) {
            showNoResultsFound(songTitle);
            return;
        }
        
        // Get top 5 results
        const topShows = data.response.docs.slice(0, 5);
        
        // Display results
        displayArchiveResults(songTitle, topShows);
        
    } catch (error) {
        console.error('Archive.org search error:', error);
        showSearchError(songTitle);
    }
}

// Display Archive.org search results
function displayArchiveResults(songTitle, shows) {
    const container = document.getElementById('versionsContainer');
    
    container.innerHTML = `
        <div style="background: #edf2f7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="color: #2d3748; margin: 0; font-size: 0.95em;">
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

// Select an Archive.org version
function selectArchiveVersion(archiveId, songTitle) {
    selectedVersion = {
        archiveId: archiveId,
        songTitle: songTitle
    };
    
    // Highlight selected version
    document.querySelectorAll('.version-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.target.closest('.version-card').classList.add('selected');
    
    // Show download section
    showDownloadSection(archiveId);
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
function showNoResultsFound(songTitle) {
    const container = document.getElementById('versionsContainer');
    container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: #fff5f5; border-radius: 12px; border: 2px dashed #fc8181;">
            <p style="font-size: 1.2em; color: #c53030; margin-bottom: 15px;">
                😕 No soundboard recordings found
            </p>
            <p style="color: #744210; margin-bottom: 20px;">
                Archive.org doesn't have any downloadable soundboard versions of "${songTitle}" in their database.
            </p>
            <button class="primary-btn" onclick="window.open('https://archive.org/search.php?query=creator%3A%22Grateful+Dead%22+AND+%22${encodeURIComponent(songTitle)}%22', '_blank')">
                🔍 Search All Versions on Archive.org
            </button>
        </div>
    `;
}

// Show search error
function showSearchError(songTitle) {
    const container = document.getElementById('versionsContainer');
    container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: #fff5f5; border-radius: 12px;">
            <p style="font-size: 1.2em; color: #c53030; margin-bottom: 15px;">
                ⚠️ Search Error
            </p>
            <p style="color: #744210; margin-bottom: 20px;">
                Couldn't connect to Archive.org. Please try again or search manually.
            </p>
            <button class="primary-btn" onclick="searchArchiveForSong('${songTitle}')">
                🔄 Try Again
            </button>
            <button class="secondary-btn" onclick="window.open('https://archive.org/search.php?query=creator%3A%22Grateful+Dead%22+AND+%22${encodeURIComponent(songTitle)}%22', '_blank')" style="margin-left: 10px;">
                🔍 Manual Search
            </button>
        </div>
    `;
}
