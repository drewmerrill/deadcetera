// ============================================================================
// ENHANCED DEADCETERA DATA - MUSICIAN FEATURES
// ============================================================================
// Added: BPM, Key, Difficulty, Practice Notes, Chords/Tabs Links, Relisten Links
// ============================================================================

// EXAMPLE ENHANCED STRUCTURE - Shows what we're adding to each version:
const enhancedTop5Database = {
    "Althea": [
        {
            rank: 1,
            venue: "Hartford Civic Center, Hartford CT",
            date: "March 14, 1981",
            archiveId: "gd1981-03-14",
            notes: "The Hartford Althea - legendary version, perfect Garcia solo",
            trackNumber: "08",
            quality: "SBD",
            
            // NEW FIELDS FOR MUSICIANS:
            bpm: 128,
            key: "E minor",
            length: "9:47",
            difficulty: 2, // 1=Beginner, 2=Intermediate, 3=Advanced
            practiceNotes: "Perfect for learning Jerry's melodic soloing style. Extended outro jam showcases his signature tone.",
            features: ["Extended outro jam", "Peak Jerry tone", "Classic 1981 sound"],
            
            // RESOURCE LINKS:
            relistenLink: "https://relisten.net/grateful-dead/1981/03/14/althea",
            headyversionLink: "https://www.headyversion.com/song/6/grateful-dead/althea/",
            chordsLink: "https://www.rukind.com/gdead/lyrics/althea.html",
            tabsLink: "https://tabs.ultimate-guitar.com/tab/grateful-dead/althea-tabs-134567"
        },
        {
            rank: 2,
            venue: "Deer Creek Music Center, Noblesville IN",
            date: "July 19, 1990",
            archiveId: "gd1990-07-19",
            notes: "Without a Net album version - hot energy, great interplay",
            trackNumber: "05",
            quality: "SBD",
            
            bpm: 132,
            key: "E minor",
            length: "8:23",
            difficulty: 2,
            practiceNotes: "Faster tempo, great for working on speed. Official album version means excellent audio quality.",
            features: ["Without a Net album", "Fast tempo", "Hot energy"],
            
            relistenLink: "https://relisten.net/grateful-dead/1990/07/19/althea",
            headyversionLink: "https://www.headyversion.com/song/6/grateful-dead/althea/",
            chordsLink: "https://www.rukind.com/gdead/lyrics/althea.html",
            tabsLink: "https://tabs.ultimate-guitar.com/tab/grateful-dead/althea-tabs-134567"
        },
        {
            rank: 3,
            venue: "Boston Garden, Boston MA",
            date: "October 1, 1994",
            archiveId: "gd1994-10-01",
            notes: "Scorching late version - Jerry's got swagger",
            trackNumber: "06",
            quality: "SBD",
            
            bpm: 125,
            key: "E minor",
            length: "10:12",
            difficulty: 2,
            practiceNotes: "Later-era Jerry tone. Slightly slower but more exploratory jam sections.",
            features: ["Late-era tone", "Extended exploration", "1994 swagger"],
            
            relistenLink: "https://relisten.net/grateful-dead/1994/10/01/althea",
            headyversionLink: "https://www.headyversion.com/song/6/grateful-dead/althea/",
            chordsLink: "https://www.rukind.com/gdead/lyrics/althea.html",
            tabsLink: "https://tabs.ultimate-guitar.com/tab/grateful-dead/althea-tabs-134567"
        }
    ],
    
    "Scarlet Begonias": [
        {
            rank: 1,
            venue: "Cornell University, Ithaca NY",
            date: "May 8, 1977",
            archiveId: "gd1977-05-08",
            notes: "From the legendary Cornell '77 show - pristine SBD",
            trackNumber: "08",
            quality: "SBD",
            
            bpm: 135,
            key: "G major",
            length: "11:12",
            difficulty: 2,
            practiceNotes: "Classic reggae-rock groove. Perfect for learning the iconic rhythm guitar parts.",
            features: ["Cornell '77", "Pristine audio", "Peak Dead era"],
            
            relistenLink: "https://relisten.net/grateful-dead/1977/05/08/scarlet-begonias",
            headyversionLink: "https://www.headyversion.com/song/196/grateful-dead/scarlet-begonias/",
            chordsLink: "https://www.rukind.com/gdead/lyrics/scarlet.html",
            tabsLink: "https://tabs.ultimate-guitar.com/tab/grateful-dead/scarlet-begonias-chords-65442"
        }
    ],
    
    "You Enjoy Myself": [
        {
            rank: 1,
            venue: "UIC Pavilion, Chicago IL",
            date: "August 13, 1993",
            archiveId: "phish1993-08-13",
            notes: "One of the greatest YEMs ever - 23+ minutes of bliss",
            trackNumber: "10",
            quality: "SBD",
            
            bpm: 142,
            key: "D major / Multiple",
            length: "23:47",
            difficulty: 3,
            practiceNotes: "Advanced - Multiple sections with different time signatures. The vocal jam is in 7/4. Essential Phish.",
            features: ["23+ minute epic", "Complex time signatures", "Vocal jam section"],
            
            relistenLink: "https://relisten.net/phish/1993/08/13/you-enjoy-myself",
            phishnetLink: "https://phish.net/song/you-enjoy-myself/history",
            chordsLink: "https://tabs.ultimate-guitar.com/tab/phish/you-enjoy-myself-chords-1059827",
            tabsLink: "https://tabs.ultimate-guitar.com/tab/phish/you-enjoy-myself-tabs-1059828"
        }
    ],
    
    "Porch Song": [
        {
            rank: 1,
            venue: "Oak Mountain Amphitheatre, Pelham AL",
            date: "July 31, 2011",
            archiveId: "wsp2011-07-31",
            notes: "Epic 15+ minute version with extended JoJo Hermann keys solo",
            trackNumber: "05",
            quality: "SBD",
            
            bpm: 98,
            key: "G major",
            length: "15:23",
            difficulty: 2,
            practiceNotes: "Mid-tempo groove. Great for learning the Panic pocket and JoJo's organ style.",
            features: ["Extended keys solo", "Classic Panic groove", "15+ minutes"],
            
            relistenLink: "https://relisten.net/widespread-panic/2011/07/31/porch-song",
            panicstreamLink: "https://www.panicstream.com/vault/widespread-panic/",
            chordsLink: "https://tabs.ultimate-guitar.com/tab/widespread-panic/porch-song-chords-1234567",
            tabsLink: "https://tabs.ultimate-guitar.com/tab/widespread-panic/porch-song-tabs-1234567"
        }
    ]
};

