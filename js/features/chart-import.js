// ============================================================================
// js/features/chart-import.js
// "Jam Band Starter Pack" — import curated songs with chord charts, key, BPM
// pre-filled so new bands have a ready-to-play library from day one.
//
// DEPENDS ON:
//   js/core/firebase-service.js — saveBandDataToDrive, loadBandDataFromDrive
//   js/features/songs.js        — renderSongs, loadCustomSongs (via app.js)
//   js/core/utils.js            — showToast
//   app.js                      — requireSignIn, allSongs, currentUserEmail
// ============================================================================

'use strict';

// ─── Starter Pack catalog ────────────────────────────────────────────────────
// Each entry: { title, band, key, bpm, feel, chart }
// chart is the plain-text chord chart shown in Practice Mode.
// Songs already in allSongs will NOT be re-added as custom songs but WILL
// have their chart/key/bpm data imported.

var STARTER_PACK = [

    // ── Grateful Dead ────────────────────────────────────────────────────────
    {
        title: "Friend of the Devil",
        band: "GD",
        key: "G major",
        bpm: 140,
        feel: "Country, medium shuffle",
        chart: `Friend of the Devil — G major (140 BPM, country shuffle)

VERSE (x3):
G             C
I lit out from Reno, I was trailed by twenty hounds
G                     D
Didn't get to sleep that night till the morning came around

CHORUS:
G                  D
Set out runnin' but I take my time
C                       G
A friend of the devil is a friend of mine
G                  D
If I get home before daylight
C              G
I just might get some sleep tonight

BREAK: G  C  G  D
TAG: G  C  G  D  G`
    },

    {
        title: "Scarlet Begonias",
        band: "GD",
        key: "E major",
        bpm: 130,
        feel: "Upbeat reggae-rock feel",
        chart: `Scarlet Begonias — E major (130 BPM, upbeat)

INTRO: E  A  E  A  E

VERSE:
E                     A
As I was walkin' round Grosvenor Square
E                         A
Not a chill to the winter but a nip to the air
E            A          E  A
From the other direction she was calling my eye
E                A         E    A
A girl from the north country fair with moonbeams in her eye

CHORUS:
A                       E
Scarlet begonias tucked into her curls
A                              E
I knew right away she was not like other girls
A                    E
Other girls

TURNAROUND: E  A  B  A  (x2)
JAM VAMP: E  A  (modal, can stretch)`
    },

    {
        title: "Truckin'",
        band: "GD",
        key: "C major",
        bpm: 124,
        feel: "Rock, driving, medium-fast",
        chart: `Truckin' — C major (124 BPM, driving rock)

INTRO / JAM RIFF: C  Bb  F  C

VERSE:
C                    Bb
Truckin', got my chips cashed in
F                     C
Keep truckin', like the do-dah man
C                     Bb
Together, more or less in line
F                 C
Just keep truckin' on

CHORUS:
F         C
Arrows of neon and flashing marquees
F                  C
Out on Main Street, Chicago, New York, Detroit
Bb               F
It's all on the same street

BRIDGE: G  F  C  (x2)
OUTRO VAMP: C  Bb  F  C`
    },

    {
        title: "Casey Jones",
        band: "GD",
        key: "D major",
        bpm: 138,
        feel: "Country-rock, driving quarter notes",
        chart: `Casey Jones — D major (138 BPM, country-rock)

INTRO: D  (single-note riff, then full)

VERSE:
D                          G
Driving that train, high on cocaine
D                              A
Casey Jones you better watch your speed
D                       G
Trouble ahead, trouble behind
D         A           D
And you know that notion just crossed my mind

CHORUS:
G                 D
This old engine makes it on time
G                    D
Leaves Central Station 'bout a quarter to nine
A                   D
Hits River Junction at seventeen to
A                       D
At a quarter to ten you know it's travelin' again

BRIDGE: G  D  A  D`
    },

    {
        title: "Sugar Magnolia",
        band: "GD",
        key: "A major",
        bpm: 158,
        feel: "Fast country-rock, bright and open",
        chart: `Sugar Magnolia — A major (158 BPM, bright country-rock)

VERSE:
A                          D
Sugar Magnolia, blossoms blooming, heads all empty and I don't care
A                              E           A
She's got everything delightful, she's got everything I need

CHORUS:
D               A
Sometimes when the cuckoo's crying
D                     A
When the moon is halfway down
D                  A
Sometimes when the night is dying
E                    A
I take me out and I wander 'round

SUNSHINE DAYDREAM TAG:
A  D  A  E  (fast, bright — keep it up)
"She's sunlight... doo do doo do"`
    },

    {
        title: "Eyes of the World",
        band: "GD",
        key: "E major",
        bpm: 120,
        feel: "Reggae feel into bright rock jam",
        chart: `Eyes of the World — E major (120 BPM, reggae feel)

INTRO JAM: E  A  (reggae chop, then open)

VERSE:
E                        A
Right outside this lazy summer home
E                          A
You ain't got time to call your soul a critic, no
E                       A
Right outside the lazy gate of winter's summer home

CHORUS:
A                       E
Wake up to find out that you are the eyes of the world
A                          E
The heart has its beaches, its homeland and thoughts of its own
A                       E
Wake now, discover that you are the song that the morning brings
B               A              E
But the heart has its seasons, its evenings and songs of its own

JAM VAMP: E  A  (can stretch, take it out)`
    },

    {
        title: "Estimated Prophet",
        band: "GD",
        key: "B modal (Mixolydian)",
        bpm: 100,
        feel: "Slow reggae, one drop feel, heavy",
        chart: `Estimated Prophet — B Mixolydian (100 BPM, one-drop reggae)

INTRO VAMP: Bm7  (reggae chop, bass holds root)

VERSE:
Bm                    A
California, preachin' on the burning shore
Bm                          A
California, I'll be knockin' on the golden door
Bm                         A
Like an angel standing in a shaft of light

CHORUS:
G           A          Bm
Wait and see what tomorrow brings
G           A              Bm
My time coming, any day, don't worry about me, no

BREAKDOWN: Bm  A  G  (slower, then build)
JAM: Bm vamp — modal jam, drummer holds steady one-drop`
    },

    {
        title: "Fire on the Mountain",
        band: "GD",
        key: "D modal (Dorian)",
        bpm: 112,
        feel: "Hypnotic groove, one chord vamp",
        chart: `Fire on the Mountain — D Dorian (112 BPM, hypnotic)

VAMP: Dm7  (all sections — this is a one-chord groove song)

VERSE:
Dm7
Long distance runner, what you standin' there for?
Dm7
Get up, get out, get out of the door
Dm7
You're playing cold music on the barroom floor

CHORUS (same vamp):
Dm7
Fire! Fire on the mountain!

TIP: Lock into the groove with keys & drums.
Jerry plays D Dorian scale throughout.
The "jam" is just commitment to the vamp — don't rush.`
    },

    {
        title: "Terrapin Station",
        band: "GD",
        key: "A major",
        bpm: 108,
        feel: "Spacious, builds into anthemic outro",
        chart: `Terrapin Station — A major (108 BPM, builds)

PART 1 — "Lady with a Fan":
A                  D
Let my inspiration flow in token lines suggesting rhythm
A                    E                A
That will not forsake me till my tale is told and done

While the firelight's aglow, strange shadows in the flames will grow
Till things we've never seen will seem familiar

PART 2 — "Terrapin":
A                   D
Inspiration, move me brightly
A             E       A
Light the song with sense and color

OUTRO BUILD (key changes up):
Eb major, then Bb major — big anthemic feel
"Counting stars by candlelight..."
End: A  (back home)`
    },

    // ── Widespread Panic ─────────────────────────────────────────────────────
    {
        title: "Chilly Water",
        band: "WSP",
        key: "E minor",
        bpm: 88,
        feel: "Slow, swampy, heavy groove",
        chart: `Chilly Water — E minor (88 BPM, slow swamp groove)

INTRO: Em  (bass-heavy vamp, slow build)

VERSE:
Em                    D
Swim out to the current, ride it to the bend
Em                        D
Nobody's gonna help you, nobody's gonna hold you
Em               D         Em
Down here where the water's cold

CHORUS:
Em          D         C
Chilly water, chilly water
Em      D          Em
Lord it's mercy if you please

JAM VAMP: Em  D  Em  (Dorian feel)
TIP: Sit on the one. Don't rush. Funkier slower.`
    },

    {
        title: "Ain't Life Grand",
        band: "WSP",
        key: "E major",
        bpm: 130,
        feel: "Upbeat rock, bright and punchy",
        chart: `Ain't Life Grand — E major (130 BPM, upbeat rock)

INTRO: E  B  A  E

VERSE:
E              B
Sometimes I feel like I'm in a rut
A                      E
Same old thing, driving me nuts

CHORUS:
E           A
Ain't life grand, ain't it fine
E              B            A  E
Got a good woman, drinkin' good wine

BRIDGE: C#m  B  A  E
JAM: E  A  B  (open rock vamp)`
    },

    {
        title: "Blackout in the Parking Lot",
        band: "WSP",
        key: "A major",
        bpm: 148,
        feel: "High-energy, rock gallop",
        chart: `Blackout in the Parking Lot — A major (148 BPM, gallop)

INTRO RIFF: A  G  D  A

VERSE:
A                 G
Everything went black, standing in the parking lot
D                     A
Car alarm ringing, can't find my keys

CHORUS:
A      G    D    A
Blackout in the parking lot
A      G    D    A
Can't stop now, give it all we got

JAM: A  G  D  (push the tempo, lock keys+drums)`
    },

    // ── Phish ────────────────────────────────────────────────────────────────
    {
        title: "Bouncing Around the Room",
        band: "PHISH",
        key: "B major",
        bpm: 116,
        feel: "Bright, bouncy, happy major feel",
        chart: `Bouncing Around the Room — B major (116 BPM, bright)

INTRO: B  F#  E  B  (capo 4 or full B)

VERSE:
B                 F#
I am a windowsill, watch the rain
E                     B
I will dry quickly in the morning sun

CHORUS:
B             F#
Bouncing around the room
E                  B
Bouncing, bouncing all around

TAG: B  F#  E  B  (repeat and float it out)
TIP: Feel the bounce. Don't rush. Keys + guitar interlock.`
    },

    {
        title: "Waste",
        band: "PHISH",
        key: "G major",
        bpm: 80,
        feel: "Slow, intimate, folky ballad",
        chart: `Waste — G major (80 BPM, gentle ballad)

VERSE:
G              Em
If you see me walking down the street
C                  D
Staring at the sky
G                  Em
Just walk on by, walk on by
C              D
Don't even say hi

CHORUS:
G           C
I just want to waste my time with you
G           D
Yeah I just want to waste my time
C                G
I just want to waste my time with you

OUTRO: G  Em  C  D  (slow down, float out)`
    },

    {
        title: "Farmhouse",
        band: "PHISH",
        key: "A major",
        bpm: 92,
        feel: "Country-folk, relaxed groove",
        chart: `Farmhouse — A major (92 BPM, country-folk)

VERSE:
A                   D
May I address your congregation?
A                      E
Is everything alright in the farmhouse?
A               D
A little of the summer haze
A      E          A
Reminds me of the old days

CHORUS:
D               A
I hope that you are satisfied
D                   A
With what you have in life
E               A
It's good enough

TURNAROUND: A  D  E  A
TIP: Keep the tempo relaxed. Space is your friend.`
    },

    // ── Jerry Garcia Band ────────────────────────────────────────────────────
    {
        title: "Cats Under the Stars",
        band: "JGB",
        key: "G major",
        bpm: 118,
        feel: "Smooth country-rock, laid-back",
        chart: `Cats Under the Stars — G major (118 BPM, laid-back rock)

INTRO: G  C  G  D

VERSE:
G                C
Sun is on the ocean and the radio is on
G                  D
Driving down this highway, singing a song
G              C
Lady by my side is laughing in the sun
G          D         G
We don't need no reason, we're just having fun

CHORUS:
C                G
Cats under the stars, alive in the night
C               G         D
Everything is right, doing alright
G (resolve)

JAM: G  C  D  (smooth, open and breathe)`
    },

    {
        title: "Midnight Moonlight",
        band: "JGB",
        key: "A minor",
        bpm: 80,
        feel: "Slow blues, gospel, brooding",
        chart: `Midnight Moonlight — A minor (80 BPM, slow blues/gospel)

INTRO: Am  G  F  E  (descending minor, slow)

VERSE:
Am              G
Won't you miss me when I'm gone
F                     E
Won't you miss me when I'm gone
Am              G
When I'm back on the road again
F                  E
Won't you wish you'd held on?

CHORUS:
Am           G
Midnight moonlight, silver and cold
F            E
Shining on the river
Am           G         F   E
An old man's stories, an old story told

BRIDGE: F  G  Am  (build back)
OUTRO: Am vamp (slow, stretch it out)`
    },

    // ── Allman Brothers ──────────────────────────────────────────────────────
    {
        title: "Melissa",
        band: "ABB",
        key: "E major",
        bpm: 76,
        feel: "Slow, country-blues ballad, open feel",
        chart: `Melissa — E major (76 BPM, slow ballad)

INTRO: E  Emaj7  E7  A  (descending E motif)

VERSE:
E             Emaj7        E7         A
Crossroads, seem to come and go, yeah
E            Emaj7       E7        A
The gypsy flies from coast to coast
F#m                     A
Knowing many, loving none
E             B               A    E
Bearing sorrow, havin' fun, but back home he'll always run

CHORUS:
A                 E
Sweet Melissa... 
G#m         A         E
Mmm... (let it breathe)

OUTRO: E  Emaj7  E7  A  (slow fade, hold the emotion)`
    },

    {
        title: "Whipping Post",
        band: "ABB",
        key: "A minor",
        bpm: 96,
        feel: "Blues-rock, 11/8 feel in intro, pushes hard",
        chart: `Whipping Post — A minor (96 BPM, blues-rock)

INTRO RIFF (11/8 or play it in 4 feel):
Am (bass-driven single-note line)

VERSE (4/4):
Am                G         F
I've been run down and I've been lied to
Am                    G              F
And I don't know why I let that mean woman make me a fool
Am             G               F
She took all my money, wrecked my brand new car
Am              G                F
Now she's with one of my good time buddies, they're drinking in some cross-town bar

CHORUS:
Dm7          F           Am
Lord, I'm down on the whipping post
Dm7          F           Am
Good Lord, I feel like I'm dying

JAM: Am vamp — push it, let it build to full freak out`
    },

    // ── Goose ────────────────────────────────────────────────────────────────
    {
        title: "Arrow",
        band: "GOOSE",
        key: "C# minor",
        bpm: 110,
        feel: "Anthemic indie-rock, builds to big jam",
        chart: `Arrow — C# minor (110 BPM, anthemic)

INTRO: C#m  A  E  B

VERSE:
C#m               A
I'm running through the forest trying to find my way
E                      B
I left the road behind me, I've been gone for days

CHORUS:
A                E
Like an arrow through the dark
B                   C#m
I will find my way home
A                  E
Like an arrow finding its mark
B                    C#m
Piercing through to the bone

JAM VAMP: C#m  A  E  B  (open it up — modal shift to C# Dorian works)
TIP: Transition into floating single-chord drone before return.`
    },

    {
        title: "Arcadia",
        band: "GOOSE",
        key: "G major",
        bpm: 105,
        feel: "Driving, hypnotic, gradual build",
        chart: `Arcadia — G major (105 BPM, hypnotic build)

INTRO VAMP: G  D  Am  C  (4-chord loop — this is 90% of the song)

VERSE:
G              D
I'm going where the river bends
Am                C
I'll find a place where summer never ends

CHORUS (same vamp, lift the energy):
G     D    Am   C
Arcadia... Arcadia...

JAM: G  D  Am  C
TIP: This is about dynamics and long builds.
     Start whisper-quiet and don't peak until late.
     Lock keys groove with rhythm guitar.`
    },

    // ── Dave Matthews Band ───────────────────────────────────────────────────
    {
        title: "Crash Into Me",
        band: "DMB",
        key: "D major",
        bpm: 100,
        feel: "Acoustic ballad feel, signature fingerpicking pattern",
        chart: `Crash Into Me — D major (100 BPM, acoustic ballad)

INTRO: Dsus2  A  Bm7  G  (capo 2 optional for feel)

VERSE:
Dsus2            A
You've got your ball, you've got your chain
Bm7               G
Tied to me tight, tie me up again

PRE-CHORUS:
Bm7          A
Who's got their claws in you my friend
G                      A
Into your heart I'll beat again

CHORUS:
Dsus2       A
Sweet like candy to my soul
Bm7              G
Sweet you rock and sweet you roll
Dsus2           A
Lost for you, I'm so lost for you
Bm7          G        A   Dsus2
Crash into me, and I come into you

OUTRO: Dsus2  A  Bm7  G  (slow fade)`
    },

    {
        title: "Ants Marching",
        band: "DMB",
        key: "D major",
        bpm: 165,
        feel: "Uptempo, intricate, driving 16th note feel",
        chart: `Ants Marching — D major (165 BPM, fast and intricate)

INTRO RIFF: D  C#  Bm  A  G  (violin/keys signature riff)

VERSE:
D                   C#
He wakes up in the morning
Bm               A
Does his teeth bite to eat and he's rolling
G                    D
Never changes a thing the week ends, the week begins

CHORUS:
G                  D
We all do it the same way
G              D
Ants marching carry food
G                D           A
Doodle-oop... Take these chances

JAM / BREAK: D  A  Bm  G  (tighten up rhythm, then let it breathe)
TIP: The 16th-note lock between drums and bass is everything here.`
    }

];

