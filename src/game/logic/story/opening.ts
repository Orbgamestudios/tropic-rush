// The opening: the crew lands, hears from Professor Terror, frees the Shaman on their first raid
// and settles in, and the Shaman tells them the old story of the crystals.

import type { Scene } from "./script";

export const OPENING: readonly Scene[] = [
  {
    id: "prologue",
    when: { on: "start" },
    lines: [
      ["rifleman", "Land ho. Well, sand ho. Close enough."],
      [
        "rifleman",
        "Nobody on the beach, nobody in the trees. Looks like this island's ours, crew.",
      ],
      ["terror", "Attention, little boat.", "radio"],
      [
        "terror",
        "These islands, and everything that glitters underneath them, belong to Professor Terror.",
        "radio",
      ],
      ["terror", "Build your huts. Catch your fish. Enjoy the sunsets.", "radio"],
      [
        "terror",
        "But touch one crystal of mine, and you will find out how I earned my name.",
        "radio",
      ],
      ["rifleman", "...Friendly neighbor."],
      [
        "rifleman",
        "Where's that voice even coming from? Is there a loudspeaker in that palm tree?",
      ],
      [
        "rifleman",
        "Right. Headquarters first. Then we find out who he is and what he's sitting on.",
      ],
    ],
  },
  {
    id: "firstRaid",
    when: { on: "first", thing: "raid" },
    lines: [
      ["rifleman", "Gun turrets, a headquarters, and a flag on top. A skull wearing... glasses?"],
      ["rifleman", "That's his flag, alright. Stay low and keep moving."],
      ["shaman", "Hello? Whoever is out there making all that noise?", "shout"],
      ["shaman", "The doors in here are very thick, and the guards are very lazy. Knock loudly."],
      ["rifleman", "Someone's locked in the headquarters. Change of plan, crew."],
      ["rifleman", "We're not just taking his gold. We're taking his prisoner."],
    ],
  },
  {
    id: "shamanFreed",
    when: { on: "first", thing: "raidWon" },
    lines: [
      ["shaman", "Ha! The roof falls in and the sky comes back. Thank you, strangers.", "laugh"],
      ["rifleman", "You alright? Who are you, and why was Terror keeping you in a box?"],
      ["shaman", "My name is very long, and your tongues are very short. Call me Shaman."],
      ["shaman", "The Professor kept me because I know the old stories of these islands."],
      [
        "shaman",
        "Where the crystals sleep. What they can do. He wanted me to tell him everything.",
      ],
      ["rifleman", "Did you?"],
      ["shaman", "I told him many stories. Not one of them was true.", "laugh"],
      ["shaman", "His raiders scattered my village years ago. I have nowhere to go home to."],
      [
        "shaman",
        "If you will have an old man, I'll live on your island. I can be useful. Sometimes.",
      ],
      ["rifleman", "We could use someone who knows these waters. Welcome to the crew."],
      [
        "shaman",
        "Then bring home what his headquarters was hiding. I'll tell you what it is.",
        "happy",
      ],
    ],
  },
  {
    id: "shamanArrives",
    when: { on: "after", scene: "shamanFreed" },
    lines: [
      ["shaman", "Ahh. Sand that has never felt one of his boots. Good sand.", "happy"],
      [
        "shaman",
        "You chose well. This island was my grandmother's, and her grandmother's before her.",
      ],
      ["shaman", "Clear the forest a little at a time. There are old things under the vines."],
      ["rifleman", "Old things like what?"],
      ["shaman", "Patience, Sergeant. A story told too early is only noise."],
      ["shaman", "I'll be on the beach. Come and find me when you want me. Usually I'm praying."],
      ["shaman", "Or sleeping. From the outside, they look exactly the same.", "laugh"],
    ],
  },
  {
    id: "firstCrystal",
    when: { on: "first", thing: "crystal" },
    lines: [
      ["shaman", "Ah. Hold it up to the light. See how it moves inside, as if it's breathing?"],
      [
        "shaman",
        "My people say that four spirits made these islands, long before anyone was here.",
      ],
      [
        "shaman",
        "Nature grew them. Fire raised them. Ice cooled them. And the Deep holds them up.",
      ],
      ["shaman", "When the spirits went to sleep, they left a little of themselves in the stone."],
      [
        "shaman",
        "Crystals. Green for nature, red for fire, blue for ice, and purple for the Deep.",
      ],
      ["rifleman", "And Terror wants them because...?"],
      ["shaman", "Because two crystals pressed together make something stronger than both."],
      [
        "shaman",
        "Ice and the Deep make a crystal of chaos. Nature and fire make a crystal of creation.",
      ],
      [
        "shaman",
        "And the oldest story says that chaos and creation, joined with time, make one more.",
      ],
      [
        "shaman",
        "The eternal crystal. Whoever holds it could remake the whole world as they please.",
      ],
      ["rifleman", "Let me guess. He wants that one."],
      ["shaman", "He wants nothing else.", "sad"],
      [
        "shaman",
        "Use these the way the spirits meant: a little strength for your heroes, never more.",
      ],
      ["shaman", "No one should hold that much power. Not him. Not you. Not me."],
    ],
  },
  {
    id: "hq2",
    when: { on: "hq", level: 2 },
    lines: [
      ["shaman", "Your headquarters grows. Good. The Professor's raiders will have noticed."],
      ["rifleman", "Let them notice."],
      [
        "shaman",
        "When it grows a little more, build a radar. Some of the people he took are still out there.",
      ],
      ["shaman", "Shouting into the sea, hoping somebody is listening. We should be listening."],
    ],
  },
  {
    id: "radar",
    when: { on: "first", thing: "radar" },
    lines: [
      ["rifleman", "Radar's up. Mostly static. And... is that whale song?"],
      [
        "shaman",
        "Listen longer. The sea is full of voices, and some of them are calling for help.",
      ],
      [
        "shaman",
        "Every time your headquarters grows, the dish hears a little further. Keep it turning.",
      ],
    ],
  },
  {
    id: "hq4",
    when: { on: "hq", level: 4 },
    lines: [
      [
        "shaman",
        "Last night the radar was humming a song. A cooking song, I think. A very deep voice.",
      ],
      ["rifleman", "You think someone's out there singing into a radio?"],
      [
        "shaman",
        "I think someone is very bored and very hungry. Grow a little more and we'll hear him.",
      ],
    ],
  },
  {
    id: "firstRaiderShip",
    when: { on: "first", thing: "raiderShip" },
    lines: [
      [
        "brack",
        "Ahoy there, little island! Captain Brack speaking, from the deck of my lovely ship.",
        "radio",
      ],
      [
        "brack",
        "The Professor pays me to keep his seas tidy. And you, my friends, are untidy.",
        "radio",
      ],
      ["brack", "See you tonight! Leave the lights on.", "radio"],
      ["rifleman", "Who's that clown?"],
      ["shaman", "Brack. His raiders burned my village. He works for the Professor, for gold."],
      ["shaman", "He would work for anyone, for more gold. Remember that about him."],
      [
        "shaman",
        "His ship lands tonight. Tap it on your map to see when, and how hard. Then get ready.",
      ],
    ],
  },
  {
    id: "nightRaidHeld",
    when: { on: "first", thing: "nightRaidHeld" },
    lines: [
      ["brack", "Back to the boat! BACK TO THE BOAT! This isn't over, island!", "radio"],
      [
        "shaman",
        "Hear that? That's the sound of a man counting everything he didn't steal.",
        "laugh",
      ],
      ["rifleman", "And holding them off pays. I could get used to Brack."],
    ],
  },
  {
    id: "nightRaidLost",
    when: { on: "first", thing: "nightRaidLost" },
    lines: [
      ["brack", "Thanks for the gold, island! Same time tomorrow?", "radio"],
      ["rifleman", "They got through. Took what they could carry."],
      ["shaman", "Don't hang your heads. Walls fall. Walls are built again."],
      [
        "shaman",
        "Look at what they broke first, and make that stronger. And remember where his ship came from.",
      ],
      ["rifleman", "His own base. We could return the visit."],
      ["shaman", "Brack hates visitors.", "laugh"],
    ],
  },
  {
    id: "islandRetaken",
    when: { on: "first", thing: "islandRetaken" },
    lines: [
      [
        "shaman",
        "One of the islands you freed has his flag on it again. Raiders came in the night.",
      ],
      ["shaman", "It will be stronger now. The Professor learns from you. You must learn faster."],
    ],
  },
  {
    id: "raidLost",
    when: { on: "first", thing: "raidLost" },
    lines: [
      ["shaman", "You came home with more bruises than gold. That isn't a loss. It's a lesson."],
      ["rifleman", "Expensive lesson."],
      ["shaman", "The good ones always are. What hit you hardest? Go back, and hit that first."],
    ],
  },
  {
    id: "threeStars",
    when: { on: "first", thing: "threeStars" },
    lines: [
      ["shaman", "Every building flat, the headquarters too. Three stars!", "happy"],
      ["shaman", "In my village we would have danced until morning."],
      ["rifleman", "Don't tempt me."],
    ],
  },
  {
    id: "firstBlueprint",
    when: { on: "first", thing: "blueprint" },
    lines: [
      [
        "shaman",
        "A plan for one of his raiders' machines. And they left it lying about. Careless.",
      ],
      [
        "shaman",
        "Paper won't shoot anybody, though. Build a laboratory to turn it into the real thing.",
      ],
    ],
  },
  {
    id: "firstLaboratory",
    when: { on: "first", thing: "laboratory" },
    lines: [
      [
        "shaman",
        "A laboratory! Glass and bubbles and very serious faces. The Professor would approve.",
      ],
      [
        "shaman",
        "Bring it the plans you find on raids. Every one is a weapon turned to your side.",
      ],
      [
        "shaman",
        "It can make your boat's weapons stronger, too. Even an old boat can learn new tricks.",
      ],
    ],
  },
  {
    id: "firstGunboatWeapon",
    when: { on: "first", thing: "gunboatWeapon" },
    lines: [
      ["shaman", "Your boat has a new voice. Call it on the radio from anywhere on an island."],
      [
        "shaman",
        "But while you talk into that radio, you stand still in the open. Choose your moment.",
      ],
      ["rifleman", "Noted. Duck first, call second."],
    ],
  },
  {
    id: "firstHeroUpgrade",
    when: { on: "first", thing: "heroUpgrade" },
    lines: [
      ["shaman", "The crystal sinks into you like warm rain. Can you feel it?"],
      ["shaman", "Nature gives health. Fire gives a harder blow. Ice gives quicker feet."],
      ["shaman", "And the Deep teaches new tricks. Each is a gift. Don't waste them."],
    ],
  },
  {
    id: "firstChest",
    when: { on: "first", thing: "chest" },
    lines: [
      ["rifleman", "A treasure chest. An actual, honest-to-goodness treasure chest."],
      ["shaman", "The raiders bury them and forget where. Open it before they remember.", "laugh"],
    ],
  },
  {
    id: "firstBeachFind",
    when: { on: "first", thing: "beachFind" },
    lines: [
      [
        "shaman",
        "The tide brought you something. The sea gives, and a few hours later, it takes back.",
      ],
      ["shaman", "Don't leave its gifts lying on the sand. Come and look whenever the tide turns."],
    ],
  },
  {
    id: "firstPuzzleIsland",
    when: { on: "first", thing: "puzzleIsland" },
    lines: [
      ["rifleman", "These defenses aren't in rings. Somebody laid this island out on purpose."],
      ["shaman", "Some of his islands are riddles. A field of mortars. A horseshoe of towers."],
      ["shaman", "Don't charge in. Look first. Then find the way in that he didn't think of."],
    ],
  },
  {
    id: "firstRivalCrew",
    when: { on: "first", thing: "rivalCrew" },
    lines: [
      ["rifleman", "That island's not one of Terror's. No skull flag."],
      ["shaman", "Another crew lives there, the way you live here."],
      [
        "shaman",
        "Raid them if you must. They'll raid you back. They're not your enemies, only your rivals.",
      ],
      ["shaman", "Try to remember the difference. Most of the time."],
    ],
  },
  {
    id: "firstPickaxe",
    when: { on: "first", thing: "pickaxe" },
    lines: [
      ["shaman", "A pickaxe. Those rocks have sat there since my grandmother's grandmother."],
      ["shaman", "Let's see what they've been sitting on."],
    ],
  },
  {
    id: "firstChainsaw",
    when: { on: "first", thing: "chainsaw" },
    lines: [
      ["shaman", "That noisy thing will open the deep forest, where the oldest trees are."],
      ["shaman", "Cut gently. Some of those trees are older than the Professor's grudges."],
    ],
  },
  {
    id: "firstDynamite",
    when: { on: "first", thing: "dynamite" },
    lines: [
      ["shaman", "Dynamite. For the rocks that won't listen to a pickaxe."],
      ["shaman", "Please warn me before you use it. I'm fond of my eyebrows.", "laugh"],
    ],
  },
  {
    id: "statueNature",
    when: { on: "first", thing: "statueNature" },
    lines: [
      [
        "shaman",
        "You found her! The Mother of Green. My people carved her when the first tree grew.",
      ],
      [
        "shaman",
        "She's tired, and covered in moss. Bring her ten nature crystals and plenty of stone.",
      ],
      ["shaman", "Wake her, and your buildings will stand stronger, with her watching over them."],
      ["shaman", "There are three more, you know. The old carvings say where. Keep clearing."],
    ],
  },
  {
    id: "statueIce",
    when: { on: "first", thing: "statueIce" },
    lines: [
      ["shaman", "The Old Cold! He lives at the top of the sky and breathes out the rain."],
      ["shaman", "Wake him, and your mills will work as if he were blowing on their sails."],
      [
        "shaman",
        "And your raids will bring home more. He was always generous, for a cold old man.",
      ],
    ],
  },
  {
    id: "statueFire",
    when: { on: "first", thing: "statueFire" },
    lines: [
      ["shaman", "The Smith. He forged these islands in his furnace under the sea."],
      ["shaman", "Wake him, and your defenses will hit like his hammer."],
    ],
  },
  {
    id: "statueDark",
    when: { on: "first", thing: "statueDark" },
    lines: [
      ["shaman", "The Deep. Nobody ever carved her face, because nobody has ever seen it."],
      ["shaman", "She keeps everything the sea takes. Every ship. Every coin. Every lost thing."],
      ["shaman", "Wake her, and the islands will give up their treasures to you more often."],
    ],
  },
  {
    id: "statueRestored",
    when: { on: "first", thing: "statueRestored" },
    lines: [
      ["shaman", "Listen. Can you hear it? The stone is singing.", "whisper"],
      [
        "shaman",
        "She remembers my people's songs. I didn't think I'd hear that again in my life.",
        "happy",
      ],
    ],
  },
  {
    id: "allStatues",
    when: { on: "first", thing: "allStatues" },
    lines: [
      ["shaman", "All four of them, awake. All four spirits watching over this island again."],
      ["shaman", "My grandmother told me about this day. She never got to see it.", "sad"],
      ["shaman", "Thank you. From her, and from me.", "happy"],
      ["rifleman", "You alright, Shaman?"],
      ["shaman", "I'm better than alright, Sergeant. I'm home."],
    ],
  },
  {
    id: "hq7",
    when: { on: "hq", level: 7 },
    lines: [
      [
        "shaman",
        "The radar keeps waking me with its beeping. Four more voices out there. At least four.",
      ],
      [
        "shaman",
        "One honks. One complains very politely. One talks about engines. One talks about herself.",
      ],
      ["rifleman", "Sounds like a crew."],
    ],
  },
];
