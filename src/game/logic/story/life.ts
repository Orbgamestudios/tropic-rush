// Life on the crew's island between the big moments: evenings round the fire as the headquarters
// grows, the things the crew can ask the Shaman about, and the odd word he has with a hero as he
// wanders about.

import { type Chatter, type Question, type Scene, together } from "./script";

export const CAMPFIRES: readonly Scene[] = [
  {
    id: "hq11",
    when: { on: "hq", level: 11 },
    lines: [
      together(
        ["heavy", "Tonight, a contest! The best fish on the island. And I will be the judge."],
        ["medic", "You're also cooking, Mo."],
        ["heavy", "So I'll win. It's very fair."],
      ),
      ["shaman", "In my village, the judge always won too. Everyone wanted to be the judge."],
      ["rifleman", "Remind me never to let this crew run a vote."],
      [
        "shaman",
        "Eat well, all of you. His islands are close to finishing something. I feel it in my teeth.",
      ],
    ],
  },
  {
    id: "hq14",
    when: { on: "hq", level: 14 },
    lines: [
      together(
        ["tank", "Gus! What did you do to Tank? He's purring!"],
        [
          "engineer",
          "I only tuned his carburetor. And polished his hatch. And told him he was a good boy.",
        ],
        ["tank", "He IS a good boy."],
      ),
      together(
        ["rifleman", "Can you tune me next, Gus?"],
        ["engineer", "Sergeant, I'm fairly sure you don't have a carburetor."],
      ),
      ["shaman", "Everything on this island hums now. The radar, the mills, the Hourglass."],
      ["shaman", "Even me, when nobody's listening.", "laugh"],
    ],
  },
  {
    id: "hq17",
    when: { on: "hq", level: 17 },
    lines: [
      together(
        ["bazooka", "Pemberton. How far can you throw a grenade?"],
        ["grenadier", "Far enough, my dear."],
        ["bazooka", "I can fire a rocket further than you can see."],
        ["grenadier", "Ah. But can you bounce one round a corner?"],
        ["bazooka", "...No."],
        ["grenadier", "Then we each have our gifts."],
      ),
      ["rifleman", "Between all of you, you've flattened more buildings than I can count."],
      ["shaman", "In my village that would make you very popular. Or very unpopular."],
      ["shaman", "It depended on whose buildings.", "laugh"],
    ],
  },
  {
    id: "hq20",
    when: { on: "hq", level: 20 },
    lines: [
      ["shaman", "Twenty! Your headquarters can see over the treetops now."],
      [
        "shaman",
        "From the top, on a clear morning, you can see clouds going round and round in the north.",
      ],
      ["shaman", "Clouds aren't supposed to do that. Be ready."],
    ],
  },
  {
    id: "hq23",
    when: { on: "hq", level: 23 },
    needs: "chaosHome",
    lines: [
      ["rifleman", "Can't sleep, Shaman?"],
      ["shaman", "I was thinking about Theodore. About the boy he was, before the storm."],
      ["rifleman", "You think that boy's still in there somewhere?"],
      [
        "shaman",
        "I think everyone is still in there somewhere. Even you, Sergeant, under all that sergeant.",
      ],
      ["rifleman", "Don't tell the crew."],
      ["shaman", "Your secret is safe with me, and with the sea. The sea never tells.", "laugh"],
    ],
  },
  {
    id: "hq26",
    when: { on: "hq", level: 26 },
    lines: [
      together(
        ["medic", "Mo, your blood pressure is terrible."],
        ["heavy", "It's because I'm so full of love, Doc."],
        ["medic", "It's because of the butter."],
        ["heavy", "Butter is love."],
        ["shaman", "He isn't wrong."],
      ),
      [
        "shaman",
        "The Hourglass hums louder every night. Something big is coming. Keep your shards close.",
      ],
    ],
  },
  {
    id: "hq29",
    when: { on: "hq", level: 29 },
    lines: [
      [
        "shaman",
        "His islands have gone quiet. Too quiet. He's gathering everything he has in one place.",
      ],
      ["rifleman", "The crystal of time?"],
      ["shaman", "Soon. Very soon."],
    ],
  },
  {
    id: "hq32",
    when: { on: "hq", level: 32 },
    needs: "timeHome",
    lines: [
      ["shaman", "I keep dreaming about my grandmother."],
      [
        "shaman",
        "She stands on the beach and waves me in from the sea, the way she did when I was small.",
      ],
      ["rifleman", "Good dream or bad dream?"],
      ["shaman", "Both, I think. The best ones usually are."],
    ],
  },
  {
    id: "hq36Revived",
    when: { on: "hq", level: 36 },
    only: "revived",
    needs: "revivedHome",
    lines: [
      together(
        ["theo", "Gus. I owe you an apology. I put my name on your turrets for years."],
        ["engineer", "Oh. Well. They were very good turrets.", "sad"],
        ["theo", "They were the best I ever had. You were the best engineer I ever had."],
        ["engineer", "...Really? You mean that?", "happy"],
        ["theo", "I should have said so twenty years ago. I'm saying it now."],
      ),
      ["clara", "The orchids have spread right across the island. Come and see them, all of you."],
      ["shaman", "Flowers where there were stumps. That's what making things right looks like."],
    ],
  },
  {
    id: "hq36Rested",
    when: { on: "hq", level: 36 },
    only: "rested",
    needs: "restedHome",
    lines: [
      ["shaman", "I sat with the photograph today. I told them about your raids."],
      [
        "shaman",
        "I think Clara would have loved Mo's stew. Theodore would have complained about it.",
      ],
      ["rifleman", "And then had seconds."],
      ["shaman", "And then had thirds.", "laugh"],
    ],
  },
  {
    id: "hq40",
    when: { on: "hq", level: 40 },
    lines: [
      ["shaman", "Forty. When you washed up here, you had one hut and a sergeant."],
      ["rifleman", "Still got the sergeant."],
      ["shaman", "And now you have a whole village. My grandmother would be very proud of you."],
    ],
  },
  {
    id: "hq45",
    when: { on: "hq", level: 45 },
    lines: [
      ["shaman", "The raiders still come at night, but fewer every year. Word gets about."],
      ["shaman", "'Don't land on that island. The old man's friends are very good.'"],
      ["rifleman", "We are very good."],
      ["shaman", "And very modest.", "laugh"],
    ],
  },
  {
    id: "hq50",
    when: { on: "hq", level: 50 },
    lines: [
      ["shaman", "Fifty. Your headquarters touches the clouds."],
      ["shaman", "In my grandmother's stories, only the spirits ever built this high."],
      ["rifleman", "Think the spirits mind?"],
      ["shaman", "I think they're proud. I know I am.", "happy"],
      together(
        ["heavy", "This calls for a feast. The biggest feast. Everybody bring a fish."],
        ["shaman", "You heard him. Everybody bring a fish."],
      ),
    ],
  },
];

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
    ask: "Who is Professor Terror?",
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
        "Brack's raiders came, looking for crystals. We didn't have any. They didn't believe us.",
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
    id: "askBrack",
    ask: "Who is Captain Brack?",
    after: "firstRaiderShip",
    answer: [
      ["shaman", "A man who'd sell the sea if he could find someone to buy it."],
      [
        "shaman",
        "He runs the Professor's raiders. Every night a ship of his comes for somebody's island.",
      ],
      [
        "shaman",
        "Hold them off and they pay for it. Let them through and you can strike back at his base.",
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
  {
    id: "askKoa",
    ask: "Clara called you Little Koa?",
    after: "revived",
    answer: [
      ["shaman", "Koa is the short part of my name. The part a child could say."],
      [
        "shaman",
        "Nobody has called me that in fifty years. I'd forgotten how much I liked it.",
        "happy",
      ],
      ["shaman", "You may use it, now. Only on special occasions. And never in front of Brack."],
    ],
  },
];

export const CHATTER: readonly Chatter[] = [
  {
    id: "riflemanStill",
    after: "shamanArrives",
    lines: [
      ["shaman", "Sergeant, do you ever sit still?"],
      ["rifleman", "Sat still once. Didn't care for it."],
    ],
  },
  {
    id: "riflemanPraying",
    after: "shamanArrives",
    lines: [
      ["rifleman", "What do you pray for, out there on the beach all day?"],
      ["shaman", "Good weather, good fish, and good friends. Two out of three, most days."],
      ["rifleman", "Which one's missing?"],
      ["shaman", "The fish.", "laugh"],
    ],
  },
  {
    id: "riflemanHelmet",
    after: "shamanArrives",
    lines: [
      ["shaman", "Why do you wear that hat in this heat?"],
      ["rifleman", "Regulations."],
      ["shaman", "Whose regulations?"],
      ["rifleman", "Mine."],
    ],
  },
  {
    id: "medicKnee",
    after: "medicHome",
    lines: [
      ["shaman", "Doctor, my knee hurts."],
      ["medic", "Because you sit cross-legged on the sand for six hours a day."],
      ["shaman", "Because I'm wise."],
      ["medic", "It's the sitting, Shaman."],
    ],
  },
  {
    id: "medicHerbs",
    after: "medicHome",
    lines: [
      ["medic", "Is it true that leaf cures headaches?"],
      ["shaman", "It cures everything."],
      ["medic", "Really?"],
      ["shaman", "No. But it smells lovely, and people stop complaining.", "laugh"],
    ],
  },
  {
    id: "heavyStew",
    after: "heavyHome",
    lines: [
      ["heavy", "Shaman, try this. Fish stew. My grandmother's recipe."],
      ["shaman", "...Mo. I'm going to tell stories about this stew.", "happy"],
      ["heavy", "Good stories?"],
      ["shaman", "Legends."],
    ],
  },
  {
    id: "heavyPot",
    after: "heavyHome",
    lines: [
      ["shaman", "You talk to that cooking pot."],
      ["heavy", "My grandmother talked to it. Her grandmother talked to it. It's a good listener."],
      ["shaman", "My grandmother talked to the sea. Same idea, I think. Bigger pot."],
    ],
  },
  {
    id: "tankSleep",
    after: "tankHome",
    lines: [
      ["shaman", "Does your iron friend ever sleep?"],
      ["tank", "With one headlight open."],
    ],
  },
  {
    id: "tankName",
    after: "tankHome",
    lines: [
      ["shaman", "Why is he called Tank?"],
      ["tank", "Because that's what he is. You're called Shaman."],
      ["shaman", "...That's fair.", "laugh"],
    ],
  },
  {
    id: "bazookaFly",
    after: "bazookaHome",
    lines: [
      ["bazooka", "Bet I could fly you round the whole island in four minutes."],
      ["shaman", "I've walked round it in four days. I enjoyed every minute."],
      ["bazooka", "Every minute? Even the swamp?"],
      ["shaman", "Especially the swamp. Nobody bothers you in a swamp."],
    ],
  },
  {
    id: "bazookaGlasses",
    after: "bazookaHome",
    lines: [
      ["shaman", "Why do you wear your sunglasses at night?"],
      ["bazooka", "So the night can't see me looking at it."],
      ["shaman", "...I'm going to think about that for a long time."],
    ],
  },
  {
    id: "grenadierFlower",
    after: "grenadierHome",
    lines: [
      ["grenadier", "Shaman, what do your people call this delightful little flower?"],
      ["shaman", "We call it 'don't eat that.'"],
      ["grenadier", "...Noted."],
    ],
  },
  {
    id: "grenadierTea",
    after: "grenadierHome",
    lines: [
      ["grenadier", "Might I offer you a cup of tea? I brought my own, of course."],
      ["shaman", "Hm. It tastes like hot leaves."],
      ["grenadier", "That's rather the point, old chap."],
    ],
  },
  {
    id: "engineerStick",
    after: "engineerHome",
    lines: [
      ["engineer", "If I put a little motor on your walking stick..."],
      ["shaman", "Gus."],
      ["engineer", "Just a small one."],
      ["shaman", "Gus."],
    ],
  },
  {
    id: "engineerSleep",
    after: "engineerHome",
    lines: [
      ["shaman", "You were up all night again. I heard the hammering."],
      ["engineer", "Sorry! I had an idea. Then the idea had an idea. Then I had a sandwich."],
      ["shaman", "And how are the ideas now?"],
      ["engineer", "Asleep. Unlike me."],
    ],
  },
  {
    id: "riflemanHate",
    after: "terror1Appears",
    lines: [
      ["rifleman", "Do you hate him? Terror?"],
      ["shaman", "I tried to, once. It was heavy. I put it down."],
    ],
  },
  {
    id: "riflemanShards",
    after: "hourglassFirstShards",
    lines: [
      ["rifleman", "If you could rewind anything, Shaman, what would it be?"],
      ["shaman", "Last Tuesday. I dropped my lunch in the sea."],
      ["rifleman", "That's it?"],
      ["shaman", "Wanting to go back is dangerous, Sergeant. Start small.", "laugh"],
    ],
  },
  {
    id: "medicClara",
    after: "chaosHome",
    lines: [
      ["medic", "Do you think she'd have liked us? Clara?"],
      ["shaman", "She'd have drawn every one of you. And named a flower after Mo."],
      ["heavy", "What kind of flower?"],
      ["shaman", "A very big one.", "laugh"],
    ],
  },
  {
    id: "riflemanPhoto",
    after: "creationHome",
    lines: [
      ["rifleman", "I keep the photo in my top pocket. Feels wrong to put it in a drawer."],
      ["shaman", "That's where he kept it too."],
    ],
  },
  {
    id: "engineerTerror",
    after: "chaosHome",
    lines: [
      ["engineer", "I worked for him for six years and never knew. About Clara. About any of it."],
      ["shaman", "He never told anyone. Grief kept behind a locked door gets mean."],
      ["engineer", "Like a boiler. If the pressure can't get out..."],
      ["shaman", "Just like a boiler, Gus."],
    ],
  },
  {
    id: "shamanWhole",
    after: "shamanReturns",
    lines: [
      ["shaman", "I keep checking I'm all here. Ten fingers. Ten toes. One nose."],
      ["medic", "You're all there, Shaman."],
      ["shaman", "Two noses would have been interesting, though."],
    ],
  },
  {
    id: "riflemanBack",
    after: "shamanReturns",
    lines: [
      ["rifleman", "Don't do that again. The dying thing."],
      ["shaman", "I'll try not to, Sergeant. It wasn't on purpose the first time."],
    ],
  },
  {
    id: "theoBoat",
    after: "revivedHome",
    only: "revived",
    lines: [
      ["theo", "Koa. Do you remember the day I arrived on your island?"],
      ["shaman", "You fell out of the boat, trod on my grandmother's goat, and apologized to it."],
      ["theo", "That goat was standing in the sea."],
      ["shaman", "It was a sea goat. Everyone knew that.", "laugh"],
    ],
  },
  {
    id: "claraFlowers",
    after: "revivedHome",
    only: "revived",
    lines: [
      ["clara", "Koa, there's a little blue flower by the beach. What do your people call it?"],
      ["shaman", "We call it Clara's Bell. A girl named it, fifty years ago. I kept my promise."],
      ["clara", "...Oh, Koa.", "sad"],
    ],
  },
  {
    id: "theoMedic",
    after: "revivedHome",
    only: "revived",
    lines: [
      [
        "medic",
        "Hold out your arm, Theo. Fifty years in a cloud of crystal dust. Let's take a look.",
      ],
      ["theo", "You don't have to look after me, Doctor."],
      ["medic", "I know. That's what makes it a choice."],
    ],
  },
  {
    id: "theoBrack",
    after: "brack1Appears",
    only: "revived",
    lines: [
      ["rifleman", "Did you know Brack was like this? When you hired him?"],
      ["theo", "I knew. I didn't care. That's the worst thing I can tell you about myself."],
      ["shaman", "And you told it. That's the best thing."],
    ],
  },
  {
    id: "claraHeavy",
    after: "revivedHome",
    only: "revived",
    lines: [
      ["heavy", "Miss Clara, try my stew. My grandmother's recipe."],
      ["clara", "Oh! Mo, that's wonderful. Is that wild ginger?"],
      ["heavy", "Nobody ever guesses the ginger!", "happy"],
    ],
  },
  {
    id: "restedHourglass",
    after: "restedHome",
    only: "rested",
    lines: [
      [
        "shaman",
        "Sometimes I sit by their photograph in the Hourglass and tell them what you've been doing.",
      ],
      ["rifleman", "What do they think?"],
      ["shaman", "They think you're very loud.", "laugh"],
    ],
  },
  {
    id: "restedSong",
    after: "restedHome",
    only: "rested",
    lines: [
      ["medic", "That song you sang for them. Will you teach it to me?"],
      ["shaman", "Of course. It's easy. It only has one word in it, and the word is 'remember.'"],
    ],
  },
];
