# The story, time shards and the radar (plan)

**Partly built.** The owner's plan from 2026-11-07, with what's been settled since and what's
still open. Concept art is in `docs/concept/` (and the owner's images of Professor Terror, young and
old, and the six time shards). The script is written (2026-11-08, see The script), and since
2026-11-13 all of it plays in the game as a first pass, with stand-in figures, no voices and
cutscenes that aren't acted out yet: see "Building it, in order" for what's done, and
`docs/DESIGN.md` ("Added 2026-11-13") for how it works.

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
  unlocked he gives advice on it, and he hints at what's coming next. Tap him for advice and he
  nudges you, vaguely, toward something you could do next (see Hints). His name is too long for
  anyone else to say; Clara, if she comes back, still calls him by his childhood name, Koa. If the
  crew lets Terror rest, he joins them as a hero to play; if they bring Terror back, he leaves to
  find his scattered people (see the choice).
- **Professor Terror:** an old white man, bald on top with long white hair down the sides, small
  black half-moon glasses, an unbuttoned black sport coat and a black tie that blows in the wind in
  cutscenes. After the time crystal, the **young Terror**: the same long hair but full and black, a
  chiseled jaw and a little stubble, in the same suit. Not seen or heard at all until his first
  island appears: before that he's a name, a flag, and what his raiders did. After that, mostly
  heard over the radio.
- **Theo and Clara:** Terror and his fiancée as they were in the photograph, if the crew brings them
  back at the end. Clara is bright, curious and kind, fifty years out of her time. Theo joins the
  crew as a hero to play.
- **The builders (the owner's call, 2026-11-08):** two army builders who came ashore with Steele
  and build and upgrade everything on the crew's island: you see them hammering on whatever's going
  up. They don't fight and have no lines.
- **The Professor's raiders (the owner's call, 2026-11-08):** nameless hired mercenaries, one for
  each hero's weapon (a raider tank and a raider medic too), so night raids never look like our own
  heroes attacking. New models made the same way as the heroes', in dark red and charcoal, rough and
  mismatched where our crew is neat and blue, holding the same weapons as the heroes. They have no
  leader of their own in the story (see Parked).
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

### Writing it (the owner's direction, 2026-11-08)

The game should feel polished, so the script does too. Not cringy, and not strings of one-liners.

- **People talk to each other,** not to the player. Each line answers the one before it, and a
  scene goes somewhere: someone wants something, learns something or decides something.
- **Fewer, fuller lines** over a run of quips. A scene can be quiet. Let a line sit.
- **Not every scene is serious (the owner, 2026-11-08).** The grounded tone is for the main story:
  the Professor, the storm, the boss islands, the finale. The rescues, the first night round the
  fire and the Shaman's advice can be warm and funny, as long as the jokes come from who people are
  and sit inside a real conversation.
- **Even in light scenes, no cringe:** no catchphrases, no punchline to end every scene, no
  gimmicks like a loudspeaker in a palm tree. In serious scenes, at most one light moment, and none
  in the big ones.
- **Grounded detail** over announcements: burned houses in the grass say more than a speech about
  raiders.
- **Terror is frightening because he's calm and certain,** not because he's loud. He isn't seen or
  heard until his first island appears; before that he's a name the Shaman won't say lightly, a
  skull flag across the water, and the village his raiders burned.
- **Each voice stays itself:** Steele says little and means it; the Shaman speaks in concrete,
  plain images, never riddles for their own sake; the heroes sound like people, not mascots.
- **Only what matters to the story (the owner, 2026-11-08):** no scenes just because the
  headquarters went up a level, and no chatter between people on the island (too distracting). A
  scene that waits for a headquarters level is there because the story needs time to pass.

## The script

In `src/game/logic/story/`: 663 lines, about 7,000 words, in 117 scenes (33 of them cutscenes),
and 16 questions for the Shaman, plus 47 hints. A test checks it holds together. A readable copy, as a screenplay, is on the owner's claude.ai artifacts ("Tropic
Rush Script"), rebuilt from the code whenever it changes.

