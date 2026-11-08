// The end of the story: the fire mountain, the Shaman's sacrifice and return, and the crew's
// choice. Brought back, Theodore and Clara stay on the crew's island, and Theo helps the crew take
// his old islands back from Captain Brack, which ends in their wedding. Left to rest, their
// photograph goes to the Hourglass.

import { type Scene, together } from "./script";

export const FINALE: readonly Scene[] = [
  {
    id: "eternalAppears",
    when: { on: "island", island: "eternal", stage: "appears" },
    lines: [
      ["shaman", "There. Light pouring out of the fire mountain. He's started."],
      ["youngTerror", "This is it, little crew. Everything comes down to this.", "radio"],
      [
        "youngTerror",
        "Your shards won't touch me while the crystals are joining. Time itself is busy.",
        "radio",
      ],
      [
        "youngTerror",
        "Stay home. It will all be over soon. And then it will never have begun.",
        "radio",
      ],
      ["shaman", "Then we'll walk in on our own feet. Get ready, all of you. We go together."],
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
      ["youngTerror", "You're too late. Listen. Can you hear it singing?"],
      ["shaman", "Theodore. Please. She wouldn't want this."],
      ["youngTerror", "Don't. Don't you dare tell me what she'd want.", "angry"],
      ["youngTerror", "You didn't find her. You didn't even look for her.", "angry"],
      ["shaman", "I looked for three days. So did my whole village."],
      ["shaman", "And every year since, on the night of the storm, we've sung for her."],
      ["youngTerror", "...You did?"],
      ["shaman", "Every year. We remember her too, Theodore."],
      ["youngTerror", "Then you understand. I can mend it. All of it."],
      ["youngTerror", "The storm, the reef, every bad thing that ever happened on these islands."],
      ["rifleman", "And who decides what's bad, Professor? You?"],
      ["youngTerror", "Who else is there?"],
      ["shaman", "It's too bright. It's breaking. Get behind me, all of you!", "shout"],
      ["rifleman", "Shaman! SHAMAN!", "scared"],
      ["shaman", "Ah. There you are. All of you.", "whisper"],
      ["shaman", "It's finished. He's gone. Don't cry. It's finished.", "whisper"],
      ["medic", "Hold still. I can fix this. I can fix this, just hold still!", "sad"],
      ["shaman", "Not this one, Doctor.", "whisper"],
      ["shaman", "Go in peace, my loved ones. Look after the island for me.", "whisper"],
      ["shaman", "My grandmother is singing. Can you hear her? I can hear her.", "whisper"],
    ],
  },
  {
    // After the crystal on the ground, the rewind across the islands and the screen going white.
    id: "shamanReturns",
    when: { on: "after", scene: "finale" },
    cutscene: true,
    lines: [
      ["shaman", "...Oh. Well. That was unexpected.", "surprised"],
      ["rifleman", "Shaman!", "happy"],
      ["shaman", "Careful, Sergeant. I've only just been put back together.", "laugh"],
      ["heavy", "Group hug. Nobody argue. Group hug.", "sad"],
      [
        "shaman",
        "That crystal in your hand. It's made from everything he gathered, and everything we lost.",
      ],
      [
        "shaman",
        "It brought me back. And there's still light in it. Enough for one more, I think.",
      ],
      ["rifleman", "Look. Where he was standing. The photograph. It didn't burn."],
      ["shaman", "The crystal will do what your heart asks of it. Once."],
      ["shaman", "You could bring them back. Theodore, and Clara with him."],
      ["shaman", "Or you could let them rest. They've been apart for fifty years."],
      together(
        ["medic", "After everything he did?"],
        ["heavy", "After everything that was done to him."],
      ),
      ["shaman", "There's no wrong answer here. Only yours."],
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
      ["rifleman", "Let them rest."],
      ["shaman", "Yes. I think they've earned it."],
      ["shaman", "There. The light has gone out of it. Now it's only a very pretty stone."],
      ["shaman", "Let's take the photograph home. They should be together somewhere peaceful."],
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
        "Now. The islands won't look after themselves, and Brack's raiders are still out there.",
      ],
      ["shaman", "Off you go, my loved ones. I'll be on the beach.", "happy"],
    ],
  },

  // Brought back.
  {
    id: "revived",
    when: { on: "chosen" },
    cutscene: true,
    lines: [
      ["clara", "Theo? Theo, the boat, the waves were... where's the boat?", "scared"],
      ["theo", "Clara. Oh, Clara. You're here.", "sad"],
      ["clara", "Why are you crying? Why is everyone staring at us? Who are all these people?"],
      ["shaman", "Welcome back, flower woman. You've been away a long time."],
      ["clara", "...Little Koa? No. It can't be. You're old!", "surprised"],
      ["shaman", "Fifty years will do that.", "laugh"],
      ["theo", "Clara, there's so much I have to tell you. And none of it is good."],
      ["clara", "Then tell me slowly. It seems I'm not going anywhere."],
    ],
  },
  {
    id: "revivedHome",
    when: { on: "after", scene: "revived" },
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
      ["clara", "Theo told me everything. Fifty years. I can't even imagine it."],
      ["clara", "Thank you, all of you. For giving us back the time. We'll try to deserve it."],
      [
        "shaman",
        "Stay on the island. There's room. There's always room for people who are trying.",
      ],
    ],
  },
  {
    id: "brack1Appears",
    when: { on: "island", island: "brack1", stage: "appears" },
    lines: [
      [
        "brack",
        "Well, well! The Professor's gone soft and young, I hear. Good. More for me!",
        "radio",
      ],
      [
        "brack",
        "His islands, his guns, all those lovely leftover crystals. And nobody minding them.",
        "radio",
      ],
      ["brack", "Except me. I'm minding them now.", "radio"],
      ["theo", "Brack. He ran my supply ships. He never cared what the crystals were for."],
      ["theo", "Only what they'd sell for."],
      [
        "theo",
        "He's taken my old islands. Their defenses still run on the last crystals I left in them.",
      ],
      ["theo", "I built every one of those islands. Let me help you take them apart."],
      ["rifleman", "Alright, Theo. Show us what you know."],
    ],
  },
  {
    id: "brack1Landing",
    when: { on: "island", island: "brack1", stage: "landing" },
    lines: [
      ["theo", "My first foundry. The headquarters is at the back, behind the mills."],
      [
        "theo",
        "I always liked to make people walk the whole island to reach it. I'm sorry about that.",
      ],
      [
        "brack",
        "Is that the boss? Ha! Welcome home, Professor! Mind the guns. You built 'em!",
        "radio",
      ],
    ],
  },
  {
    id: "brack1Won",
    when: { on: "island", island: "brack1", stage: "won" },
    lines: [
      ["brack", "That was MY foundry!", "radio"],
      ["theo", "It was mine first. And neither of us should ever have had it."],
    ],
  },
  {
    id: "brack1Home",
    when: { on: "after", scene: "brack1Won" },
    lines: [
      [
        "clara",
        "That island's nothing but stumps. Everything that grew there, he cut down for fuel.",
      ],
      [
        "clara",
        "I'd like to go over and plant something. Whatever grew there before, I'll find it again.",
      ],
      together(
        ["grenadier", "Miss Marlowe, might I help? I've brought your book."],
        ["clara", "My book? I never finished my book.", "surprised"],
        [
          "grenadier",
          "Somebody did. It was printed from your notes, after the storm. It's wonderful.",
        ],
        ["theo", "I had it printed. It was the only thing of yours I could finish."],
        ["clara", "...Oh, Theo.", "sad"],
      ),
      ["shaman", "Go and plant, flower woman. The island's been waiting for you."],
    ],
  },
  {
    id: "brack2Appears",
    when: { on: "island", island: "brack2", stage: "appears" },
    lines: [
      [
        "brack",
        "Two islands left, and my fortress. You'll never get into my fortress! Ha!",
        "radio",
      ],
      [
        "theo",
        "He's patched my old defenses with every crystal scrap he could find. They'll hit hard.",
      ],
      ["theo", "But he never read the manuals. He's never once read a manual."],
    ],
  },
  {
    id: "brack2Landing",
    when: { on: "island", island: "brack2", stage: "landing" },
    lines: [
      ["brack", "Fire everything! Fire the things that aren't guns! Throw the chairs!", "radio"],
      ["rifleman", "Is he throwing chairs?"],
      ["theo", "He's throwing chairs."],
    ],
  },
  {
    id: "brack2Won",
    when: { on: "island", island: "brack2", stage: "won" },
    lines: [
      ["brack", "Okay. That one's on me.", "radio"],
      ["theo", "Told you. Never read a manual in his life.", "laugh"],
    ],
  },
  {
    id: "brack3Appears",
    when: { on: "island", island: "brack3", stage: "appears" },
    lines: [
      [
        "clara",
        "Theo! The island I planted. Something's come up already. An orchid, white and purple.",
      ],
      ["clara", "I've never seen one like it, and I've seen every flower in these islands."],
      together(
        ["grenadier", "White and purple? With a little gold lip?", "surprised"],
        ["clara", "Yes! How did you know?"],
        [
          "grenadier",
          "That's it. That's my orchid. I've been looking for it for twenty years.",
          "happy",
        ],
        ["clara", "Then it's yours to name, Mr. Pemberton."],
        ["grenadier", "No, my dear. I think it's yours."],
      ),
      ["theo", "Brack's last island before his fortress. He'll throw everything he has at us."],
    ],
  },
  {
    id: "brack3Landing",
    when: { on: "island", island: "brack3", stage: "landing" },
    lines: [
      [
        "brack",
        "You're ruining my whole operation! Do you know what raiders cost these days?",
        "radio",
      ],
      ["brack", "Do you know what PARROTS cost?", "radio"],
      ["rifleman", "Why does he need parrots?"],
      ["theo", "I never asked. I was afraid of the answer."],
    ],
  },
  {
    id: "brack3Won",
    when: { on: "island", island: "brack3", stage: "won" },
    lines: [
      ["brack", "Okay. Okay, okay, okay. Back to the fortress, lads. Lock everything!", "radio"],
    ],
  },
  {
    id: "brackFortAppears",
    when: { on: "island", island: "brackFort", stage: "appears" },
    lines: [
      [
        "theo",
        "His fortress. It used to be my first laboratory. I built it to keep the whole world out.",
      ],
      ["theo", "Funny. I spent fifty years building walls."],
      ["theo", "And the first people to get through them saved me."],
      ["shaman", "Go together. Theodore, you stay with me this time."],
      ["shaman", "This is one fight you don't have to win by yourself."],
    ],
  },
  {
    id: "brackFortLanding",
    when: { on: "island", island: "brackFort", stage: "landing" },
    lines: [
      [
        "brack",
        "You want my crystals? Come and get 'em! Every gun on this rock is pointed at you!",
        "radio",
      ],
      ["rifleman", "Every gun on that rock is about to be pointing at the sky."],
    ],
  },
  {
    id: "brackFortLost",
    when: { on: "island", island: "brackFort", stage: "lost" },
    lines: [
      ["brack", "HA! Bounced right off! Come back when you've grown a bit!", "radio"],
      ["theo", "There's a weak spot. There always is. I'll find it for you. Rest first."],
    ],
  },
  {
    id: "brackFortWon",
    when: { on: "island", island: "brackFort", stage: "won" },
    lines: [
      ["brack", "Alright! ALRIGHT! I give up! Take 'em! Take the lot!", "radio"],
      ["brack", "...Can I keep the ship, though? It's a really nice ship.", "radio"],
      ["rifleman", "Sail it far away, Brack. And don't come back."],
      ["brack", "Far away. Got it. Very far. Bye now!", "radio"],
      ["theo", "The last of my crystals. What do we do with them?"],
      ["shaman", "We take them to the Hourglass. Shards, for friends who need a little more time."],
      ["shaman", "And never a crystal of anything again."],
    ],
  },
  {
    id: "proposal",
    when: { on: "after", scene: "brackFortWon" },
    lines: [
      ["clara", "Theo. I've been thinking. We were meant to be married, fifty years ago."],
      ["theo", "We were. On the beach, at sunset. You'd picked the flowers already.", "sad"],
      ["clara", "Well. We have a beach. We have sunsets. And I know where all the flowers are."],
      ["clara", "And we have a Shaman, and a great many friends who blow things up."],
      ["theo", "Clara Marlowe... are you asking me?", "surprised"],
      [
        "clara",
        "I've waited fifty years, Theodore. I'm not waiting for you to get round to it.",
        "laugh",
      ],
      [
        "shaman",
        "I've married a great many people. Never a professor. This will be a story.",
        "happy",
      ],
    ],
  },
  {
    id: "wedding",
    when: { on: "after", scene: "proposal" },
    cutscene: true,
    lines: [
      ["shaman", "Theodore. Clara. Time took fifty years from you."],
      ["shaman", "And time gave them back. Use them kindly. Both of you."],
      ["theo", "I will. Every single day of them."],
      ["clara", "And I'll make sure he does.", "laugh"],
      ["heavy", "I'm not crying. I was cutting onions for the cake.", "sad"],
      together(["medic", "There are no onions in a cake, Mo."], ["heavy", "There are in mine."]),
      ["tank", "Tank's wearing a bow tie! Tank, you look SO handsome!"],
      ["bazooka", "I'd do a flyover if I had a plane. I'll do a run-over instead. Watch this."],
      ["grenadier", "A toast. To the bride, to the groom, and to the orchid."],
      ["engineer", "I built a camera! It mostly works! Everybody bunch up!"],
      ["theo", "A photograph. All of us."],
      ["clara", "In color, this time.", "happy"],
      ["rifleman", "Everybody squeeze in. On three. One, two..."],
      ["rifleman", "...Perfect."],
    ],
  },
];
