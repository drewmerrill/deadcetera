// ============================================================================
// DEADCETERA APP - Main Application Logic
// ============================================================================
// This file handles rendering and interaction. You shouldn't need to edit this.
// To add songs, edit songs-data.js instead!
// ============================================================================

function renderSongList() {
    const songList = document.getElementById('songList');
    songList.innerHTML = songs.map(song => `
        <div class="song-card" onclick="showSongDetails('${song.id}')">
            <div class="song-title">${song.title}</div>
            <div class="song-meta">Key: ${song.key}</div>
            <div class="song-meta">${song.capo || 'No capo'}</div>
        </div>
    `).join('');
}

function showSongDetails(songId) {
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    const detailsContent = document.getElementById('detailsContent');
    
    detailsContent.innerHTML = `
        <h1 style="color: #e74c3c; margin-bottom: 20px;">${song.title}</h1>
        <div style="display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap;">
            <div><strong>Key:</strong> ${song.key}</div>
            <div><strong>Capo:</strong> ${song.capo}</div>
            <div><strong>Tempo:</strong> ${song.tempo}</div>
        </div>

        <div class="tools-section">
            <h3 style="color: #2ecc71; margin-bottom: 15px;">🎵 Practice Tools</h3>
            <p style="margin-bottom: 15px;">Use these tools to isolate and practice individual parts:</p>
            <a href="https://moises.ai/" target="_blank" class="tool-button">
                🎛️ Open Moises.ai - Separate Stems
            </a>
            <a href="https://moises.ai/tools/vocals-remover" target="_blank" class="tool-button">
                🎤 Isolate Vocals Only
            </a>
            <a href="https://moises.ai/tools/guitar-remover" target="_blank" class="tool-button">
                🎸 Isolate Guitar Parts
            </a>
            <div class="tip" style="margin-top: 15px;">
                <strong>How to use:</strong> Upload your recording of "${song.title}" to Moises.ai, and it will separate the vocals, guitar, bass, and drums into individual tracks. Perfect for learning Bob's exact guitar parts or isolating the harmony vocals!
            </div>
            ${song.archiveReferences ? `
                <h4 style="color: #3498db; margin-top: 20px; margin-bottom: 10px;">📼 Recommended Reference Recordings:</h4>
                ${song.archiveReferences.map(ref => `
                    <div style="margin: 10px 0;">
                        <a href="${ref.url}" target="_blank" style="color: #3498db; text-decoration: none;">
                            📻 ${ref.venue} (${ref.date})
                        </a>
                        <div style="color: #95a5a6; font-size: 0.9em; margin-left: 20px;">${ref.notes}</div>
                    </div>
                `).join('')}
            ` : ''}
        </div>

        <div class="section">
            <h2>🎸 Bob Weir's Guitar Part</h2>
            <p>${song.guitarNotes.overview}</p>
            
            <h3>Chord Progression</h3>
            ${song.guitarNotes.chordProgression.map(prog => 
                `<div class="chord-line">${prog}</div>`
            ).join('')}
            
            <h3>Rhythm Pattern</h3>
            <div class="tip">${song.guitarNotes.rhythmPattern}</div>
            
            <h3>Key Techniques</h3>
            <ul>
                ${song.guitarNotes.techniques.map(tech => `<li>${tech}</li>`).join('')}
            </ul>
            
            <h3>Weir-isms (Bob's specific style notes)</h3>
            <ul>
                ${song.guitarNotes.weirTips.map(tip => `<li>${tip}</li>`).join('')}
            </ul>
        </div>

        <div class="section">
            <h2>🎤 Vocal Harmonies</h2>
            <p>${song.harmonyNotes.overview}</p>
            
            ${song.harmonyNotes.vocals.map(vocal => `
                <div class="harmony-part">
                    <strong>${vocal.part}</strong><br>
                    <strong>Lead:</strong> ${vocal.lead}<br>
                    <strong>Harmony:</strong> ${vocal.harmony}<br>
                    <em>${vocal.notes}</em>
                </div>
            `).join('')}
            
            <h3>Harmonization Tips</h3>
            <ul>
                ${song.harmonyNotes.harmonizationTips.map(tip => `<li>${tip}</li>`).join('')}
            </ul>
            
            <div class="tip">
                <strong>Vocal Range:</strong> ${song.harmonyNotes.vocalRange}
            </div>
        </div>

        ${song.harmonyNotation ? `
        <div class="section">
            <h2>🎼 Harmony Notation</h2>
            <p style="margin-bottom: 20px;">${song.harmonyNotation.notes}</p>
            
            <div class="harmony-notation">
                <div class="notation-label">Verse Example: "${song.harmonyNotation.verse.lyrics}"</div>
                <div class="notation-container">
                    <div class="notation-staff">Lead (Jerry):    ${song.harmonyNotation.verse.lead}</div>
                    <div class="notation-staff">Harmony (Bob):  ${song.harmonyNotation.verse.bobHarmony}</div>
                    <div style="color: #95a5a6; margin-top: 10px; font-size: 0.9em;">Interval: ${song.harmonyNotation.verse.interval}</div>
                </div>
            </div>

            <div class="harmony-notation">
                <div class="notation-label">Chorus: "${song.harmonyNotation.chorus.lyrics}"</div>
                <div class="notation-container">
                    <div class="notation-staff">Lead (Jerry):    ${song.harmonyNotation.chorus.lead}</div>
                    <div class="notation-staff">Harmony (Bob):  ${song.harmonyNotation.chorus.bobHarmony}</div>
                    <div style="color: #95a5a6; margin-top: 10px; font-size: 0.9em;">Interval: ${song.harmonyNotation.chorus.interval}</div>
                </div>
            </div>

            <div class="tip">
                <strong>Practice Tip:</strong> Sing through these note patterns slowly, then match them to the lyrics. Use a piano or guitar to find the starting pitches. The actual Dead recordings have more rhythmic freedom, but these melodic contours will get you in the ballpark!
            </div>
        </div>
        ` : ''}
    `;

    document.getElementById('songList').style.display = 'none';
    document.getElementById('songDetails').classList.add('active');
    window.scrollTo(0, 0);
}

function showSongList() {
    document.getElementById('songList').style.display = 'grid';
    document.getElementById('songDetails').classList.remove('active');
    window.scrollTo(0, 0);
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', function() {
    renderSongList();
});
