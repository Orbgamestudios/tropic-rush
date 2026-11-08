// Professor Terror's islands: the Hourglass and its time shards, his ordinary islands and the
// three boss islands, each ending with his escape, and what the crew learns about him on the way:
// the photograph, Clara, and the storm fifty years ago.

import { type Scene, together } from "./script";

export const TERROR: readonly Scene[] = [
  {
    id: "terror1Appears",
    when: { on: "island", island: "terror1", stage: "appears" },
    lines: [
      ["rifleman", "New island on the map. Red flag. His flag."],
      [
        "shaman",
        "Not one of his little outposts. One of his own islands. He works on islands like that.",
      ],
      [
        "terror",
        "I see you've been busy, little crew. Freeing my prisoners. Emptying my storehouses.",
        "radio",
      ],
      ["terror", "Thieves, every one of you.", "radio"],
      [
        "terror",
        "Every gun on my islands is there to stop people like you taking what's mine.",
        "radio",
      ],
      ["rifleman", "The crystals don't belong to you, Professor."],
      ["terror", "Everything belongs to someone, Sergeant. These belong to me.", "radio"],
      [
        "shaman",
        "His own islands are harder. He's there himself, thinking. Before you go, come with me.",
      ],
      ["shaman", "There's something in the forest I need to tell you about."],
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
    id: "hourglassRepaired",
    when: { on: "hourglass", stage: "repaired" },
    lines: [
      ["engineer", "It's humming! Is it meant to hum? I didn't do anything, I swear."],
      ["shaman", "It's happy.", "happy"],
      ["shaman", "Now. Put a crystal on the altar, any kind, and strike it."],
      ["shaman", "Not too hard, not too soft. Like knocking on a friend's door."],
      [
        "shaman",
        "Usually it breaks into two shards, or three, or four. Five, if the island likes you.",
      ],
      ["shaman", "One, if it doesn't. The island has moods. Like me."],
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
    lines: [
      ["shaman", "That island. There's light coming up out of the ground.", "scared"],
      ["shaman", "He's done it. He's pressed nature and fire together. A crystal of creation."],
      ["shaman", "With it, he can make things out of nothing."],
      ["rifleman", "Things like what?"],
      ["shaman", "Whatever he can imagine. Let's hope he hasn't much imagination."],
      ["terror", "Come and see, little crew. Come and see what the world could be.", "radio"],
      ["terror", "If only one mind were in charge of it.", "radio"],
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
      ["terror", "Enough!", "shout"],
      ["terror", "You think you've won? You've broken a few glass jars."],
      ["terror", "This is the only one that matters. Watch."],
      ["terror", "Creation, my dears. From nothing, anything."],
      ["rifleman", "A boat. He made a boat out of thin air!", "shout"],
      ["terror", "I'll be seeing you. Do try to keep up."],
      ["rifleman", "He's getting away!", "shout"],
    ],
  },
  {
    id: "creationHome",
    when: { on: "after", scene: "creationEscape" },
    lines: [
      ["rifleman", "Found this on his desk, in the workshop. Under all the plans."],
      [
        "rifleman",
        "An old photograph. Black and white. A young man and a woman on a beach, laughing.",
      ],
      ["medic", "Is that... him? With hair?"],
      ["bazooka", "He was kind of handsome. Don't tell anyone I said that."],
      ["shaman", "...Let me see.", "sad"],
      ["shaman", "Keep it safe, Sergeant. I think he'll want it back."],
      ["rifleman", "You know who she is."],
      ["shaman", "I know a lot of things. Not all of them are mine to tell yet."],
    ],
  },
  {
    id: "terror3Appears",
    when: { on: "island", island: "terror3", stage: "appears" },
    lines: [
      ["terror", "You have something of mine. A photograph.", "radio"],
      ["terror", "Give it back. It's worth nothing to you. It's worth everything to me.", "radio"],
      ["rifleman", "Then come and get it, Professor."],
      ["terror", "...I will.", "radio"],
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
    lines: [
      ["shaman", "The sky over that island is wrong. Look how the clouds turn round it."],
      [
        "shaman",
        "Ice and the Deep together. A crystal of chaos. Storms that think. Seas that bite.",
      ],
      ["terror", "You've come so far. It almost touches me. Almost.", "radio"],
      [
        "terror",
        "Come to my island. I'll show you a storm to tell your grandchildren about.",
        "radio",
      ],
      ["terror", "If you ever have any.", "radio"],
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
      ["terror", "Clever children. You keep on breaking my jars."],
      ["terror", "But I always save the one that matters."],
      ["terror", "Chaos, my dears. Even the sky takes my side."],
      ["bazooka", "There's a helicopter in that storm! I can't get a lock on it!", "shout"],
      ["rifleman", "Hold your fire. We'll lose him in the clouds either way."],
      ["terror", "Give my regards to your Shaman."],
      ["terror", "Ask him about the storm. The first one."],
    ],
  },
  {
    id: "chaosHome",
    when: { on: "after", scene: "chaosEscape" },
    lines: [
      ["rifleman", "He said to ask you about a storm. The first one."],
      ["shaman", "...Sit down, all of you. This one is long."],
      ["shaman", "Fifty years ago, when I was a boy, two strangers came to my village."],
      ["shaman", "A young man with black hair, and a young woman who loved flowers."],
      [
        "shaman",
        "She drew every flower on our island. He asked my grandmother about the glowing stones.",
      ],
      together(
        ["grenadier", "A young woman who drew flowers? Fifty years ago?", "surprised"],
        ["grenadier", "Clara Marlowe. My book. 'The Flowers of the Southern Isles.' She was here?"],
        ["shaman", "She was. She laughed like the sea on a calm day."],
      ),
      ["shaman", "Her name was Clara. His name was Theodore."],
      [
        "shaman",
        "He heard of a crystal on the reef island, three hours' sail. A storm was coming.",
      ],
      ["shaman", "My grandmother told him to wait. He would not wait."],
      [
        "shaman",
        "He was afraid another man would find it first. Clara went with him, because she loved him.",
      ],
      ["shaman", "The storm threw their boat onto the reef. I was on the beach that night."],
      ["shaman", "I pulled Theodore out of the waves."],
      ["shaman", "We never found Clara.", "sad"],
      ["medic", "Oh, no...", "sad"],
      ["shaman", "When he woke, all he had was that photograph, in his shirt pocket."],
      ["shaman", "He looked at it for three days. He didn't eat. Then he sailed away."],
      ["shaman", "When he came back, years later, he wasn't Theodore anymore."],
      ["shaman", "He had ships and raiders and guns. And he wanted every crystal in the sea."],
      ["rifleman", "He wants to bring her back."],
      ["shaman", "The oldest story says the eternal crystal can undo anything. Even the sea."],
      ["heavy", "Shaman... that's the saddest thing I've ever heard.", "sad"],
      ["shaman", "It's the saddest thing I know."],
      ["shaman", "And it doesn't change what will happen if he holds that much power."],
      ["shaman", "A whole world remade by one broken heart. Nobody else would get a say."],
      ["rifleman", "So we stop him."],
      ["shaman", "We stop him. And we don't hate him while we do it. That's the hard part."],
    ],
  },
  {
    id: "terror5Appears",
    when: { on: "island", island: "terror5", stage: "appears" },
    lines: [
      ["terror", "So. Now you know. Do you understand me a little better, little crew?", "radio"],
      ["rifleman", "We understand, Professor. We're still not letting you do it."],
      [
        "terror",
        "Letting me? I don't need your permission, Sergeant. I've never needed anyone's.",
        "radio",
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
    lines: [
      [
        "shaman",
        "The Hourglass has stopped humming. Something is pulling at time itself.",
        "scared",
      ],
      [
        "shaman",
        "He's making the crystal of time. When it's done, every shard will answer to him.",
      ],
      ["terror", "Last chance, little crew. Stay at home. Hold your shards close.", "radio"],
      ["terror", "In a few days, none of this will ever have happened.", "radio"],
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
      ["terror", "Stop."],
      ["youngTerror", "Ahh. I'd forgotten how this felt. Knees that don't creak."],
      ["youngTerror", "You can hear me, can't you? Frozen, but listening. Good."],
      ["youngTerror", "You think I'm a monster."],
      [
        "youngTerror",
        "I'm a man who made one mistake on one stormy night, and paid for it every day since.",
      ],
      ["youngTerror", "When I'm finished, there will be no storm. No mistake."],
      ["youngTerror", "And none of you will remember any of this."],
      ["youngTerror", "She'll know me now. That's all I ever wanted."],
      [
        "bazooka",
        "That's a seaplane! That's a beautiful seaplane! He's getting away in a beautiful—",
        "shout",
      ],
      ["rifleman", "He's gone. And did everyone see his face? He's young."],
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
    ],
  },
];
