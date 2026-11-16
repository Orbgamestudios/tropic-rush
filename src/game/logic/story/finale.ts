// The end of the story: the fire mountain, the Shaman's sacrifice and return, and the crew's
// choice. Brought back, Theodore and Clara stay on the crew's island, Theo joins the crew as a
// hero, the Shaman goes to find his scattered people, and later Clara replants the islands, finds
// Pemberton's orchid and marries Theo, with the Shaman back to marry them. Left to rest, their
// photograph goes to the Hourglass, the Shaman stays and joins the crew as a hero, the orchid grows
// beside the photograph, and his people come home.
import { type Scene, shot, together } from "./script";

export const FINALE: readonly Scene[] = [
  {
    id: "eternalAppears",
    when: { on: "island", island: "eternal", stage: "appears" },
    cutscene: true,
    lines: [
      shot(
        "Far to the east, the old fire mountain splits open. White light pours up out of it into the clouds.",
        4,
      ),
      [
        "shaman",
        "There. Light pouring out of the fire mountain. He's started.",
        { how: "quiet and certain, the calm of someone who's dreaded this for years" },
      ],
      shot(
        "Inside the mountain: young Terror among three floating crystals, green-red, purple-blue and silver, drifting toward each other.",
        3.5,
      ),
      [
        "youngTerror",
        "This is it, little crew. Everything comes down to this.",
        { mood: "radio", how: "giddy, breathless with excitement, sing-song" },
      ],
      [
        "youngTerror",
        "Your shards won't touch me while the crystals are joining. Time itself is busy.",
        { mood: "radio", how: "smug and crisp, a little giggle on 'busy'" },
      ],
      [
        "youngTerror",
        "Stay home. It will all be over soon. And then it will never have begun.",
        {
          mood: "radio",
          how: "soft and gentle, almost kind, falling to a hush at the end",
          after: 0.8,
        },
      ],
      shot("The Shaman stands, picks up his grandmother's staff, and looks at the crew.", 2.5),
      [
        "shaman",
        "Then we'll walk in on our own feet. Get ready, all of you. We go together.",
        { how: "firm and warm, a leader's quiet strength, rising on 'together'", after: 1 },
      ],
    ],
  },
  {
    id: "eternalLanding",
    when: { on: "island", island: "eternal", stage: "landing" },
    lines: [
      [
        "shaman",
        "Your shards still work on his guns, just not on him. Break through to the mountain's heart!",
      ],
      ["youngTerror", "Shaman. You came. After all these years.", "radio"],
      ["shaman", "I pulled you out of the sea once, Theodore. I've come to pull you out again."],
      ["youngTerror", "I'm not drowning anymore, old man. I'm swimming.", "radio"],
    ],
  },
  {
    id: "eternalLost",
    when: { on: "island", island: "eternal", stage: "lost" },
    lines: [
      ["shaman", "Up, all of you. We're not finished, and neither is he. Quickly, before he is."],
    ],
  },
  {
    id: "finale",
    when: { on: "island", island: "eternal", stage: "won" },
    cutscene: true,
    lines: [
      shot(
        "The heart of the mountain. A cathedral of rock lit white. The three crystals spin together above young Terror, almost one.",
        4,
      ),
      shot("The crew and the Shaman stumble in, battered. Terror doesn't turn round.", 2.5),
      [
        "youngTerror",
        "You're too late. Listen. Can you hear it singing?",
        {
          how: "delighted and sing-song, almost giggling, then dropping to a hushed, reverent whisper on 'singing'",
        },
      ],
      [
        "shaman",
        "Theodore. Please. She wouldn't want this.",
        {
          how: "gentle and pleading, slow, using his name like a hand on his shoulder",
          before: 0.6,
        },
      ],
      shot("Terror spins round.", 0.8),
      [
        "youngTerror",
        "Don't. Don't you dare tell me what she'd want.",
        {
          mood: "angry",
          how: "suddenly flat, quiet and deadly, a smooth, measured whisper of pure menace",
        },
      ],
      [
        "youngTerror",
        "You didn't find her. You didn't even look for her.",
        {
          mood: "angry",
          how: "snapping into a manic shout, voice cracking with fury and grief",
          before: 0.2,
        },
      ],
      [
        "shaman",
        "I looked for three days. So did my whole village.",
        { how: "steady and quiet, no anger at all, letting it land", before: 1 },
      ],
      [
        "shaman",
        "And every year since, on the night of the storm, we've sung for her.",
        { how: "soft and tender, full of grief" },
      ],
      shot("Terror's face. Something cracks in it.", 2),
      [
        "youngTerror",
        "...You did?",
        { how: "all the theatre gone, small, stunned and quiet, almost a whisper", before: 0.8 },
      ],
      [
        "shaman",
        "Every year. We remember her too, Theodore.",
        { how: "very gentle, a step closer" },
      ],
      [
        "youngTerror",
        "Then you understand. I can mend it. All of it.",
        { how: "desperate hope, quickening, eyes wet" },
      ],
      [
        "youngTerror",
        "The storm, the reef, every bad thing that ever happened on these islands.",
        { how: "fervent and rushing, building, almost manic again" },
      ],
      [
        "rifleman",
        "And who decides what's bad, Professor? You?",
        { how: "hard and steady, cutting through" },
      ],
      [
        "youngTerror",
        "Who else is there?",
        { how: "flat, casual and deadpan, almost bored, chillingly calm", before: 0.4, after: 0.8 },
      ],
      shot(
        "The crystals touch. Light floods the cavern, white and blinding. The rock begins to crack.",
        2,
      ),
      [
        "shaman",
        "It's too bright. It's breaking. Get behind me, all of you!",
        {
          mood: "shout",
          how: "urgent and commanding, fast, rising over a roar but still his own deep old voice, no time to think",
        },
      ],
      shot(
        "Slow motion. The Shaman throws himself in front of the crew, arms wide. The light swallows everything.",
        3.5,
      ),
      shot(
        "White. Silence. Then dust drifting in shafts of light. Where Terror stood, there's only dust.",
        4,
      ),
      shot("The Shaman lies on the rock. Dust is lifting off him too, glittering.", 2.5),
      [
        "rifleman",
        "Shaman! SHAMAN!",
        { mood: "scared", how: "raw panic, running, voice breaking on the second cry" },
      ],
      shot("The crew kneel round him. He smiles up at them.", 2.5),
      [
        "shaman",
        "Don't cry.",
        {
          mood: "whisper",
          how: "a dying whisper, barely voiced, loving, a smile in it",
          before: 1,
        },
      ],
      [
        "shaman",
        "Take care of the island... and each other.",
        {
          mood: "whisper",
          how: "fading breath by breath, a long pause after 'island', the last words almost silent",
          before: 1.4,
          after: 2,
        },
      ],
      shot("He fades into glittering dust in their arms. The crew cry.", 4),
    ],
  },
  {
    id: "shamanReturns",
    when: { on: "after", scene: "finale" },
    cutscene: true,
    lines: [
      shot(
        "The dust settles. The crew kneel where the Shaman lay. Nobody speaks.",
        4,
        "Silence. Only the mountain ticking as it cools.",
      ),
      shot("Steele looks up. On the rock ahead, something small catches the light.", 2.5),
      shot(
        "A crystal, no bigger than a thumb: white, flawless, perfectly clear. It pulses, faintly, like a heartbeat.",
        3.5,
        "A single soft tone, in time with the pulse.",
      ),
      shot(
        "Steele gets up and walks to it, slowly. He kneels and picks it up. Light runs up his arm like water.",
        4,
      ),
      [
        "rifleman",
        "Bring him back.",
        {
          mood: "whisper",
          how: "barely a whisper, a plea and not an order, his voice cracking on 'him'",
          before: 1.2,
          after: 0.8,
        },
      ],
      shot(
        "Close on his eyes. The pupils flare, then blaze white.",
        2.5,
        "A deep swell, like the whole mountain breathing in.",
      ),
      shot(
        "The light bursts out of the crystal and across the sea. Time starts to run backwards.",
        3,
        "The score breaks in: drums, then strings, rising and soaring.",
      ),
      shot("The fire mountain's light pulls back down into the rock.", 4),
      shot("The seaplane flies backwards and settles on the water.", 3.4),
      shot("Over the storm island, the rain falls upward and the clouds unwind.", 2.9),
      shot("The speedboat comes apart into light over the workshop island.", 2.5),
      shot("Smashed jars leap back together on the workshop shelves.", 2.2),
      shot("Terror's skull flags slide down their poles, one after another.", 1.9),
      shot(
        "Raider ships sail backwards out of a burning bay as the flames shrink back into torches.",
        1.7,
      ),
      shot("The Shaman's village: charred posts grow back into houses.", 1.5),
      shot("Villagers run backwards into each other's arms.", 1.3),
      shot("A burned forest grows back green.", 1.2),
      shot("Ash falls back up into a volcano.", 1),
      shot("A storm unwinds off an island.", 0.9),
      shot("Rubble rises back into a lighthouse.", 0.8),
      shot("Fishing boats come home.", 0.7),
      shot("Children on a beach.", 0.6),
      shot("A reef, glowing.", 0.5),
      shot("Sunrise over the islands.", 0.4),
      shot("The four statues' eyes.", 0.4),
      shot("White.", 2, "The music peaks, holds, and cuts to silence."),
      shot(
        "Back in the mountain. Steele stands with blazing white eyes, the crystal in his hand. The white slowly fades from them.",
        3.5,
      ),
      shot(
        "He looks down at the crystal, surprised, as if he's only just noticed he's holding it.",
        2.5,
        "A faint, high shimmer of sound.",
      ),
      shot(
        "A soul lifts slowly out of the crystal: a small drifting light, warm as a candle.",
        4,
        "A soft choir, very far away, like the statues' hum.",
      ),
      shot(
        "It drifts to where the Shaman fell and sinks into the dust. The dust stirs, then rises in a slow, glittering spiral.",
        4.5,
      ),
      shot(
        "The spiral thickens into a shape, and the shape becomes the Shaman, kneeling, eyes closed. He opens them.",
        4.5,
        "The choir fades out on a single warm chord.",
      ),
      [
        "shaman",
        "...Oh. Well. That was unexpected.",
        {
          mood: "surprised",
          how: "bewildered, blinking, then wry, a slow dawning smile",
          before: 0.8,
        },
      ],
      ["rifleman", "Shaman!", { mood: "happy", how: "a choked, joyful cry, half a sob" }],
      [
        "shaman",
        "Careful, Sergeant. I've only just been put back together.",
        { mood: "laugh", how: "laughing and wincing as they grab him, warm" },
      ],
      [
        "heavy",
        "Group hug. Nobody argue. Group hug.",
        { mood: "sad", how: "crying openly, big and wobbly, arms already wide" },
      ],
      shot("They hold each other. Steele still holds the white crystal.", 3),
      [
        "shaman",
        "That crystal in your hand. It's made from everything he gathered, and everything we lost.",
        { how: "quiet and serious again, slow, looking at it", before: 0.8 },
      ],
      [
        "shaman",
        "It brought me back. And there's still light in it. Enough for one more, I think.",
        { how: "wondering, careful, as if it might hear him" },
      ],
      shot("A breeze moves the dust where Terror stood. Something small lies there.", 2),
      [
        "rifleman",
        "Look. Where he was standing. The photograph. It didn't burn.",
        { how: "hushed, disbelieving, kneeling to pick it up" },
      ],
      shot("Close: the black-and-white photograph, the young couple laughing.", 2.5),
      [
        "shaman",
        "The crystal will do what your heart asks of it. Once.",
        { how: "solemn and slow, a pause before 'once'" },
      ],
      [
        "shaman",
        "You could bring them back. Theodore, and Clara with him.",
        { how: "gentle, laying it before them" },
      ],
      [
        "shaman",
        "Or you could let them rest. They've been apart for fifty years.",
        { how: "just as gentle, sadder" },
      ],
      together(
        ["medic", "After everything he did?", { how: "torn, quiet, not quite angry" }],
        [
          "heavy",
          "After everything that was done to him.",
          { how: "soft and certain, a big man's gentleness" },
        ],
      ),
      [
        "shaman",
        "There's no wrong answer here. Only yours.",
        { how: "warm and steady, handing them the choice", before: 0.8, after: 1.5 },
      ],
    ],
    choice: {
      ask: "What will you do with the crystal?",
      options: [
        { say: "Bring them back", next: "revived", ending: "revived" },
        { say: "Let them rest", next: "rested", ending: "rested" },
      ],
    },
  },

  // Left to rest.
  {
    id: "rested",
    when: { on: "chosen" },
    cutscene: true,
    lines: [
      ["rifleman", "Let them rest.", { how: "quiet and sure, after a long breath", before: 1 }],
      ["shaman", "Yes. I think they've earned it.", { how: "soft agreement, relieved" }],
      shot("Steele closes his hand round the crystal. The light inside it slowly goes out.", 3.5),
      [
        "shaman",
        "There. The light has gone out of it. Now it's only a very pretty stone.",
        { how: "gentle, a little wonder, a small smile at the end" },
      ],
      [
        "shaman",
        "Let's take the photograph home. They should be together somewhere peaceful.",
        { how: "tender and slow", after: 1.5 },
      ],
      shot("The crew walk out of the mountain into the morning, the photograph held carefully.", 3),
    ],
  },
  {
    id: "restedHome",
    when: { on: "after", scene: "rested" },
    lines: [
      ["shaman", "We'll set it in the Hourglass, by the altar. Time can keep them company."],
      ["medic", "He did terrible things."],
      ["shaman", "He did. And once, he was a boy on a beach, laughing with the girl he loved."],
      ["shaman", "Both are true. That's the hard thing about people."],
      ["grenadier", "Her book can sit beside them. She'd like that, I think."],
      ["heavy", "Should we say something?"],
      ["shaman", "We sing. My village sang for her every year. Now we'll sing for both of them."],
      ["rifleman", "Rest easy, Theodore. Clara."],
      [
        "shaman",
        "Now. The islands won't look after themselves. His raiders are still out there, unpaid and angry.",
      ],
    ],
  },
  {
    id: "shamanJoins",
    when: { on: "after", scene: "restedHome" },
    joins: "shaman",
    cutscene: true,
    lines: [
      shot(
        "Morning on the crew's beach. The Shaman sits on the sand as always, looking at an old carved staff leaning on a hut.",
        3,
      ),
      ["shaman", "Sergeant. I've been thinking.", { how: "unusually decided, a little sheepish" }],
      [
        "shaman",
        "For fifty years I've sat on beaches, praying for other people to put things right.",
        { how: "reflective, slow, honest" },
      ],
      [
        "shaman",
        "I died once already this year. It was very educational.",
        { how: "dry, perfectly deadpan", before: 0.5 },
      ],
      [
        "shaman",
        "I'd like to be useful before I try it again.",
        { mood: "laugh", how: "the laugh breaking through" },
      ],
      [
        "rifleman",
        "You want to come on the raids?",
        { mood: "surprised", how: "surprised, then hopeful" },
      ],
      shot(
        "The Shaman picks up the staff. It glows faintly, green, red, blue and purple, for a moment.",
        2.5,
      ),
      [
        "shaman",
        "My grandmother's staff has leaned on a wall long enough. And the spirits owe me favors.",
        { how: "proud and playful, a glint in the eye" },
      ],
      together(
        ["medic", "Your knees, Shaman.", { how: "dry, doctorly" }],
        ["shaman", "My knees can complain on the boat.", { how: "breezy, waving it off" }],
      ),
      [
        "rifleman",
        "Then welcome to the fighting end of the crew.",
        { how: "warm, with a grin, offering a hand" },
      ],
      [
        "shaman",
        "Ha! Those raiders won't know what hit them.",
        {
          mood: "happy",
          how: "a delighted bark of a laugh, fierce and young for a moment",
          after: 0.8,
        },
      ],
    ],
  },

  // Brought back.
  {
    id: "revived",
    when: { on: "chosen" },
    cutscene: true,
    lines: [
      shot(
        "Steele raises the crystal. Light pours from it onto the photograph, and lifts off it in two shapes.",
        3.5,
      ),
      shot(
        "On the rock stand a young man with black hair and a young woman, soaked, exactly as they were in the photograph.",
        3.5,
      ),
      [
        "clara",
        "Theo? Theo, the boat, the waves were... where's the boat?",
        {
          mood: "scared",
          how: "confused and frightened, breathless, still in the storm, words tumbling",
        },
      ],
      [
        "theo",
        "Clara. Oh, Clara. You're here.",
        {
          mood: "sad",
          how: "barely able to speak, breaking down, a whisper on 'you're here'",
          before: 0.8,
        },
      ],
      [
        "clara",
        "Why are you crying? Why is everyone staring at us? Who are all these people?",
        { how: "bewildered, gentle, looking round, quickening" },
      ],
      [
        "shaman",
        "Welcome back, flower woman. You've been away a long time.",
        { how: "warm and slow, tears in his smile", before: 0.6 },
      ],
      [
        "clara",
        "...Little Koa? No. It can't be. You're old!",
        { mood: "surprised", how: "slow recognition, then a disbelieving laugh" },
      ],
      ["shaman", "Fifty years will do that.", { mood: "laugh", how: "a soft, delighted laugh" }],
      [
        "theo",
        "Clara, there's so much I have to tell you. And none of it is good.",
        { how: "heavy with shame, quiet, steadying himself", before: 0.8 },
      ],
      [
        "clara",
        "Then tell me slowly. It seems I'm not going anywhere.",
        { how: "gentle, brave, taking his hands, a small smile", after: 1.5 },
      ],
    ],
  },
  {
    id: "revivedHome",
    when: { on: "after", scene: "revived" },
    joins: "theo",
    lines: [
      ["rifleman", "So. Professor."],
      ["theo", "Theo. Please. I haven't earned the other name back, and I don't want it."],
      ["theo", "I know what I did. The islands. The raiders. The prisoners. All of you."],
      [
        "theo",
        "I can't undo it. The crystals are gone, and I wouldn't touch them if they weren't.",
      ],
      ["theo", "But I'd like to try to make it right. If you'll let me."],
      together(
        ["medic", "You kept me in a hut for a month picking splinters out of raiders."],
        ["theo", "I did. I'm sorry, Doctor.", "sad"],
        ["medic", "...I'll be watching you."],
      ),
      [
        "engineer",
        "Me too. Watching. But also, later, can I ask you about your mortar gyroscopes?",
      ],
      ["theo", "I can still build things. Let me build them for you, and fight beside you."],
      ["rifleman", "Then you're with us, Theo. Welcome to the crew."],
      ["clara", "Theo told me everything. Fifty years. I can't even imagine it."],
      ["clara", "Thank you, all of you. For giving us back the time. We'll try to deserve it."],
      [
        "shaman",
        "Stay on the island. There's room. There's always room for people who are trying.",
      ],
    ],
  },
  {
    // A boat heading out at sunset.
    id: "shamanLeaves",
    when: { on: "after", scene: "revivedHome" },
    cutscene: true,
    leaves: "shaman",
    lines: [
      shot("Sunset on the crew's beach. A small canoe waits at the water's edge, packed.", 3),
      [
        "shaman",
        "Sergeant. All of you. Sit down with me a moment.",
        { how: "calm and gentle, a little formal" },
      ],
      [
        "shaman",
        "When you washed up here, you needed an old man who knew the stories. Now look at you.",
        { how: "fond and proud, slow, smiling" },
      ],
      [
        "shaman",
        "You have a professor who knows every island, and a botanist who knows every leaf.",
        { how: "light, almost teasing" },
      ],
      [
        "shaman",
        "You don't need me anymore.",
        { how: "quiet and kind, letting it settle", before: 0.6 },
      ],
      ["rifleman", "That's not true.", { how: "quick, gruff, refusing it" }],
      [
        "shaman",
        "It's a little true. And that's good, Sergeant. That's what growing up looks like.",
        { how: "patient and loving, a soft laugh in 'a little true'" },
      ],
      [
        "shaman",
        "My people are still scattered across the islands. The seas are safe enough to look now.",
        { how: "hopeful, looking out to sea, faraway" },
      ],
      [
        "medic",
        "Will you come back?",
        { mood: "sad", how: "small and young, trying not to cry", before: 0.6 },
      ],
      [
        "shaman",
        "For the important things. Weddings. Feasts. Mo's stew.",
        { how: "warm and playful, a pause between each" },
      ],
      [
        "heavy",
        "I'll keep a bowl hot for you, Shaman.",
        { mood: "sad", how: "thick with tears, trying to smile" },
      ],
      [
        "theo",
        "Koa. Thank you. For pulling me out of the sea. Twice.",
        { how: "deeply sincere, halting, ashamed and grateful" },
      ],
      [
        "shaman",
        "The third time, you swim on your own, Theodore.",
        { mood: "laugh", how: "gently teasing, a hand on his shoulder" },
      ],
      shot("He pushes the canoe into the water and climbs in.", 2.5),
      [
        "shaman",
        "Look after the island, my loved ones. It's yours now.",
        {
          mood: "happy",
          how: "full of love, calling back across the water, softening at the end",
          after: 1,
        },
      ],
      shot(
        "The canoe grows small against the setting sun. The crew stand on the beach until it's gone.",
        4,
      ),
    ],
  },

  // After the ending, as the headquarters keeps growing.
  {
    id: "restedOrchid",
    when: { on: "hq", level: 45 },
    only: "rested",
    needs: "shamanJoins",
    lines: [
      together(
        [
          "grenadier",
          "Shaman! In the Hourglass, by the altar. Right beside their photograph.",
          { mood: "surprised", how: "breathless, hurrying up the path, hat in hand" },
        ],
        [
          "grenadier",
          "An orchid, white and purple, with a little gold lip. My orchid. Twenty years I've looked.",
          { how: "wonder and disbelief, voice unsteady" },
        ],
      ),
      ["shaman", "Nobody planted it there.", { how: "quiet wonder", before: 0.6 }],
      [
        "shaman",
        "Clara always did like to have the last word.",
        { mood: "happy", how: "a soft, fond laugh" },
      ],
      ["shaman", "Leave it where it is. It's keeping them company.", { how: "gentle and certain" }],
    ],
  },
  {
    id: "homecoming",
    when: { on: "hq", level: 48 },
    only: "rested",
    needs: "restedOrchid",
    cutscene: true,
    lines: [
      shot("Dawn. The crew's beach. Steele shades his eyes. Dozens of sails dot the horizon.", 3.5),
      [
        "rifleman",
        "Shaman. Boats on the horizon. A lot of them.",
        { how: "alert, then puzzled, calling over his shoulder" },
      ],
      shot("The Shaman walks slowly to the water's edge.", 2.5),
      [
        "shaman",
        "...Those sails. Those are our sails. Those are my people's sails.",
        {
          mood: "surprised",
          how: "disbelief turning to wonder, voice shaking more with each sentence",
        },
      ],
      [
        "shaman",
        "Word has spread that the Professor is gone. They're coming home.",
        { how: "overwhelmed, barely holding together, a sob on 'home'", before: 0.6 },
      ],
      together(
        [
          "heavy",
          "How many people is that? I need to know how many fish.",
          { how: "flustered and practical, counting sails, wiping his eyes" },
        ],
        ["shaman", "All the fish, Mo. All of them.", { mood: "laugh", how: "a crying laugh" }],
      ),
      together(
        ["medic", "Shaman, are you crying?", { how: "gentle, smiling, teasing a little" }],
        ["shaman", "I'm praying. Loudly.", { mood: "happy", how: "wet and joyful, the old joke" }],
      ),
      shot("The first canoes slide onto the sand. People leap out and run to him.", 3),
      [
        "shaman",
        "Welcome home, all of you. These are the friends who made the seas safe again.",
        { how: "calling out, proud and loving, arms wide" },
      ],
      [
        "rifleman",
        "Tonight we feast. Tomorrow we start building houses.",
        { how: "warm, a sergeant's cheer" },
      ],
      [
        "shaman",
        "One more than we need. The crew should have one too.",
        { mood: "happy", how: "full of joy, a grin you can hear", after: 1.5 },
      ],
      shot(
        "Wide: the beach crowded with people, the crew in the middle of them, the sun coming up.",
        4,
      ),
    ],
  },
  {
    id: "claraGarden",
    when: { on: "hq", level: 44 },
    only: "revived",
    needs: "shamanLeaves",
    lines: [
      [
        "clara",
        "The islands he stripped for fuel are nothing but stumps now. I'd like to plant them again.",
        { how: "determined and gentle" },
      ],
      [
        "clara",
        "Whatever grew there before, I'll find it. I drew most of it once.",
        { how: "a small, sad smile" },
      ],
      together(
        [
          "grenadier",
          "Miss Marlowe, might I help? I've brought your book.",
          { how: "shy and formal, holding out a worn book" },
        ],
        [
          "clara",
          "My book? I never finished my book.",
          { mood: "surprised", how: "confused, reaching for it" },
        ],
        [
          "grenadier",
          "Somebody did. It was printed from your notes, after the storm. It's wonderful.",
          { how: "warm, a little reverent" },
        ],
        [
          "theo",
          "I had it printed. It was the only thing of yours I could finish.",
          { mood: "sad", how: "quiet, not meeting her eyes" },
        ],
        ["clara", "...Oh, Theo.", { mood: "sad", how: "barely a breath, moved" }],
      ),
      ["theo", "Go and plant. I'll carry the watering can.", { how: "gentle, trying to smile" }],
    ],
  },
  {
    id: "claraOrchid",
    when: { on: "hq", level: 46 },
    only: "revived",
    needs: "claraGarden",
    lines: [
      [
        "clara",
        "Theo! The island I planted. Something's come up already. An orchid, white and purple.",
        { mood: "happy", how: "running up, out of breath, delighted" },
      ],
      ["clara", "I've never seen one like it, and I've seen every flower in these islands."],
      together(
        [
          "grenadier",
          "White and purple? With a little gold lip?",
          { mood: "surprised", how: "sitting bolt upright" },
        ],
        ["clara", "Yes! How did you know?"],
        [
          "grenadier",
          "That's it. That's my orchid. I've looked for it for twenty years.",
          { mood: "happy", how: "overcome, laughing" },
        ],
        ["clara", "Then it's yours to name, Mr. Pemberton."],
        ["grenadier", "No, my dear. I think it's yours.", { how: "gentle and certain" }],
      ),
      [
        "theo",
        "Fifty years away, and you're still finding flowers nobody's ever seen.",
        { how: "quiet, fond pride" },
      ],
    ],
  },
  {
    id: "proposal",
    when: { on: "hq", level: 48 },
    only: "revived",
    needs: "claraOrchid",
    cutscene: true,
    lines: [
      shot(
        "Evening. Clara and Theo sit on the beach among her new orchids, the sea gold with sunset.",
        3.5,
      ),
      [
        "clara",
        "Theo. I've been thinking. We were meant to be married, fifty years ago.",
        { how: "gentle and deliberate, a little shy, looking at the sea, not at him" },
      ],
      [
        "theo",
        "We were. On the beach, at sunset. You'd picked the flowers already.",
        { mood: "sad", how: "soft, aching with memory, a catch in 'already'", before: 0.6 },
      ],
      [
        "clara",
        "Well. We have a beach. We have sunsets. And I know where all the flowers are.",
        { how: "brightening, a playful lift on each 'we have'" },
      ],
      [
        "clara",
        "And we have a great many friends who blow things up.",
        { how: "dry and fond, glancing back at the crew" },
      ],
      [
        "theo",
        "Clara Marlowe... are you asking me?",
        { mood: "surprised", how: "stunned, a hopeful, disbelieving laugh building", before: 0.5 },
      ],
      [
        "clara",
        "I've waited fifty years, Theodore. I'm not waiting for you to get round to it.",
        { mood: "laugh", how: "laughing, bold, a bit bossy, completely sure" },
      ],
      shot("Behind them, the whole crew has been listening. Steele steps forward.", 2),
      [
        "rifleman",
        "You'll want someone to marry you.",
        { how: "gruff, pleased, trying not to grin" },
      ],
      [
        "clara",
        "I know exactly who. Somebody send a boat for Koa.",
        { mood: "happy", how: "bright and certain, already turning to go", after: 1 },
      ],
    ],
  },
  {
    id: "wedding",
    when: { on: "after", scene: "proposal" },
    cutscene: true,
    lines: [
      shot(
        "Sunset on the crew's beach, strung with flowers. Canoes pull up on the sand: the Shaman, and dozens of his people.",
        4,
      ),
      [
        "shaman",
        "I said I was leaving. I never said I'd miss a wedding.",
        { mood: "happy", how: "beaming, a big warm laugh in it" },
      ],
      [
        "shaman",
        "And I've brought guests. I found my people, a few on every island.",
        { how: "proud and moved, gesturing behind him" },
      ],
      ["shaman", "Not one of them would miss this.", { how: "soft and full of feeling" }],
      shot("Theo and Clara stand before him at the water's edge, holding hands.", 3),
      [
        "shaman",
        "Theodore. Clara. Time took fifty years from you.",
        { how: "solemn and slow, the voice of a ceremony", before: 0.8 },
      ],
      [
        "shaman",
        "And time gave them back. Use them kindly. Both of you.",
        { how: "warm and gentle, a pause before 'both of you'" },
      ],
      [
        "theo",
        "I will. Every single day of them.",
        { how: "quiet, fierce sincerity, voice thick" },
      ],
      [
        "clara",
        "And I'll make sure he does.",
        { mood: "laugh", how: "a bright laugh through happy tears" },
      ],
      shot("The crowd cheers. Big Mo is sobbing into a napkin.", 2),
      [
        "heavy",
        "I'm not crying. I was cutting onions for the cake.",
        { mood: "sad", how: "blubbering, unconvincing, very dignified about it" },
      ],
      together(
        ["medic", "There are no onions in a cake, Mo.", { how: "dry, patting his arm" }],
        ["heavy", "There are in mine.", { how: "firm and wounded" }],
      ),
      [
        "tank",
        "Tank's wearing a bow tie! Tank, you look SO handsome!",
        { mood: "happy", how: "squealing with delight" },
      ],
      [
        "bazooka",
        "I'd do a flyover if I had a plane. I'll do a run-over instead. Watch this.",
        { how: "cocky drawl, already running" },
      ],
      [
        "grenadier",
        "A toast. To the bride, to the groom, and to the orchid.",
        { how: "raising a glass, warm and formal, a twinkle on 'the orchid'" },
      ],
      [
        "engineer",
        "I built a camera! It mostly works! Everybody bunch up!",
        { how: "frantic and excited, waving everyone together" },
      ],
      ["theo", "A photograph. All of us.", { how: "quiet wonder, looking at Clara", before: 0.6 }],
      ["clara", "In color, this time.", { mood: "happy", how: "soft and glowing, a small laugh" }],
      [
        "rifleman",
        "Everybody squeeze in. On three. One, two...",
        { how: "cheerful sergeant's count, stretching the 'two'" },
      ],
      shot("Flash. The picture freezes: everyone together on the beach, in color.", 3),
      ["rifleman", "...Perfect.", { how: "quiet, content, a smile", after: 2 }],
    ],
  },
];
