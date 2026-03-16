// ============================================================================
// DEADCETERA WORKFLOW DATA
// ============================================================================
// Complete song catalog + Top 5 versions for each song
// ============================================================================

// Full song catalog (all Grateful Dead + JGB songs)
const allSongs = [
    // Grateful Dead
    { songId: "gd_aiko_aiko", title: "Aiko Aiko", artist: "GD", band: "GD" },
    { songId: "gd_alabama_getaway", title: "Alabama Getaway", artist: "GD", band: "GD" },
    { songId: "gd_althea", title: "Althea", artist: "GD", band: "GD" },
    { songId: "gd_around_and_around", title: "Around and Around", artist: "GD", band: "GD" },
    { songId: "gd_attics_of_my_life", title: "Attics of My Life", artist: "GD", band: "GD" },
    { songId: "gd_bertha", title: "Bertha", artist: "GD", band: "GD" },
    { songId: "gd_big_river", title: "Big River", artist: "GD", band: "GD" },
    { songId: "gd_bird_song", title: "Bird Song", artist: "GD", band: "GD" },
    { songId: "gd_black_peter", title: "Black Peter", artist: "GD", band: "GD" },
    { songId: "gd_blackthroated_wind", title: "Black-Throated Wind", artist: "GD", band: "GD" },
    { songId: "gd_box_of_rain", title: "Box of Rain", artist: "GD", band: "GD" },
    { songId: "gd_brokedown_palace", title: "Brokedown Palace", artist: "GD", band: "GD" },
    { songId: "gd_browneyed_women", title: "Brown-Eyed Women", artist: "GD", band: "GD" },
    { songId: "gd_candyman", title: "Candyman", artist: "GD", band: "GD" },
    { songId: "gd_casey_jones", title: "Casey Jones", artist: "GD", band: "GD" },
    { songId: "gd_cassidy", title: "Cassidy", artist: "GD", band: "GD" },
    { songId: "gd_china_cat_sunflower", title: "China Cat Sunflower", artist: "GD", band: "GD" },
    { songId: "gd_china_doll", title: "China Doll", artist: "GD", band: "GD" },
    { songId: "gd_cold_rain_and_snow", title: "Cold Rain and Snow", artist: "GD", band: "GD" },
    { songId: "gd_cosmic_charlie", title: "Cosmic Charlie", artist: "GD", band: "GD" },
    { songId: "gd_cream_puff_war", title: "Cream Puff War", artist: "GD", band: "GD" },
    { songId: "gd_cumberland_blues", title: "Cumberland Blues", artist: "GD", band: "GD" },
    { songId: "gd_dancing_in_the_street", title: "Dancing in the Street", artist: "GD", band: "GD" },
    { songId: "gd_dark_star", title: "Dark Star", artist: "GD", band: "GD" },
    { songId: "gd_days_between", title: "Days Between", artist: "GD", band: "GD" },
    { songId: "gd_deal", title: "Deal", artist: "GD", band: "GD" },
    { songId: "gd_dire_wolf", title: "Dire Wolf", artist: "GD", band: "GD" },
    { songId: "gd_duprees_diamond_blues", title: "Dupree's Diamond Blues", artist: "GD", band: "GD" },
    { songId: "gd_easy_wind", title: "Easy Wind", artist: "GD", band: "GD" },
    { songId: "gd_estimated_prophet", title: "Estimated Prophet", artist: "GD", band: "GD" },
    { songId: "gd_eyes_of_the_world", title: "Eyes of the World", artist: "GD", band: "GD" },
    { songId: "gd_fire_on_the_mountain", title: "Fire on the Mountain", artist: "GD", band: "GD" },
    { songId: "gd_foolish_heart", title: "Foolish Heart", artist: "GD", band: "GD" },
    { songId: "gd_franklins_tower", title: "Franklin's Tower", artist: "GD", band: "GD" },
    { songId: "gd_friend_of_the_devil", title: "Friend of the Devil", artist: "GD", band: "GD" },
    { songId: "gd_good_lovin", title: "Good Lovin'", artist: "GD", band: "GD" },
    { songId: "gd_greatest_story_ever_told", title: "Greatest Story Ever Told", artist: "GD", band: "GD" },
    { songId: "gd_hes_gone", title: "He's Gone", artist: "GD", band: "GD" },
    { songId: "gd_help_on_the_way", title: "Help on the Way", artist: "GD", band: "GD" },
    { songId: "gd_high_time", title: "High Time", artist: "GD", band: "GD" },
    { songId: "gd_i_know_you_rider", title: "I Know You Rider", artist: "GD", band: "GD" },
    { songId: "gd_jack_straw", title: "Jack Straw", artist: "GD", band: "GD" },
    { songId: "gd_lazy_lightnin", title: "Lazy Lightnin'", artist: "GD", band: "GD" },
    { songId: "gd_let_it_grow", title: "Let It Grow", artist: "GD", band: "GD" },
    { songId: "gd_loser", title: "Loser", artist: "GD", band: "GD" },
    { songId: "gd_looks_like_rain", title: "Looks Like Rain", artist: "GD", band: "GD" },
    { songId: "gd_mexicali_blues", title: "Mexicali Blues", artist: "GD", band: "GD" },
    { songId: "gd_mississippi_halfstep", title: "Mississippi Half-Step", artist: "GD", band: "GD" },
    { songId: "gd_morning_dew", title: "Morning Dew", artist: "GD", band: "GD" },
    { songId: "gd_mountains_of_the_moon", title: "Mountains of the Moon", artist: "GD", band: "GD" },
    { songId: "gd_music_never_stopped", title: "Music Never Stopped", artist: "GD", band: "GD" },
    { songId: "gd_new_minglewood_blues", title: "New Minglewood Blues", artist: "GD", band: "GD" },
    { songId: "gd_not_fade_away", title: "Not Fade Away", artist: "GD", band: "GD" },
    { songId: "gd_one_more_saturday_night", title: "One More Saturday Night", artist: "GD", band: "GD" },
    { songId: "gd_peggyo", title: "Peggy-O", artist: "GD", band: "GD" },
    { songId: "gd_playing_in_the_band", title: "Playing in the Band", artist: "GD", band: "GD" },
    { songId: "gd_promised_land", title: "Promised Land", artist: "GD", band: "GD" },
    { songId: "gd_ramble_on_rose", title: "Ramble On Rose", artist: "GD", band: "GD" },
    { songId: "gd_ripple", title: "Ripple", artist: "GD", band: "GD" },
    { songId: "gd_row_jimmy", title: "Row Jimmy", artist: "GD", band: "GD" },
    { songId: "gd_samson_and_delilah", title: "Samson and Delilah", artist: "GD", band: "GD" },
    { songId: "gd_scarlet_begonias", title: "Scarlet Begonias", artist: "GD", band: "GD" },
    { songId: "gd_shakedown_street", title: "Shakedown Street", artist: "GD", band: "GD" },
    { songId: "gd_ship_of_fools", title: "Ship of Fools", artist: "GD", band: "GD" },
    { songId: "gd_slipknot", title: "Slipknot!", artist: "GD", band: "GD" },
    { songId: "gd_st_stephen", title: "St Stephen", artist: "GD", band: "GD" },
    { songId: "gd_standing_on_the_moon", title: "Standing on the Moon", artist: "GD", band: "GD" },
    { songId: "gd_stella_blue", title: "Stella Blue", artist: "GD", band: "GD" },
    { songId: "gd_sugar_magnolia", title: "Sugar Magnolia", artist: "GD", band: "GD" },
    { songId: "gd_sugaree", title: "Sugaree", artist: "GD", band: "GD" },
    { songId: "gd_sunrise", title: "Sunrise", artist: "GD", band: "GD" },
    { songId: "gd_tennessee_jed", title: "Tennessee Jed", artist: "GD", band: "GD" },
    { songId: "gd_terrapin_station", title: "Terrapin Station", artist: "GD", band: "GD" },
    { songId: "gd_the_other_one", title: "The Other One", artist: "GD", band: "GD" },
    { songId: "gd_they_love_each_other", title: "They Love Each Other", artist: "GD", band: "GD" },
    { songId: "gd_touch_of_grey", title: "Touch of Grey", artist: "GD", band: "GD" },
    { songId: "gd_truckin", title: "Truckin'", artist: "GD", band: "GD" },
    { songId: "gd_turn_on_your_love_light", title: "Turn On Your Love Light", artist: "GD", band: "GD" },
    { songId: "gd_us_blues", title: "US Blues", artist: "GD", band: "GD" },
    { songId: "gd_uncle_johns_band", title: "Uncle John's Band", artist: "GD", band: "GD" },
    { songId: "gd_viola_lee_blues", title: "Viola Lee Blues", artist: "GD", band: "GD" },
    { songId: "gd_wharf_rat", title: "Wharf Rat", artist: "GD", band: "GD" },
    
    // Jerry Garcia Band
    { songId: "jgb_after_midnight", title: "After Midnight", artist: "JGB", band: "JGB" },
    { songId: "jgb_aint_no_bread_in_the_breadbox", title: "Ain't No Bread in the Breadbox", artist: "JGB", band: "JGB" },
    { songId: "jgb_catfish_john", title: "Catfish John", artist: "JGB", band: "JGB" },
    { songId: "jgb_dear_prudence", title: "Dear Prudence", artist: "JGB", band: "JGB" },
    { songId: "jgb_dont_let_go", title: "Don't Let Go", artist: "JGB", band: "JGB" },
    { songId: "jgb_gomorrah", title: "Gomorrah", artist: "JGB", band: "JGB" },
    { songId: "jgb_how_sweet_it_is", title: "How Sweet It Is", artist: "JGB", band: "JGB" },
    { songId: "jgb_i_shall_be_released", title: "I Shall Be Released", artist: "JGB", band: "JGB" },
    { songId: "jgb_knockin_on_heavens_door", title: "Knockin' on Heaven's Door", artist: "JGB", band: "JGB" },
    { songId: "jgb_mission_in_the_rain", title: "Mission in the Rain", artist: "JGB", band: "JGB" },
    { songId: "jgb_positively_4th_street", title: "Positively 4th Street", artist: "JGB", band: "JGB" },
    { songId: "jgb_reuben_and_cherise", title: "Reuben and Cherise", artist: "JGB", band: "JGB" },
    { songId: "jgb_run_for_the_roses", title: "Run for the Roses", artist: "JGB", band: "JGB" },
    { songId: "jgb_shining_star", title: "Shining Star", artist: "JGB", band: "JGB" },
    { songId: "jgb_tangled_up_in_blue", title: "Tangled Up in Blue", artist: "JGB", band: "JGB" },
    { songId: "jgb_thats_what_love_will_make_you_do", title: "That's What Love Will Make You Do", artist: "JGB", band: "JGB" },
    { songId: "jgb_the_night_they_drove_old_dixie_down", title: "The Night They Drove Old Dixie Down", artist: "JGB", band: "JGB" },
    { songId: "jgb_the_harder_they_come", title: "The Harder They Come", artist: "JGB", band: "JGB" },
    { songId: "jgb_waiting_for_a_miracle", title: "Waiting for a Miracle", artist: "JGB", band: "JGB" },
    
    // Widespread Panic
    { songId: "wsp_action_man", title: "Action Man", artist: "WSP", band: "WSP" },
    { songId: "wsp_aint_life_grand", title: "Ain't Life Grand", artist: "WSP", band: "WSP" },
    { songId: "wsp_all_time_low", title: "All Time Low", artist: "WSP", band: "WSP" },
    { songId: "wsp_anditstoned", title: "AndItStoned", artist: "WSP", band: "WSP" },
    { songId: "wsp_angel_from_montgomery", title: "Angel From Montgomery", artist: "WSP", band: "WSP" },
    { songId: "wsp_another_joyous_occasion", title: "Another Joyous Occasion", artist: "WSP", band: "WSP" },
    { songId: "wsp_arleen", title: "Arleen", artist: "WSP", band: "WSP" },
    { songId: "wsp_aunt_avis", title: "Aunt Avis", artist: "WSP", band: "WSP" },
    { songId: "wsp_barstools_and_dreamers", title: "Barstools and Dreamers", artist: "WSP", band: "WSP" },
    { songId: "wsp_beacon", title: "Beacon", artist: "WSP", band: "WSP" },
    { songId: "wsp_bears_gone_fishin", title: "Bear's Gone Fishin'", artist: "WSP", band: "WSP" },
    { songId: "wsp_beatdown", title: "Beatdown", artist: "WSP", band: "WSP" },
    { songId: "wsp_benefit_of_doubt", title: "Benefit of Doubt", artist: "WSP", band: "WSP" },
    { songId: "wsp_big_wooly_mammoth", title: "Big Wooly Mammoth", artist: "WSP", band: "WSP" },
    { songId: "wsp_blackout_blues", title: "Blackout Blues", artist: "WSP", band: "WSP" },
    { songId: "wsp_blue_indian", title: "Blue Indian", artist: "WSP", band: "WSP" },
    { songId: "wsp_bombs_butterflies", title: "Bombs & Butterflies", artist: "WSP", band: "WSP" },
    { songId: "wsp_boom_boom_boom", title: "Boom Boom Boom (WSP)", artist: "WSP", band: "WSP" },
    { songId: "wsp_bust_it_big", title: "Bust It Big", artist: "WSP", band: "WSP" },
    { songId: "wsp_chainsaw_city", title: "Chainsaw City", artist: "WSP", band: "WSP" },
    { songId: "wsp_chilly_water", title: "Chilly Water", artist: "WSP", band: "WSP" },
    { songId: "wsp_city_of_dreams", title: "City of Dreams", artist: "WSP", band: "WSP" },
    { songId: "wsp_climb_to_safety", title: "Climb to Safety", artist: "WSP", band: "WSP" },
    { songId: "wsp_conrad", title: "Conrad", artist: "WSP", band: "WSP" },
    { songId: "wsp_cotton_was_king", title: "Cotton Was King", artist: "WSP", band: "WSP" },
    { songId: "wsp_crazy", title: "Crazy", artist: "WSP", band: "WSP" },
    { songId: "wsp_dark_bar", title: "Dark Bar", artist: "WSP", band: "WSP" },
    { songId: "wsp_desparado", title: "Desparado", artist: "WSP", band: "WSP" },
    { songId: "wsp_diner", title: "Diner", artist: "WSP", band: "WSP" },
    { songId: "wsp_disco", title: "Disco", artist: "WSP", band: "WSP" },
    { songId: "wsp_do_it_every_day", title: "Do It Every Day", artist: "WSP", band: "WSP" },
    { songId: "wsp_doreatha", title: "Doreatha", artist: "WSP", band: "WSP" },
    { songId: "wsp_down", title: "Down", artist: "WSP", band: "WSP" },
    { songId: "wsp_driving_song", title: "Driving Song", artist: "WSP", band: "WSP" },
    { songId: "wsp_drums", title: "Drums", artist: "WSP", band: "WSP" },
    { songId: "wsp_end_of_the_show", title: "End of the Show", artist: "WSP", band: "WSP" },
    { songId: "wsp_estimator", title: "Estimator", artist: "WSP", band: "WSP" },
    { songId: "wsp_expiration_date", title: "Expiration Date", artist: "WSP", band: "WSP" },
    { songId: "wsp_fishing", title: "Fishing", artist: "WSP", band: "WSP" },
    { songId: "wsp_flying", title: "Flying", artist: "WSP", band: "WSP" },
    { songId: "wsp_from_the_cradle", title: "From the Cradle", artist: "WSP", band: "WSP" },
    { songId: "wsp_glow", title: "Glow", artist: "WSP", band: "WSP" },
    { songId: "wsp_good_people", title: "Good People", artist: "WSP", band: "WSP" },
    { songId: "wsp_goodnight_saigon", title: "Goodnight Saigon", artist: "WSP", band: "WSP" },
    { songId: "wsp_gradle", title: "Gradle", artist: "WSP", band: "WSP" },
    { songId: "wsp_gradle_crisp", title: "Gradle (Crisp)", artist: "WSP", band: "WSP" },
    { songId: "wsp_heaven", title: "Heaven", artist: "WSP", band: "WSP" },
    { songId: "wsp_henry_parsons_died", title: "Henry Parsons Died", artist: "WSP", band: "WSP" },
    { songId: "wsp_heroes", title: "Heroes", artist: "WSP", band: "WSP" },
    { songId: "wsp_holden_oversoul", title: "Holden Oversoul", artist: "WSP", band: "WSP" },
    { songId: "wsp_hope_in_a_letter", title: "Hope in a Letter", artist: "WSP", band: "WSP" },
    { songId: "wsp_hopeless_star", title: "Hopeless Star", artist: "WSP", band: "WSP" },
    { songId: "wsp_im_not_alone", title: "I'm Not Alone", artist: "WSP", band: "WSP" },
    { songId: "wsp_imitation_leather_shoes", title: "Imitation Leather Shoes", artist: "WSP", band: "WSP" },
    { songId: "wsp_impossible", title: "Impossible", artist: "WSP", band: "WSP" },
    { songId: "wsp_interstate_10", title: "Interstate 10", artist: "WSP", band: "WSP" },
    { songId: "wsp_jr", title: "Jr", artist: "WSP", band: "WSP" },
    { songId: "wsp_junior", title: "Junior", artist: "WSP", band: "WSP" },
    { songId: "wsp_let_it_rock", title: "Let It Rock", artist: "WSP", band: "WSP" },
    { songId: "wsp_lets_get_down_to_business", title: "Let's Get Down to Business", artist: "WSP", band: "WSP" },
    { songId: "wsp_light_fuse_get_away", title: "Light Fuse, Get Away", artist: "WSP", band: "WSP" },
    { songId: "wsp_linebacker", title: "Linebacker", artist: "WSP", band: "WSP" },
    { songId: "wsp_lost_and_found", title: "Lost and Found", artist: "WSP", band: "WSP" },
    { songId: "wsp_love_tractor", title: "Love Tractor", artist: "WSP", band: "WSP" },
    { songId: "wsp_machine", title: "Machine", artist: "WSP", band: "WSP" },
    { songId: "wsp_makin_it_work", title: "Makin' It Work", artist: "WSP", band: "WSP" },
    { songId: "wsp_makes_sense_to_me", title: "Makes Sense to Me", artist: "WSP", band: "WSP" },
    { songId: "wsp_mercy", title: "Mercy (WSP)", artist: "WSP", band: "WSP" },
    { songId: "wsp_north", title: "North", artist: "WSP", band: "WSP" },
    { songId: "wsp_one_arm_steve", title: "One Arm Steve", artist: "WSP", band: "WSP" },
    { songId: "wsp_one_kind_favor", title: "One Kind Favor", artist: "WSP", band: "WSP" },
    { songId: "wsp_ophelia", title: "Ophelia", artist: "WSP", band: "WSP" },
    { songId: "wsp_orange_blossom_special", title: "Orange Blossom Special", artist: "WSP", band: "WSP" },
    { songId: "wsp_orch_theme", title: "Orch Theme", artist: "WSP", band: "WSP" },
    { songId: "wsp_outlined", title: "Outlined", artist: "WSP", band: "WSP" },
    { songId: "wsp_porch_song", title: "Porch Song", artist: "WSP", band: "WSP" },
    { songId: "wsp_papa_johnny_road", title: "Papa Johnny Road", artist: "WSP", band: "WSP" },
    { songId: "wsp_papa_legba", title: "Papa Legba", artist: "WSP", band: "WSP" },
    { songId: "wsp_pigeons", title: "Pigeons", artist: "WSP", band: "WSP" },
    { songId: "wsp_pilgrims", title: "Pilgrims", artist: "WSP", band: "WSP" },
    { songId: "wsp_plantation", title: "Plantation", artist: "WSP", band: "WSP" },
    { songId: "wsp_pleas", title: "Pleas", artist: "WSP", band: "WSP" },
    { songId: "wsp_postcard", title: "Postcard", artist: "WSP", band: "WSP" },
    { songId: "wsp_proving_ground", title: "Proving Ground", artist: "WSP", band: "WSP" },
    { songId: "wsp_radio_child", title: "Radio Child", artist: "WSP", band: "WSP" },
    { songId: "wsp_rebirtha", title: "Rebirtha", artist: "WSP", band: "WSP" },
    { songId: "wsp_ride_me_high", title: "Ride Me High", artist: "WSP", band: "WSP" },
    { songId: "wsp_rock", title: "Rock", artist: "WSP", band: "WSP" },
    { songId: "wsp_rock_and_roll_all_nite", title: "Rock and Roll All Nite", artist: "WSP", band: "WSP" },
    { songId: "wsp_rockin_chair", title: "Rockin' Chair", artist: "WSP", band: "WSP" },
    { songId: "wsp_saint_ex", title: "Saint Ex", artist: "WSP", band: "WSP" },
    { songId: "wsp_sell_sell", title: "Sell Sell", artist: "WSP", band: "WSP" },
    { songId: "wsp_sleepy_monkey", title: "Sleepy Monkey", artist: "WSP", band: "WSP" },
    { songId: "wsp_smell_of_patchouli", title: "Smell of Patchouli", artist: "WSP", band: "WSP" },
    { songId: "wsp_space_wrangler", title: "Space Wrangler", artist: "WSP", band: "WSP" },
    { songId: "wsp_stopgo", title: "Stop-Go", artist: "WSP", band: "WSP" },
    { songId: "wsp_surprise_valley", title: "Surprise Valley", artist: "WSP", band: "WSP" },
    { songId: "wsp_tall_boy", title: "Tall Boy", artist: "WSP", band: "WSP" },
    { songId: "wsp_the_last_straw", title: "The Last Straw", artist: "WSP", band: "WSP" },
    { songId: "wsp_the_take_out", title: "The Take Out", artist: "WSP", band: "WSP" },
    { songId: "wsp_the_waker", title: "The Waker", artist: "WSP", band: "WSP" },
    { songId: "wsp_this_cruel_thing", title: "This Cruel Thing", artist: "WSP", band: "WSP" },
    { songId: "wsp_three_candles", title: "Three Candles", artist: "WSP", band: "WSP" },
    { songId: "wsp_tickle_the_truth", title: "Tickle the Truth", artist: "WSP", band: "WSP" },
    { songId: "wsp_time_waits", title: "Time Waits", artist: "WSP", band: "WSP" },
    { songId: "wsp_time_zones", title: "Time Zones", artist: "WSP", band: "WSP" },
    { songId: "wsp_tornado", title: "Tornado", artist: "WSP", band: "WSP" },
    { songId: "wsp_travelin_light", title: "Travelin' Light", artist: "WSP", band: "WSP" },
    { songId: "wsp_trouble", title: "Trouble", artist: "WSP", band: "WSP" },
    { songId: "wsp_true_to_my_nature", title: "True to My Nature", artist: "WSP", band: "WSP" },
    { songId: "wsp_tx", title: "Tx", artist: "WSP", band: "WSP" },
    { songId: "wsp_up_all_night", title: "Up All Night", artist: "WSP", band: "WSP" },
    { songId: "wsp_walk_on_the_flood", title: "Walk On the Flood", artist: "WSP", band: "WSP" },
    { songId: "wsp_walkin_for_your_love", title: "Walkin' (For Your Love)", artist: "WSP", band: "WSP" },
    { songId: "wsp_weight_of_the_world", title: "Weight of the World", artist: "WSP", band: "WSP" },
    { songId: "wsp_wondering", title: "Wondering", artist: "WSP", band: "WSP" },
    { songId: "wsp_weak_brain_strong_back", title: "Weak Brain, Strong Back", artist: "WSP", band: "WSP" },
    { songId: "wsp_who_stole_my_cheese", title: "Who Stole My Cheese?", artist: "WSP", band: "WSP" },
    
    // Allman Brothers Band
    { songId: "abb_aint_wastin_time_no_more", title: "Ain't Wastin' Time No More", artist: "ABB", band: "ABB" },
    { songId: "gd_all_along_the_watchtower", title: "All Along the Watchtower", artist: "GD", band: "GD" },
    { songId: "abb_any_day_now", title: "Any Day Now", artist: "ABB", band: "ABB" },
    { songId: "abb_are_you_lonely_for_me_baby", title: "Are You Lonely for Me Baby", artist: "ABB", band: "ABB" },
    { songId: "abb_back_where_it_all_begins", title: "Back Where It All Begins", artist: "ABB", band: "ABB" },
    { songId: "abb_bad_luck_wind", title: "Bad Luck Wind", artist: "ABB", band: "ABB" },
    { songId: "abb_blue_sky", title: "Blue Sky", artist: "ABB", band: "ABB" },
    { songId: "abb_bound_for_glory", title: "Bound for Glory", artist: "ABB", band: "ABB" },
    { songId: "abb_brother_of_the_road", title: "Brother of the Road", artist: "ABB", band: "ABB" },
    { songId: "abb_calypso", title: "Calypso", artist: "ABB", band: "ABB" },
    { songId: "abb_cant_lose_what_you_never_had", title: "Can't Lose What You Never Had", artist: "ABB", band: "ABB" },
    { songId: "abb_come_on_in_my_kitchen", title: "Come On in My Kitchen", artist: "ABB", band: "ABB" },
    { songId: "abb_crazy_love", title: "Crazy Love", artist: "ABB", band: "ABB" },
    { songId: "abb_dreams", title: "Dreams", artist: "ABB", band: "ABB" },
    { songId: "abb_drunken_hearted_boy", title: "Drunken Hearted Boy", artist: "ABB", band: "ABB" },
    { songId: "abb_elizabeth_reed", title: "Elizabeth Reed", artist: "ABB", band: "ABB" },
    { songId: "abb_end_of_the_line", title: "End of the Line", artist: "ABB", band: "ABB" },
    { songId: "abb_every_hungry_woman", title: "Every Hungry Woman", artist: "ABB", band: "ABB" },
    { songId: "abb_everybodys_got_a_mountain_to_climb", title: "Everybody's Got a Mountain to Climb", artist: "ABB", band: "ABB" },
    { songId: "abb_floating_bridge", title: "Floating Bridge", artist: "ABB", band: "ABB" },
    { songId: "abb_forty_four_blues", title: "Forty Four Blues", artist: "ABB", band: "ABB" },
    { songId: "abb_gamblers_roll", title: "Gambler's Roll", artist: "ABB", band: "ABB" },
    { songId: "abb_good_clean_fun", title: "Good Clean Fun", artist: "ABB", band: "ABB" },
    { songId: "abb_good_morning_little_schoolgirl", title: "Good Morning Little Schoolgirl", artist: "ABB", band: "ABB" },
    { songId: "abb_got_my_mojo_working", title: "Got My Mojo Working", artist: "ABB", band: "ABB" },
    { songId: "abb_high_cost_of_low_living", title: "High Cost of Low Living", artist: "ABB", band: "ABB" },
    { songId: "abb_high_falls", title: "High Falls", artist: "ABB", band: "ABB" },
    { songId: "abb_hot_lanta", title: "Hot 'Lanta", artist: "ABB", band: "ABB" },
    { songId: "abb_im_not_crying", title: "I'm Not Crying", artist: "ABB", band: "ABB" },
    { songId: "abb_in_memory_of_elizabeth_reed", title: "In Memory of Elizabeth Reed", artist: "ABB", band: "ABB" },
    { songId: "abb_it_aint_over_yet", title: "It Ain't Over Yet", artist: "ABB", band: "ABB" },
    { songId: "abb_jessica", title: "Jessica", artist: "ABB", band: "ABB" },
    { songId: "abb_just_another_love_song", title: "Just Another Love Song", artist: "ABB", band: "ABB" },
    { songId: "abb_leavin", title: "Leavin'", artist: "ABB", band: "ABB" },
    { songId: "abb_les_brers_in_a_minor", title: "Les Brers in A Minor", artist: "ABB", band: "ABB" },
    { songId: "abb_little_martha", title: "Little Martha", artist: "ABB", band: "ABB" },
    { songId: "abb_loan_me_a_dime", title: "Loan Me a Dime", artist: "ABB", band: "ABB" },
    { songId: "abb_losing_your_mind", title: "Losing Your Mind", artist: "ABB", band: "ABB" },
    { songId: "abb_low_rider", title: "Low Rider", artist: "ABB", band: "ABB" },
    { songId: "abb_melissa", title: "Melissa", artist: "ABB", band: "ABB" },
    { songId: "abb_midnight_rider", title: "Midnight Rider", artist: "ABB", band: "ABB" },
    { songId: "abb_mountain_jam", title: "Mountain Jam", artist: "ABB", band: "ABB" },
    { songId: "abb_never_knew_how_much_i_needed_you", title: "Never Knew How Much (I Needed You)", artist: "ABB", band: "ABB" },
    { songId: "abb_nobody_knows", title: "Nobody Knows", artist: "ABB", band: "ABB" },
    { songId: "abb_no_one_to_run_with", title: "No One to Run With", artist: "ABB", band: "ABB" },
    { songId: "abb_one_way_out", title: "One Way Out", artist: "ABB", band: "ABB" },
    { songId: "abb_patchwork_quilt", title: "Patchwork Quilt", artist: "ABB", band: "ABB" },
    { songId: "abb_pegasus", title: "Pegasus", artist: "ABB", band: "ABB" },
    { songId: "abb_pleased_to_meet_you", title: "Pleased to Meet You", artist: "ABB", band: "ABB" },
    { songId: "abb_polk_salad_annie", title: "Polk Salad Annie", artist: "ABB", band: "ABB" },
    { songId: "abb_ramblin_man", title: "Ramblin' Man", artist: "ABB", band: "ABB" },
    { songId: "abb_reach_for_the_sky", title: "Reach for the Sky", artist: "ABB", band: "ABB" },
    { songId: "abb_reminiscence", title: "Reminiscence", artist: "ABB", band: "ABB" },
    { songId: "abb_revival", title: "Revival", artist: "ABB", band: "ABB" },
    { songId: "abb_rockin_horse", title: "Rockin' Horse", artist: "ABB", band: "ABB" },
    { songId: "abb_roots_my_home", title: "Roots My Home", artist: "ABB", band: "ABB" },
    { songId: "abb_sailin_cross_the_devils_sea", title: "Sailin' 'Cross the Devil's Sea", artist: "ABB", band: "ABB" },
    { songId: "abb_seven_turns", title: "Seven Turns", artist: "ABB", band: "ABB" },
    { songId: "abb_soulshine", title: "Soulshine", artist: "ABB", band: "ABB" },
    { songId: "abb_stand_back", title: "Stand Back", artist: "ABB", band: "ABB" },
    { songId: "abb_statesboro_blues", title: "Statesboro Blues", artist: "ABB", band: "ABB" },
    { songId: "abb_straight_from_the_heart", title: "Straight from the Heart", artist: "ABB", band: "ABB" },
    { songId: "abb_the_high_cost_of_low_living", title: "The High Cost of Low Living", artist: "ABB", band: "ABB" },
    { songId: "abb_the_sky_is_crying", title: "The Sky is Crying", artist: "ABB", band: "ABB" },
    { songId: "abb_trouble_no_more", title: "Trouble No More", artist: "ABB", band: "ABB" },
    { songId: "abb_true_gravity", title: "True Gravity", artist: "ABB", band: "ABB" },
    { songId: "abb_unemployment", title: "Unemployment", artist: "ABB", band: "ABB" },
    { songId: "abb_whipping_post", title: "Whipping Post", artist: "ABB", band: "ABB" },
    { songId: "abb_win_lose_or_draw", title: "Win Lose or Draw", artist: "ABB", band: "ABB" },
    { songId: "abb_wicked_game", title: "Wicked Game", artist: "ABB", band: "ABB" },
    { songId: "abb_you_dont_love_me", title: "You Don't Love Me", artist: "ABB", band: "ABB" },

    // Phish
    { songId: "phish_46_days", title: "46 Days", artist: "Phish", band: "Phish" },
    { songId: "phish_555", title: "555", artist: "Phish", band: "Phish" },
    { songId: "phish_a_song_i_heard_the_ocean_sing", title: "A Song I Heard the Ocean Sing", artist: "Phish", band: "Phish" },
    { songId: "phish_acdc_bag", title: "AC/DC Bag", artist: "Phish", band: "Phish" },
    { songId: "phish_access_me", title: "Access Me", artist: "Phish", band: "Phish" },
    { songId: "phish_alaska", title: "Alaska", artist: "Phish", band: "Phish" },
    { songId: "phish_all_of_these_dreams", title: "All of These Dreams", artist: "Phish", band: "Phish" },
    { songId: "phish_alumni_blues", title: "Alumni Blues", artist: "Phish", band: "Phish" },
    { songId: "phish_axilla", title: "Axilla", artist: "Phish", band: "Phish" },
    { songId: "phish_backwards_down_the_number_line", title: "Backwards Down the Number Line", artist: "Phish", band: "Phish" },
    { songId: "phish_bathtub_gin", title: "Bathtub Gin", artist: "Phish", band: "Phish" },
    { songId: "phish_birds_of_a_feather", title: "Birds of a Feather", artist: "Phish", band: "Phish" },
    { songId: "phish_blaze_on", title: "Blaze On", artist: "Phish", band: "Phish" },
    { songId: "phish_bouncing_around_the_room", title: "Bouncing Around the Room", artist: "Phish", band: "Phish" },
    { songId: "phish_brian_and_robert", title: "Brian and Robert", artist: "Phish", band: "Phish" },
    { songId: "phish_brother", title: "Brother", artist: "Phish", band: "Phish" },
    { songId: "phish_buffalo_bill", title: "Buffalo Bill", artist: "Phish", band: "Phish" },
    { songId: "phish_bug", title: "Bug", artist: "Phish", band: "Phish" },
    { songId: "phish_buried_alive", title: "Buried Alive", artist: "Phish", band: "Phish" },
    { songId: "phish_cars_trucks_buses", title: "Car's Trucks Buses", artist: "Phish", band: "Phish" },
    { songId: "phish_carini", title: "Carini", artist: "Phish", band: "Phish" },
    { songId: "phish_cavern", title: "Cavern", artist: "Phish", band: "Phish" },
    { songId: "phish_chalk_dust_torture", title: "Chalk Dust Torture", artist: "Phish", band: "Phish" },
    { songId: "phish_character_zero", title: "Character Zero", artist: "Phish", band: "Phish" },
    { songId: "phish_chalkdust_torture", title: "Chalkdust Torture", artist: "Phish", band: "Phish" },
    { songId: "phish_cities", title: "Cities", artist: "Phish", band: "Phish" },
    { songId: "phish_colonel_forbins_ascent", title: "Colonel Forbin's Ascent", artist: "Phish", band: "Phish" },
    { songId: "phish_contact", title: "Contact", artist: "Phish", band: "Phish" },
    { songId: "phish_crosseyed_and_painless", title: "Crosseyed and Painless", artist: "Phish", band: "Phish" },
    { songId: "phish_david_bowie", title: "David Bowie", artist: "Phish", band: "Phish" },
    { songId: "phish_destiny_unbound", title: "Destiny Unbound", artist: "Phish", band: "Phish" },
    { songId: "phish_dirt", title: "Dirt", artist: "Phish", band: "Phish" },
    { songId: "phish_divided_sky", title: "Divided Sky", artist: "Phish", band: "Phish" },
    { songId: "phish_dogs_stole_things", title: "Dogs Stole Things", artist: "Phish", band: "Phish" },
    { songId: "phish_down_with_disease", title: "Down with Disease", artist: "Phish", band: "Phish" },
    { songId: "phish_driver", title: "Driver", artist: "Phish", band: "Phish" },
    { songId: "phish_farmhouse", title: "Farmhouse", artist: "Phish", band: "Phish" },
    { songId: "phish_fast_enough_for_you", title: "Fast Enough for You", artist: "Phish", band: "Phish" },
    { songId: "phish_fee", title: "Fee", artist: "Phish", band: "Phish" },
    { songId: "phish_first_tube", title: "First Tube", artist: "Phish", band: "Phish" },
    { songId: "phish_fluffhead", title: "Fluffhead", artist: "Phish", band: "Phish" },
    { songId: "phish_foam", title: "Foam", artist: "Phish", band: "Phish" },
    { songId: "phish_free", title: "Free", artist: "Phish", band: "Phish" },
    { songId: "phish_funky_bitch", title: "Funky Bitch", artist: "Phish", band: "Phish" },
    { songId: "phish_ghost", title: "Ghost", artist: "Phish", band: "Phish" },
    { songId: "phish_ginseng_sullivan", title: "Ginseng Sullivan", artist: "Phish", band: "Phish" },
    { songId: "phish_glide", title: "Glide", artist: "Phish", band: "Phish" },
    { songId: "phish_golgi_apparatus", title: "Golgi Apparatus", artist: "Phish", band: "Phish" },
    { songId: "phish_gotta_jibboo", title: "Gotta Jibboo", artist: "Phish", band: "Phish" },
    { songId: "phish_guelah_papyrus", title: "Guelah Papyrus", artist: "Phish", band: "Phish" },
    { songId: "phish_guyute", title: "Guyute", artist: "Phish", band: "Phish" },
    { songId: "phish_harpua", title: "Harpua", artist: "Phish", band: "Phish" },
    { songId: "phish_harry_hood", title: "Harry Hood", artist: "Phish", band: "Phish" },
    { songId: "phish_heavy_things", title: "Heavy Things", artist: "Phish", band: "Phish" },
    { songId: "phish_horn", title: "Horn", artist: "Phish", band: "Phish" },
    { songId: "phish_i_am_hydrogen", title: "I Am Hydrogen", artist: "Phish", band: "Phish" },
    { songId: "phish_if_i_could", title: "If I Could", artist: "Phish", band: "Phish" },
    { songId: "phish_jibboo", title: "Jibboo", artist: "Phish", band: "Phish" },
    { songId: "phish_julius", title: "Julius", artist: "Phish", band: "Phish" },
    { songId: "phish_kill_devil_falls", title: "Kill Devil Falls", artist: "Phish", band: "Phish" },
    { songId: "phish_lawn_boy", title: "Lawn Boy", artist: "Phish", band: "Phish" },
    { songId: "phish_leaves", title: "Leaves", artist: "Phish", band: "Phish" },
    { songId: "phish_lengthwise", title: "Lengthwise", artist: "Phish", band: "Phish" },
    { songId: "phish_light", title: "Light", artist: "Phish", band: "Phish" },
    { songId: "phish_limb_by_limb", title: "Limb by Limb", artist: "Phish", band: "Phish" },
    { songId: "phish_lizards", title: "Lizards", artist: "Phish", band: "Phish" },
    { songId: "phish_llama", title: "Llama", artist: "Phish", band: "Phish" },
    { songId: "phish_maze", title: "Maze", artist: "Phish", band: "Phish" },
    { songId: "phish_meat", title: "Meat", artist: "Phish", band: "Phish" },
    { songId: "phish_meatstick", title: "Meatstick", artist: "Phish", band: "Phish" },
    { songId: "phish_mikes_song", title: "Mike's Song", artist: "Phish", band: "Phish" },
    { songId: "phish_moma_dance", title: "Moma Dance", artist: "Phish", band: "Phish" },
    { songId: "phish_mountains_in_the_mist", title: "Mountains in the Mist", artist: "Phish", band: "Phish" },
    { songId: "phish_my_friend_my_friend", title: "My Friend, My Friend", artist: "Phish", band: "Phish" },
    { songId: "phish_my_soul", title: "My Soul", artist: "Phish", band: "Phish" },
    { songId: "phish_nicu", title: "NICU", artist: "Phish", band: "Phish" },
    { songId: "phish_no_men_in_no_mans_land", title: "No Men in No Man's Land", artist: "Phish", band: "Phish" },
    { songId: "phish_nothing", title: "Nothing", artist: "Phish", band: "Phish" },
    { songId: "phish_olivias_pool", title: "Olivia's Pool", artist: "Phish", band: "Phish" },
    { songId: "phish_pebbles_and_marbles", title: "Pebbles and Marbles", artist: "Phish", band: "Phish" },
    { songId: "phish_petrichor", title: "Petrichor", artist: "Phish", band: "Phish" },
    { songId: "phish_piper", title: "Piper", artist: "Phish", band: "Phish" },
    { songId: "phish_poor_heart", title: "Poor Heart", artist: "Phish", band: "Phish" },
    { songId: "phish_possum", title: "Possum", artist: "Phish", band: "Phish" },
    { songId: "phish_prince_caspian", title: "Prince Caspian", artist: "Phish", band: "Phish" },
    { songId: "phish_punch_you_in_the_eye", title: "Punch You in the Eye", artist: "Phish", band: "Phish" },
    { songId: "phish_reba", title: "Reba", artist: "Phish", band: "Phish" },
    { songId: "phish_rift", title: "Rift", artist: "Phish", band: "Phish" },
    { songId: "phish_roggae", title: "Roggae", artist: "Phish", band: "Phish" },
    { songId: "phish_runaway_jim", title: "Runaway Jim", artist: "Phish", band: "Phish" },
    { songId: "phish_run_like_an_antelope", title: "Run Like an Antelope", artist: "Phish", band: "Phish" },
    { songId: "phish_sample_in_a_jar", title: "Sample in a Jar", artist: "Phish", band: "Phish" },
    { songId: "phish_sand", title: "Sand", artist: "Phish", band: "Phish" },
    { songId: "phish_scent_of_a_mule", title: "Scent of a Mule", artist: "Phish", band: "Phish" },
    { songId: "phish_shade", title: "Shade", artist: "Phish", band: "Phish" },
    { songId: "phish_simple", title: "Simple", artist: "Phish", band: "Phish" },
    { songId: "phish_slave_to_the_traffic_light", title: "Slave to the Traffic Light", artist: "Phish", band: "Phish" },
    { songId: "phish_sleep", title: "Sleep", artist: "Phish", band: "Phish" },
    { songId: "phish_sloth", title: "Sloth", artist: "Phish", band: "Phish" },
    { songId: "phish_sparkle", title: "Sparkle", artist: "Phish", band: "Phish" },
    { songId: "phish_split_open_and_melt", title: "Split Open and Melt", artist: "Phish", band: "Phish" },
    { songId: "phish_squirming_coil", title: "Squirming Coil", artist: "Phish", band: "Phish" },
    { songId: "phish_stash", title: "Stash", artist: "Phish", band: "Phish" },
    { songId: "phish_steam", title: "Steam", artist: "Phish", band: "Phish" },
    { songId: "phish_strange_design", title: "Strange Design", artist: "Phish", band: "Phish" },
    { songId: "phish_suzy_greenberg", title: "Suzy Greenberg", artist: "Phish", band: "Phish" },
    { songId: "phish_sweet_emotion", title: "Sweet Emotion", artist: "Phish", band: "Phish" },
    { songId: "phish_taste", title: "Taste", artist: "Phish", band: "Phish" },
    { songId: "phish_the_curtain", title: "The Curtain", artist: "Phish", band: "Phish" },
    { songId: "phish_the_divided_sky", title: "The Divided Sky", artist: "Phish", band: "Phish" },
    { songId: "phish_the_lizards", title: "The Lizards", artist: "Phish", band: "Phish" },
    { songId: "phish_the_mango_song", title: "The Mango Song", artist: "Phish", band: "Phish" },
    { songId: "phish_the_moma_dance", title: "The Moma Dance", artist: "Phish", band: "Phish" },
    { songId: "phish_the_sloth", title: "The Sloth", artist: "Phish", band: "Phish" },
    { songId: "phish_the_squirming_coil", title: "The Squirming Coil", artist: "Phish", band: "Phish" },
    { songId: "phish_theme_from_the_bottom", title: "Theme From the Bottom", artist: "Phish", band: "Phish" },
    { songId: "phish_timber_jerry", title: "Timber (Jerry)", artist: "Phish", band: "Phish" },
    { songId: "phish_train_song", title: "Train Song", artist: "Phish", band: "Phish" },
    { songId: "phish_tube", title: "Tube", artist: "Phish", band: "Phish" },
    { songId: "phish_tweezer", title: "Tweezer", artist: "Phish", band: "Phish" },
    { songId: "phish_tweezer_reprise", title: "Tweezer Reprise", artist: "Phish", band: "Phish" },
    { songId: "phish_twist", title: "Twist", artist: "Phish", band: "Phish" },
    { songId: "phish_uncle_pen", title: "Uncle Pen", artist: "Phish", band: "Phish" },
    { songId: "phish_undermind", title: "Undermind", artist: "Phish", band: "Phish" },
    { songId: "phish_vultures", title: "Vultures", artist: "Phish", band: "Phish" },
    { songId: "phish_wading_in_the_velvet_sea", title: "Wading in the Velvet Sea", artist: "Phish", band: "Phish" },
    { songId: "phish_walls_of_the_cave", title: "Walls of the Cave", artist: "Phish", band: "Phish" },
    { songId: "phish_waste", title: "Waste", artist: "Phish", band: "Phish" },
    { songId: "phish_water_in_the_sky", title: "Water in the Sky", artist: "Phish", band: "Phish" },
    { songId: "phish_waves", title: "Waves", artist: "Phish", band: "Phish" },
    { songId: "phish_weekapaug_groove", title: "Weekapaug Groove", artist: "Phish", band: "Phish" },
    { songId: "phish_weigh", title: "Weigh", artist: "Phish", band: "Phish" },
    { songId: "phish_whats_the_use", title: "What's the Use?", artist: "Phish", band: "Phish" },
    { songId: "phish_whistle_while_you_work", title: "Whistle While You Work", artist: "Phish", band: "Phish" },
    { songId: "phish_wilson", title: "Wilson", artist: "Phish", band: "Phish" },
    { songId: "phish_windora_bug", title: "Windora Bug", artist: "Phish", band: "Phish" },
    { songId: "phish_wolfmans_brother", title: "Wolfman's Brother", artist: "Phish", band: "Phish" },
    { songId: "phish_ya_mar", title: "Ya Mar", artist: "Phish", band: "Phish" },
    { songId: "phish_you_enjoy_myself", title: "You Enjoy Myself", artist: "Phish", band: "Phish" },

    // Goose
    { songId: "goose_1000_miles", title: "1000 Miles", artist: "Goose", band: "Goose" },
    { songId: "goose_all_i_need", title: "All I Need", artist: "Goose", band: "Goose" },
    { songId: "goose_arrow", title: "Arrow", artist: "Goose", band: "Goose" },
    { songId: "goose_arcadia", title: "Arcadia", artist: "Goose", band: "Goose" },
    { songId: "goose_atlas_dogs", title: "Atlas Dogs", artist: "Goose", band: "Goose" },
    { songId: "goose_borne", title: "Borne", artist: "Goose", band: "Goose" },
    { songId: "goose_butter_rum", title: "Butter Rum", artist: "Goose", band: "Goose" },
    { songId: "goose_cannot_find_my_way", title: "Cannot Find My Way", artist: "Goose", band: "Goose" },
    { songId: "goose_bring_it_on_home", title: "Bring It On Home", artist: "Goose", band: "Goose" },
    { songId: "goose_creatures", title: "Creatures", artist: "Goose", band: "Goose" },
    { songId: "goose_crazy_gnarls_barkley", title: "Crazy (Gnarls Barkley)", artist: "Goose", band: "Goose" },
    { songId: "goose_deep_water", title: "Deep Water", artist: "Goose", band: "Goose" },
    { songId: "goose_doctor_robert", title: "Doctor Robert", artist: "Goose", band: "Goose" },
    { songId: "goose_dripfield", title: "Dripfield", artist: "Goose", band: "Goose" },
    { songId: "goose_eleanor_rigby", title: "Eleanor Rigby", artist: "Goose", band: "Goose" },
    { songId: "goose_elizabeth", title: "Elizabeth", artist: "Goose", band: "Goose" },
    { songId: "goose_earthling_or_alien", title: "Earthling or Alien?", artist: "Goose", band: "Goose" },
    { songId: "goose_factory_fiction", title: "Factory Fiction", artist: "Goose", band: "Goose" },
    { songId: "goose_finns", title: "Finn's", artist: "Goose", band: "Goose" },
    { songId: "goose_flooring_eddie", title: "Flooring Eddie", artist: "Goose", band: "Goose" },
    { songId: "goose_fly_around_my_pretty_little_miss", title: "Fly Around My Pretty Little Miss", artist: "Goose", band: "Goose" },
    { songId: "goose_fog_of_war", title: "Fog of War", artist: "Goose", band: "Goose" },
    { songId: "goose_get_innocuous", title: "Get Innocuous!", artist: "Goose", band: "Goose" },
    { songId: "goose_genie", title: "Genie", artist: "Goose", band: "Goose" },
    { songId: "goose_gently_floating_home", title: "Gently Floating Home", artist: "Goose", band: "Goose" },
    { songId: "goose_golden_rule", title: "Golden Rule", artist: "Goose", band: "Goose" },
    { songId: "goose_halloween", title: "Halloween (Goose)", artist: "Goose", band: "Goose" },
    { songId: "goose_hot_tea", title: "Hot Tea", artist: "Goose", band: "Goose" },
    { songId: "goose_hungersite", title: "Hungersite", artist: "Goose", band: "Goose" },
    { songId: "goose_i_go_blind", title: "I Go Blind", artist: "Goose", band: "Goose" },
    { songId: "goose_jive_lee", title: "Jive Lee", artist: "Goose", band: "Goose" },
    { songId: "goose_lead_the_way", title: "Lead the Way", artist: "Goose", band: "Goose" },
    { songId: "goose_madhuvan", title: "Madhuvan", artist: "Goose", band: "Goose" },
    { songId: "goose_madeleine", title: "Madeleine", artist: "Goose", band: "Goose" },
    { songId: "goose_maze_of_love", title: "Maze of Love", artist: "Goose", band: "Goose" },
    { songId: "goose_meet_me_in_the_morning", title: "Meet Me in the Morning", artist: "Goose", band: "Goose" },
    { songId: "goose_mind_control", title: "Mind Control", artist: "Goose", band: "Goose" },
    { songId: "goose_moon", title: "Moon", artist: "Goose", band: "Goose" },
    { songId: "goose_neon_pillar", title: "Neon Pillar", artist: "Goose", band: "Goose" },
    { songId: "goose_noyz_boyz", title: "Noyz Boyz", artist: "Goose", band: "Goose" },
    { songId: "goose_on_the_roof", title: "On the Roof", artist: "Goose", band: "Goose" },
    { songId: "goose_pancakes_for_dinner", title: "Pancakes for Dinner", artist: "Goose", band: "Goose" },
    { songId: "goose_papaya", title: "Papaya", artist: "Goose", band: "Goose" },
    { songId: "goose_peter_and_the_wolf", title: "Peter and the Wolf", artist: "Goose", band: "Goose" },
    { songId: "goose_polyester_morning", title: "Polyester Morning", artist: "Goose", band: "Goose" },
    { songId: "goose_red_bird", title: "Red Bird", artist: "Goose", band: "Goose" },
    { songId: "goose_rosewood_heart", title: "Rosewood Heart", artist: "Goose", band: "Goose" },
    { songId: "goose_route_9", title: "Route 9", artist: "Goose", band: "Goose" },
    { songId: "goose_sigma_oasis", title: "Sigma Oasis", artist: "Goose", band: "Goose" },
    { songId: "goose_slow_ready", title: "Slow Ready", artist: "Goose", band: "Goose" },
    { songId: "goose_spirit_of_the_dark_horse", title: "Spirit of the Dark Horse", artist: "Goose", band: "Goose" },
    { songId: "goose_stampede", title: "Stampede", artist: "Goose", band: "Goose" },
    { songId: "goose_stawberry_fields_forever", title: "Stawberry Fields Forever", artist: "Goose", band: "Goose" },
    { songId: "goose_summertime_blues", title: "Summertime Blues", artist: "Goose", band: "Goose" },
    { songId: "goose_sym1", title: "SYM-1", artist: "Goose", band: "Goose" },
    { songId: "goose_the_bob_lazar_story", title: "The Bob Lazar Story", artist: "Goose", band: "Goose" },
    { songId: "goose_the_empress_of_organos", title: "The Empress of Organos", artist: "Goose", band: "Goose" },
    { songId: "goose_tumble", title: "Tumble", artist: "Goose", band: "Goose" },
    { songId: "goose_tusa", title: "TUSA", artist: "Goose", band: "Goose" },
    { songId: "goose_undertone", title: "Undertone", artist: "Goose", band: "Goose" },
    { songId: "goose_unfamiliar_ground", title: "Unfamiliar Ground", artist: "Goose", band: "Goose" },
    { songId: "goose_vagabond", title: "Vagabond", artist: "Goose", band: "Goose" },
    { songId: "goose_valley_of_the_dogs", title: "Valley of the Dogs", artist: "Goose", band: "Goose" },
    { songId: "goose_vis_a_vis", title: "Vis a Vis", artist: "Goose", band: "Goose" },
    { songId: "goose_wasted_away_again_in_margaritaville", title: "Wasted Away Again in Margaritaville", artist: "Goose", band: "Goose" },
    { songId: "goose_windmill", title: "Windmill", artist: "Goose", band: "Goose" },
    { songId: "goose_wings", title: "Wings", artist: "Goose", band: "Goose" },

    // Dave Matthews Band
    { songId: "dmb_41", title: "#41", artist: "DMB", band: "DMB" },
    { songId: "dmb_alanis", title: "Alanis", artist: "DMB", band: "DMB" },
    { songId: "dmb_american_baby", title: "American Baby", artist: "DMB", band: "DMB" },
    { songId: "dmb_ants_marching", title: "Ants Marching", artist: "DMB", band: "DMB" },
    { songId: "dmb_anyone_seen_the_bridge", title: "Anyone Seen the Bridge", artist: "DMB", band: "DMB" },
    { songId: "dmb_bartender", title: "Bartender", artist: "DMB", band: "DMB" },
    { songId: "dmb_belly_belly_nice", title: "Belly Belly Nice", artist: "DMB", band: "DMB" },
    { songId: "dmb_best_of_whats_around", title: "Best of What's Around", artist: "DMB", band: "DMB" },
    { songId: "dmb_big_eyed_fish", title: "Big Eyed Fish", artist: "DMB", band: "DMB" },
    { songId: "dmb_blue_water", title: "Blue Water", artist: "DMB", band: "DMB" },
    { songId: "dmb_boom_boom_boom", title: "Boom Boom Boom (DMB)", artist: "DMB", band: "DMB" },
    { songId: "dmb_broken_things", title: "Broken Things", artist: "DMB", band: "DMB" },
    { songId: "dmb_busted_stuff", title: "Busted Stuff", artist: "DMB", band: "DMB" },
    { songId: "dmb_butterfly", title: "Butterfly", artist: "DMB", band: "DMB" },
    { songId: "dmb_cant_stop", title: "Can't Stop", artist: "DMB", band: "DMB" },
    { songId: "dmb_corn_bread", title: "Corn Bread", artist: "DMB", band: "DMB" },
    { songId: "dmb_crash_into_me", title: "Crash into Me", artist: "DMB", band: "DMB" },
    { songId: "dmb_crush", title: "Crush", artist: "DMB", band: "DMB" },
    { songId: "dmb_dancing_nancies", title: "Dancing Nancies", artist: "DMB", band: "DMB" },
    { songId: "dmb_digging_a_ditch", title: "Digging a Ditch", artist: "DMB", band: "DMB" },
    { songId: "dmb_dont_drink_the_water", title: "Don't Drink the Water", artist: "DMB", band: "DMB" },
    { songId: "dmb_dream_girl", title: "Dream Girl", artist: "DMB", band: "DMB" },
    { songId: "dmb_drive_in_drive_out", title: "Drive In Drive Out", artist: "DMB", band: "DMB" },
    { songId: "dmb_dreaming_tree", title: "Dreaming Tree", artist: "DMB", band: "DMB" },
    { songId: "dmb_eh_hee", title: "Eh Hee", artist: "DMB", band: "DMB" },
    { songId: "dmb_everyday", title: "Everyday", artist: "DMB", band: "DMB" },
    { songId: "dmb_fool_to_think", title: "Fool to Think", artist: "DMB", band: "DMB" },
    { songId: "dmb_funny_the_way_it_is", title: "Funny the Way It Is", artist: "DMB", band: "DMB" },
    { songId: "dmb_grace_is_gone", title: "Grace Is Gone", artist: "DMB", band: "DMB" },
    { songId: "dmb_gravedigger", title: "Gravedigger", artist: "DMB", band: "DMB" },
    { songId: "dmb_grey_street", title: "Grey Street", artist: "DMB", band: "DMB" },
    { songId: "dmb_grux", title: "Grux", artist: "DMB", band: "DMB" },
    { songId: "dmb_halloween", title: "Halloween (DMB)", artist: "DMB", band: "DMB" },
    { songId: "dmb_hunger_for_the_great_light", title: "Hunger for the Great Light", artist: "DMB", band: "DMB" },
    { songId: "dmb_i_did_it", title: "I Did It", artist: "DMB", band: "DMB" },
    { songId: "dmb_ill_back_you_up", title: "I'll Back You Up", artist: "DMB", band: "DMB" },
    { songId: "dmb_idea_of_you", title: "Idea of You", artist: "DMB", band: "DMB" },
    { songId: "dmb_in_the_right_place", title: "In the Right Place", artist: "DMB", band: "DMB" },
    { songId: "dmb_jimi_thing", title: "Jimi Thing", artist: "DMB", band: "DMB" },
    { songId: "dmb_louisiana_bayou", title: "Louisiana Bayou", artist: "DMB", band: "DMB" },
    { songId: "dmb_lie_in_our_graves", title: "Lie in Our Graves", artist: "DMB", band: "DMB" },
    { songId: "dmb_little_thing", title: "Little Thing", artist: "DMB", band: "DMB" },
    { songId: "dmb_long_black_veil", title: "Long Black Veil", artist: "DMB", band: "DMB" },
    { songId: "dmb_lover_lay_down", title: "Lover Lay Down", artist: "DMB", band: "DMB" },
    { songId: "dmb_loving_wings", title: "Loving Wings", artist: "DMB", band: "DMB" },
    { songId: "dmb_mercy", title: "Mercy (DMB)", artist: "DMB", band: "DMB" },
    { songId: "dmb_minarets", title: "Minarets", artist: "DMB", band: "DMB" },
    { songId: "dmb_monkey_man", title: "Monkey Man", artist: "DMB", band: "DMB" },
    { songId: "dmb_moth", title: "Moth", artist: "DMB", band: "DMB" },
    { songId: "dmb_mother_father", title: "Mother Father", artist: "DMB", band: "DMB" },
    { songId: "dmb_nancies", title: "Nancies", artist: "DMB", band: "DMB" },
    { songId: "dmb_old_dirt_hill", title: "Old Dirt Hill", artist: "DMB", band: "DMB" },
    { songId: "dmb_one_sweet_world", title: "One Sweet World", artist: "DMB", band: "DMB" },
    { songId: "dmb_pantala_naga_pampa", title: "Pantala Naga Pampa", artist: "DMB", band: "DMB" },
    { songId: "dmb_pig", title: "Pig", artist: "DMB", band: "DMB" },
    { songId: "dmb_proudest_monkey", title: "Proudest Monkey", artist: "DMB", band: "DMB" },
    { songId: "dmb_rapunzel", title: "Rapunzel", artist: "DMB", band: "DMB" },
    { songId: "dmb_raven", title: "Raven", artist: "DMB", band: "DMB" },
    { songId: "dmb_rhyme_reason", title: "Rhyme & Reason", artist: "DMB", band: "DMB" },
    { songId: "dmb_river_and_all_its_cousins", title: "River and All Its Cousins", artist: "DMB", band: "DMB" },
    { songId: "dmb_rooftop", title: "Rooftop", artist: "DMB", band: "DMB" },
    { songId: "dmb_satellite", title: "Satellite", artist: "DMB", band: "DMB" },
    { songId: "dmb_say_goodbye", title: "Say Goodbye", artist: "DMB", band: "DMB" },
    { songId: "dmb_seek_up", title: "Seek Up", artist: "DMB", band: "DMB" },
    { songId: "dmb_shake_me_like_a_monkey", title: "Shake Me Like a Monkey", artist: "DMB", band: "DMB" },
    { songId: "dmb_she", title: "She", artist: "DMB", band: "DMB" },
    { songId: "dmb_so_damn_lucky", title: "So Damn Lucky", artist: "DMB", band: "DMB" },
    { songId: "dmb_so_much_to_say", title: "So Much to Say", artist: "DMB", band: "DMB" },
    { songId: "dmb_song_that_jane_likes", title: "Song That Jane Likes", artist: "DMB", band: "DMB" },
    { songId: "dmb_space_between", title: "Space Between", artist: "DMB", band: "DMB" },
    { songId: "dmb_stay_wasting_time", title: "Stay (Wasting Time)", artist: "DMB", band: "DMB" },
    { songId: "dmb_steady_as_we_go", title: "Steady As We Go", artist: "DMB", band: "DMB" },
    { songId: "dmb_stone", title: "Stone", artist: "DMB", band: "DMB" },
    { songId: "dmb_stolen_away_on_55th_3rd", title: "Stolen Away on 55th & 3rd", artist: "DMB", band: "DMB" },
    { songId: "dmb_stress", title: "Stress", artist: "DMB", band: "DMB" },
    { songId: "dmb_sweet_up_and_down", title: "Sweet Up and Down", artist: "DMB", band: "DMB" },
    { songId: "dmb_the_last_stop", title: "The Last Stop", artist: "DMB", band: "DMB" },
    { songId: "dmb_the_maker", title: "The Maker", artist: "DMB", band: "DMB" },
    { songId: "dmb_the_song_before_the_song", title: "The Song Before the Song", artist: "DMB", band: "DMB" },
    { songId: "dmb_too_much", title: "Too Much", artist: "DMB", band: "DMB" },
    { songId: "dmb_tripping_billies", title: "Tripping Billies", artist: "DMB", band: "DMB" },
    { songId: "dmb_true_reflections", title: "True Reflections", artist: "DMB", band: "DMB" },
    { songId: "dmb_two_step", title: "Two Step", artist: "DMB", band: "DMB" },
    { songId: "dmb_typical_situation", title: "Typical Situation", artist: "DMB", band: "DMB" },
    { songId: "dmb_warehouse", title: "Warehouse", artist: "DMB", band: "DMB" },
    { songId: "dmb_what_would_you_say", title: "What Would You Say", artist: "DMB", band: "DMB" },
    { songId: "dmb_when_the_world_ends", title: "When the World Ends", artist: "DMB", band: "DMB" },
    { songId: "dmb_where_are_you_going", title: "Where Are You Going", artist: "DMB", band: "DMB" },
    { songId: "dmb_why_i_am", title: "Why I Am", artist: "DMB", band: "DMB" }

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
