// ============================================================================
// DEADCETERA SONG DATABASE
// ============================================================================
// 
// HOW TO ADD A NEW SONG:
// 1. Copy the song template at the bottom of this file
// 2. Fill in all the sections with your song's info
// 3. Add it to the songs array below
// 4. Save this file
// 5. Commit and push to GitHub (your site updates automatically!)
//
// ============================================================================

const songs = [
    {
        id: 'friend-of-the-devil',
        title: 'Friend of the Devil',
        key: 'G Major',
        capo: 'Capo 2 (sounds in A)',
        tempo: '~140 BPM',
        
        guitarNotes: {
            overview: "Bob's part is all about that driving Travis-picking style fingerpicking pattern mixed with strategic strumming. This is classic Bob - creating a full rhythmic foundation while Jerry plays lead.",
            
            chordProgression: [
                "Verse: G - D - Em - C - G - D - C",
                "Chorus: G - C - G - D - G - C - D"
            ],
            
            rhythmPattern: "Travis picking pattern on verses (thumb alternates bass notes while fingers pick higher strings). Switch to gentle strumming on chorus with emphasis on downbeats.",
            
            techniques: [
                "Use your thumb for bass notes on beats 1 and 3",
                "Fingers pluck the higher strings on off-beats creating that galloping feel",
                "Keep your right hand loose - this song needs to breathe",
                "On the D chord, emphasize the bass walk-down: D-C-B-A",
                "The intro is just G and D with the picking pattern - let it establish the groove"
            ],
            
            weirTips: [
                "Bob often throws in hammer-ons on the G chord (open to 2nd fret on the A string)",
                "Don't overplay - the spaces between notes are as important as the notes",
                "Watch live versions - Bob sometimes adds little chromatic runs between chords"
            ]
        },
        
        harmonyNotes: {
            overview: "This is primarily a Garcia lead vocal with simple but effective harmony parts. The harmonies are supportive rather than complex.",
            
            vocals: [
                {
                    part: "Verses",
                    lead: "Jerry (main melody)",
                    harmony: "Bob comes in on certain lines with harmony a third above, particularly on 'I ran into the devil, babe' and 'He loaned me twenty bills'",
                    notes: "Keep the harmony subtle and conversational - it's not a big gospel harmony, more like two guys telling a story"
                },
                {
                    part: "Chorus ('Got two reasons why I cry')",
                    lead: "Jerry",
                    harmony: "Bob harmonizes throughout the chorus, mostly a third above",
                    notes: "This is where the harmony really shines - lock in tight with the lead. The harmony should lift the chorus without overpowering"
                },
                {
                    part: "Bridge/Outro ('Set out runnin' but I take my time')",
                    lead: "Jerry",
                    harmony: "Bob joins with harmony, occasionally Phil adds a low part",
                    notes: "Three-part harmony here if you have the voices. Bob high, Jerry middle, bass voice low"
                }
            ],
            
            harmonizationTips: [
                "The melody sits in a comfortable range - harmony should be relaxed, not strained",
                "Match Jerry's phrasing and breathing - harmony breathes with the lead",
                "On 'devil' and 'level,' the harmony can sustain while lead decorates",
                "Listen to Europe '72 version for clear harmony reference"
            ],
            
            vocalRange: "Lead melody sits around middle C to D above middle C. Harmony comfortable for tenor range."
        },
        
        harmonyNotation: {
            verse: {
                lyrics: "I lit out from Reno, I was trailed by twenty hounds",
                lead: "G - G - A - B - B - A - G - E - D - D - E - D",
                bobHarmony: "B - B - C - D - D - C - B - G - F# - F# - G - F#",
                interval: "Third above (mostly)"
            },
            chorus: {
                lyrics: "Got two reasons why I cry away each lonely night",
                lead: "D - D - E - F# - G - G - F# - E - D - B - A - G",
                bobHarmony: "F# - F# - G - A - B - B - A - G - F# - D - C - B",
                interval: "Third above throughout"
            },
            notes: "These are simplified melodic contours showing the basic pitch movement. Actual performance includes slides, grace notes, and rhythmic variations typical of the Dead's loose, improvisational style."
        },
        
        archiveReferences: [
            {
                venue: "Europe '72 (album version)",
                date: "1972",
                url: "https://archive.org/details/gd1972-04-08.sbd.miller.97143.sbeok.flac16",
                notes: "Crystal clear harmonies, great reference for vocal parts"
            },
            {
                venue: "Barton Hall, Cornell",
                date: "May 8, 1977",
                url: "https://archive.org/details/gd77-05-08.sbd.hicks.4982.sbeok.shnf",
                notes: "Excellent sound quality for studying Bob's guitar work"
            }
        ]
    }
    
    // ADD MORE SONGS HERE!
    // Just copy the template below, fill it in, and paste it here
    
];

// ============================================================================
// SONG TEMPLATE - Copy this to add a new song!
// ============================================================================
/*

{
    id: 'song-name-lowercase-with-hyphens',
    title: 'Song Title',
    key: 'Key signature (e.g., D Major, A Minor)',
    capo: 'Capo position or "No capo"',
    tempo: '~BPM number',
    
    guitarNotes: {
        overview: "General description of Bob's guitar part and approach",
        
        chordProgression: [
            "Verse: Chords here",
            "Chorus: Chords here",
            "Bridge: Chords here (if applicable)"
        ],
        
        rhythmPattern: "Description of strumming or picking pattern",
        
        techniques: [
            "Technique tip 1",
            "Technique tip 2",
            "Technique tip 3"
        ],
        
        weirTips: [
            "Bob-specific style note 1",
            "Bob-specific style note 2"
        ]
    },
    
    harmonyNotes: {
        overview: "General overview of harmony arrangement",
        
        vocals: [
            {
                part: "Section name (Verse, Chorus, etc.)",
                lead: "Who sings lead",
                harmony: "Description of harmony parts",
                notes: "Tips for executing this section"
            }
            // Add more sections as needed
        ],
        
        harmonizationTips: [
            "Harmony tip 1",
            "Harmony tip 2"
        ],
        
        vocalRange: "Description of vocal ranges needed"
    },
    
    harmonyNotation: {
        verse: {
            lyrics: "Sample lyrics from verse",
            lead: "Note progression for lead (e.g., G - A - B - C)",
            bobHarmony: "Note progression for Bob's harmony",
            interval: "Interval relationship (e.g., Third above)"
        },
        chorus: {
            lyrics: "Sample lyrics from chorus",
            lead: "Note progression for lead",
            bobHarmony: "Note progression for Bob's harmony",
            interval: "Interval relationship"
        },
        notes: "Additional notes about the notation"
    },
    
    archiveReferences: [
        {
            venue: "Concert venue or album name",
            date: "Date",
            url: "https://archive.org/details/...",
            notes: "Why this recording is useful"
        }
        // Add more reference recordings as needed
    ]
}

*/
