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
    
    // Get band info from allSongs
    const songData = allSongs.find(s => s.title === songTitle);
    const bandName = songData ? songData.band : 'Grateful Dead';
    
    // Highlight selected song
    document.querySelectorAll('.song-item').forEach(item => {
        item.classList.remove('selected');
    });
    event.target.closest('.song-item').classList.add('selected');
    
    // Check if we have top 5 versions for this song
    if (top5Database[songTitle]) {
        showTop5Versions(songTitle);
    } else {
        showNoVersionsMessage(songTitle, bandName);
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
    
    // Get band name for resource links
    const songData = allSongs.find(s => s.title === songTitle);
    const bandName = songData ? songData.band : 'Grateful Dead';
    
    container.innerHTML = versions.map(version => {
        const urls = generateArchiveUrls(version.archiveId, version.trackNumber);
        
        // Format difficulty display
        const difficultyStars = version.difficulty ? '⭐'.repeat(version.difficulty) : '';
        const difficultyLabel = version.difficulty === 1 ? 'Beginner' : 
                               version.difficulty === 2 ? 'Intermediate' : 
                               version.difficulty === 3 ? 'Advanced' : '';
        
        // Generate resource links
        const resourceLinks = generateResourceLinks(songTitle, version, bandName);
        
        return `
            <div class="version-card" onclick="selectVersion('${songTitle}', ${version.rank})">
                <span class="version-rank rank-${version.rank}">#${version.rank}</span>
                <div class="version-info">
                    <div class="version-venue">${version.venue}</div>
                    <div class="version-date">${version.date}</div>
                    
                    ${version.bpm || version.key || version.length ? `
                        <div style="margin-top: 8px; display: flex; gap: 15px; flex-wrap: wrap; color: #4a5568; font-size: 0.9em;">
                            ${version.key ? `<span>🎵 <strong>Key:</strong> ${version.key}</span>` : ''}
                            ${version.bpm ? `<span>⚡ <strong>BPM:</strong> ${version.bpm}</span>` : ''}
                            ${version.length ? `<span>⏱️ <strong>Length:</strong> ${version.length}</span>` : ''}
                        </div>
                    ` : ''}
                    
                    ${version.difficulty ? `
                        <div style="margin-top: 8px; color: #805ad5; font-weight: 600; font-size: 0.9em;">
                            ${difficultyStars} ${difficultyLabel}
                        </div>
                    ` : ''}
                    
                    <div class="version-notes">${version.notes}</div>
                    
                    ${version.practiceNotes ? `
                        <div style="margin-top: 10px; padding: 10px; background: #f0fff4; border-left: 4px solid #48bb78; border-radius: 6px;">
                            <div style="color: #22543d; font-weight: 600; font-size: 0.85em; margin-bottom: 4px;">💡 Practice Tip:</div>
                            <div style="color: #2f855a; font-size: 0.9em;">${version.practiceNotes}</div>
                        </div>
                    ` : ''}
                    
                    ${version.features && version.features.length > 0 ? `
                        <div style="margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap;">
                            ${version.features.map(f => `<span style="padding: 4px 10px; background: #edf2f7; border-radius: 12px; font-size: 0.8em; color: #4a5568;">✨ ${f}</span>`).join('')}
                        </div>
                    ` : ''}
                    
                    <div style="margin-top: 10px; padding: 8px; background: #edf2f7; border-radius: 6px; border-left: 4px solid #667eea;">
                        <strong style="color: #667eea;">📂 Track ${version.trackNumber}</strong> • 
                        <span class="version-quality">${version.quality} Quality</span>
                    </div>
                    
                    ${resourceLinks ? `
                        <div style="margin-top: 12px; padding-top: 12px; border-top: 2px dashed #e2e8f0;">
                            <div style="color: #4a5568; font-weight: 600; font-size: 0.85em; margin-bottom: 8px;">🎸 Resources for Musicians:</div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                ${resourceLinks}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    step2.classList.remove('hidden');
}

// Generate resource links based on band and available data
function generateResourceLinks(songTitle, version, bandName) {
    const links = [];
    const songSlug = songTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const dateSlug = version.date ? version.date.replace(/,/g, '').split(' ').reverse().join('-').toLowerCase() : '';
    
    // Relisten.net (available for all bands)
    if (version.relistenLink || dateSlug) {
        const relistenUrl = version.relistenLink || `https://relisten.net/${bandName.toLowerCase().replace(' ', '-')}/${version.archiveId.match(/\d{4}-\d{2}-\d{2}/)?.[0] || dateSlug}/${songSlug}`;
        links.push(`<a href="${relistenUrl}" target="_blank" style="padding: 6px 12px; background: #4299e1; color: white; text-decoration: none; border-radius: 6px; font-size: 0.85em; font-weight: 500;">🎧 Stream</a>`);
    }
    
    // Band-specific rating sites
    if (bandName === 'Grateful Dead' && version.headyversionLink) {
        links.push(`<a href="${version.headyversionLink}" target="_blank" style="padding: 6px 12px; background: #9f7aea; color: white; text-decoration: none; border-radius: 6px; font-size: 0.85em; font-weight: 500;">📊 HeadyVersion</a>`);
    } else if (bandName === 'Phish' && version.phishnetLink) {
        links.push(`<a href="${version.phishnetLink}" target="_blank" style="padding: 6px 12px; background: #9f7aea; color: white; text-decoration: none; border-radius: 6px; font-size: 0.85em; font-weight: 500;">📊 Phish.net</a>`);
    } else if (bandName === 'Widespread Panic' && version.panicstreamLink) {
        links.push(`<a href="${version.panicstreamLink}" target="_blank" style="padding: 6px 12px; background: #9f7aea; color: white; text-decoration: none; border-radius: 6px; font-size: 0.85em; font-weight: 500;">📊 PanicStream</a>`);
    }
    
    // Chords
    if (version.chordsLink) {
        links.push(`<a href="${version.chordsLink}" target="_blank" style="padding: 6px 12px; background: #48bb78; color: white; text-decoration: none; border-radius: 6px; font-size: 0.85em; font-weight: 500;">🎵 Chords</a>`);
    }
    
    // Tabs
    if (version.tabsLink) {
        links.push(`<a href="${version.tabsLink}" target="_blank" style="padding: 6px 12px; background: #ed8936; color: white; text-decoration: none; border-radius: 6px; font-size: 0.85em; font-weight: 500;">🎸 Tabs</a>`);
    }
    
    return links.join('');
}

// Show message when no versions available yet
function showNoVersionsMessage(songTitle, bandName = 'Grateful Dead') {
    const step2 = document.getElementById('step2');
    const container = document.getElementById('versionsContainer');
    
    container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: #f7fafc; border-radius: 12px;">
            <p style="font-size: 1.2em; color: #4a5568; margin-bottom: 15px;">
                <strong>"${songTitle}"</strong> by <strong>${bandName}</strong> is in our catalog!
            </p>
            <p style="color: #718096; margin-bottom: 20px;">
                We haven't pre-loaded the top 5 versions for this song yet.
            </p>
            <button class="primary-btn" onclick="searchArchiveForSong('${songTitle}', '${bandName}')" style="margin-bottom: 15px;">
                🔍 Find Best Versions on Archive.org
            </button>
            <p style="color: #718096; font-size: 0.9em;">
                This will search Archive.org for popular downloadable versions
            </p>
            <a href="https://archive.org/search.php?query=creator%3A%22${encodeURIComponent(bandName)}%22+AND+%22${encodeURIComponent(songTitle)}%22+soundboard&sort=-downloads" 
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
    
    // Setup Smart Download button
    const smartDownloadBtn = document.getElementById('smartDownloadBtn');
    smartDownloadBtn.onclick = () => handleSmartDownload(songTitle, version);
    
    // Setup download button - will use best Archive version
    const downloadBtn = document.getElementById('downloadBtn');
    
    downloadBtn.onclick = async () => {
        try {
            // Show loading
            downloadBtn.disabled = true;
            downloadBtn.textContent = '🔍 Finding best version...';
            
            // Use the same auto-search logic to find best version
            const audioSplitter = new AudioSplitter();
            const bestArchiveId = await audioSplitter.findBestArchiveVersion(version.archiveId);
            
            // Generate URLs with the BEST version
            const urls = {
                details: `https://archive.org/details/${bestArchiveId}`,
                download: `https://archive.org/download/${bestArchiveId}/`
            };
            
            // Reset button
            downloadBtn.disabled = false;
            downloadBtn.textContent = '⬇️ Download Full Show from Archive.org';
            
            // Open best version download page
            window.open(urls.download, '_blank');
            
            // Show instructions
            setTimeout(() => {
                alert(`🎯 FULL SHOW DOWNLOAD:

📂 BEST VERSION FOUND: ${bestArchiveId.substring(0, 40)}...

✅ STEP 1: On Archive.org page
   → Look for the MP3 file (usually 100-200MB)
   → It will be named something like: ${bestArchiveId}.mp3

✅ STEP 2: Download the MP3
   → Right-click on the MP3 filename
   → Select "Save Link As..." or "Download Linked File"
   → Save to your Downloads folder

✅ STEP 3: Find Your Song
   → Track ${version.trackNumber} is "${songTitle}"
   → Use Setlist.fm to see song order
   → Upload to Moises and scrub to find the song

💡 TIP: Smart Download (green button) extracts just the song automatically!`);
            }, 500);
            
            // Show step 4
            step4.classList.remove('hidden');
            resetContainer.classList.remove('hidden');
            
        } catch (error) {
            console.error('Error finding best version:', error);
            downloadBtn.disabled = false;
            downloadBtn.textContent = '⬇️ Download Full Show from Archive.org';
            
            // Fallback to basic URL
            const basicUrl = `https://archive.org/download/${version.archiveId}/`;
            window.open(basicUrl, '_blank');
            
            alert(`⚠️ Could not auto-find best version, opening basic URL.
            
Look for any MP3 file on the Archive.org page to download.`);
        }
    };
    
    // Setup Moises button
    const moisesBtn = document.getElementById('moisesBtn');
    moisesBtn.onclick = () => {
        window.open('https://studio.moises.ai/', '_blank');
        
        // Show DETAILED, CLEAR Moises workflow
        setTimeout(() => {
            alert(`🎛️ MOISES.AI - UPLOAD & STEM SEPARATION

📤 STEP 1: Upload Your MP3
   → Go to https://studio.moises.ai/
   → Click "Upload" or drag the MP3 file
   → Select: ${version.archiveId}.mp3 from Downloads

💰 MOISES PRICING (Important!):
   → FREE: 2 stems only (vocals + instrumental)
   → PAID ($4/month): 6 stems separation
      • Vocals (lead & harmonies)
      • Guitar 1 (lead guitar)
      • Guitar 2 (rhythm guitar)  
      • Bass
      • Drums
      • Keys
   → Recommended: Get paid plan for full practice power!

⚙️ STEP 2: Choose Stem Separation
   → Select "6 Stems" (requires paid plan)
   → Click "Separate"
   → Wait 1-2 minutes for AI processing

🎸 STEP 3: Isolate Your Instrument
   → Click "Solo" to hear just your part
   → Or "Mute" other instruments
   → Adjust volume sliders for perfect mix

🎵 STEP 4: Practice!
   → Slow down tempo to learn (25-100%)
   → Loop difficult sections (A-B repeat)
   → Adjust pitch if needed
   → Play along and nail it!

📍 FIND YOUR SONG:
   → Full show MP3 = all songs
   → Track ${version.trackNumber} is "${songTitle}"
   → Use Moises timeline to scrub to your song
   → Or check setlist.fm for song order/timing

💡 PRO TIP: The full show gives you bonus practice material!
You can learn multiple songs from one download!`);
        }, 1000);
        
        step4.classList.remove('hidden');
        resetContainer.classList.remove('hidden');
    };
    
    // Setup Setlist.fm button
    const setlistBtn = document.getElementById('setlistBtn');
    setlistBtn.onclick = () => {
        // Extract date from version.date (e.g., "March 14, 1981" -> "1981-03-14")
        const dateStr = version.date;
        const dateParts = dateStr.split(' ');
        const months = {
            'January': '01', 'February': '02', 'March': '03', 'April': '04',
            'May': '05', 'June': '06', 'July': '07', 'August': '08',
            'September': '09', 'October': '10', 'November': '11', 'December': '12'
        };
        const month = months[dateParts[0]];
        const day = dateParts[1].replace(',', '').padStart(2, '0');
        const year = dateParts[2];
        const formattedDate = `${year}-${month}-${day}`;
        
        // Determine band name for setlist.fm
        let bandName = 'Grateful Dead';
        if (version.archiveId.startsWith('wsp')) {
            bandName = 'Widespread Panic';
        } else if (version.archiveId.startsWith('phish')) {
            bandName = 'Phish';
        }
        
        // Open setlist.fm search
        const setlistUrl = `https://www.setlist.fm/search?query=${encodeURIComponent(bandName + ' ' + formattedDate)}`;
        window.open(setlistUrl, '_blank');
        
        // Show helpful message
        setTimeout(() => {
            alert(`📋 SETLIST.FM - FIND YOUR SONG

You'll see the setlist (song order) for this show:
${bandName} - ${version.date}

WHY THIS HELPS:
→ See which song is Track ${version.trackNumber}
→ See song order to navigate the MP3
→ Estimate timing (most songs = 5-10 mins)
→ Find other songs you might want to learn!

TIP: Use the setlist to scrub through the MP3 in Moises
and find exactly where "${songTitle}" starts!`);
        }, 500);
    };
    
    // Setup YouTube Search button (if enabled)
    const youtubeSearchBtn = document.getElementById('youtubeSearchBtn');
    if (youtubeSearchBtn) {
        youtubeSearchBtn.onclick = () => {
            // Determine band name
            let bandName = 'Grateful Dead';
            if (version.archiveId.startsWith('wsp')) {
                bandName = 'Widespread Panic';
            } else if (version.archiveId.startsWith('phish')) {
                bandName = 'Phish';
            }
            
            handleYouTubeSearch(songTitle, bandName);
        };
    }
    
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
async function searchArchiveForSong(songTitle, bandName = 'Grateful Dead') {
    // Map band abbreviations to full names for Archive.org
    const bandNameMapping = {
        'GD': 'Grateful Dead',
        'Grateful Dead': 'Grateful Dead',
        'Phish': 'Phish',
        'WSP': 'Widespread Panic',
        'Widespread Panic': 'Widespread Panic',
        'JGB': 'Jerry Garcia Band',
        'Jerry Garcia Band': 'Jerry Garcia Band'
    };
    
    const fullBandName = bandNameMapping[bandName] || bandName;
    console.log('Searching Archive.org for:', songTitle, 'by', fullBandName);
    
    const container = document.getElementById('versionsContainer');
    
    // Show loading state
    container.innerHTML = `
        <div style="text-align: center; padding: 60px;">
            <div class="spinner"></div>
            <p style="color: #718096; margin-top: 20px; font-size: 1.1em;">
                Searching Archive.org for best versions of "${songTitle}" by ${fullBandName}...
            </p>
            <p style="color: #a0aec0; margin-top: 10px; font-size: 0.9em;">
                Looking for soundboard recordings with MP3 downloads
            </p>
        </div>
    `;
    
    try {
        // Query Archive.org API for shows with this song by this band
        // Sorted by downloads (popularity), filtered for soundboard quality
        const query = `creator:"${fullBandName}" AND "${songTitle}" AND soundboard AND format:MP3`;
        const apiUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl=identifier,title,date,downloads,avg_rating&sort[]=downloads+desc&sort[]=avg_rating+desc&rows=10&output=json`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (!data.response || !data.response.docs || data.response.docs.length === 0) {
            showNoResultsFound(songTitle, fullBandName);
            return;
        }
        
        // Get top 5 results
        const topShows = data.response.docs.slice(0, 5);
        
        // Display results
        displayArchiveResults(songTitle, topShows);
        
    } catch (error) {
        console.error('Archive.org search error:', error);
        showSearchError(songTitle, bandName);
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
    console.log('Selected Archive version:', archiveId, songTitle);
    
    // Store selected version
    selectedVersion = {
        archiveId: archiveId,
        songTitle: songTitle,
        trackNumber: '01', // Default - will be auto-detected by Smart Download
        venue: 'Archive.org Search Result',
        date: archiveId,
        notes: 'Auto-discovered from Archive.org search',
        quality: 'SBD'
    };
    
    // Highlight selected version
    document.querySelectorAll('.version-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.target.closest('.version-card').classList.add('selected');
    
    // Show Step 3 with download options
    const step3 = document.getElementById('step3');
    const container = document.getElementById('downloadOptions');
    
    const urls = generateArchiveUrls(archiveId, '01');
    
    container.innerHTML = `
        <h3 style="color: #2d3748; margin-bottom: 15px;">📥 Download Options</h3>
        <p style="color: #4a5568; margin-bottom: 20px;">
            <strong>Selected:</strong> ${songTitle} from ${archiveId}
        </p>
        
        <div style="display: flex; flex-direction: column; gap: 15px;">
            <button class="download-btn smart-download-btn" onclick="handleSmartDownload('${songTitle}')">
                ⚡ Smart Download (Just This Song!)
            </button>
            
            <button class="download-btn" onclick="window.open('${urls.archivePage}', '_blank')">
                📦 Download Full Show from Archive.org
            </button>
            
            <button class="download-btn moises-btn" onclick="handleMoisesUpload()">
                🎵 Open Moises.ai Studio
            </button>
            
            <button class="download-btn" onclick="window.open('https://www.setlist.fm/search?query=${encodeURIComponent('Grateful Dead ' + archiveId)}', '_blank')">
                📋 View Setlist (Song Order & Timing)
            </button>
            
            <button class="download-btn youtube-btn" onclick="handleYouTubeSearch('${songTitle}')">
                🎥 Search YouTube for This Song
            </button>
        </div>
    `;
    
    step3.style.display = 'block';
    step3.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
            <button class="secondary-btn" onclick="window.open('https://archive.org/search.php?query=creator%3A%22${encodeURIComponent(bandName)}%22+AND+%22${encodeURIComponent(songTitle)}%22', '_blank')" style="margin-left: 10px;">
                🔍 Manual Search
            </button>
        </div>
    `;
}

// ============================================================================
// SMART DOWNLOAD & YOUTUBE INTEGRATION
// ============================================================================

// Initialize Audio Splitter
let audioSplitter = null;

function initializeAudioSplitter() {
    if (!audioSplitter && typeof AudioSplitter !== 'undefined') {
        audioSplitter = new AudioSplitter();
        audioSplitter.onProgress(updateProgress);
    }
}

// Update progress UI
function updateProgress(message, percent) {
    const container = document.getElementById('progressContainer');
    const messageEl = document.getElementById('progressMessage');
    const barEl = document.getElementById('progressBar');
    
    if (container) {
        container.classList.remove('hidden');
        messageEl.textContent = message;
        barEl.style.width = `${percent}%`;
        
        // Hide after completion
        if (percent >= 100) {
            setTimeout(() => {
                container.classList.add('hidden');
            }, 2000);
        }
    }
}

// Smart Download Handler (added in showDownloadStep)
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
        
        // Extract song
        const audioBlob = await audioSplitter.extractSongFromArchive(
            version.archiveId,
            songTitle,
            parseInt(version.trackNumber),
            7 // estimated duration in minutes
        );
        
        // Download
        const url = URL.createObjectURL(audioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${songTitle.replace(/[^a-z0-9]/gi, '-')}-${version.date.replace(/[^a-z0-9]/gi, '-')}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show success
        setTimeout(() => {
            alert(
                `✅ SUCCESS!\n\n` +
                `Downloaded: ${songTitle}\n` +
                `Format: WAV audio\n\n` +
                `NEXT STEPS:\n` +
                `1. Click "Open Moises.ai Studio" below\n` +
                `2. Upload the WAV file\n` +
                `3. Separate stems (6 stems = $4/month)\n` +
                `4. Practice!\n\n` +
                `💡 TIP: WAV files work great in Moises!`
            );
        }, 500);
        
    } catch (error) {
        console.error('Smart download error:', error);
        alert(
            `❌ EXTRACTION FAILED\n\n` +
            `Error: ${error.message}\n\n` +
            `TRY INSTEAD:\n` +
            `• Click "Download Full Show" button\n` +
            `• Use Setlist.fm to find song timing\n` +
            `• Upload to Moises and trim there\n\n` +
            `Or report this issue!`
        );
    }
}

// YouTube Search Handler
async function handleYouTubeSearch(songTitle, bandName) {
    try {
        // Open modal
        const modal = document.getElementById('youtubeModal');
        const resultsContainer = document.getElementById('youtubeSearchResults');
        
        modal.classList.remove('hidden');
        resultsContainer.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="spinner" style="margin: 0 auto;"></div><p style="margin-top: 15px;">Searching YouTube...</p></div>';
        
        // Construct search query
        const query = `${bandName} ${songTitle} live`;
        
        // Call YouTube API through Cloudflare Worker
        const workerUrl = 'https://deadcetera-youtube.drewmerrill.workers.dev';
        const searchUrl = `${workerUrl}/api/youtube/search?q=${encodeURIComponent(query)}`;
        
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (!response.ok || !data.results) {
            throw new Error('YouTube search failed');
        }
        
        // Display results
        displayYouTubeResults(data.results, songTitle);
        
    } catch (error) {
        console.error('YouTube search error:', error);
        
        const resultsContainer = document.getElementById('youtubeSearchResults');
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; background: #fff5f5; border-radius: 12px;">
                <p style="font-size: 1.2em; color: #c53030; margin-bottom: 15px;">
                    ❌ YouTube Search Failed
                </p>
                <p style="color: #744210; margin-bottom: 20px;">
                    ${error.message}
                </p>
                <p style="color: #718096; font-size: 0.9em;">
                    Make sure you've deployed the Cloudflare Worker and updated the URL in app.js
                </p>
            </div>
        `;
    }
}

// Display YouTube search results
function displayYouTubeResults(results, songTitle) {
    const resultsContainer = document.getElementById('youtubeSearchResults');
    
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <p style="color: #718096;">No results found for "${songTitle}"</p>
            </div>
        `;
        return;
    }
    
    resultsContainer.innerHTML = results.map(video => `
        <div class="youtube-result" onclick="handleYouTubeDownload('${video.videoId}', '${video.title.replace(/'/g, "\\'")}')">
            <img src="${video.thumbnail}" alt="${video.title}" class="youtube-thumbnail">
            <div class="youtube-info">
                <div class="youtube-title">${video.title}</div>
                <div class="youtube-channel">${video.channel}</div>
                <span class="youtube-duration">🎥 Click to Download Audio</span>
            </div>
        </div>
    `).join('');
}

// Show YouTube download options
async function handleYouTubeDownload(videoId, title) {
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Create options modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; padding: 30px;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 1.5em; color: #2d3748;">🎥 Download YouTube Audio</h2>
                <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #718096; line-height: 1;">&times;</button>
            </div>
            
            <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                <strong style="color: #2d3748;">${title}</strong>
            </div>
            
            <div style="margin-bottom: 25px; padding: 20px; background: #f0fff4; border-left: 4px solid #48bb78; border-radius: 8px;">
                <div style="font-weight: bold; color: #22543d; margin-bottom: 10px;">🟢 OPTION 1: Browser Extension (Recommended)</div>
                <p style="color: #2f855a; margin-bottom: 15px; font-size: 0.95em;">
                    Install a browser extension for one-click YouTube downloads:
                </p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <a href="https://chromewebstore.google.com/search/youtube%20audio%20downloader" target="_blank" style="background: #48bb78; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 500; display: inline-block;">
                        📦 Find Extension
                    </a>
                    <button onclick="copyToClipboard('${youtubeUrl}'); alert('✅ YouTube URL copied! Now install extension and use it on YouTube.');" style="background: #38a169; color: white; padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 500;">
                        📋 Copy URL
                    </button>
                </div>
            </div>
            
            <div style="margin-bottom: 25px; padding: 20px; background: #fffaf0; border-left: 4px solid #ed8936; border-radius: 8px;">
                <div style="font-weight: bold; color: #7c2d12; margin-bottom: 10px;">🟡 OPTION 2: Online Converter</div>
                <p style="color: #9c4221; margin-bottom: 15px; font-size: 0.95em;">
                    Use a free converter website (opens video in converter):
                </p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <a href="https://ytmp3.nu/Y6sN/?url=${encodeURIComponent(youtubeUrl)}" target="_blank" style="background: #ed8936; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 500; display: inline-block;">
                        🔄 YTMP3.nu
                    </a>
                    <a href="https://y2mate.com/youtube/${videoId}" target="_blank" style="background: #dd6b20; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 500; display: inline-block;">
                        🔄 Y2Mate
                    </a>
                </div>
                <p style="color: #9c4221; margin-top: 10px; font-size: 0.85em;">
                    Note: You may need to click "Convert" on their site
                </p>
            </div>
            
            <div style="padding: 20px; background: #fff5f7; border-left: 4px solid #f56565; border-radius: 8px;">
                <div style="font-weight: bold; color: #742a2a; margin-bottom: 10px;">🔴 OPTION 3: Manual Copy</div>
                <p style="color: #9b2c2c; margin-bottom: 15px; font-size: 0.95em;">
                    Copy URL and use your own preferred downloader:
                </p>
                <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 10px; font-family: monospace; font-size: 0.85em; word-break: break-all;">
                    ${youtubeUrl}
                </div>
                <button onclick="copyToClipboard('${youtubeUrl}'); alert('✅ URL copied to clipboard!');" style="background: #f56565; color: white; padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 500; width: 100%;">
                    📋 Copy YouTube URL
                </button>
            </div>
            
            <div style="margin-top: 25px; padding: 15px; background: #edf2f7; border-radius: 8px; text-align: center;">
                <p style="color: #4a5568; font-size: 0.9em; margin: 0;">
                    💡 <strong>Pro Tip:</strong> Archive.org downloads (green button) usually have better quality for jam band shows!
                </p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Helper function to copy text to clipboard
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

// Close YouTube modal
function closeYoutubeModal() {
    const modal = document.getElementById('youtubeModal');
    modal.classList.add('hidden');
}
