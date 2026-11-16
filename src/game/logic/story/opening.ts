// The opening: the crew lands on an island whose village was burned, frees the Shaman on their
// first raid and brings him home, and he tells them the old story of the crystals. Professor
// Terror is only a name and a flag here; he isn't seen or heard until his first island appears.

import { type Scene, shot } from "./script";

export const OPENING: readonly Scene[] = [
  {
    id: "prologue",
    when: { on: "start" },
    cutscene: true,
    lines: [
      shot(
        "Dawn. Mist on the water. A small boat threads a gap in the reef toward a long white beach.",
        4,
      ),
      [
        "rifleman",
        "That's the one. Long beach, deep cove, fresh water up in the hills.",
        { how: "quiet and sure, studying the shore from the bow" },
      ],
      [
        "rifleman",
        "Charts say nobody's lived here for years.",
        { how: "a little puzzled, half to himself" },
      ],
      shot(
        "Steele and two army builders wade ashore, hauling crates of tools. Past the palms, the grass is full of blackened posts: the bones of a village.",
        4,
      ),
      [
        "rifleman",
        "Charts are wrong. Somebody lived here. A whole village.",
        { how: "slowing, the ease gone out of him, crouching by a charred post", before: 0.6 },
      ],
      [
        "rifleman",
        "And not long ago. This wood's still black.",
        { how: "low and grim, rubbing soot between his fingers" },
      ],
      shot(
        "He looks up. Across the water, on a darker island, a red flag flies over a fortified camp: a skull wearing small round glasses.",
        4,
      ),
      [
        "rifleman",
        "Whoever did this didn't go far.",
        { how: "very quiet, eyes on the flag", before: 0.8 },
      ],
      shot("He turns back to the builders, already prising open their crates.", 2),
      [
        "rifleman",
        "We build. Shelter first, then walls, then a headquarters we can hold.",
        { how: "brisk and steady, taking charge, a breath before he starts" },
      ],
      [
        "rifleman",
        "Then we find out who's flying that flag.",
        { how: "flat and quiet, a promise", after: 1 },
      ],
      shot(
        "Wide: the empty beach, the first post going into the sand, and the red flag far across the water.",
        3,
      ),
    ],
  },
  {
    id: "firstRaid",
    when: { on: "first", thing: "raid" },
    lines: [
      [
        "rifleman",
        "Same flag we saw from the beach. This is one of theirs.",
        { how: "low, focused" },
      ],
      [
        "rifleman",
        "Turrets on the ridge, headquarters in the middle. Stay low and stay together.",
        { how: "calm orders, quick" },
      ],
      [
        "shaman",
        "Is someone out there? Please. There's a man locked in here.",
        { mood: "shout", how: "muffled through a thick wall, old and hoarse, calm but urgent" },
      ],
      [
        "rifleman",
        "There's a prisoner. We take the headquarters, and we get him out.",
        { how: "decisive, the plan changing as he says it", before: 0.5 },
      ],
    ],
  },
  {
    id: "shamanFreed",
    when: { on: "first", thing: "raidWon" },
    cutscene: true,
    lines: [
      shot("The headquarters' roof caves in. Dust settles. In the rubble, something moves.", 3),
      shot("An old man climbs out, face paint smeared, shading his eyes against the sun.", 2.5),
      [
        "shaman",
        "Sunlight. I was starting to forget what it looked like.",
        { how: "hoarse and slow, a long breath of relief, close to laughing" },
      ],
      [
        "rifleman",
        "Easy. You're safe now. Who locked you in there?",
        { how: "gentle, steadying him, then firm on the question" },
      ],
      [
        "shaman",
        "The men who sail under that flag. They work for a man they call the Professor.",
        { how: "tired, weighing the name carefully before he says it", before: 0.4 },
      ],
      [
        "shaman",
        "He wants the crystals that sleep under these islands. My people's stories say where they lie.",
        { how: "plain and serious" },
      ],
      [
        "shaman",
        "So he kept me. He thought if he asked often enough, I would tell him.",
        { how: "quiet, a flicker of defiance under it" },
      ],
      ["rifleman", "Did you?", { how: "low, searching his face", before: 0.4 }],
      [
        "shaman",
        "I told him stories. Never the true ones.",
        { how: "a small, tired smile, no triumph in it", before: 0.6 },
      ],
      shot("He looks out across the water toward the crew's island.", 2.5),
      [
        "shaman",
        "You've built on my island. That was my village, before his raiders came.",
        { mood: "sad", how: "soft and steady, not accusing" },
      ],
      [
        "rifleman",
        "We found the houses. What's left of them.",
        { how: "quiet, respectful", before: 0.6 },
      ],
      ["shaman", "Then you know what kind of man he is.", { how: "low and heavy", after: 0.6 }],
      [
        "shaman",
        "If you'll take an old man home, I can teach you that island. Its paths, its weather, its stories.",
        { how: "hopeful but careful, offering rather than asking" },
      ],
      [
        "rifleman",
        "We'd be glad of it. Come on. Let's get you home.",
        { how: "warm, offering his arm", after: 1 },
      ],
      shot(
        "The boat pulls away from the broken camp. The old man looks back at it once, then ahead.",
        3,
      ),
    ],
  },
  {
    id: "shamanArrives",
    when: { on: "after", scene: "shamanFreed" },
    lines: [
      [
        "shaman",
        "My grandmother's house stood about here. The forest's already taking it back.",
        { mood: "sad", how: "quiet, looking at the ground, not dwelling" },
      ],
      [
        "shaman",
        "That's all right. The forest keeps things safe until someone comes back for them.",
        { how: "a little warmer, accepting" },
      ],
      ["rifleman", "Tell us where to build, and we'll build there."],
      [
        "shaman",
        "Near the beach, where the old fires were. The ground is good, and you'll see boats coming.",
      ],
      [
        "shaman",
        "Clear the forest slowly. My people carved things deep in there, long ago.",
        { how: "lower, a little mysterious, but plain" },
      ],
      ["shaman", "When you find them, come and get me."],
      ["rifleman", "We will."],
      [
        "shaman",
        "I'll be on the beach, if you need me. I think better with the sea in front of me.",
        { mood: "happy", how: "easy and content, settling in" },
      ],
    ],
  },
  {
    // Told over the spirits making the islands, in shapes of firelight.
    id: "firstCrystal",
    when: { on: "first", thing: "crystal" },
    cutscene: true,
    lines: [
      shot(
        "Night, the campfire. The Shaman turns a crystal in his fingers. Light moves inside it.",
        3,
      ),
      [
        "shaman",
        "Hold it up to the light. See how it moves inside, as if it's breathing?",
        { mood: "whisper", how: "hushed wonder, slow, as if not to wake it" },
      ],
      shot(
        "The firelight swells into the shapes of the old story: four great spirits over an empty sea.",
        3,
      ),
      [
        "shaman",
        "My people say four spirits made these islands, long before anyone lived here.",
        { how: "the storyteller's voice, low and rolling, unhurried" },
      ],
      [
        "shaman",
        "Nature grew them. Fire raised them. Ice cooled them. And the Deep holds them up.",
        {
          how: "slow and rhythmic like a chant, a breath between each spirit, deepest on 'the Deep'",
        },
      ],
      [
        "shaman",
        "When the spirits went to sleep, they left a little of themselves in the stone.",
        { how: "gentle, softer, almost tender" },
      ],
      shot("Back at the fire. The crew are leaning in.", 1.5),
      [
        "rifleman",
        "And the Professor wants them for what?",
        { how: "practical, quiet, a little wary" },
      ],
      [
        "shaman",
        "Two crystals pressed together make something stronger than either.",
        { how: "grave, slower, the warmth gone out of it" },
      ],
      [
        "shaman",
        "Ice and the Deep make a crystal of chaos. Nature and fire make a crystal of creation.",
        { how: "measured, weighing each word, ominous on 'chaos'" },
      ],
      [
        "shaman",
        "And the oldest story says chaos and creation, joined with time, make one more.",
        { how: "lower and slower, a hush creeping in" },
      ],
      shot("The fire flares white for a moment.", 1),
      [
        "shaman",
        "The eternal crystal. Whoever held it could remake the world however they pleased.",
        { mood: "whisper", how: "an awed, frightened whisper", before: 0.4 },
      ],
      ["rifleman", "That's the one he's after.", { how: "quiet realisation, not a question" }],
      [
        "shaman",
        "It's the only one he's ever been after.",
        { mood: "sad", how: "very quiet, final, heavy", before: 0.8, after: 0.8 },
      ],
      [
        "shaman",
        "Use these the way the spirits meant: a little strength for the people who fight. Never more.",
        { how: "firm and kind, a teacher's voice" },
      ],
      [
        "shaman",
        "No one should hold that much power. Not him. Not you. Not me.",
        { how: "slow and deliberate, a pause before each 'not', softest on 'me'", after: 1 },
      ],
    ],
  },
  {
    id: "radar",
    when: { on: "first", thing: "radar" },
    lines: [
      ["rifleman", "Radar's up. Nothing but static so far."],
      ["shaman", "Give it time. The sea is noisy. Under the noise there are voices."],
      [
        "shaman",
        "The taller your headquarters grows, the further the dish will hear. Keep it turning.",
      ],
    ],
  },
  {
    id: "firstRaiderShip",
    when: { on: "first", thing: "raiderShip" },
    lines: [
      [
        "shaman",
        "A dark sail, out past the reef. One of the Professor's raider ships.",
        { how: "quiet and watchful, eyes on the horizon" },
      ],
      [
        "shaman",
        "Those are the men who burned my village. Hired hands, paid in his gold.",
        { how: "controlled anger, every word steady" },
      ],
      ["shaman", "Tonight they'll come for this island. The map will tell you when, and how many."],
      ["rifleman", "Then we'll be ready for them.", { how: "flat and certain" }],
    ],
  },
  {
    id: "nightRaidHeld",
    when: { on: "first", thing: "nightRaidHeld" },
    lines: [
      [
        "rifleman",
        "They're running. Back to the boats.",
        { how: "breathing hard, grim satisfaction" },
      ],
      [
        "shaman",
        "I watched those ships burn my village from the trees. Tonight I watched them run.",
        { how: "quiet, close to wonder, a long breath out" },
      ],
      [
        "rifleman",
        "And whatever they were carrying, they left on our beach.",
        { how: "dry, pleased" },
      ],
    ],
  },
  {
    id: "nightRaidLost",
    when: { on: "first", thing: "nightRaidLost" },
    lines: [
      [
        "rifleman",
        "They got through. Took what they could carry.",
        { mood: "angry", how: "angry at himself, clipped" },
      ],
      [
        "shaman",
        "Walls fall. Walls get built again. Look where they broke through first, and build that stronger.",
        { how: "calm and steadying" },
      ],
      ["shaman", "And their ship came from somewhere. Raiders aren't so brave at home."],
      ["rifleman", "Then maybe we pay them a visit.", { how: "quiet, decided" }],
    ],
  },
  {
    id: "islandRetaken",
    when: { on: "first", thing: "islandRetaken" },
    lines: [
      [
        "shaman",
        "One of the islands you freed is flying his flag again. His raiders went back in the night.",
      ],
      ["shaman", "They'll have built it stronger. He learns from every island he loses."],
      ["rifleman", "So do we."],
    ],
  },
  {
    id: "raidLost",
    when: { on: "first", thing: "raidLost" },
    lines: [
      [
        "rifleman",
        "We pulled back. Too much fire on that ridge.",
        { how: "frustrated, catching his breath" },
      ],
      [
        "shaman",
        "Everyone came home. That matters more than the island.",
        { how: "warm and firm" },
      ],
      ["shaman", "Think about what stopped you. Go back when you know how to break it."],
    ],
  },
  {
    id: "threeStars",
    when: { on: "first", thing: "threeStars" },
    lines: [
      [
        "shaman",
        "Every building down, the headquarters too. Nothing left standing.",
        { mood: "happy" },
      ],
      [
        "shaman",
        "In my village we'd have lit a fire on the beach and told the story until morning.",
        { how: "fond, remembering" },
      ],
      ["rifleman", "Then tell it tonight. We'll listen.", { how: "warm, a rare smile" }],
    ],
  },
  {
    id: "firstBlueprint",
    when: { on: "first", thing: "blueprint" },
    lines: [
      [
        "shaman",
        "Plans for one of their machines. Their engineers draw everything before they build it.",
      ],
      ["shaman", "On paper it's no use to anyone. A laboratory could turn it into the real thing."],
    ],
  },
  {
    id: "firstLaboratory",
    when: { on: "first", thing: "laboratory" },
    lines: [
      [
        "shaman",
        "A laboratory. The Professor's islands are full of them. Glass, smoke and quiet men.",
      ],
      ["shaman", "Bring it the plans you take on raids. Each one is a weapon turned to your side."],
      ["shaman", "It can teach your boat new things, too."],
    ],
  },
  {
    id: "firstGunboatWeapon",
    when: { on: "first", thing: "gunboatWeapon" },
    lines: [
      ["shaman", "Your boat has something new. Call it on the radio from anywhere on an island."],
      ["shaman", "But while you're calling, you're standing still in the open. Pick your moment."],
    ],
  },
  {
    id: "firstHeroUpgrade",
    when: { on: "first", thing: "heroUpgrade" },
    lines: [
      ["shaman", "Feel that? The crystal goes in like warm rain."],
      ["shaman", "Nature gives the strength to stand, fire a harder blow, ice quicker feet."],
      [
        "shaman",
        "And the Deep teaches new things. Each is a gift from the spirits. Spend them on those who fight.",
      ],
    ],
  },
  {
    id: "firstChest",
    when: { on: "first", thing: "chest" },
    lines: [
      ["rifleman", "A chest, buried behind their stores. Heavy."],
      ["shaman", "Raiders bury what they steal, and then forget where. Open it."],
      ["shaman", "Whatever's inside was somebody's once."],
    ],
  },
  {
    id: "firstBeachFind",
    when: { on: "first", thing: "beachFind" },
    lines: [
      ["shaman", "The tide has left something on the sand. It brings things in every few hours."],
      [
        "shaman",
        "And it takes them back again. Walk the beaches when you can. The sea doesn't wait.",
      ],
    ],
  },
  {
    id: "firstPuzzleIsland",
    when: { on: "first", thing: "puzzleIsland" },
    lines: [
      ["rifleman", "These defenses aren't scattered. Somebody laid this island out on purpose."],
      [
        "shaman",
        "Some of his islands are built like riddles. A field of mortars, a ring of towers.",
      ],
      ["shaman", "Don't charge in. Watch it a while, and look for the way in he didn't think of."],
    ],
  },
  {
    id: "firstRivalCrew",
    when: { on: "first", thing: "rivalCrew" },
    lines: [
      ["rifleman", "No skull on this one. Different flag."],
      ["shaman", "Another crew lives there, the way you live here. They aren't his."],
      [
        "shaman",
        "Raid them if you must, and they'll raid you back. Just remember they aren't the enemy.",
      ],
    ],
  },
  {
    id: "firstPickaxe",
    when: { on: "first", thing: "pickaxe" },
    lines: [
      [
        "shaman",
        "A pickaxe. Some of these rocks haven't moved since my grandmother's grandmother.",
      ],
      ["shaman", "My people hid things among the rocks. See what they've been keeping."],
    ],
  },
  {
    id: "firstChainsaw",
    when: { on: "first", thing: "chainsaw" },
    lines: [
      ["shaman", "That will open the deep forest, where the oldest trees grow."],
      [
        "shaman",
        "Go carefully in there. Some of those trees were old when the first canoes landed.",
      ],
    ],
  },
  {
    id: "firstDynamite",
    when: { on: "first", thing: "dynamite" },
    lines: [
      ["shaman", "Dynamite. For the stones that won't move any other way."],
      ["shaman", "Tell me before you light it. My ears are old.", { mood: "happy" }],
    ],
  },
  {
    id: "statueNature",
    when: { on: "first", thing: "statueNature" },
    lines: [
      [
        "shaman",
        "You found her. The Mother of Green. My people carved her when the first tree grew here.",
        { how: "moved, hushed" },
      ],
      [
        "shaman",
        "She's asleep under all that moss. Bring her ten nature crystals and plenty of stone.",
      ],
      [
        "shaman",
        "Wake her, and your buildings will stand stronger. There are three more. The old carvings say where.",
      ],
    ],
  },
  {
    id: "statueIce",
    when: { on: "first", thing: "statueIce" },
    lines: [
      ["shaman", "The Old Cold. He lives at the top of the sky and breathes out the rain."],
      [
        "shaman",
        "Wake him, and your mills will work harder, and you'll bring more home from every raid.",
      ],
    ],
  },
  {
    id: "statueFire",
    when: { on: "first", thing: "statueFire" },
    lines: [
      ["shaman", "The Smith. He forged these islands in a furnace under the sea."],
      ["shaman", "Wake him, and your defenses will hit like his hammer."],
    ],
  },
  {
    id: "statueDark",
    when: { on: "first", thing: "statueDark" },
    lines: [
      [
        "shaman",
        "The Deep. Nobody ever carved her face, because nobody has ever seen it.",
        { how: "low, a little afraid of her even now" },
      ],
      ["shaman", "She keeps everything the sea takes. Every ship, every coin, every lost thing."],
      ["shaman", "Wake her, and the islands will give their treasures up to you more often."],
    ],
  },
  {
    id: "statueRestored",
    when: { on: "first", thing: "statueRestored" },
    lines: [
      ["shaman", "Listen. Do you hear that? The stone is humming.", { mood: "whisper" }],
      [
        "shaman",
        "It's one of my people's songs. I didn't think I'd ever hear it again.",
        { how: "moved, voice unsteady" },
      ],
    ],
  },
  {
    id: "allStatues",
    when: { on: "first", thing: "allStatues" },
    cutscene: true,
    lines: [
      shot(
        "The fourth statue's eyes glow. Across the island, the other three answer, one after another.",
        4,
      ),
      shot("A low hum rolls over the forest, like a choir far away.", 2.5),
      [
        "shaman",
        "All four of them, awake. All four spirits watching over this island again.",
        { mood: "whisper", how: "breathless, overwhelmed, voice trembling" },
      ],
      [
        "shaman",
        "My grandmother told me about this day. She never got to see it.",
        { mood: "sad", how: "tears close, swallowing between the sentences", before: 0.8 },
      ],
      [
        "shaman",
        "Thank you. From her, and from me.",
        { mood: "happy", how: "crying and smiling at once, soft and full", before: 0.6 },
      ],
      ["rifleman", "You alright?", { how: "gentle, quiet, a hand on his shoulder", before: 0.8 }],
      [
        "shaman",
        "Better than alright, Sergeant. I'm home.",
        { mood: "happy", how: "a wet laugh, then calm and certain on 'I'm home'", after: 1.2 },
      ],
    ],
  },
];
