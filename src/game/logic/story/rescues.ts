// The radar's signals: six heroes held on Professor Terror's islands, each found, freed and
// brought home, then the whole crew together for the first time. The order after the Medic and the
// Heavy is shuffled for each crew (docs/STORY.md), so no rescue leans on another.

import { type Scene, together } from "./script";

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
    lines: [
      ["medic", "Oh, thank goodness. Now hold still. You've got a cut on your... no, four cuts."],
      ["medic", "Who's been looking after you lot?"],
      ["rifleman", "We've been managing."],
      ["medic", "You've been bleeding. That's not the same as managing."],
      ["medic", "Right. I'm coming with you. Somebody obviously has to."],
      [
        "medic",
        "And I've got a bottle of something very nasty I've been dying to throw at his buildings.",
      ],
      ["rifleman", "Acid?"],
      ["medic", "Acid.", "happy"],
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
      ["shaman", "That's the voice that was singing. I told you he was hungry."],
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
    lines: [
      ["heavy", "Free! Free, and very, very hungry.", "happy"],
      ["heavy", "Thank you, friends. They made me cook for raiders. Raiders have no manners."],
      ["heavy", "They put ketchup on everything. On FISH, my friends."],
      ["heavy", "And look what they kept in a crate. My old girl. She doesn't like crates."],
      ["rifleman", "That's a minigun, Mo."],
      ["heavy", "She's a minigun with feelings."],
      ["heavy", "From now on, you stand behind me. Nobody hurts my crew while Mo is standing up."],
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
    lines: [
      ["tank", "Out of the way, out of the way, ROLLING!", "shout"],
      ["tank", "Ha! Oh, that felt good. They tried to paint him grey. GREY!", "laugh"],
      ["tank", "He's sand-colored with blue trim, you absolute barbarians."],
      ["tank", "I'm Tilly, by the way. This is Tank. He's the strong, quiet type."],
      ["rifleman", "Want to come with us and knock down every building the Professor owns?"],
      ["tank", "Tank says yes. I say YES!", "happy"],
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
    lines: [
      ["bazooka", "Nice flying. Well. Nice walking. Walking's like flying, only worse."],
      ["bazooka", "My plane's at the bottom of the sea, but these geniuses kept my launcher."],
      ["bazooka", "Big mistake. Huge."],
      ["bazooka", "You need someone to blow up their towers from very far away?"],
      ["bazooka", "That's me. I'm fragile, I'm fabulous, and I'm in.", "happy"],
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
    lines: [
      ["grenadier", "Thank you ever so much. Archibald Pemberton. Explorer, gardener..."],
      ["grenadier", "...and twice runner-up at the county fair for grenade lobbing."],
      ["rifleman", "That's a thing?"],
      [
        "grenadier",
        "Where I'm from, it is. Over walls, round corners, skipped off the ground like a stone.",
      ],
      ["grenadier", "Terribly satisfying. And I still haven't found my orchid."],
      ["grenadier", "I'd be delighted to keep looking with you, if you'll have me."],
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
    lines: [
      ["engineer", "Oh, you broke it. You broke all of it."],
      ["engineer", "That's... honestly, that's very satisfying to watch.", "laugh"],
      [
        "engineer",
        "Gus. Engineer. I can fix anything, and I build turrets that fold up into a backpack.",
      ],
      ["engineer", "He wanted a thousand of them. I built him six and then hid my wrench."],
      ["engineer", "Let me build them for the right side for a change."],
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
    id: "fullCrew",
    when: { on: "first", thing: "fullCrew" },
    lines: [
      [
        "shaman",
        "Look at this. A fire, a full pot, and seven heroes round it. My village felt like this.",
      ],
      ["heavy", "Seconds, anyone? Thirds? There's always thirds."],
      ["tank", "Tank wants thirds."],
      ["medic", "Tank runs on diesel, Tilly."],
      ["tank", "Tank runs on LOVE, Penny."],
      ["bazooka", "Gus, stop taking my launcher apart."],
      [
        "engineer",
        "I'm not taking it apart, I'm improving it. It's very similar from the outside.",
      ],
      ["grenadier", "Might I propose a toast? To the Sergeant, who came for each of us."],
      ["rifleman", "Wasn't just me. Took the whole crew. Still does."],
      [
        "shaman",
        "Remember tonight. There are harder days coming, and you will want to remember this one.",
      ],
    ],
  },
];
