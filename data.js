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
    { title: "That's What Love Will Make You Do", band: "JGB" },
    { title: "The Night They Drove Old Dixie Down", band: "JGB" },
    { title: "The Harder They Come", band: "JGB" },
    { title: "Waiting for a Miracle", band: "JGB" },
    
    // Widespread Panic
    { title: "Action Man", band: "WSP" },
    { title: "Ain't Life Grand", band: "WSP" },
    { title: "All Time Low", band: "WSP" },
    { title: "AndItStoned", band: "WSP" },
    { title: "Angel From Montgomery", band: "WSP" },
    { title: "Another Joyous Occasion", band: "WSP" },
    { title: "Arleen", band: "WSP" },
    { title: "Aunt Avis", band: "WSP" },
    { title: "Barstools and Dreamers", band: "WSP" },
    { title: "Beacon", band: "WSP" },
    { title: "Bear's Gone Fishin'", band: "WSP" },
    { title: "Beatdown", band: "WSP" },
    { title: "Benefit of Doubt", band: "WSP" },
    { title: "Big Wooly Mammoth", band: "WSP" },
    { title: "Blackout Blues", band: "WSP" },
    { title: "Blue Indian", band: "WSP" },
    { title: "Bombs & Butterflies", band: "WSP" },
    { title: "Boom Boom Boom", band: "WSP" },
    { title: "Bust It Big", band: "WSP" },
    { title: "Chainsaw City", band: "WSP" },
    { title: "Chilly Water", band: "WSP" },
    { title: "City of Dreams", band: "WSP" },
    { title: "Climb to Safety", band: "WSP" },
    { title: "Conrad", band: "WSP" },
    { title: "Cotton Was King", band: "WSP" },
    { title: "Crazy", band: "WSP" },
    { title: "Dark Bar", band: "WSP" },
    { title: "Desparado", band: "WSP" },
    { title: "Diner", band: "WSP" },
    { title: "Disco", band: "WSP" },
    { title: "Do It Every Day", band: "WSP" },
    { title: "Doreatha", band: "WSP" },
    { title: "Down", band: "WSP" },
    { title: "Driving Song", band: "WSP" },
    { title: "Drums", band: "WSP" },
    { title: "End of the Show", band: "WSP" },
    { title: "Estimator", band: "WSP" },
    { title: "Expiration Date", band: "WSP" },
    { title: "Fishing", band: "WSP" },
    { title: "Flying", band: "WSP" },
    { title: "From the Cradle", band: "WSP" },
    { title: "Glow", band: "WSP" },
    { title: "Good People", band: "WSP" },
    { title: "Goodnight Saigon", band: "WSP" },
    { title: "Gradle", band: "WSP" },
    { title: "Gradle (Crisp)", band: "WSP" },
    { title: "Heaven", band: "WSP" },
    { title: "Henry Parsons Died", band: "WSP" },
    { title: "Heroes", band: "WSP" },
    { title: "Holden Oversoul", band: "WSP" },
    { title: "Hope in a Letter", band: "WSP" },
    { title: "Hopeless Star", band: "WSP" },
    { title: "I'm Not Alone", band: "WSP" },
    { title: "Imitation Leather Shoes", band: "WSP" },
    { title: "Impossible", band: "WSP" },
    { title: "Interstate 10", band: "WSP" },
    { title: "Jr.", band: "WSP" },
    { title: "Junior", band: "WSP" },
    { title: "Let It Rock", band: "WSP" },
    { title: "Let's Get Down to Business", band: "WSP" },
    { title: "Light Fuse, Get Away", band: "WSP" },
    { title: "Linebacker", band: "WSP" },
    { title: "Lost and Found", band: "WSP" },
    { title: "Love Tractor", band: "WSP" },
    { title: "Machine", band: "WSP" },
    { title: "Makin' It Work", band: "WSP" },
    { title: "Makes Sense to Me", band: "WSP" },
    { title: "Mercy", band: "WSP" },
    { title: "North", band: "WSP" },
    { title: "One Arm Steve", band: "WSP" },
    { title: "One Kind Favor", band: "WSP" },
    { title: "Ophelia", band: "WSP" },
    { title: "Orange Blossom Special", band: "WSP" },
    { title: "Orch Theme", band: "WSP" },
    { title: "Outlined", band: "WSP" },
    { title: "Porch Song", band: "WSP" },
    { title: "Papa Johnny Road", band: "WSP" },
    { title: "Papa Legba", band: "WSP" },
    { title: "Pigeons", band: "WSP" },
    { title: "Pilgrims", band: "WSP" },
    { title: "Plantation", band: "WSP" },
    { title: "Pleas", band: "WSP" },
    { title: "Porch Song", band: "WSP" },
    { title: "Postcard", band: "WSP" },
    { title: "Proving Ground", band: "WSP" },
    { title: "Radio Child", band: "WSP" },
    { title: "Rebirtha", band: "WSP" },
    { title: "Ride Me High", band: "WSP" },
    { title: "Rock", band: "WSP" },
    { title: "Rock and Roll All Nite", band: "WSP" },
    { title: "Rockin' Chair", band: "WSP" },
    { title: "Saint Ex", band: "WSP" },
    { title: "Sell Sell", band: "WSP" },
    { title: "Sleepy Monkey", band: "WSP" },
    { title: "Smell of Patchouli", band: "WSP" },
    { title: "Space Wrangler", band: "WSP" },
    { title: "Stop-Go", band: "WSP" },
    { title: "Surprise Valley", band: "WSP" },
    { title: "Tall Boy", band: "WSP" },
    { title: "The Last Straw", band: "WSP" },
    { title: "The Take Out", band: "WSP" },
    { title: "The Waker", band: "WSP" },
    { title: "This Cruel Thing", band: "WSP" },
    { title: "Three Candles", band: "WSP" },
    { title: "Tickle the Truth", band: "WSP" },
    { title: "Time Waits", band: "WSP" },
    { title: "Time Zones", band: "WSP" },
    { title: "Tornado", band: "WSP" },
    { title: "Travelin' Light", band: "WSP" },
    { title: "Trouble", band: "WSP" },
    { title: "True to My Nature", band: "WSP" },
    { title: "Tx.", band: "WSP" },
    { title: "Up All Night", band: "WSP" },
    { title: "Walk On the Flood", band: "WSP" },
    { title: "Walkin' (For Your Love)", band: "WSP" },
    { title: "Weight of the World", band: "WSP" },
    { title: "Wondering", band: "WSP" },
    { title: "Weak Brain, Strong Back", band: "WSP" },
    { title: "Who Stole My Cheese?", band: "WSP" },
    
    // Allman Brothers Band
    { title: "Ain't Wastin' Time No More", band: "ABB" },
    { title: "All Along the Watchtower", band: "ABB" },
    { title: "Any Day Now", band: "ABB" },
    { title: "Are You Lonely for Me Baby", band: "ABB" },
    { title: "Back Where It All Begins", band: "ABB" },
    { title: "Bad Luck Wind", band: "ABB" },
    { title: "Blue Sky", band: "ABB" },
    { title: "Bound for Glory", band: "ABB" },
    { title: "Brother of the Road", band: "ABB" },
    { title: "Calypso", band: "ABB" },
    { title: "Can't Lose What You Never Had", band: "ABB" },
    { title: "Come On in My Kitchen", band: "ABB" },
    { title: "Crazy Love", band: "ABB" },
    { title: "Dreams", band: "ABB" },
    { title: "Drunken Hearted Boy", band: "ABB" },
    { title: "Elizabeth Reed", band: "ABB" },
    { title: "End of the Line", band: "ABB" },
    { title: "Every Hungry Woman", band: "ABB" },
    { title: "Everybody's Got a Mountain to Climb", band: "ABB" },
    { title: "Fire on the Mountain", band: "ABB" },
    { title: "Floating Bridge", band: "ABB" },
    { title: "Forty Four Blues", band: "ABB" },
    { title: "Gambler's Roll", band: "ABB" },
    { title: "Good Clean Fun", band: "ABB" },
    { title: "Good Morning Little Schoolgirl", band: "ABB" },
    { title: "Got My Mojo Working", band: "ABB" },
    { title: "High Cost of Low Living", band: "ABB" },
    { title: "High Falls", band: "ABB" },
    { title: "Hot 'Lanta", band: "ABB" },
    { title: "I'm Not Crying", band: "ABB" },
    { title: "In Memory of Elizabeth Reed", band: "ABB" },
    { title: "It Ain't Over Yet", band: "ABB" },
    { title: "Jessica", band: "ABB" },
    { title: "Just Another Love Song", band: "ABB" },
    { title: "Leavin'", band: "ABB" },
    { title: "Les Brers in A Minor", band: "ABB" },
    { title: "Little Martha", band: "ABB" },
    { title: "Loan Me a Dime", band: "ABB" },
    { title: "Losing Your Mind", band: "ABB" },
    { title: "Low Rider", band: "ABB" },
    { title: "Melissa", band: "ABB" },
    { title: "Midnight Rider", band: "ABB" },
    { title: "Mountain Jam", band: "ABB" },
    { title: "Never Knew How Much (I Needed You)", band: "ABB" },
    { title: "Nobody Knows", band: "ABB" },
    { title: "No One to Run With", band: "ABB" },
    { title: "One Way Out", band: "ABB" },
    { title: "Patchwork Quilt", band: "ABB" },
    { title: "Pegasus", band: "ABB" },
    { title: "Pleased to Meet You", band: "ABB" },
    { title: "Polk Salad Annie", band: "ABB" },
    { title: "Ramblin' Man", band: "ABB" },
    { title: "Reach for the Sky", band: "ABB" },
    { title: "Reminiscence", band: "ABB" },
    { title: "Revival", band: "ABB" },
    { title: "Rockin' Horse", band: "ABB" },
    { title: "Roots My Home", band: "ABB" },
    { title: "Sailin' 'Cross the Devil's Sea", band: "ABB" },
    { title: "Seven Turns", band: "ABB" },
    { title: "Soulshine", band: "ABB" },
    { title: "Stand Back", band: "ABB" },
    { title: "Statesboro Blues", band: "ABB" },
    { title: "Straight from the Heart", band: "ABB" },
    { title: "The High Cost of Low Living", band: "ABB" },
    { title: "The Sky is Crying", band: "ABB" },
    { title: "Trouble No More", band: "ABB" },
    { title: "True Gravity", band: "ABB" },
    { title: "Unemployment", band: "ABB" },
    { title: "Whipping Post", band: "ABB" },
    { title: "Win Lose or Draw", band: "ABB" },
    { title: "Wicked Game", band: "ABB" },
    { title: "You Don't Love Me", band: "ABB" },

    // Phish
    { title: "46 Days", band: "Phish" },
    { title: "555", band: "Phish" },
    { title: "A Song I Heard the Ocean Sing", band: "Phish" },
    { title: "AC/DC Bag", band: "Phish" },
    { title: "Access Me", band: "Phish" },
    { title: "Alaska", band: "Phish" },
    { title: "All of These Dreams", band: "Phish" },
    { title: "Alumni Blues", band: "Phish" },
    { title: "Axilla", band: "Phish" },
    { title: "Backwards Down the Number Line", band: "Phish" },
    { title: "Bathtub Gin", band: "Phish" },
    { title: "Birds of a Feather", band: "Phish" },
    { title: "Blaze On", band: "Phish" },
    { title: "Bouncing Around the Room", band: "Phish" },
    { title: "Brian and Robert", band: "Phish" },
    { title: "Brother", band: "Phish" },
    { title: "Buffalo Bill", band: "Phish" },
    { title: "Bug", band: "Phish" },
    { title: "Buried Alive", band: "Phish" },
    { title: "Car's Trucks Buses", band: "Phish" },
    { title: "Carini", band: "Phish" },
    { title: "Cavern", band: "Phish" },
    { title: "Chalk Dust Torture", band: "Phish" },
    { title: "Character Zero", band: "Phish" },
    { title: "Chalkdust Torture", band: "Phish" },
    { title: "Cities", band: "Phish" },
    { title: "Colonel Forbin's Ascent", band: "Phish" },
    { title: "Contact", band: "Phish" },
    { title: "Crosseyed and Painless", band: "Phish" },
    { title: "David Bowie", band: "Phish" },
    { title: "Destiny Unbound", band: "Phish" },
    { title: "Dirt", band: "Phish" },
    { title: "Divided Sky", band: "Phish" },
    { title: "Dogs Stole Things", band: "Phish" },
    { title: "Down with Disease", band: "Phish" },
    { title: "Driver", band: "Phish" },
    { title: "Farmhouse", band: "Phish" },
    { title: "Fast Enough for You", band: "Phish" },
    { title: "Fee", band: "Phish" },
    { title: "First Tube", band: "Phish" },
    { title: "Fluffhead", band: "Phish" },
    { title: "Foam", band: "Phish" },
    { title: "Free", band: "Phish" },
    { title: "Funky Bitch", band: "Phish" },
    { title: "Ghost", band: "Phish" },
    { title: "Ginseng Sullivan", band: "Phish" },
    { title: "Glide", band: "Phish" },
    { title: "Golgi Apparatus", band: "Phish" },
    { title: "Gotta Jibboo", band: "Phish" },
    { title: "Guelah Papyrus", band: "Phish" },
    { title: "Guyute", band: "Phish" },
    { title: "Harpua", band: "Phish" },
    { title: "Harry Hood", band: "Phish" },
    { title: "Heavy Things", band: "Phish" },
    { title: "Horn", band: "Phish" },
    { title: "I Am Hydrogen", band: "Phish" },
    { title: "If I Could", band: "Phish" },
    { title: "Jibboo", band: "Phish" },
    { title: "Julius", band: "Phish" },
    { title: "Kill Devil Falls", band: "Phish" },
    { title: "Lawn Boy", band: "Phish" },
    { title: "Leaves", band: "Phish" },
    { title: "Lengthwise", band: "Phish" },
    { title: "Light", band: "Phish" },
    { title: "Limb by Limb", band: "Phish" },
    { title: "Lizards", band: "Phish" },
    { title: "Llama", band: "Phish" },
    { title: "Maze", band: "Phish" },
    { title: "Meat", band: "Phish" },
    { title: "Meatstick", band: "Phish" },
    { title: "Mike's Song", band: "Phish" },
    { title: "Moma Dance", band: "Phish" },
    { title: "Mountains in the Mist", band: "Phish" },
    { title: "My Friend, My Friend", band: "Phish" },
    { title: "My Soul", band: "Phish" },
    { title: "NICU", band: "Phish" },
    { title: "No Men in No Man's Land", band: "Phish" },
    { title: "Nothing", band: "Phish" },
    { title: "Olivia's Pool", band: "Phish" },
    { title: "Pebbles and Marbles", band: "Phish" },
    { title: "Petrichor", band: "Phish" },
    { title: "Piper", band: "Phish" },
    { title: "Poor Heart", band: "Phish" },
    { title: "Possum", band: "Phish" },
    { title: "Prince Caspian", band: "Phish" },
    { title: "Punch You in the Eye", band: "Phish" },
    { title: "Reba", band: "Phish" },
    { title: "Rift", band: "Phish" },
    { title: "Roggae", band: "Phish" },
    { title: "Runaway Jim", band: "Phish" },
    { title: "Run Like an Antelope", band: "Phish" },
    { title: "Sample in a Jar", band: "Phish" },
    { title: "Sand", band: "Phish" },
    { title: "Scent of a Mule", band: "Phish" },
    { title: "Shade", band: "Phish" },
    { title: "Simple", band: "Phish" },
    { title: "Slave to the Traffic Light", band: "Phish" },
    { title: "Sleep", band: "Phish" },
    { title: "Sloth", band: "Phish" },
    { title: "Sparkle", band: "Phish" },
    { title: "Split Open and Melt", band: "Phish" },
    { title: "Squirming Coil", band: "Phish" },
    { title: "Stash", band: "Phish" },
    { title: "Steam", band: "Phish" },
    { title: "Strange Design", band: "Phish" },
    { title: "Suzy Greenberg", band: "Phish" },
    { title: "Sweet Emotion", band: "Phish" },
    { title: "Taste", band: "Phish" },
    { title: "The Curtain", band: "Phish" },
    { title: "The Divided Sky", band: "Phish" },
    { title: "The Lizards", band: "Phish" },
    { title: "The Mango Song", band: "Phish" },
    { title: "The Moma Dance", band: "Phish" },
    { title: "The Sloth", band: "Phish" },
    { title: "The Squirming Coil", band: "Phish" },
    { title: "Theme From the Bottom", band: "Phish" },
    { title: "Timber (Jerry)", band: "Phish" },
    { title: "Train Song", band: "Phish" },
    { title: "Tube", band: "Phish" },
    { title: "Tweezer", band: "Phish" },
    { title: "Tweezer Reprise", band: "Phish" },
    { title: "Twist", band: "Phish" },
    { title: "Uncle Pen", band: "Phish" },
    { title: "Undermind", band: "Phish" },
    { title: "Vultures", band: "Phish" },
    { title: "Wading in the Velvet Sea", band: "Phish" },
    { title: "Walls of the Cave", band: "Phish" },
    { title: "Waste", band: "Phish" },
    { title: "Water in the Sky", band: "Phish" },
    { title: "Waves", band: "Phish" },
    { title: "Weekapaug Groove", band: "Phish" },
    { title: "Weigh", band: "Phish" },
    { title: "What's the Use?", band: "Phish" },
    { title: "Whistle While You Work", band: "Phish" },
    { title: "Wilson", band: "Phish" },
    { title: "Windora Bug", band: "Phish" },
    { title: "Wolfman's Brother", band: "Phish" },
    { title: "Ya Mar", band: "Phish" },
    { title: "You Enjoy Myself", band: "Phish" }
].sort((a, b) => a.title.localeCompare(b.title));

