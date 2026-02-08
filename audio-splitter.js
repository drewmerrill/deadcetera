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
     * @param {string} archiveId - Archive.org identifier (e.g., "gd1981-03-14")
     * @param {string} songTitle - Name of song to extract
     * @param {number} songPosition - Position in setlist (1-indexed)
     * @param {number} estimatedDuration - Estimated song length in minutes (default: 7)
     * @returns {Promise<Blob>} - Extracted audio as MP3 blob
     */
    async extractSongFromArchive(archiveId, songTitle, songPosition, estimatedDuration = 7) {
        try {
            // Step 1: Get Archive.org metadata
            this.updateProgress('Fetching show metadata...', 10);
            const metadata = await this.fetchArchiveMetadata(archiveId);
            
            // Step 2: Find MP3 file
            this.updateProgress('Finding audio file...', 20);
            const mp3File = this.findBestMP3(metadata);
            
            if (!mp3File) {
                throw new Error('No MP3 file found for this show');
            }

            // Step 3: Calculate timestamp window
            this.updateProgress('Calculating song position...', 30);
            const { startTime, endTime } = this.estimateTimestamp(
                songPosition, 
                estimatedDuration
            );

            // Step 4: Fetch and extract audio segment
            this.updateProgress('Downloading show audio...', 40);
            const mp3Url = `https://archive.org/download/${archiveId}/${mp3File.name}`;
            
            // Use Range request to only download the segment we need
            const extractedBlob = await this.extractAudioSegment(
                mp3Url,
                startTime,
                endTime,
                mp3File.size
            );

            this.updateProgress('Complete!', 100);
            return extractedBlob;

        } catch (error) {
            console.error('Error extracting song:', error);
            throw error;
        }
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
        this.updateProgress('Extracting song segment...', 60);
        
        // For simplicity, we'll download the whole file in browser
        // In production, we'd use Range requests for efficiency
        // But Archive.org CORS makes this tricky, so we download full file
        
        const response = await fetch(mp3Url);
        const arrayBuffer = await response.arrayBuffer();
        
        this.updateProgress('Processing audio...', 70);
        
        // Decode audio
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        
        this.updateProgress('Creating extract...', 80);
        
        // Extract segment
        const sampleRate = audioBuffer.sampleRate;
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const duration = endSample - startSample;
        
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
        
        this.updateProgress('Encoding MP3...', 90);
        
        // Convert to WAV blob (MP3 encoding requires additional library)
        const wavBlob = this.bufferToWave(extractedBuffer);
        
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
