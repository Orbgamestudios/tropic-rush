// What the Shaman says when you tap him for advice: a nudge toward something the crew could do
// next, never spelled out. The game picks the first step on this list that applies, and one of
// its sayings, a different one each tap. While he's away from the island, there's nobody to ask.
// No engine imports.

import type { Line } from "./script";

/** Something the crew could do next, as the game sees it, most pressing first. */
export type NextStep =
  /** A raider ship lands tonight. */
  | "raidersTonight"
  /** The radar has a hero's signal nobody's answered. */
  | "answerSignal"
  /** A boss island, or the fire mountain, is waiting. */
  | "bossIsland"
  /** One of Terror's islands is waiting. */
  | "terrorIsland"
  /** Raiders took back an island the crew had won. */
  | "retakeIsland"
  /** A night raid got through, and the crew can hit the raider base back. */
  | "strikeBack"
  /** The headquarters is big enough for a radar, and there isn't one. */
  | "buildRadar"
  /** The Hourglass is found but broken. */
  | "repairHourglass"
  /** The Hourglass works, there are crystals to break and few shards. */
  | "breakCrystals"
  /** A statue is found but not restored. */
  | "restoreStatue"
  /** A statue's hiding place can be reached but it isn't found yet. */
  | "findStatue"
  /** A blueprint is waiting for the laboratory. */
  | "researchBlueprint"
  /** Crystals sitting unspent, and a hero who could use them. */
  | "spendCrystals"
  /** The headquarters can be upgraded now. */
  | "upgradeHq"
  /** A storage is full. */
  | "storageFull"
  /** The mills have plenty waiting to collect. */
  | "collect"
  /** The tide has left something on a beach. */
  | "beachFind"
  /** The next patch of overgrowth needs a better tool. */
  | "betterTool"
  /** There's overgrowth the crew could clear now. */
  | "clearForest"
  /** Cloud still hides islands on the map. */
  | "exploreMap"
  /** Nothing pressing. */
  | "rest";

export interface Hint {
  step: NextStep;
  /** A few ways of saying it, so tapping again doesn't repeat him. */
  sayings: readonly (readonly Line[])[];
}

