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
