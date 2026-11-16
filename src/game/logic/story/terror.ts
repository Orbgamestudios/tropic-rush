// Professor Terror's islands: the Hourglass and its time shards, his ordinary islands and the
// three boss islands, each ending with his escape, and what the crew learns about him on the way:
// the photograph, Clara, and the storm fifty years ago.

import { type Scene, shot, together } from "./script";

export const TERROR: readonly Scene[] = [
  {
    // The first time the crew sees Professor Terror himself.
    id: "terror1Appears",
    when: { on: "island", island: "terror1", stage: "appears" },
    cutscene: true,
    lines: [
      shot("The map. Cloud parts over a dark island under a red skull flag.", 2.5),
      [
        "rifleman",
        "New island on the map. Red flag. His flag.",
        { how: "low and wary, reading the map slowly" },
      ],
      [
        "shaman",
        "Not one of his little outposts. One of his own islands. He works on islands like that.",
        { how: "grave and careful, a warning in it" },
      ],
      shot(
        "Cut to a dim laboratory full of glowing jars. A bald old man in half-moon glasses leans to a brass microphone.",
        3,
      ),
      [
        "terror",
        "I see you've been busy, little crew. Freeing my prisoners. Emptying my storehouses.",
        {
          mood: "radio",
          how: "light and amused, sing-song, ticking the crimes off on his fingers",
        },
      ],
      [
        "terror",
        "Thieves, every one of you.",
        { mood: "radio", how: "the smile gone, suddenly flat and cold, very quiet", before: 0.5 },
      ],
      [
        "terror",
        "Every gun on my islands is there to stop people like you taking what's mine.",
        { mood: "radio", how: "crisp and precise, rising and sharpening on 'what's mine'" },
      ],
      [
        "rifleman",
        "The crystals don't belong to you, Professor.",
        { how: "steady and firm, unimpressed" },
      ],
      shot("Terror smiles at the microphone, almost fondly.", 1.5),
      [
        "terror",
        "Everything belongs to someone, Sergeant. These belong to me.",
        {
          mood: "radio",
          how: "patient, as to a child, a little giggle before the last four words, then stone",
          after: 0.8,
        },
      ],
      [
        "shaman",
        "That is the Professor. His own men call him Terror, and they mean it.",
        { how: "quiet and grim, saying the name aloud as if it costs him something", before: 0.6 },
      ],
      [
        "shaman",
        "His own islands are harder. He's there himself, thinking. Before you go, come with me.",
        { how: "urgent but calm, already turning toward the forest" },
      ],
      [
        "shaman",
        "There's something in the forest I need to tell you about.",
        { how: "quieter, mysterious" },
      ],
    ],
  },
  {
    id: "hourglassTold",
    when: { on: "after", scene: "terror1Appears" },
    lines: [
      ["shaman", "Deep in the forest, further than your saws have gone, there is a ruin."],
      ["shaman", "My people called it the Hourglass."],
      ["shaman", "Long ago, our wise ones broke crystals there. Not into dust. Into shards."],
      ["shaman", "Shards that hold a little piece of time."],
      ["rifleman", "Time. As in, clocks?"],
      ["shaman", "As in the river that clocks only pretend to measure."],
      ["shaman", "A shard can slow the world down, or stop it, or turn it back a few heartbeats."],
      ["shaman", "Not much. Just enough."],
      ["shaman", "The Professor has crystals and guns. You need something he doesn't understand."],
      ["shaman", "Clear the way to the Hourglass and mend it. I'll show you how to use it."],
    ],
  },
  {
    id: "hourglassFound",
    when: { on: "hourglass", stage: "found" },
    lines: [
      ["rifleman", "Found it. Big stone thing, cracked down the middle, vines all over it."],
      ["shaman", "Ahh. It's smaller than I remember. Or I'm bigger.", "happy"],
      ["shaman", "Hm. No."],
      [
        "shaman",
        "Mend the stone and it will work again. My grandmother said it hums when it's happy.",
      ],
    ],
  },
  {
    // The Hourglass wakes up.
    id: "hourglassRepaired",
    when: { on: "hourglass", stage: "repaired" },
    cutscene: true,
    lines: [
      shot(
        "Deep forest. The last stone settles into place on the cracked hourglass-shaped ruin.",
        2.5,
      ),
      shot("Sand begins to fall upward inside it, glittering. A low hum fills the clearing.", 3),
      [
        "engineer",
        "It's humming! Is it meant to hum? I didn't do anything, I swear.",
        { mood: "scared", how: "nervous and fast, backing away, hands up" },
      ],
      [
        "shaman",
        "It's happy.",
        { mood: "happy", how: "simple, delighted, a soft laugh", before: 0.5 },
      ],
      [
        "shaman",
        "Now. Put a crystal on the altar, any kind, and strike it.",
        { how: "a teacher's patience, slow and clear" },
      ],
      [
        "shaman",
        "Not too hard, not too soft. Like knocking on a friend's door.",
        { how: "gentle and playful, miming a soft knock" },
      ],
      [
        "shaman",
        "Usually it breaks into two shards, or three, or four. Five, if the island likes you.",
        { how: "counting, easy rhythm, a wink on 'five'" },
      ],
      [
        "shaman",
        "One, if it doesn't. The island has moods. Like me.",
        { mood: "laugh", how: "dry, then a chuckle at himself", after: 0.6 },
      ],
    ],
  },
  {
    id: "hourglassFirstShards",
    when: { on: "hourglass", stage: "firstShards" },
    lines: [
      [
        "rifleman",
        "Look at that. Clear as glass, full of light. Each with a little picture inside.",
      ],
      ["shaman", "Each shard does one thing. Take three with you on a raid, no more."],
      ["shaman", "Time doesn't like being carried about in big bags."],
      [
        "shaman",
        "And only one can be running at a time. When you fight together, the whole crew feels it.",
      ],
      ["shaman", "The red ones are different. Retries. They don't count against your three."],
      [
        "shaman",
        "There's a slot for one for every friend fighting beside you. The crew shares them.",
      ],
      ["shaman", "The Professor's own islands are meant for all of you together."],
      ["shaman", "If you go alone, you get a slot for everyone in your crew, to make up for it."],
    ],
  },
  {
    id: "powerSlow",
    when: { on: "power", power: "slow" },
    lines: [
      ["rifleman", "Everything's moving like it's under water. Everything except me."],
      ["shaman", "The yellow shard. The world takes a long, slow breath, and you don't."],
      ["rifleman", "I could get used to this."],
    ],
  },
  {
    id: "powerPause",
    when: { on: "power", power: "pause" },
    lines: [
      ["shaman", "The blue shard. Everything stops. Their shots hang in the air like fruit."],
      [
        "shaman",
        "Their guns can't turn and can't fall. But they still feel every blow you give them.",
      ],
      ["rifleman", "And when it all starts again?"],
      ["shaman", "Every shot carries on where it was going. So don't stand where it was going."],
    ],
  },
  {
    id: "powerFastForward",
    when: { on: "power", power: "fastForward" },
    lines: [
      ["rifleman", "Whoa! Everything's double speed. Me too!", "surprised"],
      ["shaman", "The orange shard. A barrier round you takes the blows while it lasts."],
      [
        "shaman",
        "When the barrier breaks, the shard is spent, and time goes back to its own pace.",
      ],
    ],
  },
  {
    id: "powerRetry",
    when: { on: "power", power: "retry" },
    lines: [
      [
        "rifleman",
        "I was down. I was really down. And then... I was standing up, a few seconds back.",
      ],
      ["shaman", "The red shard. One more chance, taken from a moment ago."],
      ["shaman", "They're precious. The crew shares them, so don't spend them on silly things."],
    ],
  },
  {
    id: "powerRecord",
    when: { on: "power", power: "record" },
    lines: [
      [
        "shaman",
        "The green shard. While it shines, nothing can touch you, and the island watches you.",
      ],
      ["shaman", "When it ends, time goes back to where you started."],
      ["shaman", "Then your shadow does everything you did, all over again, while you're free."],
      ["rifleman", "So I just fought beside myself."],
      ["bazooka", "Two Sergeants. Twice the grumbling."],
      [
        "shaman",
        "The enemy sees only the shadow. Go and do something clever while it fights for you.",
      ],
    ],
  },
  {
    id: "powerRewind",
    when: { on: "power", power: "rewind" },
    lines: [
      ["shaman", "The purple shard. The world runs backwards."],
      [
        "shaman",
        "His shots fly home into the guns that fired them. Mind they don't pass through you.",
      ],
      [
        "shaman",
        "Careful, though. Whatever you broke before the turning mends itself as time runs back.",
      ],
      [
        "shaman",
        "What you break while it turns stays broken. And it won't give you back a single scratch.",
      ],
      ["rifleman", "So we hit hardest while it's turning."],
      ["shaman", "Now you're thinking like time."],
    ],
  },
  {
    id: "terror1Landing",
    when: { on: "island", island: "terror1", stage: "landing" },
    lines: [
      ["terror", "Welcome to my island. Please wipe your feet.", "radio"],
      ["terror", "Then please leave.", "radio"],
      ["terror", "No? Then allow me to introduce you to my defenses.", "radio"],
    ],
  },
  {
    id: "terror1Won",
    when: { on: "island", island: "terror1", stage: "won" },
    lines: [
      ["terror", "Do you have any idea how long that took to build? Any idea at all?", "radio"],
      ["rifleman", "Longer than it took to knock down, I'd guess."],
      [
        "terror",
        "Enjoy your little victory. It's the last one you'll enjoy on my islands.",
        "radio",
      ],
    ],
  },
  {
    id: "terror1Lost",
    when: { on: "island", island: "terror1", stage: "lost" },
    lines: [
      ["terror", "And off they run. Come back any time. My guns could use the practice.", "radio"],
      ["shaman", "Don't listen to him. He talks most when he's worried."],
    ],
  },
  {
    id: "terror2Appears",
    when: { on: "island", island: "terror2", stage: "appears" },
    lines: [
      ["shaman", "Another of his islands. He's moving his crystals, one island closer at a time."],
      ["shaman", "He wants them all in one place. He's building something."],
      ["rifleman", "Then we take them before they get there."],
    ],
  },
  {
    id: "terror2Landing",
    when: { on: "island", island: "terror2", stage: "landing" },
    lines: [
      ["terror", "I've been watching your little raids. You rely on that boat of yours.", "radio"],
      ["terror", "How sweet. Let's see how far it gets you here.", "radio"],
    ],
  },
  {
    id: "terror2Won",
    when: { on: "island", island: "terror2", stage: "won" },
    lines: [
      ["terror", "Fine. Take them. I have more. I always have more.", "radio"],
      ["medic", "He sounds tired."],
      ["shaman", "He has been tired for fifty years.", "sad"],
      ["rifleman", "Fifty years? What happened fifty years ago?"],
      ["shaman", "A storm. Ask me again another day."],
    ],
  },
  {
    id: "creationAppears",
    when: { on: "island", island: "creation", stage: "appears" },
    cutscene: true,
    lines: [
      shot(
        "Night. Out on the map, an island glows from underneath, green and red light pulsing up through the trees.",
        3.5,
      ),
      [
        "shaman",
        "That island. There's light coming up out of the ground.",
        { mood: "scared", how: "hushed and afraid, breath catching" },
      ],
      [
        "shaman",
        "He's done it. He's pressed nature and fire together. A crystal of creation.",
        { how: "slow, heavy dread, each sentence its own weight" },
      ],
      ["shaman", "With it, he can make things out of nothing.", { how: "almost a whisper" }],
      ["rifleman", "Things like what?", { how: "tense, quick" }],
      [
        "shaman",
        "Whatever he can imagine. Let's hope he hasn't much imagination.",
        { how: "grim, with a thin, tired humour on the second sentence" },
      ],
      shot(
        "Terror in his workshop, bathed in green and red light, arms spread like a showman.",
        2.5,
      ),
      [
        "terror",
        "Come and see, little crew. Come and see what the world could be.",
        { mood: "radio", how: "giddy and grand, like a ringmaster, savouring every word" },
      ],
      [
        "terror",
        "If only one mind were in charge of it.",
        {
          mood: "radio",
          how: "dropping to a soft, intimate purr, slow and certain",
          before: 0.4,
          after: 1,
        },
      ],
    ],
  },
  {
    id: "creationLanding",
    when: { on: "island", island: "creation", stage: "landing" },
    lines: [
      [
        "terror",
        "My workshop. Forty years of work. Every crystal I took from these islands.",
        "radio",
      ],
      ["terror", "Turn back now, and you may keep the scraps you've stolen.", "radio"],
      ["rifleman", "Crew, we take his crystals. All of them. Smash the jars."],
      ["terror", "THIEVES!", "radio"],
    ],
  },
  {
    id: "creationLost",
    when: { on: "island", island: "creation", stage: "lost" },
    lines: [
      ["terror", "You see? Even nothing can be made into a wall, when I want it to be.", "radio"],
      ["shaman", "Come home and rest. His workshop isn't going anywhere. Neither are we."],
    ],
  },
  {
    id: "creationEscape",
    when: { on: "island", island: "creation", stage: "won" },
    cutscene: true,
    lines: [
      shot(
        "The workshop in ruins, jars smashed, smoke everywhere. The crew advance through it.",
        3,
      ),
      shot("Terror stands at the far end, one crystal glowing in his fist.", 2),
      [
        "terror",
        "Enough!",
        { mood: "shout", how: "a sudden furious shriek that cuts everything off" },
      ],
      [
        "terror",
        "You think you've won? You've broken a few glass jars.",
        {
          how: "instantly calm again, amused and mocking, brushing dust off his sleeve",
          before: 0.6,
        },
      ],
      [
        "terror",
        "This is the only one that matters. Watch.",
        { how: "quiet and pleased, a magician before a trick" },
      ],
      shot(
        "He raises the crystal. Light pours out of it onto the water and folds itself into a sleek speedboat.",
        3.5,
      ),
      [
        "terror",
        "Creation, my dears. From nothing, anything.",
        { how: "a delighted sing-song, almost giggling", before: 0.3 },
      ],
      [
        "rifleman",
        "A boat. He made a boat out of thin air!",
        { mood: "shout", how: "disbelief, shouting over the engine" },
      ],
      shot("Terror steps aboard and gives a little wave.", 1.5),
      [
        "terror",
        "I'll be seeing you. Do try to keep up.",
        { how: "airy and bored, almost singing it", before: 0.2 },
      ],
      shot("The boat tears away across the bay.", 2),
      [
        "rifleman",
        "He's getting away!",
        { mood: "shout", how: "frustrated, running to the shore, too late" },
      ],
      shot("The wake fades. Silence and smoke.", 2),
    ],
  },
  {
    id: "creationHome",
    when: { on: "after", scene: "creationEscape" },
    cutscene: true,
    lines: [
      shot(
        "The crew's island, evening. Steele turns a small, old photograph over in his hands by the fire.",
        3,
      ),
      [
        "rifleman",
        "Found this on his desk, in the workshop. Under all the plans.",
        { how: "puzzled, quiet, almost reluctant to show it" },
      ],
      shot(
        "Close on the photograph: black and white, a young man and a woman on a beach, laughing.",
        3,
      ),
      [
        "rifleman",
        "An old photograph. Black and white. A young man and a woman on a beach, laughing.",
        { how: "slow, describing it carefully, softening on 'laughing'" },
      ],
      [
        "medic",
        "Is that... him? With hair?",
        { mood: "surprised", how: "squinting, half amused, half disbelieving" },
      ],
      [
        "bazooka",
        "He was kind of handsome. Don't tell anyone I said that.",
        { how: "a casual drawl, then quickly defensive" },
      ],
      shot("The Shaman goes very still.", 1.5),
      [
        "shaman",
        "...Let me see.",
        { mood: "sad", how: "quiet and careful, a catch in the voice", before: 0.6 },
      ],
      shot("He holds the photograph for a long moment, then hands it back.", 2.5),
      [
        "shaman",
        "Keep it safe, Sergeant. I think he'll want it back.",
        { how: "gentle and heavy, looking away" },
      ],
      ["rifleman", "You know who she is.", { how: "not a question, quiet", before: 0.5 }],
      [
        "shaman",
        "I know a lot of things. Not all of them are mine to tell yet.",
        { how: "kind but closed, slow, the fire crackling between the sentences", after: 1 },
      ],
    ],
  },
  {
    id: "terror3Appears",
    when: { on: "island", island: "terror3", stage: "appears" },
    cutscene: true,
    lines: [
      shot("Terror's laboratory. He holds an empty silver frame, turning it over and over.", 3),
      [
        "terror",
        "You have something of mine. A photograph.",
        {
          mood: "radio",
          how: "very quiet and controlled, dangerously calm, a long breath before speaking",
          before: 0.6,
        },
      ],
      [
        "terror",
        "Give it back. It's worth nothing to you. It's worth everything to me.",
        { mood: "radio", how: "the control slipping, voice rising and cracking on 'everything'" },
      ],
      shot(
        "The crew's island. Steele takes the photograph out of his top pocket and looks at it.",
        2,
      ),
      ["rifleman", "Then come and get it, Professor.", { how: "quiet, unafraid, almost gentle" }],
      [
        "terror",
        "...I will.",
        {
          mood: "radio",
          how: "a whisper, barely audible, no performance in it at all",
          before: 1.2,
          after: 1,
        },
      ],
    ],
  },
  {
    id: "terror3Landing",
    when: { on: "island", island: "terror3", stage: "landing" },
    lines: [
      [
        "terror",
        "Is it with you? The photograph? If so much as a corner of it is bent...",
        "radio",
      ],
      ["rifleman", "It's safe at home. Safer than it was with you."],
    ],
  },
  {
    id: "terror3Won",
    when: { on: "island", island: "terror3", stage: "won" },
    lines: [
      ["terror", "Keep it, then. Look at it. Look at her face.", "radio"],
      ["terror", "And then tell me I'm the monster.", "radio"],
    ],
  },
  {
    id: "magicAmmo",
    when: { on: "first", thing: "magicAmmo" },
    lines: [
      ["rifleman", "Those shells glowed. Since when do mortar shells glow?"],
      [
        "shaman",
        "He's feeding his crystals to his guns. Fire burns, ice slows, the Deep... hurts.",
      ],
      ["shaman", "Every shot carries a little of a spirit in it. The spirits would be ashamed."],
    ],
  },
  {
    id: "terror4Appears",
    when: { on: "island", island: "terror4", stage: "appears" },
    lines: [
      ["shaman", "Feel the air round that island? Crystals, burning away inside his turrets."],
      together(
        ["engineer", "I've seen his new turrets. Crystal-fed. He runs them so hot they'll crack."],
        ["engineer", "Inside a year. He knows that. He doesn't care."],
        ["engineer", "He doesn't need them in a year. He only needs them until he's finished."],
        ["rifleman", "Finished with what?"],
      ),
      ["shaman", "He's nearly finished with all of it. Get ready."],
    ],
  },
  {
    id: "terror4Landing",
    when: { on: "island", island: "terror4", stage: "landing" },
    lines: [
      ["terror", "Say hello to my new defenses. They've been so looking forward to you.", "radio"],
    ],
  },
  {
    id: "terror4Won",
    when: { on: "island", island: "terror4", stage: "won" },
    lines: [
      ["terror", "Clever. You're very clever.", "radio"],
      ["terror", "She was clever, too.", "radio"],
      ["rifleman", "She? Who's she, Professor?"],
      ["terror", "Never mind.", "radio"],
    ],
  },
  {
    id: "chaosAppears",
    when: { on: "island", island: "chaos", stage: "appears" },
    cutscene: true,
    lines: [
      shot(
        "On the map, a slow hurricane turns over one island, lightning flickering inside it.",
        3.5,
      ),
      [
        "shaman",
        "The sky over that island is wrong. Look how the clouds turn round it.",
        { how: "uneasy, slow, looking up" },
      ],
      [
        "shaman",
        "Ice and the Deep together. A crystal of chaos. Storms that think. Seas that bite.",
        { how: "low and ominous, a pause before each short sentence" },
      ],
      shot(
        "Terror at the window of a tower inside the storm, wind tugging his long white hair.",
        2.5,
      ),
      [
        "terror",
        "You've come so far. It almost touches me. Almost.",
        {
          mood: "radio",
          how: "mock-sentimental, a hand on his heart, then cold on the last 'almost'",
        },
      ],
      [
        "terror",
        "Come to my island. I'll show you a storm to tell your grandchildren about.",
        { mood: "radio", how: "bright and theatrical, a showman's invitation" },
      ],
      [
        "terror",
        "If you ever have any.",
        { mood: "radio", how: "flat, quiet, deadly, after a beat", before: 0.6, after: 1 },
      ],
    ],
  },
  {
    id: "chaosLanding",
    when: { on: "island", island: "chaos", stage: "landing" },
    lines: [
      [
        "terror",
        "Feel that wind? That's mine. Every drop of rain here falls where I tell it to.",
        "radio",
      ],
      ["tank", "Tank hates rain. It gets in his tracks and he sulks for days."],
      ["rifleman", "Stay together. Keep moving. Crystals first."],
    ],
  },
  {
    id: "chaosLost",
    when: { on: "island", island: "chaos", stage: "lost" },
    lines: [
      ["terror", "Blown away like leaves. How very fitting.", "radio"],
      ["shaman", "Dry off. Eat something. Then we go again. Storms always run out of wind."],
    ],
  },
  {
    id: "chaosEscape",
    when: { on: "island", island: "chaos", stage: "won" },
    cutscene: true,
    lines: [
      shot(
        "Rain lashing sideways. The storm tower is cracked open, its crystals smashed. Terror on the rooftop, coat whipping.",
        3.5,
      ),
      [
        "terror",
        "Clever children. You keep on breaking my jars.",
        { how: "shouting over the wind but amused, almost proud of them" },
      ],
      [
        "terror",
        "But I always save the one that matters.",
        { how: "sly, holding up a crackling purple-blue crystal" },
      ],
      shot(
        "He lifts it. The storm answers, swirling down round the tower until it's a wall of rain.",
        3,
      ),
      [
        "terror",
        "Chaos, my dears. Even the sky takes my side.",
        { how: "ecstatic, laughing into the storm, arms wide" },
      ],
      shot("Somewhere inside the rain, rotor blades start to thump.", 1.5),
      [
        "bazooka",
        "There's a helicopter in that storm! I can't get a lock on it!",
        { mood: "shout", how: "shouting, frustrated, launcher on her shoulder, tracking nothing" },
      ],
      [
        "rifleman",
        "Hold your fire. We'll lose him in the clouds either way.",
        { mood: "shout", how: "commanding over the wind, steady" },
      ],
      shot("A shape rises through the rain. Terror's voice comes from somewhere above.", 2),
      [
        "terror",
        "Give my regards to your Shaman.",
        { how: "intimate and quiet despite the storm, as if right beside them", before: 0.4 },
      ],
      [
        "terror",
        "Ask him about the storm. The first one.",
        { how: "slow and cold, every word placed, no laughter left", after: 1.5 },
      ],
      shot("The helicopter is gone. The rain slowly eases.", 2.5),
    ],
  },
  {
    // Told over a flashback in black and white, grained like the photograph.
    id: "chaosHome",
    when: { on: "after", scene: "chaosEscape" },
    cutscene: true,
    lines: [
      shot(
        "The crew's island, night. The Shaman sits by the fire, the crew around him, soaked and quiet.",
        3,
      ),
      [
        "rifleman",
        "He said to ask you about a storm. The first one.",
        { how: "careful and gentle, not pushing" },
      ],
      [
        "shaman",
        "...Sit down, all of you. This one is long.",
        { how: "a long breath out first, tired and heavy, resigned", before: 1 },
      ],
      shot(
        "The picture drains to black and white. Fifty years ago: the same beach, a village of huts, a small boy on the sand.",
        4,
      ),
      [
        "shaman",
        "Fifty years ago, when I was a boy, two strangers came to my village.",
        { how: "the storyteller's voice, slow and low, far away in memory" },
      ],
      shot(
        "A young man with black hair and a young woman with a sketchbook step off a little boat.",
        3,
      ),
      [
        "shaman",
        "A young man with black hair, and a young woman who loved flowers.",
        { how: "warm, fond, a smile you can hear" },
      ],
      [
        "shaman",
        "She drew every flower on our island. He asked my grandmother about the glowing stones.",
        { how: "lighter on her, darker and slower on 'the glowing stones'" },
      ],
      together(
        [
          "grenadier",
          "A young woman who drew flowers? Fifty years ago?",
          { mood: "surprised", how: "sitting up, breathless, half to himself" },
        ],
        [
          "grenadier",
          "Clara Marlowe. My book. 'The Flowers of the Southern Isles.' She was here?",
          { how: "wonder and disbelief, voice unsteady, clutching the worn book" },
        ],
        [
          "shaman",
          "She was. She laughed like the sea on a calm day.",
          { how: "soft and tender, remembering" },
        ],
      ),
      [
        "shaman",
        "Her name was Clara. His name was Theodore.",
        { how: "slow, giving each name its own weight", before: 0.6 },
      ],
      shot(
        "Black and white: the sky darkening over the sea. The young man pulling a boat to the water. An old woman shaking her head.",
        4,
      ),
      [
        "shaman",
        "He heard of a crystal on the reef island, three hours' sail. A storm was coming.",
        { how: "the pace tightening, tension building" },
      ],
      [
        "shaman",
        "My grandmother told him to wait. He would not wait.",
        { how: "firm, then hard and final on 'would not wait'" },
      ],
      [
        "shaman",
        "He was afraid another man would find it first. Clara went with him, because she loved him.",
        { how: "the anger leaving, sorrow taking its place, softest on 'because she loved him'" },
      ],
      shot(
        "Black and white: the storm. Waves over the reef. The little boat thrown against the rocks.",
        4,
      ),
      [
        "shaman",
        "The storm threw their boat onto the reef. I was on the beach that night.",
        { how: "quiet, hollow, reliving it" },
      ],
      [
        "shaman",
        "I pulled Theodore out of the waves.",
        { how: "barely above a whisper, a small boy's fear still in it" },
      ],
      [
        "shaman",
        "We never found Clara.",
        {
          mood: "sad",
          how: "breaking, a long pause before it, almost no voice left",
          before: 1.4,
          after: 1.4,
        },
      ],
      ["medic", "Oh, no...", { mood: "sad", how: "a small, stricken breath" }],
      shot(
        "Black and white: the young man on the sand, staring at a photograph in his shaking hands.",
        3.5,
      ),
      [
        "shaman",
        "When he woke, all he had was that photograph, in his shirt pocket.",
        { how: "gentle and sad, slow" },
      ],
      [
        "shaman",
        "He looked at it for three days. He didn't eat. Then he sailed away.",
        { how: "plain and heavy, a pause between each sentence" },
      ],
      [
        "shaman",
        "When he came back, years later, he wasn't Theodore anymore.",
        { how: "darker, colder", before: 0.6 },
      ],
      shot("Colour floods back: the fire, the crew's faces.", 2),
      [
        "shaman",
        "He had ships and raiders and guns. And he wanted every crystal in the sea.",
        { how: "grim, matter-of-fact" },
      ],
      [
        "rifleman",
        "He wants to bring her back.",
        { how: "quiet realisation, almost to himself", before: 0.8 },
      ],
      [
        "shaman",
        "The oldest story says the eternal crystal can undo anything. Even the sea.",
        { how: "slow and grave, a hush on 'even the sea'" },
      ],
      [
        "heavy",
        "Shaman... that's the saddest thing I've ever heard.",
        { mood: "sad", how: "a big man's voice gone small and thick with tears" },
      ],
      ["shaman", "It's the saddest thing I know.", { how: "simple, very quiet", before: 0.6 }],
      [
        "shaman",
        "And it doesn't change what will happen if he holds that much power.",
        { how: "steadier, the elder again, firm" },
      ],
      [
        "shaman",
        "A whole world remade by one broken heart. Nobody else would get a say.",
        { how: "grave, deliberate, a long breath before the second sentence" },
      ],
      ["rifleman", "So we stop him.", { how: "quiet, resolved, no anger in it", before: 0.8 }],
      [
        "shaman",
        "We stop him. And we don't hate him while we do it. That's the hard part.",
        { how: "gentle and certain, each sentence slower than the last", after: 1.5 },
      ],
    ],
  },
  {
    id: "terror5Appears",
    when: { on: "island", island: "terror5", stage: "appears" },
    cutscene: true,
    lines: [
      shot(
        "Terror, lit by his glowing jars, speaking softly into the microphone. The empty frame stands beside it.",
        3,
      ),
      [
        "terror",
        "So. Now you know. Do you understand me a little better, little crew?",
        {
          mood: "radio",
          how: "almost tender, mocking underneath, a sing-song lilt on 'little crew'",
        },
      ],
      [
        "rifleman",
        "We understand, Professor. We're still not letting you do it.",
        { how: "calm, sorry for him, but immovable" },
      ],
      [
        "terror",
        "Letting me? I don't need your permission, Sergeant. I've never needed anyone's.",
        {
          mood: "radio",
          how: "a shriek of laughter on 'Letting me?', then dropping instantly to a cold, slow, flat finish",
          after: 0.8,
        },
      ],
    ],
  },
  {
    id: "terror5Landing",
    when: { on: "island", island: "terror5", stage: "landing" },
    lines: [
      ["terror", "My defenses aren't here to hurt you.", "radio"],
      [
        "terror",
        "They're here to stop people like you taking what I've spent my life gathering.",
        "radio",
      ],
      ["terror", "Stop taking it, and they'll stop hurting you. It's very simple.", "radio"],
      ["rifleman", "It's never simple, Professor."],
    ],
  },
  {
    id: "terror5Won",
    when: { on: "island", island: "terror5", stage: "won" },
    lines: [
      ["terror", "Every crystal you take from me is another day she has to wait.", "radio"],
      ["terror", "Remember that, when you're counting your loot.", "radio"],
      ["medic", "That's not fair. That's not fair of him."],
      ["shaman", "Grief is never fair. Don't let it get into your aim."],
    ],
  },
  {
    id: "frozenHero",
    when: { on: "first", thing: "frozenHero" },
    lines: [
      ["rifleman", "Did you see that? I got hit and just... stopped. Mid-step. Like a photograph."],
      ["shaman", "Time shards in his guns. He has found the old way of breaking crystals."],
      [
        "shaman",
        "Keep moving, and keep close to each other. A frozen friend needs a friend nearby.",
      ],
    ],
  },
  {
    id: "terror6Appears",
    when: { on: "island", island: "terror6", stage: "appears" },
    lines: [
      ["shaman", "I can feel the shards stirring, even in our Hourglass. He's close now."],
      ["shaman", "When he has enough of them, he can press them into the third crystal. Time."],
      ["rifleman", "Then this island's where we slow him down."],
    ],
  },
  {
    id: "terror6Landing",
    when: { on: "island", island: "terror6", stage: "landing" },
    lines: [
      ["terror", "Do you know what it is to wait fifty years? Every day the same day?", "radio"],
      ["terror", "No. You're young. You think you have all the time in the world.", "radio"],
      ["terror", "I'm the one who's going to have it.", "radio"],
    ],
  },
  {
    id: "terror6Won",
    when: { on: "island", island: "terror6", stage: "won" },
    lines: [
      ["terror", "Go on. Break it all. I have what I need now.", "radio"],
      ["shaman", "He's laughing. I don't like it when he laughs."],
    ],
  },
  {
    id: "timeAppears",
    when: { on: "island", island: "time", stage: "appears" },
    cutscene: true,
    lines: [
      shot(
        "The Hourglass in the forest. Its glittering sand slows, hangs in the air, and stops.",
        3.5,
      ),
      [
        "shaman",
        "The Hourglass has stopped humming. Something is pulling at time itself.",
        { mood: "scared", how: "frightened, hushed, listening hard to the silence" },
      ],
      [
        "shaman",
        "He's making the crystal of time. When it's done, every shard will answer to him.",
        { how: "urgent and low, fear barely held down" },
      ],
      shot(
        "Terror before a great clock-like machine, its gears turning backwards. He speaks without looking at the microphone.",
        3,
      ),
      [
        "terror",
        "Last chance, little crew. Stay at home. Hold your shards close.",
        { mood: "radio", how: "soft and almost kind, like a lullaby, sing-song" },
      ],
      [
        "terror",
        "In a few days, none of this will ever have happened.",
        { mood: "radio", how: "dreamy and quietly thrilled, trailing off", after: 1.2 },
      ],
    ],
  },
  {
    id: "timeLanding",
    when: { on: "island", island: "time", stage: "landing" },
    lines: [
      ["terror", "Tick.", "radio"],
      ["terror", "Tock.", "radio"],
      ["rifleman", "Crew, go! Fast! Break his crystals before he can—"],
    ],
  },
  {
    id: "timeLost",
    when: { on: "island", island: "time", stage: "lost" },
    lines: [
      [
        "terror",
        "Time's up. For now. I'll give you some more, since I'll have so much of it.",
        "radio",
      ],
      ["shaman", "He's toying with you. Let him. People who toy make mistakes."],
    ],
  },
  {
    id: "timeEscape",
    when: { on: "island", island: "time", stage: "won" },
    cutscene: true,
    lines: [
      shot(
        "The clock machine shatters. Gears fly. Terror, cornered, lifts a crystal of swirling silver light.",
        3,
      ),
      ["terror", "Stop.", { how: "one word, quiet, absolutely calm", before: 0.4 }],
      shot(
        "Everything freezes: flying gears, falling sparks, the crew mid-stride. Only Terror moves.",
        3.5,
      ),
      shot(
        "A purple mist curls round him as he walks between them. His white hair darkens. His face loses fifty years.",
        4,
      ),
      [
        "youngTerror",
        "Ahh. I'd forgotten how this felt. Knees that don't creak.",
        { how: "a long, luxurious sigh, then playful and delighted with himself" },
      ],
      [
        "youngTerror",
        "You can hear me, can't you? Frozen, but listening. Good.",
        { how: "leaning close to Steele's frozen face, a mocking whisper, then pleased" },
      ],
      [
        "youngTerror",
        "You think I'm a monster.",
        { how: "flat and quiet, no performance", before: 0.6 },
      ],
      [
        "youngTerror",
        "I'm a man who made one mistake on one stormy night, and paid for it every day since.",
        { how: "raw and bitter, slow, the theatre stripped away, cracking on 'every day'" },
      ],
      [
        "youngTerror",
        "When I'm finished, there will be no storm. No mistake.",
        { how: "recovering, fervent, almost tender" },
      ],
      [
        "youngTerror",
        "And none of you will remember any of this.",
        { how: "back to a light sing-song, a little giggle at the end" },
      ],
      shot(
        "He stops at the shore, touches his young face, and looks at his reflection in the still water.",
        3,
      ),
      [
        "youngTerror",
        "She'll know me now. That's all I ever wanted.",
        {
          mood: "whisper",
          how: "barely a whisper, utterly sincere, almost a prayer",
          before: 0.8,
          after: 1,
        },
      ],
      shot(
        "He climbs into a seaplane. The pause breaks: gears crash down, sparks fall, the engine roars.",
        3,
      ),
      [
        "bazooka",
        "That's a seaplane! That's a beautiful seaplane! He's getting away in a beautiful—",
        { mood: "shout", how: "shouting, torn between outrage and admiration, cut off mid-word" },
      ],
      [
        "rifleman",
        "He's gone. And did everyone see his face? He's young.",
        { how: "shaken, slow, disbelief growing", before: 0.6, after: 1.2 },
      ],
    ],
  },
  {
    id: "timeHome",
    when: { on: "after", scene: "timeEscape" },
    lines: [
      ["rifleman", "He's young. He's actually young."],
      [
        "shaman",
        "The rewind turned his years back. He looks just as he did when I pulled him from the sea.",
      ],
      ["rifleman", "So what now? He's got creation, chaos and time."],
      [
        "shaman",
        "Now he puts them together. Only one place in the islands is strong enough to hold that.",
      ],
      ["shaman", "The old fire mountain, out east, where the Smith keeps his forge."],
      ["shaman", "When he goes there, I'm coming with you."],
      ["rifleman", "Shaman, you're—"],
      ["shaman", "Old? So is he, under that face."],
      ["shaman", "Somebody has to talk to him who remembers Theodore."],
      [
        "shaman",
        "I keep dreaming about my grandmother.",
        { how: "quieter, almost to himself", before: 0.8 },
      ],
      [
        "shaman",
        "She stands on the beach and waves me in from the sea, the way she did when I was small.",
        { how: "soft and faraway" },
      ],
      ["rifleman", "Good dream or bad dream?", { how: "gentle" }],
      ["shaman", "Both, I think. The best ones usually are.", { how: "a small, peaceful smile" }],
    ],
  },
];