// ─── Band display metadata ────────────────────────────────────────────────────
var BAND_META = {
    GD:    { label: 'Grateful Dead',    emoji: '💀' },
    JGB:   { label: 'Jerry Garcia Band', emoji: '🎸' },
    WSP:   { label: 'Widespread Panic', emoji: '🌀' },
    PHISH: { label: 'Phish',            emoji: '🐟' },
    ABB:   { label: 'Allman Brothers',  emoji: '🍑' },
    GOOSE: { label: 'Goose',            emoji: '🪿' },
    DMB:   { label: 'Dave Matthews Band', emoji: '☀️' }
};

// ─── Public API ───────────────────────────────────────────────────────────────

window.showChartImportModal = function showChartImportModal() {
    if (!requireSignIn()) return;
    var existing = document.getElementById('chartImportModal');
    if (existing) existing.remove();

    // Group songs by band
    var byBand = {};
    STARTER_PACK.forEach(function(song) {
        var b = song.band;
        if (!byBand[b]) byBand[b] = [];
        byBand[b].push(song);
    });

    // Build rows HTML
    var bandOrder = ['GD','JGB','WSP','PHISH','ABB','GOOSE','DMB'];
    var rowsHtml = '';
    bandOrder.forEach(function(band) {
        var songs = byBand[band];
        if (!songs) return;
        var meta = BAND_META[band] || { label: band, emoji: '🎵' };
        rowsHtml += '<div class="ci-band-header">' + meta.emoji + ' ' + meta.label + '</div>';
        songs.forEach(function(song) {
            var isAlreadyInLib = typeof allSongs !== 'undefined' && allSongs.find(function(s) {
                return s.title.toLowerCase() === song.title.toLowerCase();
            });
            var statusLabel = isAlreadyInLib
                ? '<span class="ci-status ci-status-lib">In Library</span>'
                : '<span class="ci-status ci-status-custom">Custom</span>';
            rowsHtml += '<label class="ci-row" data-title="' + song.title.replace(/"/g,'&quot;') + '">' +
                '<input type="checkbox" class="ci-check" value="' + song.title.replace(/"/g,'&quot;') + '" checked>' +
                '<div class="ci-row-info">' +
                  '<span class="ci-title">' + song.title + '</span>' +
                  '<span class="ci-meta">' +
                    '<span class="ci-key">🎵 ' + song.key + '</span>' +
                    '<span class="ci-bpm">🥁 ' + song.bpm + ' BPM</span>' +
                    '<span class="ci-feel">' + song.feel + '</span>' +
                  '</span>' +
                '</div>' +
                statusLabel +
            '</label>';
        });
    });

    var modal = document.createElement('div');
    modal.id = 'chartImportModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto';

    modal.innerHTML = `
    <div style="background:var(--bg-card,#1e293b);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:16px;padding:0;max-width:560px;width:100%;color:var(--text,#f1f5f9);margin:auto;overflow:hidden">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,rgba(102,126,234,0.15),rgba(118,75,162,0.15));padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.06)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                    <h3 style="margin:0 0 4px;font-size:1.15em;color:#a5b4fc">🎸 Jam Band Starter Pack</h3>
                    <p style="margin:0;color:#64748b;font-size:0.8em">Import songs with chord charts, key & BPM pre-filled — ready for Practice Mode</p>
                </div>
                <button onclick="document.getElementById('chartImportModal').remove()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:1.3em;padding:0 0 0 12px;flex-shrink:0">✕</button>
            </div>
            <div style="display:flex;gap:8px;margin-top:14px">
                <button onclick="ciSelectAll(true)" style="background:rgba(102,126,234,0.15);border:1px solid rgba(102,126,234,0.3);color:#a5b4fc;padding:5px 12px;border-radius:20px;cursor:pointer;font-size:0.78em;font-weight:600">✅ Select All</button>
                <button onclick="ciSelectAll(false)" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#94a3b8;padding:5px 12px;border-radius:20px;cursor:pointer;font-size:0.78em;font-weight:600">☐ Deselect All</button>
                <span id="ciSelCount" style="margin-left:auto;color:#64748b;font-size:0.78em;align-self:center"></span>
            </div>
        </div>

        <!-- Song list -->
        <div id="ciSongList" style="max-height:55vh;overflow-y:auto;padding:12px 0">
            <style>
                .ci-band-header{padding:10px 20px 4px;font-size:0.7em;font-weight:800;letter-spacing:0.08em;color:#64748b;text-transform:uppercase}
                .ci-row{display:flex;align-items:center;gap:12px;padding:9px 20px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid rgba(255,255,255,0.03)}
                .ci-row:hover{background:rgba(255,255,255,0.04)}
                .ci-check{accent-color:#667eea;width:15px;height:15px;flex-shrink:0;cursor:pointer}
                .ci-row-info{flex:1;min-width:0}
                .ci-title{display:block;font-size:0.9em;font-weight:600;color:#e2e8f0;margin-bottom:2px}
                .ci-meta{display:flex;gap:8px;flex-wrap:wrap}
                .ci-key,.ci-bpm{font-size:0.72em;color:#94a3b8}
                .ci-feel{font-size:0.72em;color:#64748b;font-style:italic}
                .ci-status{font-size:0.68em;font-weight:700;padding:2px 7px;border-radius:10px;flex-shrink:0;align-self:center}
                .ci-status-lib{background:rgba(34,197,94,0.15);color:#4ade80;border:1px solid rgba(34,197,94,0.2)}
                .ci-status-custom{background:rgba(102,126,234,0.12);color:#818cf8;border:1px solid rgba(102,126,234,0.2)}
                .ci-row input:checked ~ .ci-row-info .ci-title{color:#a5b4fc}
            </style>
            ${rowsHtml}
        </div>

        <!-- Footer -->
        <div style="padding:16px 20px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:10px;align-items:center">
            <div style="flex:1;font-size:0.75em;color:#64748b">
                <b style="color:#94a3b8">What gets imported:</b> Chord chart, key, BPM — visible in Practice Mode immediately.
                Songs already in the library just get chart data added.
            </div>
            <button id="ciImportBtn" class="btn btn-primary" style="flex-shrink:0;font-size:0.85em;padding:9px 18px" onclick="runChartImport()">
                🎸 Import
            </button>
        </div>
    </div>`;

    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    ciUpdateCount();
    // Wire checkboxes to counter
    modal.querySelectorAll('.ci-check').forEach(function(cb) {
        cb.addEventListener('change', ciUpdateCount);
    });
};

window.ciSelectAll = function ciSelectAll(checked) {
    document.querySelectorAll('#chartImportModal .ci-check').forEach(function(cb) { cb.checked = checked; });
    ciUpdateCount();
};

window.ciUpdateCount = function ciUpdateCount() {
    var all = document.querySelectorAll('#chartImportModal .ci-check');
    var sel = document.querySelectorAll('#chartImportModal .ci-check:checked');
    var el = document.getElementById('ciSelCount');
    if (el) el.textContent = sel.length + ' / ' + all.length + ' selected';
};

window.runChartImport = async function runChartImport() {
    if (!requireSignIn()) return;

    var checked = Array.from(document.querySelectorAll('#chartImportModal .ci-check:checked'));
    if (checked.length === 0) { showToast('⚠️ No songs selected'); return; }

    var btn = document.getElementById('ciImportBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Importing…'; }

    var selectedTitles = checked.map(function(cb) { return cb.value; });
    var toImport = STARTER_PACK.filter(function(s) { return selectedTitles.includes(s.title); });

    var customAdded = [];
    var chartsSaved = 0;
    var errors = 0;

    // Load existing custom songs once
    var existing = [];
    try {
        existing = toArray(await loadBandDataFromDrive('_band', 'custom_songs') || []);
    } catch(e) { existing = []; }

    for (var i = 0; i < toImport.length; i++) {
        var song = toImport[i];
        try {
            // 1. Save chord chart
            await saveBandDataToDrive(song.title, 'chart', { text: song.chart, importedAt: new Date().toISOString() });
            chartsSaved++;

            // 2. Save key (dual-write via GLStore if available)
            if (typeof GLStore !== 'undefined' && GLStore.updateSongField) {
                await GLStore.updateSongField(song.title, 'key', song.key);
            } else {
                await saveBandDataToDrive(song.title, 'key', { key: song.key, updatedAt: new Date().toISOString() });
            }

            // 3. Save BPM (dual-write via GLStore if available)
            if (typeof GLStore !== 'undefined' && GLStore.updateSongField) {
                await GLStore.updateSongField(song.title, 'bpm', song.bpm);
            } else {
                await saveBandDataToDrive(song.title, 'song_bpm', { bpm: song.bpm, updatedAt: new Date().toISOString() });
            }

            // 4. If not in main allSongs library, add as custom song
            var inLib = typeof allSongs !== 'undefined' && allSongs.find(function(s) {
                return s.title.toLowerCase() === song.title.toLowerCase();
            });
            if (!inLib) {
                var alreadyCustom = existing.find(function(s) {
                    return s.title.toLowerCase() === song.title.toLowerCase();
                });
                if (!alreadyCustom) {
                    existing.push({
                        title: song.title,
                        band: song.band,
                        notes: song.feel,
                        key: song.key,
                        bpm: song.bpm,
                        addedBy: typeof currentUserEmail !== 'undefined' ? currentUserEmail : 'import',
                        addedAt: new Date().toISOString(),
                        fromStarterPack: true
                    });
                    customAdded.push(song.title);
                }
            }
        } catch(e) {
            console.error('Chart import error for', song.title, e);
            errors++;
        }
    }

    // Save updated custom songs list once
    if (customAdded.length > 0) {
        try {
            await saveBandDataToDrive('_band', 'custom_songs', existing);
        } catch(e) {
            console.error('Failed to save custom songs', e);
        }
    }

    document.getElementById('chartImportModal')?.remove();

    // Refresh song list
    if (typeof loadCustomSongs === 'function') await loadCustomSongs();
    if (typeof renderSongs === 'function') renderSongs();

    // Summary toast
    var msg = '✅ Imported ' + chartsSaved + ' charts';
    if (customAdded.length > 0) msg += ', added ' + customAdded.length + ' custom songs';
    if (errors > 0) msg += ' (' + errors + ' errors)';
    if (typeof showToast === 'function') showToast(msg);
};

console.log('✅ chart-import.js loaded — ' + STARTER_PACK.length + ' songs in Starter Pack');