// Top 5 versions database (expandable - add more songs as researched)
const top5Database = {
    "Althea": [
        {
            rank: 1,
            venue: "Hartford Civic Center, Hartford CT",
            date: "March 14, 1981",
            archiveId: "gd1981-03-14.nak700.glassberg.motb.84826.sbeok.flac16",  // Glassberg version - has FULL show (both sets)
            notes: "The Hartford Althea - legendary version, perfect Garcia solo",
            trackNumber: "08",  // Trying 08 - track 07 gave us See See Rider (one song before Althea)
            quality: "SBD",
            // Musician features:
            bpm: 128,
            key: "E minor",
            length: "9:47",
            difficulty: 2,
            practiceNotes: "Perfect for learning Jerry's melodic soloing style. Extended outro jam showcases his signature '81 tone.",
            features: ["Extended outro jam", "Peak Jerry tone", "Classic '81 sound"],
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
            practiceNotes: "Faster tempo than usual - great for working on speed and tightness. Official album version has pristine audio.",
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
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Henry J. Kaiser Convention Center, Oakland CA",
            date: "December 30, 1986",
            archiveId: "gd1986-12-30",
            notes: "Hot upbeat version from an awesome show",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Alaska State Fairgrounds, Palmer AK",
            date: "July 1, 1980",
            archiveId: "gd1980-07-01",
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
            archiveId: "gd1979-08-31",
            notes: "Months after song debut - early definitive version",
            trackNumber: "06",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Grugahalle, Essen, West Germany",
            date: "March 28, 1981",
            archiveId: "gd1981-03-28",
            notes: "Europe '81 - peak Garcia era performance",
            trackNumber: "05",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Madison Square Garden, New York NY",
            date: "September 18, 1987",
            archiveId: "gd1987-09-18",
            notes: "MSG run - Brent-era excellence",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Knickerbocker Arena, Albany NY",
            date: "March 24, 1990",
            archiveId: "gd1990-03-24",
            notes: "Spring 1990 - tight and energetic",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Soldier Field, Chicago IL",
            date: "June 22, 1991",
            archiveId: "gd1991-06-22",
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
            archiveId: "gd1977-05-08",
            notes: "Cornell '77 - legendary show, part of Help>Slip>Frank",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Winterland Arena, San Francisco CA",
            date: "December 31, 1978",
            archiveId: "gd1978-12-31",
            notes: "Closing of Winterland - Help>Slip>Frank sequence",
            trackNumber: "14",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Nassau Coliseum, Uniondale NY",
            date: "May 16, 1980",
            archiveId: "gd1980-05-16",
            notes: "Spring 1980 peak - extended jam version",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Greek Theatre, Berkeley CA",
            date: "July 13, 1984",
            archiveId: "gd1984-07-13",
            notes: "Mid-80s gem with great tempo",
            trackNumber: "09",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Golden Gate Park, San Francisco CA",
            date: "September 28, 1975",
            archiveId: "gd1975-09-28",
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
            archiveId: "gd1977-05-08",
            notes: "Scarlet>Fire from Cornell '77 - THE definitive version",
            trackNumber: "06",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "The Sportatorium, Pembroke Pines FL",
            date: "May 22, 1977",
            archiveId: "gd1977-05-22",
            notes: "Dick's Picks Vol 29 - another Spring '77 monster",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Red Rocks Amphitheatre, Morrison CO",
            date: "July 8, 1978",
            archiveId: "gd1978-07-08",
            notes: "Red Rocks magic - extended jam",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Horton Field House, Normal IL",
            date: "April 24, 1978",
            archiveId: "gd1978-04-24",
            notes: "Spring '78 - highly underrated version",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Hampton Coliseum, Hampton VA",
            date: "March 24, 1986",
            archiveId: "gd1986-03-24",
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
            archiveId: "gd1977-05-07",
            notes: "Night before Cornell - epic Deal",
            trackNumber: "10",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Fairgrounds Arena, Oklahoma City OK",
            date: "October 19, 1973",
            archiveId: "gd1973-10-19",
            notes: "Dick's Picks Vol 1 - early '70s jamming",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Shoreline Amphitheatre, Mountain View CA",
            date: "September 18, 1994",
            archiveId: "gd1994-09-18",
            notes: "Late era gem - one last great Deal",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Winterland Arena, San Francisco CA",
            date: "June 9, 1977",
            archiveId: "gd1977-06-09",
            notes: "June '77 perfection",
            trackNumber: "09",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Capitol Theatre, Passaic NJ",
            date: "April 27, 1977",
            archiveId: "gd1977-04-27",
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
            archiveId: "gd1972-04-08",
            notes: "Crystal clear harmonies, definitive studio-quality soundboard",
            trackNumber: "03",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Barton Hall, Cornell University",
            date: "May 8, 1977",
            archiveId: "gd77-05-08",
            notes: "From the legendary Cornell show, pristine recording",
            trackNumber: "03",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Capitol Theatre, Passaic NJ",
            date: "April 25, 1977",
            archiveId: "gd1977-04-25",
            notes: "Spring '77 peak performance, excellent tempo",
            trackNumber: "02",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Boston Garden",
            date: "May 7, 1977",
            archiveId: "gd77-05-07",
            notes: "Night before Cornell, equally strong version",
            trackNumber: "04",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Winterland, San Francisco",
            date: "October 21, 1978",
            archiveId: "gd1978-10-21",
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
            archiveId: "gd77-05-08",
            notes: "Perfect tempo, incredibly tight playing",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Veneta, Oregon (Sunshine Daydream)",
            date: "August 27, 1972",
            archiveId: "gd1972-08-27",
            notes: "Legendary outdoor show, psychedelic jamming",
            trackNumber: "05",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Swing Auditorium, San Bernardino",
            date: "February 26, 1977",
            archiveId: "gd77-02-26",
            notes: "Early '77 fire, great energy",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Boston Garden",
            date: "May 7, 1977",
            archiveId: "gd77-05-07",
            notes: "Spring '77 peak, transitions into Fire beautifully",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Buffalo Memorial Auditorium",
            date: "May 9, 1977",
            archiveId: "gd77-05-09",
            notes: "Day after Cornell, often considered better",
            trackNumber: "06",
            quality: "SBD"
        }
    ],
    
    "Tall Boy": [
        {
            rank: 1,
            venue: "The Fillmore, San Francisco CA",
            date: "October 31, 1998",
            archiveId: "wsp1998-10-31",
            notes: "Halloween show, extended jamming, legendary version",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Bonnaroo Music Festival, Manchester TN",
            date: "June 23, 2000",
            archiveId: "wsp2000-06-23",
            notes: "Festival energy, huge crowd response",
            trackNumber: "05",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Red Rocks Amphitheatre, Morrison CO",
            date: "September 19, 2003",
            archiveId: "wsp2003-09-19",
            notes: "Red Rocks magic, tight performance",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Fox Theatre, Atlanta GA",
            date: "November 2, 1996",
            archiveId: "wsp1996-11-02",
            notes: "Hometown show, classic version",
            trackNumber: "06",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Red Rocks Amphitheatre, Morrison CO",
            date: "July 30, 2011",
            archiveId: "wsp2011-07-30",
            notes: "Late-era gem, JB's guitar work shines",
            trackNumber: "09",
            quality: "SBD"
        }
    ],
    
    "Chilly Water": [
        {
            rank: 1,
            venue: "Fox Theatre, Atlanta GA",
            date: "November 3, 1996",
            archiveId: "wsp1996-11-03",
            notes: "Definitive version, perfect pacing",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Lakewood Amphitheatre, Atlanta GA",
            date: "September 26, 1999",
            archiveId: "wsp1999-09-26",
            notes: "Hometown crowd, extended outro",
            trackNumber: "06",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "The Fillmore, San Francisco CA",
            date: "October 30, 1998",
            archiveId: "wsp1998-10-30",
            notes: "Halloween run, atmospheric jamming",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Bonnaroo Music Festival, Manchester TN",
            date: "June 24, 2000",
            archiveId: "wsp2000-06-24",
            notes: "Festival highlight, summer vibe",
            trackNumber: "09",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Red Rocks Amphitheatre, Morrison CO",
            date: "August 3, 2002",
            archiveId: "wsp2002-08-03",
            notes: "Red Rocks perfection, stellar sound",
            trackNumber: "08",
            quality: "SBD"
        }
    ],
    
    "Ain't Life Grand": [
        {
            rank: 1,
            venue: "Fox Theatre, Atlanta GA",
            date: "December 31, 1993",
            archiveId: "wsp1993-12-31",
            notes: "New Year's Eve classic, emotional performance",
            trackNumber: "12",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Orpheum Theatre, Boston MA",
            date: "October 31, 1999",
            archiveId: "wsp1999-10-31",
            notes: "Halloween show, extended version",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Red Rocks Amphitheatre, Morrison CO",
            date: "September 20, 2003",
            archiveId: "wsp2003-09-20",
            notes: "Red Rocks beauty, tight band",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Lakewood Amphitheatre, Atlanta GA",
            date: "July 3, 1997",
            archiveId: "wsp1997-07-03",
            notes: "Summer night magic, hometown energy",
            trackNumber: "09",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "UNO Lakefront Arena, New Orleans LA",
            date: "November 12, 2000",
            archiveId: "wsp2000-11-12",
            notes: "NOLA energy, soulful rendition",
            trackNumber: "06",
            quality: "SBD"
        }
    ],
    
    "All Time Low": [
        {
            rank: 1,
            venue: "Philips Arena, Atlanta GA",
            date: "October 29, 2010",
            archiveId: "wsp2010-10-29",
            notes: "Arena show, big sound, JB era",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Red Rocks Amphitheatre, Morrison CO",
            date: "September 15, 2012",
            archiveId: "wsp2012-09-15",
            notes: "Red Rocks power, modern classic",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Verizon Wireless Amphitheatre, Charlotte NC",
            date: "November 1, 2008",
            archiveId: "wsp2008-11-01",
            notes: "Halloween weekend, heavy groove",
            trackNumber: "09",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Red Rocks Amphitheatre, Morrison CO",
            date: "June 26, 2011",
            archiveId: "wsp2011-06-26",
            notes: "Summer solstice energy",
            trackNumber: "06",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Lakewood Amphitheatre, Atlanta GA",
            date: "March 6, 2010",
            archiveId: "wsp2010-03-06",
            notes: "Spring show, hometown crowd",
            trackNumber: "07",
            quality: "SBD"
        }
    ],
    
    "Funky Bitch": [
        {
            rank: 1,
            venue: "Madison Square Garden, New York NY",
            date: "December 31, 1995",
            archiveId: "phish1995-12-31",
            notes: "New Year's Run, peak mid-90s Phish, explosive",
            trackNumber: "15",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Great Went Festival, Limestone ME",
            date: "August 17, 1997",
            archiveId: "phish1997-08-17",
            notes: "Festival jam, extended funk workout",
            trackNumber: "09",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Deer Creek Music Center, Noblesville IN",
            date: "July 25, 1999",
            archiveId: "phish1999-07-25",
            notes: "Summer tour highlight, tight groove",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Worcester Centrum, Worcester MA",
            date: "November 29, 1997",
            archiveId: "phish1997-11-29",
            notes: "Fall '97 tour, legendary jamming era",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Nassau Coliseum, Uniondale NY",
            date: "February 28, 2003",
            archiveId: "phish2003-02-28",
            notes: "2.0 era gem, return tour energy",
            trackNumber: "10",
            quality: "SBD"
        }
    ],
    
    // Add more songs here as you research them!

    "Dark Star": [
        {
            rank: 1,
            venue: "Fillmore East, New York NY",
            date: "February 13, 1970",
            archiveId: "gd1970-02-13",
            notes: "The 'Feelin' Groovy Jam' - breathtakingly emotive",
            trackNumber: "04",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Old Renaissance Faire Grounds, Veneta OR",
            date: "August 27, 1972",
            archiveId: "gd1972-08-27",
            notes: "Most cited by fans - intense jamming",
            trackNumber: "06",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Winterland Arena, San Francisco CA",
            date: "October 18, 1974",
            archiveId: "gd1974-10-18",
            notes: "Brain dissolving jam",
            trackNumber: "08",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Winterland Arena, San Francisco CA",
            date: "November 11, 1973",
            archiveId: "gd1973-11-11",
            notes: "Peak performance",
            trackNumber: "07",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Fillmore West, San Francisco CA",
            date: "February 27, 1969",
            archiveId: "gd1969-02-27",
            notes: "Live/Dead album version",
            trackNumber: "02",
            quality: "SBD"
        }
    ],

    "Alabama Getaway": [
        {
            rank: 1,
            venue: "Hartford Civic Center, Hartford CT",
            date: "March 14, 1981",
            archiveId: "gd1981-03-14.nak700.glassberg.motb.84826.sbeok.flac16",
            notes: "From legendary Hartford show - hot opener",
            trackNumber: "13",
            quality: "SBD"
        },
        {
            rank: 2,
            venue: "Nassau Coliseum, Uniondale NY",
            date: "May 15, 1981",
            archiveId: "gd1981-05-15",
            notes: "Spring '81 peak - blazing energy",
            trackNumber: "01",
            quality: "SBD"
        },
        {
            rank: 3,
            venue: "Capital Centre, Landover MD",
            date: "November 30, 1980",
            archiveId: "gd1980-11-30",
            notes: "Shortly after debut",
            trackNumber: "01",
            quality: "SBD"
        },
        {
            rank: 4,
            venue: "Grugahalle, Essen, West Germany",
            date: "March 28, 1981",
            archiveId: "gd1981-03-28",
            notes: "Europe '81 - peak Garcia era",
            trackNumber: "12",
            quality: "SBD"
        },
        {
            rank: 5,
            venue: "Greek Theatre, Berkeley CA",
            date: "June 28, 1981",
            archiveId: "gd1981-06-28",
            notes: "Summer outdoor show",
            trackNumber: "01",
            quality: "SBD"
        }
    ]

};

