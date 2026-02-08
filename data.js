// ============================================================================
// DEADCETERA WORKFLOW DATA
// ============================================================================
// Complete song catalog + Top 5 versions for each song
// ============================================================================

// Full song catalog (all Grateful Dead + JGB songs)
const allSongs = [
    // Grateful Dead
    { title: "Aiko Aiko", band: "GD" },
    { title: "Alabama Getaway", band: "GD" },
    { title: "Althea", band: "GD" },
    { title: "Around and Around", band: "GD" },
    { title: "Attics of My Life", band: "GD" },
    { title: "Bertha", band: "GD" },
    { title: "Big River", band: "GD" },
    { title: "Bird Song", band: "GD" },
    { title: "Black Peter", band: "GD" },
    { title: "Black-Throated Wind", band: "GD" },
    { title: "Box of Rain", band: "GD" },
    { title: "Brokedown Palace", band: "GD" },
    { title: "Brown-Eyed Women", band: "GD" },
    { title: "Candyman", band: "GD" },
    { title: "Casey Jones", band: "GD" },
    { title: "Cassidy", band: "GD" },
    { title: "China Cat Sunflower", band: "GD" },
    { title: "China Doll", band: "GD" },
    { title: "Cold Rain and Snow", band: "GD" },
    { title: "Cosmic Charlie", band: "GD" },
    { title: "Cream Puff War", band: "GD" },
    { title: "Cumberland Blues", band: "GD" },
    { title: "Dancing in the Street", band: "GD" },
    { title: "Dark Star", band: "GD" },
    { title: "Days Between", band: "GD" },
    { title: "Deal", band: "GD" },
    { title: "Dire Wolf", band: "GD" },
    { title: "Dupree's Diamond Blues", band: "GD" },
    { title: "Easy Wind", band: "GD" },
    { title: "Estimated Prophet", band: "GD" },
    { title: "Eyes of the World", band: "GD" },
    { title: "Fire on the Mountain", band: "GD" },
    { title: "Foolish Heart", band: "GD" },
    { title: "Franklin's Tower", band: "GD" },
    { title: "Friend of the Devil", band: "GD" },
    { title: "Good Lovin'", band: "GD" },
    { title: "Greatest Story Ever Told", band: "GD" },
    { title: "He's Gone", band: "GD" },
    { title: "Help on the Way", band: "GD" },
    { title: "High Time", band: "GD" },
    { title: "I Know You Rider", band: "GD" },
    { title: "Jack Straw", band: "GD" },
    { title: "Lazy Lightnin'", band: "GD" },
    { title: "Let It Grow", band: "GD" },
    { title: "Loser", band: "GD" },
    { title: "Looks Like Rain", band: "GD" },
    { title: "Mexicali Blues", band: "GD" },
    { title: "Mississippi Half-Step", band: "GD" },
    { title: "Morning Dew", band: "GD" },
    { title: "Mountains of the Moon", band: "GD" },
    { title: "Music Never Stopped", band: "GD" },
    { title: "New Minglewood Blues", band: "GD" },
    { title: "Not Fade Away", band: "GD" },
    { title: "One More Saturday Night", band: "GD" },
    { title: "Peggy-O", band: "GD" },
    { title: "Playing in the Band", band: "GD" },
    { title: "Promised Land", band: "GD" },
    { title: "Ramble On Rose", band: "GD" },
    { title: "Ripple", band: "GD" },
    { title: "Row Jimmy", band: "GD" },
    { title: "Samson and Delilah", band: "GD" },
    { title: "Scarlet Begonias", band: "GD" },
    { title: "Shakedown Street", band: "GD" },
    { title: "Ship of Fools", band: "GD" },
    { title: "Slipknot!", band: "GD" },
    { title: "St. Stephen", band: "GD" },
    { title: "Standing on the Moon", band: "GD" },
    { title: "Stella Blue", band: "GD" },
    { title: "Sugar Magnolia", band: "GD" },
    { title: "Sugaree", band: "GD" },
    { title: "Sunrise", band: "GD" },
    { title: "Tennessee Jed", band: "GD" },
    { title: "Terrapin Station", band: "GD" },
    { title: "The Other One", band: "GD" },
    { title: "They Love Each Other", band: "GD" },
    { title: "Touch of Grey", band: "GD" },
    { title: "Truckin'", band: "GD" },
    { title: "Turn On Your Love Light", band: "GD" },
    { title: "U.S. Blues", band: "GD" },
    { title: "Uncle John's Band", band: "GD" },
    { title: "Viola Lee Blues", band: "GD" },
    { title: "Wharf Rat", band: "GD" },
    
    // Jerry Garcia Band
    { title: "After Midnight", band: "JGB" },
    { title: "Ain't No Bread in the Breadbox", band: "JGB" },
    { title: "Catfish John", band: "JGB" },
    { title: "Dear Prudence", band: "JGB" },
    { title: "Don't Let Go", band: "JGB" },
    { title: "Gomorrah", band: "JGB" },
    { title: "How Sweet It Is", band: "JGB" },
    { title: "I Shall Be Released", band: "JGB" },
    { title: "Knockin' on Heaven's Door", band: "JGB" },
    { title: "Mission in the Rain", band: "JGB" },
    { title: "Positively 4th Street", band: "JGB" },
    { title: "Reuben and Cherise", band: "JGB" },
    { title: "Run for the Roses", band: "JGB" },
    { title: "Shining Star", band: "JGB" },
    { title: "Tangled Up in Blue", band: "JGB" },
    { title: "The Night They Drove Old Dixie Down", band: "JGB" },
    { title: "The Harder They Come", band: "JGB" },
    { title: "Waiting for a Miracle", band: "JGB" }
].sort((a, b) => a.title.localeCompare(b.title));