export const HINTS: readonly Hint[] = [
  {
    step: "raidersTonight",
    sayings: [
      [["shaman", "Smell the wind. Salt, tar and bad manners. Someone's coming tonight."]],
      [["shaman", "I saw a dark sail today, far out. Look to your walls before the moon is up."]],
      [
        [
          "shaman",
          "The birds left the reef early this evening. Birds know when raiders are coming.",
        ],
      ],
    ],
  },
  {
    step: "answerSignal",
    sayings: [
      [
        [
          "shaman",
          "Someone is still calling from out there. Every night their voice sounds more tired.",
        ],
      ],
      [
        [
          "shaman",
          "The radar keeps singing the same song. Somebody's waiting for you to answer it.",
        ],
      ],
      [
        [
          "shaman",
          "A voice on the wind asked about you this morning. I said you were busy. Are you?",
        ],
      ],
    ],
  },
  {
    step: "bossIsland",
    sayings: [
      [
        [
          "shaman",
          "That light on the horizon... he's close to finishing something. I'd not let him.",
        ],
      ],
      [
        [
          "shaman",
          "I haven't slept. The air tastes of crystals. Whatever he's making, it's nearly made.",
        ],
      ],
    ],
  },
  {
    step: "terrorIsland",
    sayings: [
      [
        [
          "shaman",
          "That red island isn't going anywhere. But it grows stronger every day you wait.",
        ],
      ],
      [
        [
          "shaman",
          "The Professor is sitting on his island, waiting for you. Don't keep a clever man idle.",
        ],
      ],
      [
        [
          "shaman",
          "Every crystal he keeps is one more brick in his wall. Go and take some bricks.",
        ],
      ],
    ],
  },
  {
    step: "retakeIsland",
    sayings: [
      [["shaman", "One of the islands you freed is flying the wrong flag again."]],
      [["shaman", "The raiders crept back somewhere while we slept. The map will tell you where."]],
    ],
  },
  {
    step: "strikeBack",
    sayings: [
      [
        [
          "shaman",
          "Their raiders left footprints on our beach. Footprints lead both ways, you know.",
        ],
      ],
      [["shaman", "They visited us last night. It would be rude not to visit them back."]],
    ],
  },
  {
    step: "buildRadar",
    sayings: [
      [
        [
          "shaman",
          "The sea has been talking all week. Somebody on this island should learn to listen.",
        ],
      ],
      [
        [
          "shaman",
          "There are voices out past the reef, calling for help. A dish that turns would hear them.",
        ],
      ],
    ],
  },
  {
    step: "repairHourglass",
    sayings: [
      [
        [
          "shaman",
          "The old stone in the forest is cracked and sleeping. It wants mending before it sings.",
        ],
      ],
      [["shaman", "My grandmother said the Hourglass hums when it's happy. It isn't humming yet."]],
    ],
  },
  {
    step: "breakCrystals",
    sayings: [
      [["shaman", "The Hourglass is hungry. Feed it a crystal and see what falls out."]],
      [["shaman", "Knock on the old stone's door with a crystal. Gently. Time has a lot to give."]],
    ],
  },
  {
    step: "restoreStatue",
    sayings: [
      [
        [
          "shaman",
          "The stone face in the forest is waiting for its color. Patient, but not forever.",
        ],
      ],
      [
        [
          "shaman",
          "A spirit is half awake out there. Bring it what it's made of, and some good stone.",
        ],
      ],
    ],
  },
  {
    step: "findStatue",
    sayings: [
      [["shaman", "My grandmother hid something under the vines, deeper in than you've been."]],
      [["shaman", "The old carvings point somewhere you haven't cleared. They're never wrong."]],
    ],
  },
  {
    step: "researchBlueprint",
    sayings: [
      [
        [
          "shaman",
          "There's paper in your pocket that wants to become iron. The laboratory can help.",
        ],
      ],
      [
        [
          "shaman",
          "Those plans you took aren't much use folded up. Somebody clever should read them.",
        ],
      ],
    ],
  },
  {
    step: "spendCrystals",
    sayings: [
      [["shaman", "The crystals in your bag are restless. Your heroes could carry them better."]],
      [["shaman", "A crystal in a box is a song nobody sings. Give one to someone who fights."]],
    ],
  },
  {
    step: "upgradeHq",
    sayings: [
      [["shaman", "Your headquarters looks a little short today. It could stand taller."]],
      [["shaman", "Everything else on this island has grown. Has the heart of it?"]],
    ],
  },
  {
    step: "storageFull",
    sayings: [
      [["shaman", "Your storehouses are bursting. Spend something before the rats do."]],
      [["shaman", "When the pot is full, the cook stops cooking. Empty something."]],
    ],
  },
  {
    step: "collect",
    sayings: [
      [
        [
          "shaman",
          "The mills have been busy while you weren't looking. Go and see what they've made.",
        ],
      ],
      [["shaman", "There's work finished and waiting all over this island. Go and gather it in."]],
    ],
  },
  {
    step: "beachFind",
    sayings: [
      [["shaman", "The tide brought something in this morning. It won't wait for you long."]],
      [["shaman", "The sea left a gift on the sand. The sea also takes its gifts back."]],
    ],
  },
  {
    step: "betterTool",
    sayings: [
      [
        [
          "shaman",
          "Some of this forest laughs at your axe. You'll want something with more teeth.",
        ],
      ],
      [["shaman", "Those rocks won't move for asking nicely. Some things need a bigger tool."]],
    ],
  },
  {
    step: "clearForest",
    sayings: [
      [["shaman", "There's a lot of island still under those trees. Room for more of everything."]],
      [["shaman", "The forest keeps its secrets close. Cut a little, and it tells you one."]],
    ],
  },
  {
    step: "exploreMap",
    sayings: [
      [
        [
          "shaman",
          "There's sea past the clouds you haven't seen. Every island you win shows a little more.",
        ],
      ],
      [["shaman", "The world is bigger than your map. Go and make the map bigger."]],
    ],
  },
  {
    step: "rest",
    sayings: [
      [
        [
          "shaman",
          "Nothing needs you right now. Sit. Watch the waves. They don't need you either.",
        ],
      ],
      [["shaman", "When there's nothing to do, the wise man sleeps. I'm very wise.", "laugh"]],
      [
        ["shaman", "Listen. The island's quiet today."],
        ["shaman", "Enjoy it. Quiet never stays long here."],
      ],
    ],
  },
];