- `script.ts`: the types, the speakers (with a note on each voice), the story islands and the rules
  below. `opening.ts`: the landing, the Shaman, the crystals' myth, and advice on firsts.
  `rescues.ts`: the radar and the six rescues. `terror.ts`: the Hourglass, the time powers and
  Terror's islands up to the third boss. `finale.ts`: the end, both endings and what follows them.
  `life.ts`: questions for the Shaman.
  `hints.ts`: the Shaman's advice when tapped. `delivery.ts`: what each mood asks of a voice, the
  direction each recording is made from, and a cutscene's pacing.
- **Both endings:** a scene can be only for one ending, and the scene where Theo or the Shaman
  joins the crew, or the Shaman leaves, says so, for the game to act on.
- **What sets a scene off:** the first time the crew opens the game, a headquarters level, a first
  (the first raid, the first crystal, the first night raid held off, and so on), a rescue's signal,
  landing, win and homecoming, a story island appearing, being landed on, won or lost, the
  Hourglass, the first use of each time power, straight after another scene, or the crew's choice.
- **Whoever's there:** a hero the crew hasn't rescued yet is left out of a scene, so every scene
  reads right whatever order the rescues happened in. Sgt. Steele is always there, and the hero
  being rescued is in their own rescue. Lines that only make sense together (a question and its
  answer) are kept together or left out together.
- **Moods:** each line can say how it's said (happy, sad, angry, scared, shouting, whispering, over
  a radio, and so on): the portrait's face and the voice's delivery. Each mood carries its own
  prosody for the voice (a whisper is breathy, slow and barely voiced; anger is clipped, quick and
  hard on the consonants), so every line gets clues even without notes of its own.
