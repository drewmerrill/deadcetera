// ============================================================================
// DEADCETERA - COLLABORATIVE BAND KNOWLEDGE SYSTEM
// Example: Tweezer Reprise by Phish
// ============================================================================

// Band member configuration
const bandMembers = {
    brian: { name: "Brian", role: "Lead Guitar", sings: true, harmonies: true },
    chris: { name: "Chris", role: "Bass", sings: false, harmonies: true },
    drew: { name: "Drew", role: "Rhythm Guitar", sings: true, leadVocals: true, harmonies: true },
    pierce: { name: "Pierce", role: "Keyboard", sings: true, leadVocals: true, harmonies: true },
    jay: { name: "Jay", role: "Drums", sings: false, harmonies: false }
};

// Song knowledge base structure
const songKnowledgeBase = {
    "Tweezer Reprise": {
        // Basic info
        artist: "Phish",
        
        // CHORD CHART - Google Doc Integration
        chordChart: {
            googleDocId: "YOUR_DOC_ID_HERE", // Create this in Google Docs
            editUrl: "https://docs.google.com/document/d/YOUR_DOC_ID_HERE/edit",
            viewUrl: "https://docs.google.com/document/d/YOUR_DOC_ID_HERE/view",
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/phish/tweezer-reprise-chords-1234567",
            lastUpdated: "2024-02-14",
            updatedBy: "drew",
            bandNotes: [
                "Drew: Watch the D->G transition in the main riff",
                "Brian: Solo section is 16 bars",
                "Pierce: Organ follows bass line in verse"
            ]
        },
        
        // SPOTIFY REFERENCE VERSION - Democratic Voting
        spotifyVersions: [
            {
                id: "version_1",
                title: "A Live One - 12/31/94 Boston",
                spotifyUrl: "https://open.spotify.com/track/...",
                albumCover: "https://i.scdn.co/image/...",
                duration: "3:42",
                votes: {
                    brian: true,   // ✓
                    chris: true,   // ✓
                    drew: true,    // ✓
                    pierce: false,
                    jay: true      // ✓
                },
                totalVotes: 4,
                isDefault: true,  // Majority voted - this is THE version
                addedBy: "drew",
                notes: "High energy, perfect tempo for us"
            },
            {
                id: "version_2",
                title: "12/29/18 MSG",
                spotifyUrl: "https://open.spotify.com/track/...",
                duration: "4:15",
                votes: {
                    brian: false,
                    chris: false,
                    drew: false,
                    pierce: true,  // ✓ Pierce prefers this
                    jay: false
                },
                totalVotes: 1,
                isDefault: false,
                addedBy: "pierce",
                notes: "Slower, more groove-oriented"
            }
        ],
        
        // PRACTICE TRACKS - By instrument
        practiceTracks: {
            bass: [
                {
                    title: "Tweezer Reprise - No Bass Backing Track",
                    youtubeUrl: "https://youtube.com/watch?v=...",
                    uploadedBy: "drew",
                    dateAdded: "2024-02-10",
                    tempo: 138,
                    notes: "Created from A Live One version",
                    quality: "Good - clean isolation"
                }
            ],
            leadGuitar: [
                {
                    title: "Tweezer Reprise - Rhythm Only",
                    youtubeUrl: "https://youtube.com/watch?v=...",
                    uploadedBy: "chris",
                    dateAdded: "2024-02-11",
                    notes: "For practicing Trey's solo section"
                }
            ],
            rhythmGuitar: [],  // Empty - can add
            keys: [],
            drums: [
                {
                    title: "Tweezer Reprise - No Drums",
                    youtubeUrl: "https://youtube.com/watch?v=...",
                    uploadedBy: "brian",
                    dateAdded: "2024-02-12",
                    notes: "Practice with just bass and guitars"
                }
            ]
        },
        
        // MOISES STEMS - Pre-separated parts from reference version
        moisesParts: {
            sourceVersion: "A Live One - 12/31/94",
            googleDriveFolder: "https://drive.google.com/drive/folders/YOUR_FOLDER_ID",
            stems: {
                bass: {
                    url: "https://drive.google.com/file/d/.../bass.mp3",
                    size: "8.2 MB",
                    duration: "3:42"
                },
                drums: {
                    url: "https://drive.google.com/file/d/.../drums.mp3",
                    size: "7.8 MB",
                    duration: "3:42"
                },
                guitar: {
                    url: "https://drive.google.com/file/d/.../guitar.mp3",
                    size: "6.9 MB",
                    duration: "3:42"
                },
                keys: {
                    url: "https://drive.google.com/file/d/.../keys.mp3",
                    size: "5.4 MB",
                    duration: "3:42"
                },
                vocals: {
                    url: "https://drive.google.com/file/d/.../vocals.mp3",
                    size: "4.1 MB",
                    duration: "3:42"
                }
            },
            uploadedBy: "drew",
            dateCreated: "2024-02-13",
            notes: "All stems from voted reference - download what you need!"
        },
        
        // HARMONY PARTS - Critical tracking!
        harmonies: {
            sections: [
                {
                    id: "harmony_1",
                    lyric: "Won't you step into the freezer",
                    timing: "Verse 1 (0:15-0:22)",
                    parts: [
                        {
                            singer: "drew",
                            part: "lead",
                            notes: "Main melody, stay on root"
                        },
                        {
                            singer: "pierce",
                            part: "harmony_high",
                            notes: "Third above on 'freezer', come in strong"
                        },
                        {
                            singer: "brian",
                            part: "harmony_low",
                            notes: "Fifth below, only on last word"
                        },
                        {
                            singer: "chris",
                            part: "doubling",
                            notes: "Double Drew's lead softly for thickness"
                        }
                    ],
                    referenceRecording: "https://drive.google.com/.../harmony_verse1.mp3",
                    practiceNotes: [
                        "Brian tends to come in early - wait for 'freeze'",
                        "Pierce and Drew rehearse this separately first",
                        "All: Watch Jay's hi-hat for timing cue"
                    ],
                    workedOut: true,
                    soundsGood: true
                },
                {
                    id: "harmony_2",
                    lyric: "Tweezer, Tweezer, Tweezer",
                    timing: "Outro (3:15-3:35)",
                    parts: [
                        {
                            singer: "drew",
                            part: "lead",
                            notes: "Shout it out, high energy"
                        },
                        {
                            singer: "pierce",
                            part: "harmony_high",
                            notes: "Octave up, alternate with Drew (call/response)"
                        },
                        {
                            singer: "brian",
                            part: "harmony_mid",
                            notes: "Fill between Drew and Pierce"
                        },
                        {
                            singer: "chris",
                            part: "harmony_low",
                            notes: "Bass note singing, anchor the bottom"
                        }
                    ],
                    referenceRecording: "https://drive.google.com/.../harmony_outro.mp3",
                    practiceNotes: [
                        "This is chaotic - embrace it!",
                        "Pierce: Don't overpower, blend with Brian",
                        "Chris: You're holding down the fort here"
                    ],
                    workedOut: false,  // Still needs work!
                    soundsGood: false,
                    issuesNoted: "Timing is still rough, needs dedicated practice"
                }
            ],
            generalNotes: [
                "Tweezer Reprise is all about energy - harmonies should be LOUD",
                "Don't worry about perfection, go for the vibe",
                "Jay: Give strong visual cues for harmony entrances"
            ]
        },
        
        // SONG STRUCTURE & NOTES
        structure: {
            tempo: 138,
            key: "D major",
            timeSignature: "4/4",
            form: "Intro (8) - Verse (16) - Chorus (8) - Solo (16) - Verse (16) - Chorus (8) - Outro (16)",
            sections: [
                {
                    name: "Intro",
                    bars: 8,
                    notes: "Heavy guitar riff, drums build",
                    cues: "Jay counts in with sticks"
                },
                {
                    name: "Verse 1",
                    bars: 16,
                    vocals: "drew",
                    notes: "Drew sings lead, harmonies on 'freezer'",
                    cues: "Chris hits root note hard on downbeat"
                },
                {
                    name: "Chorus",
                    bars: 8,
                    vocals: "drew + pierce",
                    notes: "Everyone joins vocally",
                    cues: "Watch Brian for return to verse"
                },
                {
                    name: "Solo",
                    bars: 16,
                    soloist: "brian",
                    notes: "Brian takes lead, rhythm stays locked",
                    cues: "Brian will nod to end solo"
                },
                {
                    name: "Verse 2",
                    bars: 16,
                    vocals: "pierce",
                    notes: "Pierce takes lead this time, Drew harmonizes",
                    cues: "Pierce steps to center mic"
                },
                {
                    name: "Outro",
                    bars: 16,
                    vocals: "everyone",
                    notes: "Chaotic 'Tweezer' chants, build to ending",
                    cues: "Jay gives cut-off signal"
                }
            ],
            keyChanges: [],
            tempoChanges: [
                {
                    section: "Solo",
                    note: "Jay tends to rush here - pull back slightly"
                }
            ]
        },
        
        // REHEARSAL NOTES - Chronological band feedback
        rehearsalNotes: [
            {
                date: "2024-02-14",
                author: "drew",
                note: "Overall timing is good, but harmony in outro needs work. Let's run that section 5x next practice.",
                priority: "high"
            },
            {
                date: "2024-02-13",
                author: "brian",
                note: "Solo section feels good but Drew and Chris should lock tighter on the rhythm during my solo.",
                priority: "medium"
            },
            {
                date: "2024-02-12",
                author: "pierce",
                note: "Organ part is solid but I need to be louder in the mix during chorus. Jay - can you pull back on cymbals?",
                priority: "medium"
            },
            {
                date: "2024-02-11",
                author: "chris",
                note: "Nailing the bass line but rushing in the intro. Need to lock with Jay's kick drum better.",
                priority: "high"
            },
            {
                date: "2024-02-10",
                author: "jay",
                note: "Tempo feels right at 138 BPM. Let's stick with that. Also, working on visual cues for harmony entrances.",
                priority: "low"
            }
        ],
        
        // GIG NOTES - Performance tips
        gigNotes: [
            "HIGH ENERGY song - this is a crowd pleaser!",
            "Jay counts in: 1-2-3-4 with sticks",
            "Watch Brian for solo length - he'll nod when done",
            "Outro can extend if crowd is into it - Jay controls length",
            "Hard stop on final downbeat - everyone watch Jay",
            "This comes right after Tweezer in setlist typically"
        ],
        
        // PERFORMANCE HISTORY
        performances: [
            {
                date: "2024-02-08",
                venue: "Band Practice",
                recording: "https://drive.google.com/.../practice_020824.mp3",
                notes: "First full run-through. Tempo good, harmonies rough.",
                ratings: {
                    tight: 6,
                    energy: 8,
                    harmonies: 4,
                    overall: 6
                },
                feedback: [
                    "Brian: Solo was fun but need more rehearsal",
                    "Drew: Vocals felt good except outro",
                    "Jay: Timing solid, need to watch rushing"
                ]
            }
        ],
        
        // QUICK LINKS
        quickLinks: {
            setlistFM: "https://www.setlist.fm/stats/songs/phish-bd6ad4a.html?song=Tweezer+Reprise",
            phishNet: "https://phish.net/song/tweezer-reprise",
            youtube: "https://www.youtube.com/results?search_query=phish+tweezer+reprise",
            reddit: "https://www.reddit.com/r/phish/search/?q=tweezer%20reprise"
        }
    }
};

