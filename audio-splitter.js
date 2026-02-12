// ============================================================================
// AUDIO SPLITTER - Smart Song Extraction
// ============================================================================
// Extracts individual songs from full show MP3s using timestamp estimation
// Works with Archive.org shows for Grateful Dead, Widespread Panic, Phish
// ============================================================================

class AudioSplitter {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.currentBuffer = null;
        this.progressCallback = null;
    }

    /**
     * Extract a song segment from Archive.org show
     * @param {string} archiveId - Archive.org identifier (can be simplified like "gd1981-03-14")
     * @param {string} songTitle - Name of song to extract
     * @param {number} songPosition - Position in setlist (1-indexed)
     * @param {number} estimatedDuration - Estimated song length in minutes (default: 7)
     * @returns {Promise<Blob>} - Extracted audio as MP3 blob
     */
    async extractSongFromArchive(archiveId, songTitle, songPosition, estimatedDuration = 7, isArchiveSearchResult = false) {
        try {
            console.log(`========================================`);
            console.log(`EXTRACT SONG FROM ARCHIVE`);
            console.log(`  archiveId: ${archiveId}`);
            console.log(`  songTitle: ${songTitle}`);
            console.log(`  songPosition: ${songPosition}`);
            console.log(`  isArchiveSearchResult: ${isArchiveSearchResult}`);
            console.log(`========================================`);
            
            // Step 1: Search for best version if archiveId is simplified (e.g., "gd1981-03-14")
            this.updateProgress('Finding best show version...', 5);
            const bestArchiveId = await this.findBestArchiveVersion(archiveId);
            
            // Step 2: Get Archive.org metadata for best version
            this.updateProgress('Fetching show metadata...', 10);
            const metadata = await this.fetchArchiveMetadata(bestArchiveId);
            
            // Step 3: Check if individual track file exists (EASIEST PATH!)
            this.updateProgress('Looking for individual track file...', 20);
            const trackFile = this.findIndividualTrackFile(metadata, songTitle, songPosition, isArchiveSearchResult);
            
            if (trackFile) {
                // PERFECT! We have the individual track file - just download it directly!
                console.log(`✅ Found individual track file: ${trackFile.name} - downloading directly!`);
                this.updateProgress('Downloading track file directly...', 50);
                
                // Use actual archive ID from metadata if available (fixes Archive.org version mismatch)
                const downloadArchiveId = metadata._actualArchiveId || bestArchiveId;
                console.log(`Downloading from archive: ${downloadArchiveId}`);
                
                const trackUrl = `https://archive.org/download/${downloadArchiveId}/${trackFile.name}`;
                const response = await fetch(trackUrl);
                const blob = await response.blob();
                
                this.updateProgress('Complete!', 100);
                console.log(`✅ Direct download complete! No extraction needed.`);
                return blob;
            }
            
            // Step 4: No individual track - need to find full show and extract
            this.updateProgress('Finding full show file...', 25);
            const mp3File = this.findBestMP3(metadata);
            
            if (!mp3File) {
                throw new Error('No MP3 file found for this show');
            }

            // Step 5: Try to get REAL track timestamps from Archive.org
            this.updateProgress('Looking for track timestamps...', 30);
            const trackInfo = await this.findTrackTimestamps(metadata, songTitle, songPosition);
            
            let startTime, endTime;
            
            if (trackInfo && trackInfo.start !== null) {
                // We found real timestamps!
                this.updateProgress('Using real track data...', 35);
                startTime = trackInfo.start;
                endTime = trackInfo.end || (startTime + (estimatedDuration * 60));
                
                // VALIDATE: If timestamps are backwards, fall back to estimation
                if (endTime <= startTime) {
                    console.warn(`⚠️ Invalid track timestamps (end=${endTime}s before start=${startTime}s). Falling back to estimation.`);
                    const estimated = this.estimateTimestamp(songPosition, estimatedDuration);
                    startTime = estimated.startTime;
                    endTime = estimated.endTime;
                    console.log(`⚠️ Using estimated timestamps: ${(startTime/60).toFixed(1)}min - ${(endTime/60).toFixed(1)}min`);
                } else {
                    console.log(`✅ Found real timestamps: ${(startTime/60).toFixed(1)}min - ${(endTime/60).toFixed(1)}min`);
                }
            } else {
                // Fall back to estimation
                this.updateProgress('Estimating song position...', 35);
                const estimated = this.estimateTimestamp(songPosition, estimatedDuration);
                startTime = estimated.startTime;
                endTime = estimated.endTime;
                console.log(`⚠️ Using estimated timestamps: ${(startTime/60).toFixed(1)}min - ${(endTime/60).toFixed(1)}min`);
            }
            
            // VALIDATE TIMESTAMPS
            if (isNaN(startTime) || isNaN(endTime)) {
                throw new Error(`Invalid timestamps: start=${startTime}, end=${endTime}. Cannot extract audio.`);
            }
            
            if (startTime < 0 || endTime < 0) {
                throw new Error(`Negative timestamps: start=${startTime}s, end=${endTime}s. This indicates corrupted data.`);
            }
            
            if (endTime <= startTime) {
                throw new Error(`Invalid extraction range: start=${startTime}s, end=${endTime}s. Start must be before end.`);
            }
            
            if ((endTime - startTime) > 1200) { // 20 minutes max
                throw new Error(`Extraction too long: ${((endTime - startTime)/60).toFixed(1)} minutes. Maximum is 20 minutes. This usually means bad timestamp data.`);
            }

            // Step 5: Fetch and extract audio segment
            this.updateProgress('Downloading audio segment...', 40);
            
            // Use actual archive ID from metadata if available (fixes Archive.org version mismatch)
            const downloadArchiveId = metadata._actualArchiveId || bestArchiveId;
            console.log(`Downloading full show from archive: ${downloadArchiveId}`);
            
            const mp3Url = `https://archive.org/download/${downloadArchiveId}/${mp3File.name}`;
            
            const extractedBlob = await this.extractAudioSegment(
                mp3Url,
                startTime,
                endTime,
                mp3File.size || mp3File.length
            );

            this.updateProgress('Complete!', 100);
            return extractedBlob;

        } catch (error) {
            console.error('Error extracting song:', error);
            throw error;
        }
    }

    /**
     * NEW: Auto-search Archive.org to find best version of a show
     * Takes simplified ID like "gd1981-03-14" and finds best full version
     */
    async findBestArchiveVersion(archiveId) {
        try {
            // If archiveId is already detailed (has dots), use it as-is
            if (archiveId.includes('.') && archiveId.split('.').length > 2) {
                console.log(`Using provided Archive ID: ${archiveId}`);
                return archiveId;
            }
            
            // Search Archive.org for all versions of this show
            console.log(`Searching for best version of: ${archiveId}`);
            
            const searchUrl = `https://archive.org/advancedsearch.php?` +
                `q=identifier:${archiveId}*&` +
                `fl[]=identifier,downloads,format&` +
                `sort[]=downloads+desc&` +
                `rows=20&` +
                `output=json`;
            
            const response = await fetch(searchUrl);
            const data = await response.json();
            
            if (!data.response || !data.response.docs || data.response.docs.length === 0) {
                console.warn(`No versions found for ${archiveId}, using original ID`);
                return archiveId;
            }
            
            const versions = data.response.docs;
            console.log(`Found ${versions.length} versions of this show`);
            
            // ENHANCED SCORING SYSTEM
            // Priority 1: Versions with individual track files that include song names
            // Priority 2: Soundboard (SBD) > Audience (AUD)
            // Priority 3: FLAC > MP3
            // Priority 4: Higher download count
            
            let bestVersion = null;
            let bestScore = -1;
            
            for (const version of versions) {
                let score = 0;
                const id = version.identifier;
                
                // CRITICAL: Prefer versions that split songs (more likely to have song names in files)
                if (id.includes('sbd') || id.includes('soundboard')) {
                    score += 100; // SBD quality (highest priority)
                }
                
                // Avoid audience recordings
                if (id.includes('aud') || id.includes('audience')) {
                    score -= 50; // Penalty for audience
                }
                
                // Prefer FLAC (lossless)
                if (id.includes('flac')) {
                    score += 40;
                }
                
                // MP3 is okay
                if (id.includes('mp3') || id.includes('vbr')) {
                    score += 20;
                }
                
                // Prefer known good tapers/sources
                if (id.includes('miller') || id.includes('bertha') || id.includes('dusborne') || 
                    id.includes('clugston') || id.includes('tobin') || id.includes('scotton')) {
                    score += 30; // Known quality tapers
                }
                
                // Avoid versions with only disc numbers (no individual tracks)
                if (id.includes('.motb.0029') || id.includes('.shnf')) {
                    score -= 30; // These often have only crowd/tuning
                }
                
                // Download count (popularity = usually better quality)
                const downloads = parseInt(version.downloads) || 0;
                score += Math.min(downloads / 1000, 100); // Cap at 100 points
                
                console.log(`Version: ${id.substring(0, 60)}... Score: ${score}`);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestVersion = id;
                }
            }
            
            console.log(`✅ Selected best version: ${bestVersion} (score: ${bestScore})`);
            return bestVersion || archiveId;
            
        } catch (error) {
            console.error('Error searching for best version:', error);
            // Fall back to original ID
            return archiveId;
        }
    }

    /**
     * NEW: Try to find actual track timestamps from Archive.org metadata
     * Archive.org often has individual track files with timing info!
     */
    async findTrackTimestamps(metadata, songTitle, songPosition) {
        try {
            const files = metadata.files || [];
            
            // Look for individual track files (often have timing in metadata)
            const trackFiles = files.filter(f => 
                (f.format && f.format.includes('VBR MP3')) ||
                (f.name && f.name.match(/d\d+t\d+/i)) // Pattern like d1t08
            );
            
            // Try to find track by position (e.g., d1t08 for track 8)
            const trackPattern = new RegExp(`d\\d+t${String(songPosition).padStart(2, '0')}`, 'i');
            const matchingTrack = trackFiles.find(f => trackPattern.test(f.name));
            
            if (matchingTrack && matchingTrack.length) {
                // Found individual track file with duration!
                console.log(`Found track file: ${matchingTrack.name}, length: ${matchingTrack.length}`);
                
                // Calculate start time by summing previous tracks
                let startTime = 0;
                for (const file of trackFiles) {
                    const fileTrackNum = this.extractTrackNumber(file.name);
                    if (fileTrackNum && fileTrackNum < songPosition) {
                        startTime += parseFloat(file.length) || 0;
                    }
                }
                
                const endTime = startTime + parseFloat(matchingTrack.length);
                
                return {
                    start: startTime,
                    end: endTime,
                    duration: parseFloat(matchingTrack.length)
                };
            }
            
            // Alternative: Check if metadata has track info
            if (metadata.metadata && metadata.metadata.tracks) {
                const trackData = metadata.metadata.tracks;
                // Parse track data if available
                // This varies by archive, so we'll skip for now
            }
            
            return null; // No track info found, will use estimation
            
        } catch (error) {
            console.error('Error finding track timestamps:', error);
            return null;
        }
    }

    /**
     * Extract track number from filename (e.g., "d1t08" -> 8)
     */
    extractTrackNumber(filename) {
        const match = filename.match(/d\d+t(\d+)/i);
        return match ? parseInt(match[1]) : null;
    }

    /**
     * Fetch Archive.org metadata
     */
    async fetchArchiveMetadata(archiveId) {
        const metadataUrl = `https://archive.org/metadata/${archiveId}`;
        console.log(`Fetching metadata from: ${metadataUrl}`);
        const response = await fetch(metadataUrl);
        
        if (!response.ok) {
            throw new Error('Failed to fetch show metadata');
        }
        
        const metadata = await response.json();
        console.log(`Metadata received for identifier: ${metadata.metadata?.identifier || 'unknown'}`);
        console.log(`Metadata has ${metadata.files?.length || 0} files`);
        
        // CRITICAL FIX: Archive.org sometimes returns files from multiple versions in one metadata response
        // We need to detect the ACTUAL archiveId from the file names, not trust the metadata identifier
        if (metadata.files && metadata.files.length > 0) {
            // Look at first audio file to detect actual archive ID prefix
            const firstAudioFile = metadata.files.find(f => 
                (f.name.endsWith('.mp3') || f.name.includes('.flac')) && 
                !f.name.endsWith('.txt')
            );
            
            if (firstAudioFile) {
                // Extract base identifier from filename (e.g., "gd1981-03-14.motb.0029" from "gd1981-03-14.motb.0029.d1t01.mp3")
                // Match everything up to the .dXtYY disc/track pattern
                const match = firstAudioFile.name.match(/^(.+?)\.d\d+t\d+/i);
                if (match) {
                    const actualArchiveId = match[1];
                    if (actualArchiveId !== archiveId) {
                        console.warn(`⚠️ Archive.org returned files from DIFFERENT version!`);
                        console.warn(`   Requested: ${archiveId}`);
                        console.warn(`   Got files from: ${actualArchiveId}`);
                        console.warn(`   Using actual version for downloads...`);
                        
                        // Store the actual archive ID in metadata for download URLs
                        metadata._actualArchiveId = actualArchiveId;
                    }
                }
            }
        }
        
        return metadata;
    }

    /**
     * Find the best MP3 file from metadata
     * Prefers: VBR MP3 > MP3 > Any audio file
     */
    /**
     * Find track by counting sequentially across all discs
     * Used when track numbers don't match setlist positions
     */
    findTrackBySequentialCount(files, songPosition) {
        console.log(`Strategy 4: Counting tracks sequentially to find position ${songPosition}...`);
        
        // Get all track files sorted by disc and track number
        // FILTER OUT: crowd, tuning, banter files (usually < 3MB)
        const trackFiles = files.filter(f => {
            // Must be audio file
            if (!f.name.endsWith('.mp3') && !f.name.includes('.flac')) return false;
            
            // Must have disc/track pattern
            if (!/d\d+t\d+/i.test(f.name)) return false;
            
            // Filter out known non-song files by name
            const nameLower = f.name.toLowerCase();
            if (nameLower.includes('crowd') || 
                nameLower.includes('tuning') || 
                nameLower.includes('banter') ||
                nameLower.includes('noise')) {
                console.log(`  Skipping non-song: ${f.name}`);
                return false;
            }
            
            // Filter out tiny files (< 3MB = likely crowd/tuning)
            const sizeMB = f.size ? (f.size / 1024 / 1024) : 0;
            if (sizeMB > 0 && sizeMB < 3) {
                console.log(`  Skipping small file (${sizeMB.toFixed(1)}MB): ${f.name}`);
                return false;
            }
            
            return true;
        }).sort((a, b) => {
            // Extract disc and track numbers for sorting
            const aMatch = a.name.match(/d(\d+)t(\d+)/i);
            const bMatch = b.name.match(/d(\d+)t(\d+)/i);
            if (!aMatch || !bMatch) return 0;
            
            const aDisc = parseInt(aMatch[1]);
            const bDisc = parseInt(bMatch[1]);
            const aTrack = parseInt(aMatch[2]);
            const bTrack = parseInt(bMatch[2]);
            
            if (aDisc !== bDisc) return aDisc - bDisc;
            return aTrack - bTrack;
        });
        
        console.log(`  Found ${trackFiles.length} valid tracks (filtered out crowd/tuning)`);
        
        // Get the Nth track (songPosition - 1 because arrays are 0-indexed)
        if (trackFiles.length >= songPosition) {
            const targetTrack = trackFiles[songPosition - 1];
            if (targetTrack) {
                // Prefer MP3 version if available
                const baseName = targetTrack.name.replace(/\.(mp3|flac.*)/i, '');
                const mp3Version = files.find(f => f.name === baseName + '.mp3');
                const flacVersion = files.find(f => f.name.startsWith(baseName + '.flac'));
                
                const selectedTrack = mp3Version || flacVersion || targetTrack;
                const sizeMB = selectedTrack.size ? (selectedTrack.size / 1024 / 1024).toFixed(1) : '?';
                console.log(`✅ Strategy 4 SUCCESS: ${selectedTrack.name} (${sizeMB}MB)`);
                return selectedTrack;
            }
        }
        
        console.log(`❌ Strategy 4 FAILED: Not enough tracks (need ${songPosition}, have ${trackFiles.length})`);
        return null;
    }

    /**
     * Find individual track file (e.g., d1t08.mp3 for track 8)
     * This is the BEST case - just download the track directly!
     * Note: We search across all discs (d1, d2, d3) since we don't know which disc the song is on
     */
    findIndividualTrackFile(metadata, songTitle, songPosition, isArchiveSearchResult = false) {
        const files = metadata.files || [];
        
        console.log(`========================================`);
        console.log(`SEARCHING FOR: "${songTitle}" (position ${songPosition})`);
        console.log(`Total files in show: ${files.length}`);
        if (isArchiveSearchResult) {
            console.log(`⚠️ Archive search result - will prioritize sequential counting`);
        }
        console.log(`========================================`);
        
        // Log ALL audio files to see what's available
        const audioFiles = files.filter(f => 
            (f.name.endsWith('.mp3') || f.name.includes('.flac')) && 
            !f.name.endsWith('.txt')
        );
        console.log(`Found ${audioFiles.length} audio files:`);
        audioFiles.forEach((f, idx) => {
            const sizeMB = f.size ? (f.size / 1024 / 1024).toFixed(1) : '?';
            console.log(`  [${idx + 1}] ${f.name} (${sizeMB}MB)`);
        });
        console.log(`========================================`);
        
        // FOR ARCHIVE SEARCH RESULTS: Skip to Strategy 4 (sequential counting) immediately
        if (isArchiveSearchResult) {
            console.log(`Skipping Strategies 1-3, going straight to Strategy 4 (sequential counting)...`);
            const track = this.findTrackBySequentialCount(files, songPosition);
            if (track) return track;
            console.log(`❌ Sequential counting failed`);
            console.log(`❌ Could not find "${songTitle}" by any method`);
            return null;
        }
        
        // STRATEGY 1: Try to find by song name in filename (MOST RELIABLE!)
        console.log(`Strategy 1: Searching filenames for "${songTitle}"...`);
        const songSlug = songTitle.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // Remove special chars
            .replace(/\s+/g, ''); // Remove spaces
        
        console.log(`  Looking for slug: "${songSlug}"`);
        
        // Try MP3 files with song name
        for (const file of files) {
            if (!file.name.endsWith('.mp3')) continue;
            
            const filename = file.name.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '');
            
            if (filename.includes(songSlug)) {
                const sizeMB = file.size ? (file.size / 1024 / 1024).toFixed(1) : '?';
                console.log(`✅ Strategy 1 SUCCESS: Found by song name: ${file.name} (${sizeMB}MB)`);
                return file;
            }
        }
        
        // Try FLAC files with song name
        for (const file of files) {
            if (!file.name.includes('.flac') || file.name.endsWith('.txt')) continue;
            
            const filename = file.name.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '');
            
            if (filename.includes(songSlug)) {
                const sizeMB = file.size ? (file.size / 1024 / 1024).toFixed(1) : '?';
                console.log(`✅ Strategy 1 SUCCESS: Found by song name: ${file.name} (${sizeMB}MB)`);
                return file;
            }
        }
        
        console.log(`❌ Strategy 1 FAILED - no files with "${songTitle}" in name`);
        console.log(`========================================`);
        
        // STRATEGY 2: Try exact track number patterns
        console.log(`Strategy 2: Looking for track #${songPosition} across all discs...`);
        
        // Try multiple disc/track combinations
        // songPosition might be the overall setlist position, not the disc track number
        const trackPadded = String(songPosition).padStart(2, '0');
        
        // Search patterns: d1t08, d2t08, d3t08, d4t08, or just t08
        const patterns = [
            new RegExp(`d1t${trackPadded}`, 'i'),
            new RegExp(`d2t${trackPadded}`, 'i'),
            new RegExp(`d3t${trackPadded}`, 'i'),
            new RegExp(`d4t${trackPadded}`, 'i'),
            new RegExp(`[^d]t${trackPadded}`, 'i'), // Matches "t08" without a disc prefix
        ];
        
        // Try to find MP3 track file with any pattern
        for (const pattern of patterns) {
            const mp3Track = files.find(f => 
                f.name.endsWith('.mp3') && 
                pattern.test(f.name)
            );
            
            if (mp3Track) {
                const sizeMB = mp3Track.size ? (mp3Track.size / 1024 / 1024).toFixed(1) : '?';
                console.log(`✅ Found MP3 track file: ${mp3Track.name} (${sizeMB}MB)`);
                return mp3Track;
            }
        }
        
        // Try FLAC if no MP3 (includes .flac, .flac16, .flac24, .flac1644, etc.)
        for (const pattern of patterns) {
            const flacTrack = files.find(f => 
                (f.name.includes('.flac') && !f.name.endsWith('.txt')) &&
                pattern.test(f.name)
            );
            
            if (flacTrack) {
                const sizeMB = flacTrack.size ? (flacTrack.size / 1024 / 1024).toFixed(1) : '?';
                console.log(`✅ Found FLAC track file: ${flacTrack.name} (${sizeMB}MB)`);
                return flacTrack;
            }
        }
        
        console.log(`Strategy 2 failed - no track #${songPosition} found`);
        
        // STRATEGY 3: Try track numbers ±1 (off by one errors)
        console.log(`Strategy 3: Trying nearby track numbers (±1, ±2)...`);
        const nearbyTracks = [songPosition - 1, songPosition + 1, songPosition - 2, songPosition + 2];
        
        for (const tryTrack of nearbyTracks) {
            if (tryTrack < 1) continue;
            
            const tryPadded = String(tryTrack).padStart(2, '0');
            const tryPatterns = [
                new RegExp(`d1t${tryPadded}`, 'i'),
                new RegExp(`d2t${tryPadded}`, 'i'),
                new RegExp(`d3t${tryPadded}`, 'i'),
                new RegExp(`d4t${tryPadded}`, 'i'),
            ];
            
            for (const pattern of tryPatterns) {
                const track = files.find(f => 
                    (f.name.endsWith('.mp3') || (f.name.includes('.flac') && !f.name.endsWith('.txt'))) &&
                    pattern.test(f.name)
                );
                
                if (track) {
                    const sizeMB = track.size ? (track.size / 1024 / 1024).toFixed(1) : '?';
                    console.log(`⚠️ Found nearby track #${tryTrack}: ${track.name} (${sizeMB}MB)`);
                    console.log(`⚠️ WARNING: This might not be "${songTitle}" - track number may be off by ${Math.abs(songPosition - tryTrack)}`);
                    return track;
                }
            }
        }
        
        console.log(`Strategy 3 failed - no nearby tracks found`);
        
        // STRATEGY 4: Try to find by counting tracks sequentially across discs
        // Sometimes songPosition is the overall position in the show, not the disc track number
        console.log(`Attempting to find by counting tracks sequentially...`);
        
        // Get all track files sorted by disc and track number
        const trackFiles = files.filter(f => 
            (f.name.endsWith('.mp3') || f.name.includes('.flac')) &&
            /d\d+t\d+/i.test(f.name)
        ).sort((a, b) => {
            // Extract disc and track numbers for sorting
            const aMatch = a.name.match(/d(\d+)t(\d+)/i);
            const bMatch = b.name.match(/d(\d+)t(\d+)/i);
            if (!aMatch || !bMatch) return 0;
            
            const aDisc = parseInt(aMatch[1]);
            const bDisc = parseInt(bMatch[1]);
            const aTrack = parseInt(aMatch[2]);
            const bTrack = parseInt(bMatch[2]);
            
            if (aDisc !== bDisc) return aDisc - bDisc;
            return aTrack - bTrack;
        });
        
        // Get the Nth track (songPosition - 1 because arrays are 0-indexed)
        if (trackFiles.length >= songPosition) {
            const targetTrack = trackFiles[songPosition - 1];
            if (targetTrack) {
                // Prefer MP3 version if available
                const baseName = targetTrack.name.replace(/\.(mp3|flac.*)/i, '');
                const mp3Version = files.find(f => f.name === baseName + '.mp3');
                const flacVersion = files.find(f => f.name.startsWith(baseName + '.flac'));
                
                const selectedTrack = mp3Version || flacVersion || targetTrack;
                const sizeMB = selectedTrack.size ? (selectedTrack.size / 1024 / 1024).toFixed(1) : '?';
                console.log(`✅ Found track by sequential counting: ${selectedTrack.name} (${sizeMB}MB)`);
                return selectedTrack;
            }
        }
        
        console.log(`Strategy 4 failed - not enough tracks for sequential counting`);
        console.log(`❌ Could not find "${songTitle}" by any method`);
        return null;
    }

    findBestMP3(metadata) {
        const files = metadata.files || [];
        
        // Helper: Check if filename indicates it's an individual track
        const isTrackFile = (name) => /d\d+t\d+/i.test(name);
        
        // Helper: Get file size in MB
        const getSizeMB = (f) => f.size ? (f.size / 1024 / 1024) : 0;
        
        console.log(`Searching for audio file among ${files.length} files...`);
        
        // DEBUG: Log what audio files we actually have
        const audioFiles = files.filter(f => 
            (f.name.endsWith('.mp3') || f.name.includes('.flac')) && 
            !f.name.endsWith('.txt')
        );
        console.log(`Found ${audioFiles.length} audio files total`);
        audioFiles.forEach(f => {
            const sizeMB = getSizeMB(f).toFixed(1);
            const isTrack = isTrackFile(f.name);
            console.log(`  - ${f.name} (${sizeMB}MB) ${isTrack ? '[TRACK FILE]' : '[FULL SHOW?]'}`);
        });
        
        // PRIORITY 1: Full show MP3 (VBR preferred)
        let mp3File = files.find(f => 
            f.format === 'VBR MP3' && 
            f.name.endsWith('.mp3') &&
            !isTrackFile(f.name) &&
            getSizeMB(f) > 50 // Full shows are usually > 50MB
        );
        
        if (mp3File) {
            console.log(`✅ Found full show VBR MP3: ${mp3File.name} (${getSizeMB(mp3File).toFixed(1)}MB)`);
            return mp3File;
        }
        
        // PRIORITY 2: Any full show MP3
        mp3File = files.find(f => 
            f.name.endsWith('.mp3') &&
            !isTrackFile(f.name) &&
            getSizeMB(f) > 50
        );
        
        if (mp3File) {
            console.log(`✅ Found full show MP3: ${mp3File.name} (${getSizeMB(mp3File).toFixed(1)}MB)`);
            return mp3File;
        }
        
        // PRIORITY 3: FLAC file (Archive.org can stream these)
        // Note: Archive.org has various FLAC formats: .flac, .flac16, .flac24, .flac1644, etc.
        const flacFile = files.find(f => 
            (f.name.includes('.flac') && !f.name.endsWith('.txt')) &&
            !isTrackFile(f.name) &&
            getSizeMB(f) > 50
        );
        
        if (flacFile) {
            console.log(`✅ Found FLAC file (will stream): ${flacFile.name} (${getSizeMB(flacFile).toFixed(1)}MB)`);
            return flacFile;
        }
        
        
        // PRIORITY 5: Last resort - largest audio file > 50MB
        const largeFiles = files.filter(f => 
            ((f.name.endsWith('.mp3') || f.name.includes('.flac')) && !f.name.endsWith('.txt')) &&
            getSizeMB(f) > 50 &&
            !isTrackFile(f.name)
        );
        
        if (largeFiles.length > 0) {
            largeFiles.sort((a, b) => getSizeMB(b) - getSizeMB(a));
            const file = largeFiles[0];
            console.log(`⚠️ Using largest audio file: ${file.name} (${getSizeMB(file).toFixed(1)}MB)`);
            return file;
        }
        
        console.error('❌ No suitable full-show audio file found for extraction.');
        console.error('💡 This show may only have individual track files.');
        return null;
    }

    /**
     * Estimate timestamp for song based on setlist position
     * @param {number} songPosition - Position in setlist (1 = first song)
     * @param {number} estimatedDuration - Expected song length in minutes
     * @returns {object} - {startTime, endTime} in seconds
     */
    estimateTimestamp(songPosition, estimatedDuration) {
        // Average song lengths for jam bands
        const AVG_SONG_LENGTH = 6; // minutes
        const BUFFER_BEFORE = 1;   // minute buffer before song
        const BUFFER_AFTER = 1;    // minute buffer after song
        
        // Calculate estimated start (account for songs before this one)
        const songsBeforeDuration = (songPosition - 1) * AVG_SONG_LENGTH;
        const estimatedStart = songsBeforeDuration - BUFFER_BEFORE;
        const estimatedEnd = estimatedStart + estimatedDuration + BUFFER_BEFORE + BUFFER_AFTER;
        
        // Convert to seconds
        const startTime = Math.max(0, estimatedStart * 60);
        const endTime = estimatedEnd * 60;
        
        console.log(`Estimated window: ${startTime}s - ${endTime}s (${(endTime - startTime) / 60} mins)`);
        
        return { startTime, endTime };
    }

    /**
     * Extract audio segment using HTTP Range requests
     * This is efficient - only downloads the portion we need!
     */
    async extractAudioSegment(mp3Url, startTime, endTime, totalFileSize) {
        this.updateProgress('Downloading audio (this may take 1-3 minutes)...', 60);
        
        // IMPORTANT: We need to download the full file because:
        // 1. Archive.org doesn't reliably support Range requests
        // 2. Web Audio API needs complete MP3 to decode properly
        // 3. Browser-based processing has limitations
        
        // However, we'll add a safety check
        const estimatedDuration = (endTime - startTime) / 60; // in minutes
        if (estimatedDuration > 15) {
            console.warn(`Warning: Extracting ${estimatedDuration} minutes - this is more than expected!`);
        }
        
        // Download full show MP3
        const response = await fetch(mp3Url);
        const arrayBuffer = await response.arrayBuffer();
        
        this.updateProgress('Decoding audio (be patient)...', 70);
        
        // Decode audio (this takes time for large files)
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        
        // Calculate total duration
        const totalDuration = audioBuffer.duration;
        console.log(`Full show duration: ${(totalDuration / 60).toFixed(1)} minutes`);
        
        this.updateProgress('Extracting song segment...', 80);
        
        // Safety check: Don't extract more than 15 minutes
        const maxDuration = 15 * 60; // 15 minutes in seconds
        let adjustedEndTime = endTime;
        
        if ((endTime - startTime) > maxDuration) {
            console.warn(`Limiting extraction to 15 minutes`);
            adjustedEndTime = startTime + maxDuration;
        }
        
        // Make sure we don't go past end of show
        if (adjustedEndTime > totalDuration) {
            adjustedEndTime = totalDuration;
        }
        
        // Extract segment
        const sampleRate = audioBuffer.sampleRate;
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(adjustedEndTime * sampleRate);
        const duration = endSample - startSample;
        
        // CRITICAL SAFETY CHECK: Validate duration
        if (duration <= 0) {
            throw new Error(`Invalid extraction range: start=${startTime}s, end=${adjustedEndTime}s. Start must be before end.`);
        }
        
        if (duration > sampleRate * 60 * 20) { // Max 20 minutes
            throw new Error(`Extraction too long: ${(duration / sampleRate / 60).toFixed(1)} minutes. Maximum is 20 minutes. This usually means bad timestamp data.`);
        }
        
        console.log(`Extracting: ${(startTime / 60).toFixed(1)}min to ${(adjustedEndTime / 60).toFixed(1)}min (${(duration / sampleRate / 60).toFixed(1)}min total)`);
        
        // Create new buffer with extracted segment
        const extractedBuffer = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            duration,
            sampleRate
        );
        
        // Copy audio data
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const sourceData = audioBuffer.getChannelData(channel);
            const targetData = extractedBuffer.getChannelData(channel);
            
            for (let i = 0; i < duration; i++) {
                targetData[i] = sourceData[startSample + i];
            }
        }
        
        this.updateProgress('Creating audio file...', 90);
        
        // Convert to WAV blob
        const wavBlob = this.bufferToWave(extractedBuffer);
        
        // Log final size
        const sizeMB = (wavBlob.size / 1024 / 1024).toFixed(1);
        console.log(`Created WAV file: ${sizeMB} MB`);
        
        return wavBlob;
    }

    /**
     * Convert AudioBuffer to WAV blob
     */
    bufferToWave(audioBuffer) {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const length = audioBuffer.length * numberOfChannels * 2;
        
        const buffer = new ArrayBuffer(44 + length);
        const view = new DataView(buffer);
        
        // Write WAV header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + length, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numberOfChannels * 2, true);
        view.setUint16(32, numberOfChannels * 2, true);
        view.setUint16(34, 16, true);
        this.writeString(view, 36, 'data');
        view.setUint32(40, length, true);
        
        // Write audio data
        const offset = 44;
        const channelData = [];
        for (let i = 0; i < numberOfChannels; i++) {
            channelData.push(audioBuffer.getChannelData(i));
        }
        
        let index = 0;
        for (let i = 0; i < audioBuffer.length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
                view.setInt16(offset + index, sample * 0x7FFF, true);
                index += 2;
            }
        }
        
        return new Blob([buffer], { type: 'audio/wav' });
    }

    /**
     * Helper to write string to DataView
     */
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    /**
     * Set progress callback
     */
    onProgress(callback) {
        this.progressCallback = callback;
    }

    /**
     * Update progress
     */
    updateProgress(message, percent) {
        if (this.progressCallback) {
            this.progressCallback(message, percent);
        }
        console.log(`[${percent}%] ${message}`);
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioSplitter;
}
