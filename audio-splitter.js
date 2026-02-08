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
    async extractSongFromArchive(archiveId, songTitle, songPosition, estimatedDuration = 7) {
        try {
            // Step 1: Search for best version if archiveId is simplified (e.g., "gd1981-03-14")
            this.updateProgress('Finding best show version...', 5);
            const bestArchiveId = await this.findBestArchiveVersion(archiveId);
            
            // Step 2: Get Archive.org metadata for best version
            this.updateProgress('Fetching show metadata...', 10);
            const metadata = await this.fetchArchiveMetadata(bestArchiveId);
            
            // Step 3: Find MP3 file
            this.updateProgress('Finding audio file...', 20);
            const mp3File = this.findBestMP3(metadata);
            
            if (!mp3File) {
                throw new Error('No MP3 file found for this show');
            }

            // Step 4: Try to get REAL track timestamps from Archive.org
            this.updateProgress('Looking for track timestamps...', 30);
            const trackInfo = await this.findTrackTimestamps(metadata, songTitle, songPosition);
            
            let startTime, endTime;
            
            if (trackInfo && trackInfo.start !== null) {
                // We found real timestamps!
                this.updateProgress('Using real track data...', 35);
                startTime = trackInfo.start;
                endTime = trackInfo.end || (startTime + (estimatedDuration * 60));
                console.log(`✅ Found real timestamps: ${(startTime/60).toFixed(1)}min - ${(endTime/60).toFixed(1)}min`);
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
                throw new Error(`End time (${endTime}s) must be after start time (${startTime}s). Cannot extract audio.`);
            }
            
            if ((endTime - startTime) > 1200) { // 20 minutes max
                throw new Error(`Extraction too long: ${((endTime - startTime)/60).toFixed(1)} minutes. Maximum is 20 minutes. This usually means bad timestamp data.`);
            }

            // Step 5: Fetch and extract audio segment
            this.updateProgress('Downloading audio segment...', 40);
            const mp3Url = `https://archive.org/download/${bestArchiveId}/${mp3File.name}`;
            
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
            
            // Scoring system to find best version:
            // Priority 1: Has individual track files (look for multiple files)
            // Priority 2: Soundboard (SBD) > Audience (AUD)
            // Priority 3: Higher download count = better quality
            
            let bestVersion = null;
            let bestScore = -1;
            
            for (const version of versions) {
                let score = 0;
                const id = version.identifier;
                
                // Check if this version likely has individual tracks
                // (we'll verify this when we fetch metadata)
                if (id.includes('sbd') || id.includes('soundboard')) {
                    score += 50; // SBD quality
                }
                
                if (id.includes('flac')) {
                    score += 30; // FLAC format
                }
                
                if (id.includes('mp3') || id.includes('vbr')) {
                    score += 20; // MP3 available
                }
                
                // Download count (popularity = usually better quality)
                const downloads = parseInt(version.downloads) || 0;
                score += Math.min(downloads / 100, 100); // Cap at 100 points
                
                console.log(`Version: ${id.substring(0, 50)}... Score: ${score}`);
                
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
        const response = await fetch(metadataUrl);
        
        if (!response.ok) {
            throw new Error('Failed to fetch show metadata');
        }
        
        return await response.json();
    }

    /**
     * Find the best MP3 file from metadata
     * Prefers: VBR MP3 > MP3 > Any audio file
     */
    findBestMP3(metadata) {
        const files = metadata.files || [];
        
        // Try to find VBR MP3 (usually best quality)
        let mp3File = files.find(f => 
            f.format === 'VBR MP3' && 
            f.name.endsWith('.mp3')
        );
        
        // Fallback to regular MP3
        if (!mp3File) {
            mp3File = files.find(f => 
                f.format === 'MP3' || 
                f.name.endsWith('.mp3')
            );
        }
        
        // Last resort: any audio file
        if (!mp3File) {
            mp3File = files.find(f => 
                f.format && 
                (f.format.includes('MP3') || f.format.includes('Audio'))
            );
        }
        
        return mp3File;
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