// Top 5 versions database (expandable - add more songs as researched)
const top5Database = {
    "Althea": [
        {
            rank: 1,
            venue: "Hartford Civic Center, Hartford CT",
            date: "March 14, 1981",
            archiveId: "gd1981-03-14.sbd.miller.97443.sbeok.flac16",
            notes: "The Hartford Althea - legendary version, perfect Garcia solo",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Deer Creek Music Center, Noblesville IN",
            date: "July 19, 1990",
            archiveId: "gd1990-07-19.sbd.miller.90475.sbeok.flac16",
            notes: "Without a Net album version - hot energy, great interplay",
            trackNumber: "05",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Boston Garden, Boston MA",
            date: "October 1, 1994",
            archiveId: "gd1994-10-01.sbd.miller.87506.sbeok.flac16",
            notes: "Scorching late version - Jerry's got swagger",
            trackNumber: "06",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Henry J. Kaiser Convention Center, Oakland CA",
            date: "December 30, 1986",
            archiveId: "gd1986-12-30.sbd.cotsman.6530.sbeok.shnf",
            notes: "Hot upbeat version from an awesome show",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Alaska State Fairgrounds, Palmer AK",
            date: "July 1, 1980",
            archiveId: "gd1980-07-01.sbd.cole.6597.sbeok.shnf",
            notes: "A+++ version with insane end jam - rare Alaska show",
            trackNumber: "09",
            quality: "SBD"
        }
    ],
    
    "Shakedown Street": [
        {
            rank: 1,
            venue: "Capital Centre, Landover MD",
            date: "August 31, 1979",
            archiveId: "gd1979-08-31.sbd.smith.5488.sbeok.shnf",
            notes: "Months after song debut - early definitive version",
            trackNumber: "06",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Grugahalle, Essen, West Germany",
            date: "March 28, 1981",
            archiveId: "gd1981-03-28.sbd.walker-scotton.miller.84397.flac16",
            notes: "Europe '81 - peak Garcia era performance",
            trackNumber: "05",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Madison Square Garden, New York NY",
            date: "September 18, 1987",
            archiveId: "gd1987-09-18.sbd.braverman.11672.sbeok.shnf",
            notes: "MSG run - Brent-era excellence",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Knickerbocker Arena, Albany NY",
            date: "March 24, 1990",
            archiveId: "gd1990-03-24.sbd.orf.9803.sbeok.shnf",
            notes: "Spring 1990 - tight and energetic",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Soldier Field, Chicago IL",
            date: "June 22, 1991",
            archiveId: "gd1991-06-22.sbd.miller.88896.flac16",
            notes: "Extended jam version with great crowd energy",
            trackNumber: "09",
            quality: "SBD"
        }
    ],
    
    "Franklin's Tower": [
        {
            rank: 1,
            venue: "Barton Hall, Cornell University, Ithaca NY",
            date: "May 8, 1977",
            archiveId: "gd1977-05-08.sbd.hicks.4982.sbeok.shnf",
            notes: "Cornell '77 - legendary show, part of Help>Slip>Frank",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Winterland Arena, San Francisco CA",
            date: "December 31, 1978",
            archiveId: "gd1978-12-31.sbd.miller.97766.sbeok.flac16",
            notes: "Closing of Winterland - Help>Slip>Frank sequence",
            trackNumber: "14",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Nassau Coliseum, Uniondale NY",
            date: "May 16, 1980",
            archiveId: "gd1980-05-16.sbd.dave.9584.sbeok.shnf",
            notes: "Spring 1980 peak - extended jam version",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Greek Theatre, Berkeley CA",
            date: "July 13, 1984",
            archiveId: "gd1984-07-13.sbd.cantor-bershaw.1573.sbeok.shnf",
            notes: "Mid-80s gem with great tempo",
            trackNumber: "09",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Golden Gate Park, San Francisco CA",
            date: "September 28, 1975",
            archiveId: "gd1975-09-28.aud.bershaw.103258.flac16",
            notes: "Blues For Allah era - early version",
            trackNumber: "05",
            quality: "AUD"
        }
    ],
    
    "Fire on the Mountain": [
        {
            rank: 1,
            venue: "Barton Hall, Cornell University, Ithaca NY",
            date: "May 8, 1977",
            archiveId: "gd1977-05-08.sbd.hicks.4982.sbeok.shnf",
            notes: "Scarlet>Fire from Cornell '77 - THE definitive version",
            trackNumber: "06",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "The Sportatorium, Pembroke Pines FL",
            date: "May 22, 1977",
            archiveId: "gd1977-05-22.sbd.miller.83742.sbeok.flac16",
            notes: "Dick's Picks Vol 29 - another Spring '77 monster",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Red Rocks Amphitheatre, Morrison CO",
            date: "July 8, 1978",
            archiveId: "gd1978-07-08.sbd.weedpatch.20862.sbefail.shnf",
            notes: "Red Rocks magic - extended jam",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Horton Field House, Normal IL",
            date: "April 24, 1978",
            archiveId: "gd1978-04-24.sbd.unknown.15882.sbeok.shnf",
            notes: "Spring '78 - highly underrated version",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Hampton Coliseum, Hampton VA",
            date: "March 24, 1986",
            archiveId: "gd1986-03-24.sbd.shannon-vernon.13891.sbeok.shnf",
            notes: "Hampton '86 - Brent era excellence",
            trackNumber: "06",
            quality: "SBD"
        }
    ],
    
    "Deal": [
        {
            rank: 1,
            venue: "Boston Garden, Boston MA",
            date: "May 7, 1977",
            archiveId: "gd1977-05-07.sbd.bershaw.97290.sbeok.flac16",
            notes: "Night before Cornell - epic Deal",
            trackNumber: "10",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Fairgrounds Arena, Oklahoma City OK",
            date: "October 19, 1973",
            archiveId: "gd1973-10-19.sbd.silver.1503.sbeok.shnf",
            notes: "Dick's Picks Vol 1 - early '70s jamming",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Shoreline Amphitheatre, Mountain View CA",
            date: "September 18, 1994",
            archiveId: "gd1994-09-18.sbd.miller.87356.sbeok.flac16",
            notes: "Late era gem - one last great Deal",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Winterland Arena, San Francisco CA",
            date: "June 9, 1977",
            archiveId: "gd1977-06-09.sbd.cotsman.4181.sbeok.shnf",
            notes: "June '77 perfection",
            trackNumber: "09",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Capitol Theatre, Passaic NJ",
            date: "April 27, 1977",
            archiveId: "gd1977-04-27.sbd.wise.8053.sbeok.shnf",
            notes: "Spring '77 magic - tight and energetic",
            trackNumber: "08",
            quality: "SBD"
        }
    ],
    
    "Friend of the Devil": [
        {
            rank: 1,
            venue: "Wembley Empire Pool, London (Europe '72)",
            date: "April 8, 1972",
            archiveId: "gd1972-04-08.sbd.miller.97143.sbeok.flac16",
            notes: "Crystal clear harmonies, definitive studio-quality soundboard",
            trackNumber: "03",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Barton Hall, Cornell University",
            date: "May 8, 1977",
            archiveId: "gd77-05-08.sbd.hicks.4982.sbeok.shnf",
            notes: "From the legendary Cornell show, pristine recording",
            trackNumber: "03",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Capitol Theatre, Passaic NJ",
            date: "April 25, 1977",
            archiveId: "gd1977-04-25.sbd.miller.102376.flac16",
            notes: "Spring '77 peak performance, excellent tempo",
            trackNumber: "02",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Boston Garden",
            date: "May 7, 1977",
            archiveId: "gd77-05-07.sbd.hicks.4936.sbeok.shnf",
            notes: "Night before Cornell, equally strong version",
            trackNumber: "04",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Winterland, San Francisco",
            date: "October 21, 1978",
            archiveId: "gd1978-10-21.sbd.miller.87716.sbeok.flac16",
            notes: "Closing of Winterland, emotional performance",
            trackNumber: "02",
            quality: "SBD"
        }
    ],
    
    "Scarlet Begonias": [
        {
            rank: 1,
            venue: "Barton Hall, Cornell University",
            date: "May 8, 1977",
            archiveId: "gd77-05-08.sbd.hicks.4982.sbeok.shnf",
            notes: "Perfect tempo, incredibly tight playing",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Veneta, Oregon (Sunshine Daydream)",
            date: "August 27, 1972",
            archiveId: "gd1972-08-27.sbd.hollister.22952.sbeok.flac16",
            notes: "Legendary outdoor show, psychedelic jamming",
            trackNumber: "05",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Swing Auditorium, San Bernardino",
            date: "February 26, 1977",
            archiveId: "gd77-02-26.sbd.hicks.4469.sbeok.shnf",
            notes: "Early '77 fire, great energy",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Boston Garden",
            date: "May 7, 1977",
            archiveId: "gd77-05-07.sbd.hicks.4936.sbeok.shnf",
            notes: "Spring '77 peak, transitions into Fire beautifully",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Buffalo Memorial Auditorium",
            date: "May 9, 1977",
            archiveId: "gd77-05-09.sbd.hicks.81004.sbeok.flac16",
            notes: "Day after Cornell, often considered better",
            trackNumber: "06",
            quality: "SBD"
        }
    ],
    
    // Add more songs here as you research them!
    // Template:
    // "Song Name": [
    //     { rank: 1, venue: "", date: "", archiveId: "", notes: "", trackNumber: "", quality: "SBD" },
    //     ...
    // ]
};

// Helper to generate Archive.org URLs
function generateArchiveUrls(archiveId, trackNumber) {
    return {
        details: `https://archive.org/details/${archiveId}`,
        download: `https://archive.org/download/${archiveId}/`,
        // Try to construct direct MP3 link (may need adjustment per show)
        mp3: `https://archive.org/download/${archiveId}/${archiveId.replace(/\./g, '-')}-t${trackNumber}.mp3`
    };
}