// Helper function to calculate voting winner
function getDefaultSpotifyVersion(songData) {
    const versions = songData.spotifyVersions;
    const totalMembers = Object.keys(bandMembers).length;
    const majority = Math.ceil(totalMembers / 2);
    
    // Find version with most votes
    const sorted = versions.sort((a, b) => b.totalVotes - a.totalVotes);
    
    if (sorted[0].totalVotes >= majority) {
        return sorted[0];
    }
    
    return null; // No consensus yet
}

// Helper function to get practice tracks by member
function getPracticeTracksForMember(songData, memberName) {
    const member = bandMembers[memberName.toLowerCase()];
    if (!member) return [];
    
    const role = member.role.toLowerCase();
    const tracks = songData.practiceTracks;
    
    // Map role to track categories
    if (role.includes('bass')) return tracks.bass || [];
    if (role.includes('lead guitar')) return tracks.leadGuitar || [];
    if (role.includes('rhythm guitar')) return tracks.rhythmGuitar || [];
    if (role.includes('keyboard')) return tracks.keys || [];
    if (role.includes('drums')) return tracks.drums || [];
    
    return [];
}

// Helper function to get harmony parts for member
function getHarmonyPartsForMember(songData, memberName) {
    const harmonySections = songData.harmonies.sections;
    const memberParts = [];
    
    harmonySections.forEach(section => {
        const memberPart = section.parts.find(p => 
            p.singer.toLowerCase() === memberName.toLowerCase()
        );
        
        if (memberPart) {
            memberParts.push({
                lyric: section.lyric,
                timing: section.timing,
                part: memberPart.part,
                notes: memberPart.notes,
                reference: section.referenceRecording,
                practiceNotes: section.practiceNotes
            });
        }
    });
    
    return memberParts;
}

// Export for use in main app
module.exports = {
    songKnowledgeBase,
    bandMembers,
    getDefaultSpotifyVersion,
    getPracticeTracksForMember,
    getHarmonyPartsForMember
};