- **Delivery notes (the owner's request, 2026-11-08):** a line can also say how it's delivered in
  words, for the voice: the feeling, the pace, the pitch, where the stress falls and where the
  breaths and catches go ("barely a whisper, utterly sincere, almost a prayer"). Every line in a
  cutscene has one. A recording is made from the speaker's voice note, then the mood's prosody,
  then the line's own note.

### Hints

Tap the Shaman for advice and he says something about what the crew could do next, never spelled
out: "The sea has been talking all week. Somebody on this island should learn to listen" when
there's no radar yet, "Smell the wind. Salt, tar and bad manners. Someone's coming tonight" before a
night raid. The game picks the most pressing of 21 things (raiders tonight, an unanswered signal,
a waiting boss or Terror island, a broken Hourglass, a statue waiting for its crystals, a full
storage, and so on, down to nothing pressing at all), and one of two or three sayings for it, a
different one each tap. In the "bring them back" ending he leaves the island, and his advice with
him.

### The story islands

A first pass at the headquarters level each one appears at, stretched so the Professor's story runs
to headquarters 42 (the owner's call, 2026-11-08). Each appears once the one before it is won and
the headquarters is at its level.

| Island             | Headquarters |
| ------------------ | ------------ |
| Terror's first two | 6, 10        |
| Creation (boss)    | 14           |
| Terror's next two  | 18, 22       |
| Chaos (boss)       | 26           |
| Terror's last two  | 30, 34       |
| Time (boss)        | 38           |
| The fire mountain  | 42           |

After the ending, the rest of each ending's story waits for headquarters 44 to 48, so it comes
as the island keeps growing rather than all at once.

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
  bases laid out with real thought, and are meant to be fought by the whole crew together. **Not
  ordinary islands:** they're Terror's own, six of them between the boss islands, each a raid the
  crew has to win to move the story on. Each appears with a scene (the first, third and fifth as
  cutscenes, with Terror at his microphone), and has lines for the landing and the win.
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
  take the blast as the crystal bursts behind him. When it fades, dust drifts away where Terror
  stood, and from the Shaman too. The crew runs to hold him; he whispers to them not to cry, and to
  take care of the island, and each other, and fades away smiling as they cry.
- **The crystal (the owner's direction, 2026-11-08):** as the dust settles, Sgt. Steele sees a small
  crystal on the rock, glimmering white, flawless, pulsing faintly like a heartbeat. He walks to it,
  kneels and picks it up, and light runs up his arm. He whispers "Bring him back." His pupils blaze
  white, the light bursts out across the sea, and a montage of about 30 seconds plays time running
  backwards over the islands, every cut quicker than the last (from four seconds down to under
  half a second) while the score soars: the fire mountain's light sinking back into the rock, the
  seaplane landing backwards, the storm unwinding, the speedboat coming apart into light, Terror's
  flags coming down, raider ships sailing out of a burning bay, the Shaman's village rebuilding
  itself, villagers in each other's arms, a forest growing back, ash falling back into a volcano,
  and more, until the screen goes white and the music cuts out. Back in the mountain, the white
  fades from Steele's eyes and he looks down at the crystal in surprise. A soul, a small warm
  light, drifts slowly out of it, sinks into the dust where the Shaman fell and stirs it into a
  glittering spiral that becomes the Shaman again. They hug, Steele still holding the crystal.
- **The choice (the owner's idea, 2026-11-08):** there's light left in the crystal, enough for one
  more, and the photograph lies unburnt where Terror stood. The crew chooses: **bring them back**,
  Theodore and Clara together, or **let them rest**. Then the credits roll, and the game carries on.
  - **Either way, a new hero to play:** **Theo** if they bring him back, **the Shaman** if not.
  - **Let them rest:** the crystal goes dark, and the photograph is set in the Hourglass, by the
    altar. The village's song for Clara is sung for both of them. The Shaman decides he's prayed on
    beaches long enough, takes up his grandmother's staff and **joins the crew as a hero**. Later,
    as the headquarters grows, Pemberton's orchid turns up in the Hourglass, by the photograph, and
    the story ends with the Shaman's scattered people, hearing the Professor is gone, sailing home
    to the island for a feast.
  - **Bring them back:** Theo and Clara appear on the sand as they were in the photograph, Clara
    asking where the boat went. They stay on the crew's island, and **Theo joins the crew as a
    hero**, wanting to make amends. With a professor who knows every island and a botanist who knows
    every leaf, the crew doesn't need the Shaman anymore, and he sails off to find his scattered
    people, promising to come back for the important things. Later, as the headquarters grows,
    Clara replants the islands Theo stripped; Pemberton learns that his book of flowers is Clara's,
    printed by Theo from her notes, and his orchid turns up on the island she replanted. The story
    ends with Theo and Clara's wedding on the crew's beach. The Shaman comes back with his people to
    marry them, and there's a photograph of everyone, in color this time.
  - **The two new heroes, Proposed (first pass, for the owner to look at):** neither uses crystals.
    **Theo** fights with gadgets from his old workshop, and his signature move turns a defense he
    hits against its own side for a few seconds: he built them, so he knows how. **The Shaman**
    fights with his grandmother's spirit staff, and his signature move plants a totem that blesses
    the heroes near it. Both are balanced to be as useful as each other.

## Cutscenes

Made in the game engine, not as video. A cutscene is a script (camera moves, who goes where, poses,
dialogue, effects and music) played with the game's own models, so the player's hero and their
crewmates are in it, it's sharp on any screen, and it costs almost nothing to download. One player
for scripts, then each escape and the finale is a new script. Video can't put the player's hero in,
every clip would be megabytes to download and keep offline, and generated video drifts in style
from shot to shot.

**33 cutscenes (the owner wanted more, 2026-11-08),** about 28 minutes in all at their pacing:

- The opening, freeing the Shaman, his story of the crystals told over the spirits making the
  islands, and all four statues waking.
- Each hero freed (six), and the first night with all seven round the fire.
- Terror's first, third and fifth islands appearing, with Terror at his microphone; the Hourglass
  waking; each boss island appearing, and each escape; finding the photograph; the Shaman's story of
  the storm (the longest, nearly three minutes); the fire mountain appearing.
- The finale, the crystal and the Shaman's return (over two minutes, with the 30-second montage)
  and the choice, both endings' first scenes, the Shaman joining the crew or sailing off, and his
  people's homecoming, or the proposal and the wedding.

Each one is written as shots and lines: what the camera shows and what happens, held for so many
seconds, between the lines, with a delivery note on every line. A shot can also say what the music
or sound does from there: silence as the dust settles, a soft tone with the crystal's pulse, the
score breaking in as time runs backwards, a far-off choir as the soul leaves the crystal.

### Making them cinematic

The owner wants them really cinematic (2026-11-08). What that means here:

- **Framed like a film:** black bars slide in (2.39:1) and the game's buttons go. Each line gets
  its own shot rather than one wandering camera: wide shots to set the place, close-ups on faces
  for what matters, over the shoulder back and forth in a conversation, a slow push in on a line
  that lands, a crane up and away to end. Cuts land on the music's beats and the ends of lines.
- **A real lens:** each shot has its own focal length, and depth of field keeps the speaker sharp
  and the background soft, pulling focus when someone else speaks. A little handheld drift in
  tense shots, a steady camera in calm ones.
- **Light and color for each scene:** key and rim lights placed on faces, lightning lighting the
  chaos escape, shafts of light pouring out of the fire mountain, the time pause drained cold and
  blue with dust hanging in the air, the finale burning out to white. Film grain, a vignette, and
  bloom on the crystals.
- **Time as a camera trick:** slow motion for the biggest moments (the Shaman throwing himself in
  front of the blast, the crystal dropping to the sand), ramping back up into the action, and the
  pause frozen mid-splash as Terror walks past.
- **The storm, in black and white:** the Shaman tells the story of the storm over a flashback in
  black and white, grained like the photograph: the young Theodore and Clara on the beach, the boat
  on the reef, the boy in the surf.
- **Faces that act:** close-ups need faces that do more than the heroes' do now: blinking, brows,
  eyes on whoever's speaking, mouths moving with the voice, and more detailed heads for Terror,
  the Shaman and Clara, whom the camera gets closest to. It stays further back from anyone else.
- **Sound to match:** music written for each scene, swelling and dropping out with it (silence just
  before the blast), the sea, wind and fire under it, and the voices on top.
- **The best the phone can do:** cutscenes are short, so they play with Ultra's lighting and effects
  whatever the graphics setting, stepping down only if the phone can't keep up.
- **Made on a timeline:** each cutscene is tracks (camera, actors, lines, music, effects) on a
  timeline, with a scrubber in development for previewing and tuning it shot by shot, the way a
  film is cut. Storyboarded first, with an image generator for the frames.
- **Paced by mood (the owner's request, 2026-11-08), so it breathes:** sad and whispered lines
  come slowly, after long silences; anger and shouting cut in fast; someone answering waits a beat
  longer than someone carrying on; a line's notes can hold a silence before or after it, and a shot
  holds for its length. The finale's montage cuts quicker and quicker, from four seconds down to
  under half a second. Until lines are recorded, their length comes from their words and mood; then from the
  recording, with the pauses kept.
- **Skippable** after the first time, and played again from the story log.

Needed for them: models of Terror (old and young), the Shaman, Clara and Terror's buildings (made in
Blender like the buildings, or by image-to-3D from the concept art), and more poses for the hero
rigs (kneel, embrace, cry, walk). The finale's rewind montage can be the game's own islands and
raids played backwards. Image generators are still useful for concept art, storyboards and
dialogue portraits.

## Voices

**Every character is voiced, every line (the owner's call, 2026-11-08):** 12 voices (the seven
heroes, the Shaman, Terror old and young, Theo and Clara) and about 710 lines with the Shaman's
hints, the Shaman's over 300 of them. Each speaker in `script.ts` has a note for
whoever voices them, each line a mood, and many lines a delivery note.

- **Filing:** a line's recording is filed under its scene and its place in it (`chaosHome/12`), so
  the script is recorded once it's settled. Lines added in the middle of a scene later mean the rest
  of that scene is filed again.
- **Download:** recordings aren't part of the game's download. A scene's lines are fetched when it's
  about to play and kept for playing offline, at around 15 to 25 KB a line, so all of it is about
  15 to 25 MB, spread over the whole game.
- **In cutscenes,** mouths move with the loudness of the line.
- **Making them, first pass:** drafted with a free speech model from Hugging Face (no purchases),
  one voice per character, to time the scenes and hear how they play.
- **VoxCPM2 (the owner's pick, 2026-11-08):** tried on 14 of the finale's lines against Chatterbox,
  it gave better emotion (Apache 2.0). Each voice is made once from its character's note, then
  every line is read in that voice with its mood as an instruction. What worked:
  - **Read in the voice, not continued from it.** VoxCPM2's "ultimate cloning" (continuing on from
    the voice's sample) ignores the mood instruction completely, and the lines came out flat.
    "Controllable cloning" (the sample for the voice, the instruction for the mood) follows it.
  - **Terror (the owner's direction, 2026-11-08):** a theatrical, unpredictable villain with a
    strong, posh South Dublin accent, mocking and sing-song one moment, flat and deadly quiet the
    next, never a low, gravelly mastermind. His voice is made from a description of that style,
    not copied from any actor, then pushed further toward the accent. Each line gets its own swing
    (giggling glee with a laugh tag, a hushed threat, a manic shout), and takes that go shrill are
    dropped: earlier tries were too squeaky, then too deep and echoey. The owner signed off on this
    style after the fifth try.
  - **Staying in character when shouting:** a shouted line can rise to twice a voice's usual pitch
    and stop sounding like them, as the Shaman's "Get behind me" did. Shouts are asked for in the
    character's own voice, and takes far above their usual pitch are dropped.
  - **The Shaman dying** is short whispered phrases with pauses for breath between them: just
    "Don't cry." and "Take care of the island... and each other." (the owner's words). There's no
    scream as the blast hits him: the model couldn't make one that sounded right, so the owner cut
    it. Where the model wouldn't whisper, the phrase is turned into a whisper afterwards.
  - A speech recognizer checks each take says the right words, each is measured for pitch, echo,
    loudness and how much of it is whispered, and the best of a few is kept.
- **To settle first:** `public/audio/` only takes CC0 audio, and this repository is public. The
  final recordings need to be ones that can be released as CC0: recorded by the owner or by voice
  actors who agree to it, or made with a speech model whose licence lets its output be released that
  way (checked for each model before any of it goes in), or the rule changes for voices.

## Building it, in order

Each step is playable on its own.

1. **Dialogue and the Shaman:** the boxes, voices and tap-to-continue, a story log shared by the
   crew, the Shaman on the island, and the opening scenes. **Built (2026-11-13), without voices.**
2. **The radar and rescued heroes. Built (2026-11-13):** the rescue islands are buttons on the
   crew's island, not places on the map yet.
3. **The Hourglass and time shards:** repairing it, breaking crystals, picking three. **Built.**
4. **The time powers,** easiest first: slow, pause, fast forward, retry, then record and rewind.
   **Built.**
5. **Professor Terror's islands** and the three boss islands. **Built as a first pass
   (2026-11-13):** each is an ordinary raider base of a high level. Bases laid out by hand, magic
   ammunition, his time powers and the escapes acted out are still to do.
6. **Cutscenes, the finale, the choice and the credits. A first pass (2026-11-13):** every
   cutscene plays with black bars, subtitles, a cast of stand-ins and a camera that cuts between
   speakers, with each shot's action told in words. The timeline, the lenses, the acting, the
   montage, the crew's vote and the credits are still to do.
7. **Theo and the Shaman as heroes, the wedding and the homecoming.** The scenes play; neither is
   a hero to play yet (their kits are still Proposed).

## Parked

- **Captain Brack (taken out, the owner's call, 2026-11-08):** a raider captain was written in as
  the face of the night raids, and as the last enemy after the finale, taking Terror's old islands
  for himself until the crew took them back with Theo or the Shaman leading the way. The owner felt
  it was too much for the game. It may come back as more story after the Professor's, or not at
  all. An early version of his islands, for the "bring them back" ending only, is in the story
  script at commit `7bd6649`.

## Still open

- Whether, and how, a crew too small or partly offline takes on Terror's islands, beyond the extra
  retry slots.
- Retry: how many shards fill a slot, and whether the retry pool is limited by the shards the crew
  brings.
- How long each power lasts, and whether shards can be bought, traded or found anywhere else.
- Hero levels: whether the Tank, at headquarters 18 now, moves to 15 or below.
- **The choice in a crew:** a first pass is that everyone who fought the finale votes, and the hero
  who picked up the crystal breaks a tie.
- What comes after the wedding or the homecoming, beyond the ordinary game: more story later?
- Theo's and the Shaman's kits and numbers (see the choice).
- Whose voices (see above).
- **Voices, still to fix:** the finale's lines don't sound urgent enough yet (the owner, after the
  seventh test).