// ============================================================================
// RESOURCE LINK TEMPLATES BY BAND
// ============================================================================

const resourceLinks = {
    "Grateful Dead": {
        headyversion: "https://www.headyversion.com/song/[SONG_ID]/grateful-dead/[SONG_SLUG]/",
        relisten: "https://relisten.net/grateful-dead/[DATE]/[SONG_SLUG]",
        chords: "https://www.rukind.com/gdead/lyrics/[SONG_SLUG].html",
        tabs: "https://tabs.ultimate-guitar.com/tab/grateful-dead/[SONG_SLUG]"
    },
    "Jerry Garcia Band": {
        relisten: "https://relisten.net/jerry-garcia-band/[DATE]/[SONG_SLUG]",
        chords: "https://www.rukind.com/jgb/lyrics/[SONG_SLUG].html",
        tabs: "https://tabs.ultimate-guitar.com/tab/jerry-garcia-band/[SONG_SLUG]"
    },
    "Phish": {
        phishnet: "https://phish.net/song/[SONG_SLUG]/history",
        relisten: "https://relisten.net/phish/[DATE]/[SONG_SLUG]",
        chords: "https://tabs.ultimate-guitar.com/tab/phish/[SONG_SLUG]",
        tabs: "https://tabs.ultimate-guitar.com/tab/phish/[SONG_SLUG]"
    },
    "Widespread Panic": {
        panicstream: "https://www.panicstream.com/vault/widespread-panic/",
        relisten: "https://relisten.net/widespread-panic/[DATE]/[SONG_SLUG]",
        chords: "https://tabs.ultimate-guitar.com/tab/widespread-panic/[SONG_SLUG]",
        tabs: "https://tabs.ultimate-guitar.com/tab/widespread-panic/[SONG_SLUG]"
    }
};

// ============================================================================
// DIFFICULTY LEVEL DEFINITIONS
// ============================================================================

const difficultyLevels = {
    1: {
        label: "⭐ Beginner",
        description: "Straightforward structure, standard time signature, good for learning basics"
    },
    2: {
        label: "⭐⭐ Intermediate",
        description: "Some complexity, extended jams, good for developing improvisation skills"
    },
    3: {
        label: "⭐⭐⭐ Advanced",
        description: "Complex structure, odd time signatures, extended type-II jams, challenging"
    }
};

// ============================================================================
// NOTES FOR DATA ENTRY
// ============================================================================

/*
TO ADD THESE FEATURES TO ALL 60 SONGS:

1. BPM - Use a metronome or online BPM detector on the actual recording
2. Key - Listen to the recording or use music theory knowledge
3. Length - Get from Archive.org metadata
4. Difficulty:
   - 1 = Beginner: Standard songs, no odd time signatures
   - 2 = Intermediate: Some jams, standard complexity
   - 3 = Advanced: Complex jams, odd meters, type-II stuff
5. Practice Notes - Write 1-2 sentences about what makes this version good for learning
6. Features - 2-4 key characteristics in array format
7. Links:
   - Relisten: Format is consistent per band
   - HeadyVersion/Phish.net: Band-specific rating sites
   - Chords/Tabs: Search Ultimate Guitar and Rukind

PRIORITY ORDER:
1. Add all Relisten links (easy, formulaic)
2. Add HeadyVersion/Phish.net/PanicStream links (easy)
3. Add Chords/Tabs links (search Ultimate Guitar)
4. Research BPM/Key/Length for each (time-consuming)
5. Write practice notes (requires musical knowledge)
*/
