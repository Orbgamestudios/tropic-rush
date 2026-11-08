# The story, time shards and the radar (plan)

**Planned, not built.** The owner's plan from 2026-11-07, with what's been settled since and what's
still open. Concept art is in `docs/concept/` (and the owner's images of Professor Terror, young and
old, and the six time shards). The script is written (2026-11-08, see The script), but nothing here
plays in the game yet; `docs/DESIGN.md` gets each piece as it's built.

## The story

Professor Terror is trying to make himself all-powerful by combining the world's crystals into one
eternal crystal. Ice and dark combine into a **crystal of chaos**, fire and nature into a **crystal
of creation**, and the time shards together into a **crystal of time**. Creation, chaos and time
together make the **eternal crystal**. The crew won't use crystal magic that way themselves: the
Shaman warns them it isn't meant to give one person that much power. They fight with time shards
instead.

The Shaman tells the crew the old myths of the crystals. They free him from the headquarters on
their first raid, and from then on he lives on their island.

**Why Terror wants it (the owner's idea, 2026-11-08):** fifty years ago he was Theodore, a young
scientist who came to the islands with his fiancée, Clara Marlowe, a botanist drawing their flowers.
He heard of a crystal on a reef island and wouldn't wait out a storm to reach it, for fear someone
else would find it first. Clara went with him. The boat broke on the reef; the Shaman, a boy then,
pulled Theodore out of the waves, and Clara was never found. All he kept was a black-and-white
photograph of the two of them, in his shirt pocket. He wants the eternal crystal to undo that night
and bring her back. To him the crew are thieves: his defenses are there to stop people like them
taking the crystals he's spent his life gathering. The crew don't hate him; they just won't let
anyone have that much power.

The crew learn it a piece at a time: the photograph, left on his desk when he escapes the first boss
island; his asking for it back; "she was clever, too"; and after the second boss island he tells
them to ask the Shaman about "the first storm", and the Shaman tells them the whole story.

## Characters

- **The Shaman:** a native tribesman with face paint, a mohawk and gold earrings, in cloth shorts,
  with a necklace of shark teeth and a retry time shard. He guides the player: he sits praying on
  the beach or wanders about talking to the heroes. Tap him to hear his last lines again, or to ask
  him things he's already told you (fixed questions and answers). The first time something new is
  unlocked he gives advice on it, and he hints at what's coming next. His name is too long for
  anyone else to say; Clara, if she comes back, still calls him by his childhood name, Koa.
- **Professor Terror:** an old white man, bald on top with long white hair down the sides, small
  black half-moon glasses, an unbuttoned black sport coat and a black tie that blows in the wind in
  cutscenes. After the time crystal, the **young Terror**: the same long hair but full and black, a
  chiseled jaw and a little stubble, in the same suit. Mostly heard over loudspeakers and radios.
- **Theo and Clara:** Terror and his fiancée as they were in the photograph, if the crew brings them
  back at the end. Clara is bright, curious and kind, fifty years out of her time.
- **Captain Brack:** runs Terror's raiders, the ships that land on the crew's island at night. Loud
  and greedy, always over a radio. Only the crew's ending choice makes him more than a nuisance.
- **The heroes:** the crew's own, rescued one by one (see the radar). In the script: Sgt. Steele is
  steady and dry, and the one who's always there; Doc Penny quick and bossy, warm underneath; Tilly
  loud and fearless, and talks to Tank like a big dog; Big Mo a gentle giant who cooks; Ace a cocky
  pilot shot down by a watchtower; Mr. Pemberton a polite English gentleman hunting a rare orchid,
  who carries Clara's book of flowers everywhere; Gus an excitable engineer who used to build
  Terror's defenses.

## Dialogue

- Boxes along the bottom of the screen, with the speaker's portrait and name, in an indie-game style:
  text types out left to right, letter by letter, fast. Tap anywhere for the next line.
- **Every line is spoken (the owner's call, 2026-11-08):** each character has a real voice of their
  own, the heroes too, in the boxes and in cutscenes alike, in place of the gibberish first planned.
  The text types out in time with the line. See Voices.
- Everyone in the crew sees the story as it happens. Someone who's been away is caught up on what
  they missed when they come back.

## The script

In `src/game/logic/story/`: 849 lines, about 8,800 words, in 141 scenes, 18 questions for the
Shaman and 29 little exchanges between him and the heroes. A test checks it holds together.

- `script.ts`: the types, the speakers (with a note on each voice), the story islands and the rules
  below. `opening.ts`: the landing, the Shaman, the crystals' myth, and advice on firsts.
  `rescues.ts`: the radar and the six rescues. `terror.ts`: the Hourglass, the time powers and
  Terror's islands up to the third boss. `finale.ts`: the end, both endings and Brack's islands.
  `life.ts`: evenings round the fire, questions for the Shaman and his chatter with the heroes.
- **What sets a scene off:** the first time the crew opens the game, a headquarters level, a first
  (the first raid, the first crystal, the first night raid held off, and so on), a rescue's signal,
  landing, win and homecoming, a story island appearing, being landed on, won or lost, the
  Hourglass, the first use of each time power, straight after another scene, or the crew's choice.
- **Whoever's there:** a hero the crew hasn't rescued yet is left out of a scene, so every scene
  reads right whatever order the rescues happened in. Sgt. Steele is always there, and the hero
  being rescued is in their own rescue. Lines that only make sense together (a question and its
  answer) are kept together or left out together.
- **Moods:** each line can say how it's said (happy, sad, angry, scared, shouting, whispering, over
  a radio, and so on): the portrait's face and the voice's delivery.

### The story islands

A first pass at the headquarters level each one appears at. Brack's come only if Terror is brought
back, straight away for a crew that's past their level by then.

| Island                | Headquarters |
| --------------------- | ------------ |
| Terror's first two    | 6, 9         |
| Creation (boss)       | 12           |
| Terror's next two     | 15, 18       |
| Chaos (boss)          | 21           |
| Terror's last two     | 24, 27       |
| Time (boss)           | 30           |
| The fire mountain     | 33           |
| Brack's three islands | 35, 38, 41   |
| Brack's fortress      | 45           |

## Time shards

- **Where they come from:** a ruined structure far into the forest on the crew's island, the
  **Hourglass**, which the crew repairs (the way statues are restored). Once it's repaired, an
  elemental crystal (nature, fire, ice or dark, the ones heroes are already upgraded with) can be
  broken into shards there: usually 2 to 4, 5 if you're lucky, 1 if you're not. A first pass: 1
  shard 10% of the time, 2 to 4 80%, 5 10%.
- **When:** the Shaman tells the crew about the Hourglass when the first of Professor Terror's
  islands appears on their map.
- **The look:** each is a clear, faceted crystal full of light and refraction, with its icon embossed
  out of it, in its own color.
- **Taking them on a raid:** each player picks up to three before a raid, and can use only those.
  Retry shards don't count towards the three (see Retry).
- **One at a time:** only one time power can be running at once. In a crew raid it acts on everyone,
  whoever used it.

### The six powers

- **Rewind (purple, ⏪):** the world runs backwards. Enemy shots fly back into the defenses that
  fired them, and they can hurt a hero they pass through on the way. Damage done to buildings before
  the rewind is undone as it goes back; damage done while it's rewinding stays. It never gives a
  hero back health.
- **Fast forward (orange, ⏩):** everything, heroes and the world, runs at double speed. A barrier
  round each hero soaks up hits worth 20% of their health; once it's gone, fast forward ends.
- **Pause (blue, ⏸):** time stops. Shots hang in the air and defenses can't turn or fall, but they
  still take damage. When it ends, every shot carries on where it was going, so mind where you
  stand.
- **Record (green, ⏺):** for its length, the hero can't be hurt while everything they do is
  recorded. When it runs out, the world goes back to where the recording started and a copy of the
  hero plays out exactly what was recorded, fighting, while the player does something else. When
  that time is up again, the copy is gone. Enemies see only the copy.
- **Slow (yellow, ▶|):** the world runs at half speed. The heroes, and their shots, don't.
- **Retry (red, ♥):** takes a hero back to a few seconds before they died: an extra life. Retries go
  into a pool the team shares, outside the three picks. There's a retry slot for each crewmate
  attacking. Professor Terror's islands are meant for the whole crew, but someone who takes one on
  alone gets a slot for each member of their crew, to make up for it.

## The radar and rescuing heroes

- **The radar** is a new building from headquarters 3. Upgrading it picks up signals from heroes
  trapped on islands.
- As the headquarters grows, the radar picks up an **unknown signal** from an island on the map. Win
  there and you rescue the hero who was sending it.
- **When:** the Medic first, at headquarters 3, the Heavy at 5, then the other four in an order
  nobody's told, up to headquarters 15. The same order for everyone in a crew. A first pass: 8, 10,
  12 and 15, shuffled.
- Heroes a player already has stay theirs.
- Each rescue has four scenes: the hero's call for help over the radar, their shouts when the crew
  lands, meeting them once they're free, and their first look at the crew's island.

## Professor Terror's islands

- Red-tagged islands that appear on the map as the crew grows: the main story. They're hard, with
  bases laid out with real thought, and are meant to be fought by the whole crew together.
- Between boss islands Terror grows closer to his crystals, and powers his defenses with them: magic
  ammunition that hits hard, and in the end time powers of his own (some shots freeze a hero where
  they stand).
- **Three boss islands**, each ending with Terror escaping from the great building he's working in,
  with the one crystal he saves (the crew destroys the rest, which were powering his defenses):
  1. **Creation:** he makes a speedboat out of nothing and is gone. The crew find the photograph on
     his desk.
  2. **Chaos:** he summons a storm, and a helicopter takes off hidden in it. He tells them to ask the
     Shaman about the first storm.
  3. **Time:** he pauses time and walks past the crew, frozen. A rewind essence drifts round him as
     he goes, turning him young again, and he tells them, frozen and listening, why he's doing it.
     He climbs into a plane and flies off as the pause ends.
- **The finale:** he's combining all three at once, in the old fire mountain, and the Shaman fights
  alongside the crew. Time shards don't work on Terror while he's doing it; the crew has to break
  through the island to reach him, into a megastructure with light pouring out of it. The Shaman
  pleads with him as Theodore, and tells him the village has sung for Clara every year since the
  storm. They're too late. The light grows blinding, and the Shaman runs in front of the crew to
  take the blast. When it fades, dust drifts away where Terror stood, and from the Shaman too. The
  crew runs to hold him; he tells them it's finished, to go in peace, his loved ones, and fades away
  smiling as they cry. As the dust clears, a small crystal lies on the ground ahead, glimmering
  white, flawless, perfectly clear. The hero kneels and picks it up; the camera closes in on their
  eyes as the pupils turn blazing white. A montage across the tropical world plays time running
  backwards: Terror's ships leaving islands alone, villagers embracing, forests growing back, ash
  going back into a volcano, an island saved, and more, each cut quicker than the last, until the
  screen turns white. Back in the present, glimmering white dust gathers behind the hero and forms
  back into the Shaman. They hug, the hero still holding the crystal.
- **The choice (the owner's idea, 2026-11-08):** there's light left in the crystal, enough for one
  more, and the photograph lies unburnt where Terror stood. The crew chooses: **bring them back**,
  Theodore and Clara together, or **let them rest**. Then the credits roll, and the game carries on.
  - **Let them rest:** the crystal goes dark, and the photograph is set in the Hourglass, by the
    altar. The village's song for Clara is sung for both of them. The story ends there.
  - **Bring them back:** Theo and Clara appear on the sand as they were in the photograph, Clara
    asking where the boat went. They stay on the crew's island. Theo wants to make amends; Clara
    replants the islands he stripped. More story follows: Captain Brack takes Terror's old islands,
    their defenses still running on his leftover crystals, and Theo, who built them, helps the crew
    take them back, three islands and then Brack's fortress. Along the way Pemberton learns that
    his book of flowers is Clara's, printed by Theo from her notes, and his orchid turns up on the
    island Clara replanted. Brack gives up and sails away, the last crystals go to the Hourglass as
    shards, and the story ends with Theo and Clara's wedding on the crew's beach, the Shaman marrying
    them, and a photograph of everyone, in color this time.

## Cutscenes

Made in the game engine, not as video. A cutscene is a script (camera moves, who goes where, poses,
dialogue, effects and music) played with the game's own models, so the player's hero and their
crewmates are in it, it's sharp on any screen, and it costs almost nothing to download. One player
for scripts, then each escape and the finale is a new script. Video can't put the player's hero in,
every clip would be megabytes to download and keep offline, and generated video drifts in style
from shot to shot.

The scenes marked as cutscenes in the script: the three escapes, the finale, the Shaman's return
and the choice, both endings' first scenes, and the wedding.

Needed for them: models of Terror (old and young), the Shaman, Clara and Terror's buildings (made in
Blender like the buildings, or by image-to-3D from the concept art), and more poses for the hero
rigs (kneel, embrace, cry, walk). The finale's rewind montage can be the game's own islands and
raids played backwards. Image generators are still useful for concept art, storyboards and
dialogue portraits.

## Voices

**Every character is voiced, every line (the owner's call, 2026-11-08):** 13 voices (the seven
heroes, the Shaman, Terror old and young, Theo, Clara and Brack) and 849 lines, the Shaman's 377 the
most by far. Each speaker in `script.ts` has a note for whoever voices them, and each line a mood.

- **Filing:** a line's recording is filed under its scene and its place in it (`chaosHome/12`), so
  the script is recorded once it's settled. Lines added in the middle of a scene later mean the rest
  of that scene is filed again.
- **Download:** recordings aren't part of the game's download. A scene's lines are fetched when it's
  about to play and kept for playing offline, at around 15 to 25 KB a line, so all of it is about
  15 to 20 MB, spread over the whole game.
- **In cutscenes,** mouths move with the loudness of the line.
- **Making them, first pass:** drafted with a free speech model from Hugging Face (no purchases),
  one voice per character, to time the scenes and hear how they play.
- **To settle first:** `public/audio/` only takes CC0 audio, and this repository is public. The
  final recordings need to be ones that can be released as CC0: recorded by the owner or by voice
  actors who agree to it, or made with a speech model whose licence lets its output be released that
  way (checked for each model before any of it goes in), or the rule changes for voices.

## Building it, in order

Each step is playable on its own.

1. **Dialogue and the Shaman:** the boxes, voices and tap-to-continue, a story log shared by the
   crew, the Shaman on the island, and the opening scenes.
2. **The radar and rescued heroes.**
3. **The Hourglass and time shards:** repairing it, breaking crystals, picking three.
4. **The time powers,** easiest first: slow, pause, fast forward, retry, then record and rewind.
5. **Professor Terror's islands** and the three boss islands.
6. **Cutscenes, the finale, the choice and the credits.**
7. **Brack's islands and the wedding.**

## Still open

- Whether, and how, a crew too small or partly offline takes on Terror's islands, beyond the extra
  retry slots.
- Retry: how many shards fill a slot, and whether the retry pool is limited by the shards the crew
  brings.
- How long each power lasts, and whether shards can be bought, traded or found anywhere else.
- Hero levels: whether the Tank, at headquarters 18 now, moves to 15 or below.
- **The choice in a crew:** a first pass is that everyone who fought the finale votes, and the hero
  who picked up the crystal breaks a tie.
- What comes after the wedding, or after the rest, beyond the ordinary game: more story later?
- Whose voices (see above).
