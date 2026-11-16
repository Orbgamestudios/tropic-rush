// Things the crew can ask the Shaman about when they tap him, once a scene has told them of it.
// Island chatter and evenings tied to headquarters levels were cut (the owner, 2026-11-08): too
// distracting, and not about the story.

import type { Question } from "./script";

export const QUESTIONS: readonly Question[] = [
  {
    id: "askWho",
    ask: "Who are you?",
    after: "shamanFreed",
    answer: [
      ["shaman", "I'm the last shaman of a village that isn't there anymore."],
      ["shaman", "I know the old stories, the old songs, and which berries not to eat."],
      ["shaman", "The last one is the most useful, most days.", "laugh"],
    ],
  },
  {
    id: "askName",
    ask: "What's your real name?",
    after: "shamanFreed",
    answer: [
      ["shaman", "It's thirty-one syllables long, and half of them are a sort of whistle."],
      [
        "shaman",
        "When I was small, they called me something much shorter. Maybe one day I'll tell you.",
      ],
    ],
  },
  {
    id: "askTerror",
    ask: "Who is the Professor?",
    after: "shamanFreed",
    answer: [
      ["shaman", "A clever man who wants every crystal in the islands for himself."],
      [
        "shaman",
        "His raiders dig them out and ship them to his own islands, where he does... something.",
      ],
      ["shaman", "Nobody knows what. Only that he's been doing it for a very long time."],
    ],
  },
  {
    id: "askVillage",
    ask: "What happened to your village?",
    after: "shamanArrives",
    answer: [
      [
        "shaman",
        "His raiders came, looking for crystals. We didn't have any. They didn't believe us.",
      ],
      [
        "shaman",
        "My people scattered to the other islands. Some I still hear from. Some I don't.",
        "sad",
      ],
      ["shaman", "But this island remembers them. And now it has you. That's something."],
    ],
  },
  {
    id: "askGrandmother",
    ask: "Tell us about your grandmother.",
    after: "shamanArrives",
    answer: [
      [
        "shaman",
        "She was the shaman before me. Small, fierce, and never once wrong about the weather.",
      ],
      ["shaman", "She could sing a fish into a net. I've tried. The fish just look at me."],
      ["shaman", "She taught me every story I know. I'm still finding out what some of them mean."],
    ],
  },
  {
    id: "askCrystals",
    ask: "What are the crystals?",
    after: "firstCrystal",
    answer: [
      ["shaman", "A little of the four spirits who made the islands, left behind in the stone."],
      ["shaman", "Nature, fire, ice and the Deep. Green, red, blue and purple."],
      ["shaman", "They make your heroes stronger, and they can wake the old statues."],
    ],
  },
  {
    id: "askEternal",
    ask: "What's the eternal crystal?",
    after: "firstCrystal",
    answer: [
      [
        "shaman",
        "Ice and the Deep make chaos. Nature and fire make creation. Time shards make time.",
      ],
      ["shaman", "Chaos, creation and time, all joined, make the eternal crystal."],
      [
        "shaman",
        "Whoever holds it could remake the world. Every river, every mountain, every person.",
      ],
      ["shaman", "That's why nobody should."],
    ],
  },
  {
    id: "askUse",
    ask: "Why don't we use crystal magic ourselves?",
    after: "firstCrystal",
    answer: [
      [
        "shaman",
        "Because it isn't meant to give anyone that much power. Not him, not you, not me.",
      ],
      ["shaman", "The moment you think you'd use it well is the moment it starts to use you."],
    ],
  },
  {
    id: "askStatues",
    ask: "What are the statues?",
    after: "statueNature",
    answer: [
      [
        "shaman",
        "My people carved one for each spirit, and hid them deep in the island to keep them safe.",
      ],
      ["shaman", "The Mother of Green, the Old Cold, the Smith, and the Deep."],
      ["shaman", "Wake them with their own crystals, and they'll bless this island for good."],
    ],
  },
  {
    id: "askRadar",
    ask: "What's the radar for?",
    after: "radar",
    answer: [
      ["shaman", "Listening. The Professor's people took prisoners from all over the islands."],
      [
        "shaman",
        "Some of them are still calling for help. As your headquarters grows, it hears further.",
      ],
    ],
  },
  {
    id: "askHourglass",
    ask: "What's the Hourglass?",
    after: "hourglassTold",
    answer: [
      ["shaman", "A ruin in the deep forest, where our wise ones broke crystals into time shards."],
      ["shaman", "Mend it, put a crystal on its altar, and strike. Out come the shards. Usually."],
    ],
  },
  {
    id: "askShards",
    ask: "How do time shards work?",
    after: "hourglassFirstShards",
    answer: [
      [
        "shaman",
        "Take three on a raid. Only one can be running at a time, and it works for the whole crew.",
      ],
      [
        "shaman",
        "Yellow slows the world. Blue stops it. Orange speeds everything up, behind a barrier.",
      ],
      ["shaman", "Green records you, then sends your shadow to fight while you're free."],
      ["shaman", "Purple turns the world back. And red gives a fallen friend one more chance."],
      [
        "shaman",
        "The red ones don't count against your three. One for each friend who fights with you.",
      ],
    ],
  },
  {
    id: "askPhoto",
    ask: "Who's in the photograph?",
    after: "creationHome",
    answer: [
      ["shaman", "A young man and the girl he loved, on the happiest day of his life."],
      ["shaman", "The rest is a sad story, and it's his to tell. Or mine, when the time is right."],
    ],
  },
  {
    id: "askClara",
    ask: "What was Clara like?",
    after: "chaosHome",
    answer: [
      ["shaman", "She asked me the name of every flower, and wrote down all of them."],
      [
        "shaman",
        "When I didn't know one, she'd make one up and make me promise to use it.",
        "laugh",
      ],
      [
        "shaman",
        "There's a little blue flower by the beach that only I call Clara's Bell. Now you do too.",
      ],
    ],
  },
  {
    id: "askTheodore",
    ask: "What was Theodore like, before?",
    after: "chaosHome",
    answer: [
      ["shaman", "Clever. Kind, mostly. Always in a hurry, as if time was chasing him."],
      [
        "shaman",
        "He fixed my grandmother's fishing net with a piece of wire and a song he made up.",
      ],
      ["shaman", "He laughed when Clara laughed. That's what I remember most."],
    ],
  },
  {
    id: "askGone",
    ask: "What was it like, when you were gone?",
    after: "shamanReturns",
    answer: [
      [
        "shaman",
        "Quiet. Warm. Like lying on the sand with your eyes closed, listening to the sea.",
      ],
      [
        "shaman",
        "My grandmother was there. She told me I wasn't finished yet. She was right. She always was.",
      ],
    ],
  },
];
