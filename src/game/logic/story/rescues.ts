// The radar's signals: six heroes held on Professor Terror's islands, each found, freed and
// brought home, then the whole crew together for the first time. The order after the Medic and the
// Heavy is shuffled for each crew (docs/STORY.md), so no rescue leans on another.

import { type Scene, shot, together } from "./script";

export const RESCUES: readonly Scene[] = [
  // Doc Penny, the Medic.
  {
    id: "medicSignal",
    when: { on: "rescue", hero: "medic", stage: "signal" },
    cast: ["medic"],
    lines: [
      ["medic", "Is anyone getting this? This is Doctor Penelope... Penny. Doc Penny.", "radio"],
      [
        "medic",
        "I'm being held on an island with far too many turrets. West of you, I think.",
        "radio",
      ],
      [
        "medic",
        "They've had me patching up raiders for a month. Splinters, sunburn, more splinters.",
        "radio",
      ],
      [
        "medic",
        "If I have to pull one more splinter out of one more raider, I will scream.",
        "radio",
      ],
      ["rifleman", "We hear you, Doc. Hang on. We're coming."],
      ["medic", "Bring bandages. Not for me. For them, afterwards.", "radio"],
    ],
  },
  {
    id: "medicLanding",
    when: { on: "rescue", hero: "medic", stage: "landing" },
    cast: ["medic"],
    lines: [
      ["medic", "Over here! The hut with the red cross they painted over!", "shout"],
      ["medic", "Shoot anything you like. Just not the hut with me in it!", "shout"],
      ["rifleman", "Noted."],
    ],
  },
  {
    id: "medicWon",
    when: { on: "rescue", hero: "medic", stage: "won" },
    cast: ["medic"],
    cutscene: true,
    lines: [
      shot(
        "The hut door bursts open. A blonde girl in round glasses marches out, already rolling up her sleeves.",
        3,
      ),
      [
        "medic",
        "Oh, thank goodness. Now hold still. You've got a cut on your... no, four cuts.",
        {
          mood: "surprised",
          how: "relief for half a second, then straight into brisk doctor mode, counting the cuts with growing alarm",
        },
      ],
      [
        "medic",
        "Who's been looking after you lot?",
        { how: "scolding, hands on hips, exasperated" },
      ],
      ["rifleman", "We've been managing.", { how: "a bit sheepish, defensive" }],
      [
        "medic",
        "You've been bleeding. That's not the same as managing.",
        { how: "crisp and quick, a teacher correcting a pupil", before: 0.2 },
      ],
      shot("She snaps her med bag shut.", 1),
      [
        "medic",
        "Right. I'm coming with you. Somebody obviously has to.",
        { how: "decided, matter-of-fact, a hint of a smile" },
      ],
      [
        "medic",
        "And I've got a bottle of something very nasty I've been dying to throw at his buildings.",
        { how: "mischievous, dropping her voice, savouring 'very nasty'" },
      ],
      ["rifleman", "Acid?", { how: "a little wary, eyebrow raised", before: 0.3 }],
      [
        "medic",
        "Acid.",
        { mood: "happy", how: "one word, delighted, grinning", before: 0.5, after: 0.8 },
      ],
    ],
  },
  {
    id: "medicHome",
    when: { on: "rescue", hero: "medic", stage: "home" },
    cast: ["medic"],
    lines: [
      ["medic", "So this is home. Sand, huts, and an old man asleep on the beach."],
      ["shaman", "Praying."],
      ["medic", "You were snoring."],
      ["shaman", "I pray loudly.", "laugh"],
      [
        "shaman",
        "Welcome, Doctor. Your hands are gentle and your tongue is sharp. A good balance.",
      ],
      [
        "medic",
        "And your knees are terrible. I could hear them from the boat. Sit still, I'll look.",
      ],
    ],
  },

  // Big Mo, the Heavy.
  {
    id: "heavySignal",
    when: { on: "rescue", hero: "heavy", stage: "signal" },
    cast: ["heavy"],
    lines: [
      ["heavy", "Hello? Hello. This is Mo. Big Mo. Is this thing on?", "radio"],
      [
        "heavy",
        "They took my ship. They took my kitchen. They took my grandmother's cooking pot.",
        "radio",
      ],
      ["heavy", "I don't mind so much about the ship.", "radio"],
      ["rifleman", "Sit tight, Mo. We'll get you out. And the pot."],
      ["heavy", "Then I'll cook for you every night for the rest of your lives.", "radio"],
    ],
  },
  {
    id: "heavyLanding",
    when: { on: "rescue", hero: "heavy", stage: "landing" },
    cast: ["heavy"],
    lines: [
      ["heavy", "I'm in the storehouse! You'll know which one's me.", "shout"],
      ["heavy", "I'm the big one.", "laugh"],
    ],
  },
  {
    id: "heavyWon",
    when: { on: "rescue", hero: "heavy", stage: "won" },
    cast: ["heavy"],
    cutscene: true,
    lines: [
      shot(
        "The storehouse wall bulges, then gives. A huge bearded man steps through the hole, stretching.",
        3,
      ),
      [
        "heavy",
        "Free! Free, and very, very hungry.",
        {
          mood: "happy",
          how: "booming and joyful, arms wide, slowing down with longing on 'very, very hungry'",
        },
      ],
      [
        "heavy",
        "Thank you, friends. They made me cook for raiders. Raiders have no manners.",
        { how: "deep and warm, then wounded dignity" },
      ],
      [
        "heavy",
        "They put ketchup on everything. On FISH, my friends.",
        { how: "genuinely scandalised, the outrage building, punching 'FISH'" },
      ],
      shot("He pries open a crate. Inside, a minigun. He lifts it like a baby.", 2.5),
      [
        "heavy",
        "And look what they kept in a crate. My old girl. She doesn't like crates.",
        { how: "soft and tender, almost cooing" },
      ],
      ["rifleman", "That's a minigun, Mo.", { how: "flat, deadpan" }],
      [
        "heavy",
        "She's a minigun with feelings.",
        { how: "gently offended, perfectly serious", before: 0.3 },
      ],
      [
        "heavy",
        "From now on, you stand behind me. Nobody hurts my crew while Mo is standing up.",
        { how: "quiet, low and steady, a promise, every word weighted", before: 0.6, after: 0.8 },
      ],
    ],
  },
  {
    id: "heavyHome",
    when: { on: "rescue", hero: "heavy", stage: "home" },
    cast: ["heavy"],
    lines: [
      ["heavy", "Ooh, a beach. A good beach. Is there a kitchen?"],
      ["shaman", "There is a fire, a pot, and a great many fish."],
      ["heavy", "That's a kitchen!", "laugh"],
      together(
        ["medic", "Please tell me you cook vegetables."],
        ["heavy", "I cook everything, Doc. Even vegetables. Especially vegetables. With fish."],
      ),
    ],
  },

  // Tilly and Tank.
  {
    id: "tankSignal",
    when: { on: "rescue", hero: "tank", stage: "signal" },
    cast: ["tank"],
    lines: [
      [
        "tank",
        "Mayday, mayday! Well, not mayday. More of a 'we're locked in a garage' day.",
        "radio",
      ],
      ["tank", "They took Tank. So I came to get him back. Then they took me too.", "radio"],
      ["tank", "Tank says hello. That's him honking. Say hello, Tank! HONK!", "radio"],
      ["rifleman", "...Is she talking to the tank?"],
      ["tank", "He can hear you, you know.", "radio"],
    ],
  },
  {
    id: "tankLanding",
    when: { on: "rescue", hero: "tank", stage: "landing" },
    cast: ["tank"],
    lines: [
      [
        "tank",
        "We're in the big shed! Open that door and we're rolling the second you do!",
        "shout",
      ],
      ["tank", "Tank's revving. I can't stop him. I don't want to.", "laugh"],
    ],
  },
  {
    id: "tankWon",
    when: { on: "rescue", hero: "tank", stage: "won" },
    cast: ["tank"],
    cutscene: true,
    lines: [
      shot(
        "The big shed doors crack. An engine roars. A sand-coloured tank smashes through them in a cloud of splinters.",
        2.5,
      ),
      [
        "tank",
        "Out of the way, out of the way, ROLLING!",
        { mood: "shout", how: "gleeful yelling, fast, building to a scream of joy on 'ROLLING'" },
      ],
      shot("The tank skids to a halt. A girl in a sailor hat pops out of the hatch.", 1.5),
      [
        "tank",
        "Ha! Oh, that felt good. They tried to paint him grey. GREY!",
        { mood: "laugh", how: "breathless laughing, then disgusted outrage on 'GREY'" },
      ],
      [
        "tank",
        "He's sand-colored with blue trim, you absolute barbarians.",
        { how: "indignant, patting the tank, shouting back at the raiders" },
      ],
      [
        "tank",
        "I'm Tilly, by the way. This is Tank. He's the strong, quiet type.",
        { how: "suddenly polite and chirpy, a mock-formal introduction" },
      ],
      [
        "rifleman",
        "Want to come with us and knock down every building the Professor owns?",
        { how: "amused, a grin in it" },
      ],
      shot("The tank's horn honks, once.", 0.8),
      [
        "tank",
        "Tank says yes. I say YES!",
        { mood: "happy", how: "bouncing with excitement, the second YES much louder", after: 0.6 },
      ],
    ],
  },
  {
    id: "tankHome",
    when: { on: "rescue", hero: "tank", stage: "home" },
    cast: ["tank"],
    lines: [
      ["tank", "Tank, look! A beach! Do NOT drive into the sea again."],
      ["shaman", "Your iron friend is very large."],
      ["tank", "He's a big softie. Go on, pat him. He likes it."],
      ["shaman", "...He's warm."],
      ["tank", "That's the engine. Or he likes you. Probably both."],
    ],
  },

  // Ace, the Bazooka.
  {
    id: "bazookaSignal",
    when: { on: "rescue", hero: "bazooka", stage: "signal" },
    cast: ["bazooka"],
    lines: [
      ["bazooka", "This is Ace. Pilot. Best in the islands. Currently sitting in a cage.", "radio"],
      [
        "bazooka",
        "Shot down by a watchtower. A watchtower! I did a barrel roll and everything.",
        "radio",
      ],
      ["rifleman", "Sit tight, Ace."],
      ["bazooka", "Sergeant, I'm in a cage. Sitting tight is all I've got going on.", "radio"],
    ],
  },
  {
    id: "bazookaLanding",
    when: { on: "rescue", hero: "bazooka", stage: "landing" },
    cast: ["bazooka"],
    lines: [
      ["bazooka", "Hey, rescue crew! Take out the watchtower first.", "shout"],
      ["bazooka", "It's personal.", "shout"],
    ],
  },
  {
    id: "bazookaWon",
    when: { on: "rescue", hero: "bazooka", stage: "won" },
    cast: ["bazooka"],
    cutscene: true,
    lines: [
      shot(
        "The cage door clangs open. A girl in aviators and a backwards cap strolls out like she owns the place.",
        3,
      ),
      [
        "bazooka",
        "Nice flying. Well. Nice walking. Walking's like flying, only worse.",
        { how: "cool, lazy drawl, unimpressed but secretly grateful" },
      ],
      [
        "bazooka",
        "My plane's at the bottom of the sea, but these geniuses kept my launcher.",
        { how: "a flicker of real sadness on 'my plane', then sarcastic on 'geniuses'" },
      ],
      shot("She hefts an olive bazooka tube onto her shoulder.", 1.5),
      ["bazooka", "Big mistake. Huge.", { how: "slow, relishing it, a smirk you can hear" }],
      [
        "bazooka",
        "You need someone to blow up their towers from very far away?",
        { how: "sly, teasing, a sales pitch" },
      ],
      [
        "bazooka",
        "That's me. I'm fragile, I'm fabulous, and I'm in.",
        { mood: "happy", how: "cocky and quick, a beat before 'and I'm in'", after: 0.6 },
      ],
    ],
  },
  {
    id: "bazookaHome",
    when: { on: "rescue", hero: "bazooka", stage: "home" },
    cast: ["bazooka"],
    lines: [
      ["bazooka", "Cute island. No runway, though."],
      ["shaman", "We have a very long beach."],
      ["bazooka", "Old man, you and I are going to get along just fine.", "laugh"],
    ],
  },

  // Mr. Pemberton, the Grenadier.
  {
    id: "grenadierSignal",
    when: { on: "rescue", hero: "grenadier", stage: "signal" },
    cast: ["grenadier"],
    lines: [
      [
        "grenadier",
        "Good afternoon. Archibald Pemberton speaking. I'm in a rather damp storeroom.",
        "radio",
      ],
      [
        "grenadier",
        "I was looking for a very rare orchid on one of the Professor's islands.",
        "radio",
      ],
      ["grenadier", "His men took exception. Quite strong exception.", "radio"],
      [
        "grenadier",
        "If anybody's passing, I'd be most grateful. No rush. Well. Some rush.",
        "radio",
      ],
      ["rifleman", "On our way, Mr. Pemberton."],
    ],
  },
  {
    id: "grenadierLanding",
    when: { on: "rescue", hero: "grenadier", stage: "landing" },
    cast: ["grenadier"],
    lines: [
      ["grenadier", "Ah, splendid, you've come. Do watch your step on the beach.", "shout"],
      ["grenadier", "I've watched them bury mines in it for weeks. Dreadful manners.", "shout"],
    ],
  },
  {
    id: "grenadierWon",
    when: { on: "rescue", hero: "grenadier", stage: "won" },
    cast: ["grenadier"],
    cutscene: true,
    lines: [
      shot(
        "A storeroom door creaks open. A neat man in a panama hat steps out, brushing dust off his shirt.",
        3,
      ),
      [
        "grenadier",
        "Thank you ever so much. Archibald Pemberton. Explorer, gardener...",
        { how: "impeccably polite, a slight bow, unhurried, as if at a garden party" },
      ],
      [
        "grenadier",
        "...and twice runner-up at the county fair for grenade lobbing.",
        { how: "modest pride, a small cough first" },
      ],
      ["rifleman", "That's a thing?", { how: "baffled", before: 0.4 }],
      [
        "grenadier",
        "Where I'm from, it is. Over walls, round corners, skipped off the ground like a stone.",
        { how: "warming to it, a bowler's enthusiasm, miming the throw" },
      ],
      [
        "grenadier",
        "Terribly satisfying. And I still haven't found my orchid.",
        { how: "satisfied, then a little wistful" },
      ],
      [
        "grenadier",
        "I'd be delighted to keep looking with you, if you'll have me.",
        { how: "warm and sincere, tipping his hat", after: 0.6 },
      ],
    ],
  },
  {
    id: "grenadierHome",
    when: { on: "rescue", hero: "grenadier", stage: "home" },
    cast: ["grenadier"],
    lines: [
      ["grenadier", "What a charming island. Is that a frangipani? And wild vanilla, over there!"],
      ["shaman", "You know our flowers."],
      ["grenadier", "Only from books. Well, one book. 'The Flowers of the Southern Isles.'"],
      [
        "grenadier",
        "I take it everywhere. It's falling apart, poor thing. Look, the pressed pages.",
      ],
      [
        "grenadier",
        "Written fifty years ago by a young woman who came out here and never went home.",
      ],
      ["grenadier", "Nobody knows quite what became of her."],
      ["shaman", "...Hm. Some stories wash up on their own, in their own time.", "sad"],
    ],
  },

  // Gus, the Engineer.
  {
    id: "engineerSignal",
    when: { on: "rescue", hero: "engineer", stage: "signal" },
    cast: ["engineer"],
    lines: [
      [
        "engineer",
        "Hello? Testing, testing. Ooh, he's boosted the gain on this radio, that's clever, the—",
        "radio",
      ],
      [
        "engineer",
        "Sorry. Sorry. My name's Gus. I used to build things for the Professor.",
        "radio",
      ],
      [
        "engineer",
        "Then I saw what the things were for. I told him I quit. He told me I didn't.",
        "radio",
      ],
      ["rifleman", "Hold on, Gus. We'll get you out of there."],
      ["engineer", "Be careful. The turrets on this island are mine. My design, I mean.", "radio"],
      ["engineer", "They're very good. I'm very good. That's the whole problem, really.", "radio"],
    ],
  },
  {
    id: "engineerLanding",
    when: { on: "rescue", hero: "engineer", stage: "landing" },
    cast: ["engineer"],
    lines: [
      ["engineer", "In the workshop! The one with all the sparks coming out of it!", "shout"],
      ["engineer", "Mind the turret by the door. It's one of my better ones. Sorry!", "shout"],
    ],
  },
  {
    id: "engineerWon",
    when: { on: "rescue", hero: "engineer", stage: "won" },
    cast: ["engineer"],
    cutscene: true,
    lines: [
      shot(
        "Sparks. The workshop's last turret topples. A man with a huge moustache and goggles peers out from under a bench.",
        3,
      ),
      [
        "engineer",
        "Oh, you broke it. You broke all of it.",
        { how: "dismayed at first, quietly, taking in the wreckage" },
      ],
      [
        "engineer",
        "That's... honestly, that's very satisfying to watch.",
        { mood: "laugh", how: "the dismay melting into a giggle, surprised at himself" },
      ],
      [
        "engineer",
        "Gus. Engineer. I can fix anything, and I build turrets that fold up into a backpack.",
        { how: "excited and quick, tripping over his words, proud" },
      ],
      [
        "engineer",
        "He wanted a thousand of them. I built him six and then hid my wrench.",
        { how: "lower, conspiratorial, a guilty little grin" },
      ],
      [
        "engineer",
        "Let me build them for the right side for a change.",
        { how: "sincere and quiet, almost pleading", before: 0.5, after: 0.6 },
      ],
    ],
  },
  {
    id: "engineerHome",
    when: { on: "rescue", hero: "engineer", stage: "home" },
    cast: ["engineer"],
    lines: [
      [
        "engineer",
        "Ooh. Your headquarters has a wobble on the top floor. Do you mind if I just...",
      ],
      ["shaman", "He has been here one minute, and already he's hammering."],
      ["rifleman", "Let him. It does wobble."],
      ["engineer", "Shaman... I built things for him. Big things. Bad things. I'm sorry.", "sad"],
      ["shaman", "You put down your hammer when you saw what it was building. Most men never do."],
      ["shaman", "Pick it up again here. Build us something good."],
    ],
  },

  {
    // The first night with all seven round one fire.
    id: "fullCrew",
    when: { on: "first", thing: "fullCrew" },
    cutscene: true,
    lines: [
      shot(
        "Night on the crew's island. A big fire, a bubbling pot, seven heroes and an old man round it.",
        3.5,
      ),
      [
        "shaman",
        "Look at this. A fire, a full pot, and seven heroes round it. My village felt like this.",
        { how: "content, slow and warm, a little faraway on the last sentence" },
      ],
      [
        "heavy",
        "Seconds, anyone? Thirds? There's always thirds.",
        { mood: "happy", how: "jolly, ladling, already serving whether they want it or not" },
      ],
      ["tank", "Tank wants thirds.", { how: "quick, mischievous" }],
      ["medic", "Tank runs on diesel, Tilly.", { how: "dry, not looking up" }],
      ["tank", "Tank runs on LOVE, Penny.", { how: "mock-offended, loud on 'LOVE'", before: 0.1 }],
      shot("Laughter. Across the fire, Gus has Ace's launcher in pieces.", 1.5),
      ["bazooka", "Gus, stop taking my launcher apart.", { how: "flat warning, without moving" }],
      [
        "engineer",
        "I'm not taking it apart, I'm improving it. It's very similar from the outside.",
        { how: "flustered, talking fast, screwdriver in his mouth" },
      ],
      [
        "grenadier",
        "Might I propose a toast? To the Sergeant, who came for each of us.",
        { how: "rising to his feet, raising a tin cup, sincere and a little formal", before: 0.6 },
      ],
      [
        "rifleman",
        "Wasn't just me. Took the whole crew. Still does.",
        { how: "embarrassed, gruff, quietly proud" },
      ],
      shot("The fire crackles. The Shaman looks past them, out at the dark sea.", 2),
      [
        "shaman",
        "Remember tonight. There are harder days coming, and you will want to remember this one.",
        { how: "gentle and grave, slower, softer at the end", after: 1.2 },
      ],
    ],
  },
];