// Helper to generate Archive.org URLs
function generateArchiveUrls(archiveId, trackNumber) {
    return {
        details: `https://archive.org/details/${archiveId}`,
        download: `https://archive.org/download/${archiveId}/`,
        mp3: `https://archive.org/download/${archiveId}/${archiveId.replace(/\./g, '-')}-t${trackNumber}.mp3`
    };
}

// ============================================================================
// BAND KNOWLEDGE SYSTEM
// Collaborative song resources for the whole band
// ============================================================================

// Band member configuration
const bandMembers = {
    brian: { name: "Brian", role: "Lead Guitar", sings: true, harmonies: true },
    chris: { name: "Chris", role: "Bass", sings: false, harmonies: true },
    drew: { name: "Drew", role: "Rhythm Guitar", sings: true, leadVocals: true, harmonies: true },
    pierce: { name: "Pierce", role: "Keyboard", sings: true, leadVocals: true, harmonies: true },
    jay: { name: "Jay", role: "Drums", sings: false, harmonies: false }
};

// Collaborative song knowledge base
const bandKnowledgeBase = {
    "Tweezer Reprise": {
        // Basic info
        artist: "Phish",
        
        // SHARED CHORD CHART - Google Doc
        chordChart: {
            googleDocId: "1D_1At83u7NX37nsmJolDyZygJqIVEBp4",
            editUrl: "https://docs.google.com/document/d/1D_1At83u7NX37nsmJolDyZygJqIVEBp4/edit",
            viewUrl: "https://docs.google.com/document/d/1D_1At83u7NX37nsmJolDyZygJqIVEBp4/view",
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/phish/tweezer-reprise-tabs-3392057",
            lastUpdated: "2024-02-14",
            updatedBy: "drew",
            bandNotes: [
                "Drew: Watch D→G transition in main riff",
                "Brian: Solo section is 16 bars",
                "Pierce: Follow bass line in verse"
            ]
        },
        
        // SPOTIFY VERSIONS - Democratic voting
        spotifyVersions: [
            {
                id: "version_1",
                title: "Tweezer Reprise - Live",
                spotifyUrl: "https://open.spotify.com/track/5EPfDGkdwRx801NTxrnpia",
                votes: {
                    brian: false,
                    chris: false,
                    drew: true,  // Drew voted for this version!
                    pierce: false,
                    jay: false
                },
                totalVotes: 1,
                isDefault: false,  // Need 3+ votes for majority
                addedBy: "drew",
                notes: "Drew's preferred version - waiting for band votes"
            }
        ],
        
        // PRACTICE TRACKS - By instrument
        practiceTracks: {
            bass: [],
            leadGuitar: [],
            rhythmGuitar: [],
            keys: [],
            drums: []
        },
        
        // MOISES STEMS - Your Google Drive folder!
        moisesParts: {
            sourceVersion: "Tweezer Reprise - Separated in Moises",
            googleDriveFolder: "https://drive.google.com/drive/folders/1TsGjHAqAbvc_6MbARAQ-cGMhdGip9LnX",
            stems: {
                bass: "https://drive.google.com/file/d/1U15OOxCLwKC98F5K-Hc2jGt8eZMZ98or/view?usp=sharing",
                drums: "https://drive.google.com/file/d/1oBkp9LOhdEGNeZ9J2XPh1jp-NBBV_ZRu/view?usp=sharing",
                guitar: "https://drive.google.com/file/d/1KaQDTcYB9ZPigvwVLukwZN23-tQfFbLd/view?usp=sharing",
                keys: "https://drive.google.com/file/d/1bE86lzxNJROqOeurU9a6qfejWnNf11oa/view?usp=sharing",
                vocals: "https://drive.google.com/file/d/1N0XO1NNO-kwEYt0trfxujplh85EII7VB/view?usp=sharing"
            },
            uploadedBy: "drew",
            dateCreated: "2024-02-14",
            notes: "All stems separated from Moises - Bass, Drums, Guitar, Keys, Vocals"
        },
        
        // HARMONY PARTS - THE CRITICAL SECTION!
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
                            notes: "Main melody"
                        },
                        {
                            singer: "pierce",
                            part: "harmony_high",
                            notes: "Third above"
                        },
                        {
                            singer: "brian",
                            part: "harmony_low",
                            notes: "Fifth below"
                        },
                        {
                            singer: "chris",
                            part: "doubling",
                            notes: "Double lead softly"
                        }
                    ],
                    referenceRecording: null,
                    practiceNotes: [],
                    workedOut: false,
                    soundsGood: false
                }
            ],
            generalNotes: [
                "Tweezer Reprise is all about energy",
                "Harmonies should be LOUD",
                "Don't worry about perfection, go for the vibe"
            ]
        },
        
        // SONG STRUCTURE
        structure: {
            tempo: 138,
            key: "D major",
            timeSignature: "4/4",
            form: "Intro-Verse-Chorus-Solo-Verse-Chorus-Outro"
        },
        
        // REHEARSAL NOTES
        rehearsalNotes: [],
        
        // GIG NOTES
        gigNotes: [
            "HIGH ENERGY song - crowd pleaser!",
            "Jay counts in with sticks",
            "Watch Brian for solo ending",
            "Hard stop on final downbeat"
        ]
    },
    
    // ==========================================================================
    // PRIORITY SONGS - Pre-populated for band
    // ==========================================================================
    
    "Fire on the Mountain": {
        artist: "Grateful Dead",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/grateful-dead/fire-on-the-mountain-chords-77504"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    },
    
    "Terrapin Station": {
        artist: "Grateful Dead",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/grateful-dead/terrapin-station-chords-1134539"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    },
    
    "Estimated Prophet": {
        artist: "Grateful Dead",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/grateful-dead/estimated-prophet-chords-1677341"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    },
    
    "Touch of Grey": {
        artist: "Grateful Dead",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/grateful-dead/touch-of-grey-chords-73436"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    },
    
    "Eyes of the World": {
        artist: "Grateful Dead",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/grateful-dead/eyes-of-the-world-chords-1677340"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    },
    
    "Sugaree": {
        artist: "Grateful Dead / Jerry Garcia Band",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/grateful-dead/sugaree-chords-73435"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    },
    
    "Brown Eyed Women": {
        artist: "Grateful Dead",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/grateful-dead/brown-eyed-women-chords-77506"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    },
    
    "Friend of the Devil": {
        artist: "Grateful Dead",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/grateful-dead/friend-of-the-devil-chords-73434"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    },
    
    "Althea": {
        artist: "Grateful Dead",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/grateful-dead/althea-chords-77508"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    },
    
    "Mr. Charlie": {
        artist: "Grateful Dead",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/grateful-dead/mr-charlie-chords-1677349"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    },
    
    "All Time Low": {
        artist: "Widespread Panic",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/widespread-panic/all-time-low-chords-3076267"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    },
    
    "Ain't Life Grand": {
        artist: "Widespread Panic",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/widespread-panic/aint-life-grand-chords-1245738"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    },
    
    "Funky Bitch": {
        artist: "Phish / Son Seals",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/phish/funky-bitch-chords-973863"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    },
    
    "Scarlet Begonias": {
        artist: "Grateful Dead",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/grateful-dead/scarlet-begonias-chords-1677345"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    },
    
    "China Cat Sunflower": {
        artist: "Grateful Dead",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/grateful-dead/china-cat-sunflower-chords-3230813"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    },
    
    "I Know You Rider": {
        artist: "Grateful Dead",
        chordChart: {
            ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/grateful-dead/i-know-you-rider-chords-1677346"
        },
        spotifyVersions: [],
        practiceTracks: { bass: [], leadGuitar: [], rhythmGuitar: [], keys: [], drums: [] },
        moisesParts: {},
        harmonies: { sections: [] },
        rehearsalNotes: [],
        gigNotes: []
    }
};
