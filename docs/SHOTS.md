# Shot plans for the cutscenes (plan)

**A plan for the owner to go over (2026-11-14). Nothing in it is built.** Shot by shot, how fourteen
of the cutscenes could be filmed in the manner of Christopher Nolan's films. It builds on the rules
already agreed in `docs/DIRECTING.md` and doesn't repeat them. Each scene ends with choices for the
owner. After the scenes, "How the plans become the script" proposes how a planned shot is written
into the script as data the game plays, and the last section lists what the engine would need.

The script isn't changed. Where it still says Sgt. Steele (the speaker `rifleman`), this plan writes
the Captain, the owner's change of 2026-11-14, and the lines that need rethinking for him are listed
under "The people".

## How to read the shot lists

- **Shot sizes:** an extreme wide shows the place, with people tiny in it; a wide shows the place
  with the people in it; a full shot shows a whole person, head to feet; a medium shot is from the
  waist up; a close-up is head and shoulders; a big close-up is the face filling the frame; an
  extreme close-up is a part of one: the eyes, a mouth, a hand.
- **Angle:** eye level; low (the camera below, looking up, which makes someone bigger); high
  (looking down, which makes them smaller); overhead (straight down).
- **Lens:** wide shows more of the place and stretches distance; normal is about what the eye sees;
  long shows a narrow slice, flattens distance so far things feel near, and blurs what's behind a
  face. In the engine these are the stage's three fields of view (44, 31 and 22 degrees). Macro is a
  new one, for tiny things very close.
- **Moves:** locked (the camera doesn't move); push in and pull out (towards or away); crane (rising
  or sinking); track (sliding alongside); pan and tilt (turning side to side, or up and down);
  handheld (a hand holding it, breathing). A focus pull moves the sharpness from one thing to
  another during a shot.
- **Over the shoulder:** past one person's shoulder, soft and near, onto the other's face.
- **Insert, cutaway and pillow shot:** as `DIRECTING.md` defines them. A pillow shot is a cutaway
  held still for a few seconds between moments, to give a feeling room.
- **Match cut:** a cut between two shots that match in shape or place, so one turns into the other
  (the photograph's beach becoming the real beach).
- **Heard over:** a line can be heard over a shot of someone else (whoever's listening) or of a
  thing. The voice carries on across the cut.
- **Left and right** are as the player sees the screen. "The line" is the 180-degree line from
  `DIRECTING.md`: the camera stays on one side of the two people talking.
- **(Build: …)** marks what the engine can't do yet, with what it could do today instead where
  there's a way.
- Seconds are a shot's rough length when it holds with nothing said. A shot that a line is heard
  over lasts as long as the line.

## The people, and the things that carry the story

### The Captain

The player's own man from the start, and the one who mans the gunboat: blond swept hair, a short
beard, a light blue shirt with rolled sleeves, white trousers, boat shoes, a watch on his left
wrist, and a toothpick. Two things he carries do the work that Nolan gives to objects:

- **The toothpick is his tell.** He chews it when he's at ease. He takes it out when something
  matters, and puts it back in when he's decided. He never explains it; the player learns to read
  it. It's out for every serious line in this plan.
- **The watch is time.** Its tick sits under every scene with Terror in it (see "A clock you can
  hear" below). It stops when Terror stops time, runs backwards in the finale's montage, and ticks
  again when the Shaman comes back.

The script has him keep the photograph in his top pocket (`creationHome`, `terror3Appears`). The
shirt in the design has no breast pocket: one could be added, or he keeps it inside his shirt.

**Lines to rethink for him.** In the scenes planned here: Terror's "Everything belongs to someone,
Sergeant" (`terror1Appears`), Pemberton's "To the Sergeant, who came for each of us" (`fullCrew`,
which works even better for the man who sailed out for each of them), and "Careful, Sergeant"
(`shamanReturns`). If he mans the gunboat during raids, the escapes need him to have come ashore
with the crew: the script has him running to the shore (`creationEscape`) and frozen mid-stride
(`timeEscape`). Elsewhere in the script: "Better than alright, Sergeant" (`allStatues`), "Keep it
safe, Sergeant" (`creationHome`), "I don't need your permission, Sergeant" (`terror5Appears`),
"Sergeant, I'm in a cage" (`bazookaSignal`), "So I just fought beside myself" and "Two Sergeants"
(`powerRecord`, which only fits if he fights on foot), "Sergeant. I've been thinking"
(`shamanJoins`), two "Sergeant"s in `shamanLeaves`, and the delivery notes "a sergeant's cheer"
(`homecoming`) and "a cheerful sergeant's count" (`wedding`). His voice note in `script.ts` still
describes a sergeant. The parked raider, Captain Brack, would need another title if he ever came
back.

### The Shaman

Redesigned: long black hair with beads and a feather, a white open shirt, khaki shorts, sandals,
bead bracelets, and a necklace with the red retry crystal. The red crystal is his object: a retry,
one more chance, worn at his throat. This plan shows it first when he's freed and last as he
throws himself in front of the blast.

Two things in the script no longer match him. The design reads as a man of about forty, but the
script makes him about sixty (a boy fifty years ago), and leans on it: "an old man", his knees,
"Old? So is he", and Clara's "You're old!". Either the model gets grey in the hair and lines on the
face, or those lines change. And he has no face paint now, so "face paint smeared" (`shamanFreed`)
goes, and the shark-teeth insert in `DIRECTING.md` becomes the red crystal.

### Professor Terror

Never lit by daylight until he steps into his speedboat: in every other shot his light comes from
his crystals, green in the lab, purple-blue in the storm, silver in the time pause, white in the
mountain. It makes him a creature of what he's gathering.

### The objects

| Object              | What it means                                 | Where it's seen                               |
| ------------------- | --------------------------------------------- | --------------------------------------------- |
| The photograph      | What Terror lost; what the crew has to decide | Desk, fire, storm story, finale, both endings |
| The Captain's watch | Time, and the Captain's hand on it            | Terror's scenes, the pause, the montage       |
| The toothpick       | The Captain deciding                          | Every serious line he has                     |
| The red crystal     | The Shaman's one more chance                  | Freed, and the finale                         |
| The red skull flag  | Terror before he's seen                       | Prologue, first crystal, his first scene      |
| The fire            | Home, the crew together, the story told       | First crystal, the full crew, the storm story |

## 1. What we take from Nolan

`DIRECTING.md` already takes cutting away from the big moment, cross-cutting, objects that carry
the story, still floating shots and quick cutting. These are new, from his films and the people he
makes them with:

1. **Small people in big places, and one face that carries it.** Dunkirk's large-format wide shots
   keep one face sharp against a huge beach, because the shallow focus picks a person out even in
   a very wide shot ([ASC, "Monumental Intimacy"](https://theasc.com/blog/the-film-book/monumental-intimacy-the-experience-of-amp-lt-i-amp-gt-dunkirk-amp-lt-i-amp-gt)).
   Nolan wanted that audience on the beach, with fewer words and longer shots
   ([Little White Lies](https://lwlies.com/interviews/christopher-nolan-dunkirk-70mm)).
   _Here:_ the big scenes open on the island's scale with the cast small in it (the Captain's boat
   a speck at the reef, the crew tiny under the mountain's light), and focus still finds one face.
2. **The face is the landscape, and the tightest shots are rare.** For Oppenheimer, Nolan and Hoyte
   van Hoytema treated portraits as landscapes and filmed closer to faces than they ever had
   ([CineD](https://www.cined.com/emotional-close-ups-of-oppenheimer-conversation-with-cinematographer-hoyte-van-hoytema/)).
   _Here:_ close-ups carry every scene, but the extreme close-up (eyes alone) is kept for a handful
   of moments in the whole story: Terror's face cracking at "...You did?", the Captain's eyes
   blazing white, young Terror's reflection in the still water.
3. **A hand on the camera when it's close, a still camera when it's far.** Van Hoytema put the
   IMAX camera on his shoulder for Interstellar to make it intimate and free
   ([Den of Geek](https://www.denofgeek.com/movies/interview-interstellar-cinematographer-hoyte-van-hoytema/)).
   _Here:_ handheld only on close shots in tense moments, where the camera is someone in the scene;
   wide shots are locked or move slowly, the island watching. Never a shaking wide.
4. **Light you could point to.** Wally Pfister lit The Prestige with gaslight, firelight and a real
   chandelier, and could only shoot from where that light looked right
   ([No Film School](https://nofilmschool.com/radical-cinematography-the-prestige)). Interstellar
   projected space outside the ship's windows, so the actors were lit by what they saw
   ([Post](https://www.postmagazine.com/Publications/Post-Magazine/2014/November-1-2014/Interstellar-Space-crafts-robots-science.aspx)).
   _Here:_ every key light has a source in the scene (the fire, a crystal in someone's hand,
   Terror's jars, lightning, the mountain's white), and faces are filmed from the side it lights.
5. **Every shot directed; none of it filler.** Nolan films drama with one camera and no second
   unit, since every shot ends up the same size on the screen
   ([DGA Quarterly](https://dga.org/craft/dgaq/issues/1202-spring-2012/dga-interview-christopher-nolan)).
   _Here:_ the camera stops picking shots by rule (today it goes over the shoulder by default and
   across the two every fourth cut). Each line gets the shot planned for it, and the small shots
   (the crab, the sparks) get the same care, lens and light as faces.
6. **A clock you can hear.** For Dunkirk, Nolan recorded his own pocket watch and sent it to Hans
   Zimmer, and its tick became the heart of the score
   ([Slashfilm](https://www.slashfilm.com/908307/christopher-nolan-brought-a-unique-sound-to-hans-zimmers-dunkirk-score)).
   Interstellar's watch had a little motor inside so its second hand moved for real on camera
   ([aBlogtoWatch](https://www.ablogtowatch.com/hamilton-watches-movie-interstellar/)).
   _Here:_ the Captain's watch is our clock. We record a real watch ourselves, so it can be CC0, and
   model his with a second hand close enough to read.
7. **A rise that never arrives.** The Shepard tone is a sound that seems to climb forever; Zimmer
   built Dunkirk's score on it at Nolan's suggestion
   ([CBC](https://www.cbc.ca/radio/q/blog/hans-zimmer-explains-the-audio-trickery-that-made-dunkirk-audiences-nauseous-1.4311684)).
   _Here:_ under the escapes and the finale's last minute, a rising tone that doesn't resolve until
   the cut to white. The game's music script can make one.
8. **A silence that's full, and the bang that comes late.** Oppenheimer's Trinity test plays in a
   near-silence built from breathing and atmosphere, and the blast arrives after the audience has
   half forgotten it's coming
   (["The Boldest Sound in Oppenheimer Was the Silence"](https://ca.news.yahoo.com/boldest-sound-oppenheimer-silence-210000937.html)).
   _Here:_ the finale's white is near-silent (breath, ringing rock, falling grit) and the crack comes
   late. In the storm, the wind drops out entirely under Terror's last two lines, as if he's
   whispering in the Captain's ear.
9. **Black and white as another way of seeing.** Oppenheimer's colour scenes are his own
   experience; its black-and-white scenes are a colder, outside view
   ([Slashfilm](https://slashfilm.com/1343310/oppenheimers-black-and-white-scenes-explained)).
   _Here:_ black and white is how the photograph remembers. The storm story is told in it, and if
   the crew brings Theodore and Clara back, they first appear in it. The last photograph, at the
   wedding, is in colour.
10. **Strands at different speeds that meet.** Nolan wrote Dunkirk as three timelines (a week, a day,
    an hour) woven together for constant tension ([Slashfilm](https://www.slashfilm.com/908307/christopher-nolan-brought-a-unique-sound-to-hans-zimmers-dunkirk-score)),
    and Inception keeps cutting back to a van falling in slow motion while the other levels race
    ([We Got This Covered](https://wegotthiscovered.com/movies/i-have-it-under-control-the-top-5-scenes-in-inception/2/)).
    _Here:_ the finale cuts back to the three crystals between lines, a little closer each time;
    the storm story cuts between the fire now and the storm then, joined by the sound of the sea;
    the montage cuts back to the Captain's watch.
11. **Backwards for real.** Tenet's reversed scenes were filmed with a camera rebuilt to run
    backwards and actors who learned to move in reverse
    ([Gulf News](https://gulfnews.com/amp/story/entertainment%2Fhollywood%2Ftenet-how-christopher-nolan-made-the-impossible-happen-1.73410352),
    [Cinemablend](https://cinemablend.com/news/2562558/why-filming-that-tenet-backwards-fight-scene-for-christopher-nolan-was-crazy-according-to-john-david-washington)).
    _Here:_ the engine can truly run its islands and raids backwards for the montage, and the
    crystal's light moves forwards through each shot, the one thing not reversed.
12. **End on the object.** Inception ends on the spinning top, then black
    ([Den of Geek](https://www.denofgeek.com/movies/inception-ending-christopher-nolan-explained)).
    _Here:_ several scenes end on a thing, not a face: the crystal by the fire, a gear spinning
    down, the photograph going into the Captain's pocket.
13. **Pillow shots as Ozu meant them.** Yasujiro Ozu's pillow shots are things and places (flags,
    the sea, an empty room) held for several seconds between scenes, sometimes held on after the
    people have gone ([BFI](https://www.bfi.org.uk/features/enigmatic-pillow-shots-yasujiro-ozu)).
    _Here:_ our cutaways hold two to four seconds, show things rather than people, and the
    strongest is the empty frame after someone's gone.

On inserts and cutaways generally: an insert is always a real thing inside the scene, like a watch
or a hand on a door ([Descript](https://www.descript.com/blog/article/how-to-create-the-perfect-insert-shot-for-your-film));
a match cut joins two shots by a shared shape or place ([Wikipedia](https://en.wikipedia.org/wiki/Match_cut)).

## 2. The scenes, in story order

### The prologue (`prologue`): about 55 seconds

**Where and when:** the crew's island, the landing beach in the south-west, at dawn. The sun just
up (3 or 4 degrees, against today's 12) behind the island, so the island is dark against a bright
sky and the Captain, facing it, is lit from the front. Mist lies on the water. The flag island is
west across the water, lit full by the low sun behind the camera.

**Who and where:** the Captain, and two builders with no lines. The island is always screen right,
the sea and the flag island screen left: he looks right at the island and left at the flag. The
builders stay behind him on the beach, screen right. No music until the last shot.

1. **Black.** 2 s. Heard: the sea before any picture, and an outboard motor far off. Why: the
   sound puts us there before we see anything, and the game begins calm.
2. **Extreme wide from high over the reef; wide lens; slow crane down.** 6 s. The island dark
   against the dawn, mist on the water, the boat a speck threading the gap. Sharp all through.
   Heard: surf, one gull. Why: the island first, the man second; he's small against it. (Build:
   boat, sea mist. Today: start at shot 7, with the motor heard cutting out over black.)
3. **Close-up on the Captain at the bow, from the side; long lens; the boat's gentle roll.**
   Toothpick in, chewing; the island soft behind him. Captain: "That's the one. Long beach…" Why:
   the player meets their own man before he says a word about himself.
4. **Insert: a folded chart on his knee; the wind lifts its corner; a pencil ring round the
   island.** Heard over it: "Charts say nobody's lived here for years." Why: we see what he trusts,
   just before it's proved wrong. (Build: chart.)
5. **Cutaway at the waterline, at ground level; long lens.** 3 s. A crab crosses the wet sand,
   stops, goes on; behind it, out of focus, the bow slides up the beach. Heard: the hull scraping,
   the motor cut. Why: we arrive at the island's own level, and the island doesn't care; the cut
   hides the landing. (Build: crab, boat.)
6. **Wide from behind them; normal lens; slow push in.** 4 s. The Captain and the builders wading
   the last few metres, hauling crates toward the palms. Why: the work starts the moment they land.
   (Build: builders, crates, wading. Today: skip it.)
7. **Wide past the first palms, at eye level; normal lens; locked.** 4 s. The grass full of
   blackened posts, the bones of a village; the Captain small among them. Heard: wind in the grass;
   the surf falls away. Why: the reveal is a place, not a line, so the player reads it before he
   speaks. (Build: burned posts.)
8. **Medium, low; he crouches by a charred post and takes the toothpick out.** Captain: "Charts are
   wrong. Somebody lived here. A whole village." Why: the toothpick comes out the first time
   something matters.
9. **Insert: his fingers rubbing soot; black on his thumb.** Heard over it: "And not long ago. This
   wood's still black." Why: the detail says it, and his voice carries across the cut.
10. **Close-up: he looks up, off to the left.** 1 s, nothing said. Why: the look before what he
    sees.
11. **Across the water as he'd see it; long lens; locked.** 3.5 s. A darker island, a fortified
    camp, the red flag with its skull in small round glasses, the distance squashed flat so it
    feels close. Heard: the flag snapping, nearer than it could be. Why: for hours of play Terror is
    only this. (Build: the flag island in view of the beach.)
12. **Close-up, a little low; long lens; the flag island soft over his shoulder.** Captain:
    "Whoever did this didn't go far." Why: the threat and the man in one frame.
13. **Medium: he turns back to the builders prising open crates, and puts the toothpick back in.**
    Captain: "We build. Shelter first…" Why: toothpick in, decision made. (Build: builders.)
14. **Insert: a crowbar bites a crate lid and it cracks open on tools.** 1 s. Cut on the crack.
    Why: a sound to cut on, and the game's first tools.
15. **Close-up in profile, looking out at the flag; focus pulled from him to the flag as he
    speaks.** Captain: "Then we find out who's flying that flag." Why: the promise, then the focus
    moves to what it's about.
16. **Extreme wide from behind the first post as a builder drives it in; crane up and back.** 5 s.
    Our beach, and the flag a speck across the water. Heard: the hammer on the post, then the
    game's first music, one low held note. Then black. Why: their flag and our beach in one frame,
    and the story's begun.

**For the owner:**
- Arrive by boat (needs a boat and mist), or open on the beach with the boat only heard?
- Do we see the builders (people on the set with no lines), or only hear them hammering?
- The toothpick as his tell, out when something matters and back in when he's decided: a rule for
  every scene?
- The game's title over the last wide, or no title at all?

### The Shaman freed (`shamanFreed`): about 60 seconds

**Where and when:** the first raid's island, before the fallen headquarters, late afternoon. The
sun low in the west, in the Shaman's eyes as he comes out, and later going down behind the crew's
island across the water. Dust in the air catches the light.

**Who and where:** the Shaman screen right, facing the sun; the Captain screen left with his back
to it, so the sun rims him. The line runs between them; the camera stays on the south side, with
the rubble behind the Shaman. Any crew stand behind the Captain.

1. **Wide, low; wide lens; locked.** 3 s. The headquarters' roof caves in and dust rolls at the
   camera. Heard: the collapse, then debris settling for a long time, then nothing.
2. **Pillow shot: dust drifting through a shaft of low sun; a torn page slides off a beam.** 2 s.
   Heard: cooling metal ticking. Why: a breath before the reveal, and the dust hides the jump to
   him already standing.
3. **Medium-wide at eye level; normal lens; slow push in.** 2.5 s. In the thinning dust, a figure
   in the rubble, one hand up shading his eyes. Why: we meet him as the crew would, a shape and
   then a man. (Build: shading-the-eyes pose; climbing out, if wanted.)
4. **Close-up; long lens; the sun full on his face, dust in his hair.** Shaman: "Sunlight. I was
   starting to forget…" Why: the first close-up of the game's guide, and the light is the line.
5. **Over the Shaman's shoulder onto the Captain, rimmed by the sun.** Captain: "Easy. You're safe
   now…" He offers a hand.
6. **Over the Captain's shoulder onto the Shaman, pushing in slowly across three lines:** "The men
   who sail under that flag…", "He wants the crystals…", "So he kept me…" Why: one unbroken shot
   while a man tells you he was held. Cutting would interrupt him.
7. **Insert: his hand closes over the red crystal at his throat.** 1.5 s, at the end of "So he
   kept me". Why: the necklace, planted now so it means something at the end. It's the one thing
   he kept from them.
8. **Close-up on the Captain, the toothpick out.** Captain: "Did you?"
9. **Close-up on the Shaman.** Shaman: "I told him stories. Never the true ones." Hold a second
   after. Why: the small tired smile is the line; give it room.
10. **Wide from behind the two of them; the sun going down over the water and a far island.**
    2.5 s. Why: home, as a place we can see.
11. **Close-up in profile; long lens; the sea soft behind.** Shaman: "You've built on my island.
    That was my village…"
12. **Close-up on the Captain.** Captain: "We found the houses. What's left of them."
13. **Insert: the raiders' flagpole leaning in the rubble, the skull flag dragging in the dust.**
    Heard over it: "Then you know what kind of man he is." Why: the line lands on what's left of
    his power here. (Build: a flag on the base.)
14. **Two-shot from the side, the Shaman right.** Shaman: "If you'll take an old man home…" /
    Captain: "We'd be glad of it…" He offers his arm.
15. **Extreme wide from the broken camp's shore; locked.** 3 s. The boat pulling away across the
    gold water; the Shaman looks back once, then ahead. Heard: the Shaman's music, the first time.
    (Build: boat. Today: crane up and away from the two of them in the ruins.)

**For the owner:**
- Do we see him climb out of the rubble (a new action), or does the dust clear on him already
  standing?
- Show the red crystal here, so it pays off at the end?
- End on the boat (to build), or in the ruins?

### The story of the crystals (`firstCrystal`): about 75 seconds

**Where and when:** the crew's beach at night, round a small fire near the water, where the old
fires were. A half moon over the sea. The fire is the only key light; the moon a cold rim from
behind.

**Who and where:** the Shaman screen right, on the sea side of the fire; the Captain screen left;
anyone rescued so far sits beside the Captain. The line runs through the fire; the camera stays on
the land side, so the sea and the dark are always behind the Shaman.

1. **Extreme wide from out on the water, low; locked.** 4 s. The dark island, the stars, one small
   fire on the beach. Heard: surf, the fire faint across the water. Why: a few people and a fire
   against all that dark.
2. **Insert: the Shaman's fingers turning a crystal, light moving inside it; macro lens.** 3 s.
   Heard: a faint glassy hum under the fire. (Build: a crystal held in a hand.)
3. **Big close-up on the Shaman, lit from below by the fire and by the crystal; long lens; sparks
   soft in front.** Shaman (whisper): "Hold it up to the light…" Why: lit by the thing he's
   talking about.
4. **Insert: a log turned, sparks lifting; tilt up with them into the stars.** Heard over it: "My
   people say four spirits made these islands…"
5. **Four pillow shots, one per spirit, cut on the beat of the chant (about 1.2 s each), over
   "Nature grew them. Fire raised them. Ice cooled them. And the Deep holds them up."** The jungle
   canopy, black-green in moonlight; embers glowing in the fire's heart; moonlight on wet sand as a
   wave draws back; black water, straight down off the rocks. Why: the myth told over real things
   on this island rather than a vision, so the spirits are still here. (Today the stage's sky and
   sea views can do two of the four.)
6. **Close-up on the Shaman, looking at the crystal.** Shaman: "When the spirits went to sleep…"
7. **Wide two-shot across the fire, past the Captain's shoulder; the crew leaning in.** Captain:
   "And the Professor wants them for what?"
8. **Close-up on the Shaman, a slow push across three lines:** "Two crystals pressed together…",
   "Ice and the Deep…", "And the oldest story says…" The firelight sinks as the push goes in.
9. **Insert: the fire flares white for an instant as a log collapses.** 1 s. Heard: a soft whump,
   then the sound drops away.
10. **Big close-up on the Shaman, the white fading off his face.** Shaman (whisper): "The eternal
    crystal…"
11. **Close-up on the Captain; the toothpick comes out.** Captain: "That's the one he's after."
12. **Close-up on the Shaman.** Shaman: "It's the only one he's ever been after." Silence held
    before and after.
13. **Medium on the Shaman, closing his hand round the crystal.** Shaman: "Use these the way the
    spirits meant…"
14. **One line cut three ways.** "No one should hold that much power." on the Shaman; "Not him."
    over a cutaway of one lamp burning on the flag island across the black water; "Not you." over
    the Captain; "Not me." back on the Shaman, softest, looking at his own closed hand. Why: the
    voice keeps going while the picture points at each of them, with no new lines.
15. **Insert: the crystal set down on the sand by the fire, still glowing faintly.** 3 s, then
    black. Why: end on the object the whole story is about.

**For the owner:**
- The spirits: shapes in the firelight (an effect to build), or four real places on the island?
- Split "Not him. Not you. Not me." across three shots?
- Who's at the fire: only the Captain, or whoever the crew has by then?

### A rescue: Doc Penny (`medicWon`), the template for all six: about 35 seconds

**Where and when:** the rescue island, before the hut whose red cross the raiders painted over,
the base fallen round it. Early afternoon: high, bright sun and short, hard shadows, the lightest
and steadiest light in the game, because these scenes are funny.

**Who and where:** Penny screen right, with the hut always behind her; the Captain screen left; the
crew behind him. The camera stays still: the comedy lives in cutting to the listener and holding a
beat on a straight face. No cutaways during the back-and-forth; one small last insert, the button,
to end on.

1. **Wide; locked.** 2 s. The fallen base, smoke thinning, the hut with its cross painted over in
   grey. Heard: small fires crackling, an alarm winding down.
2. **Medium on the door, a little low.** 1.5 s. It bursts open and dust puffs out. (Build: a door
   that opens. Today: cut to her already in the doorway.)
3. **The hero shot: full figure, low angle, normal lens.** 1.5 s. Penny in the doorway rolling up
   her sleeves, her round glasses catching the sun. Why: every rescued hero gets one low full-length
   shot, their portrait in the film.
4. **Close-up on Penny, the camera moving a little with her.** Penny: "Oh, thank goodness. Now hold
   still…"
5. **Insert: her fingertip on the Captain's forearm beside his watch, counting scratches.** 1 s.
   Why: the joke gets a picture, and the watch a quiet first look.
6. **Medium on Penny, hands on hips (wide enough for the pose to read).** Penny: "Who's been looking
   after you lot?"
7. **Close-up on the Captain, the toothpick moving to the other side of his mouth.** Captain: "We've
   been managing."
8. **Close-up on Penny, cut in fast.** Penny: "You've been bleeding…"
9. **Insert: she snaps her bag shut.** 1 s. Cut on the click.
10. **Two-shot from the side.** Penny: "Right. I'm coming with you…"
11. **Close-up on Penny leaning in; slow push.** Penny: "And I've got a bottle of something very
    nasty…"
12. **Close-up on the Captain, one eyebrow up.** Captain: "Acid?"
13. **Close-up on Penny.** Penny: "Acid." Hold on the grin.
14. **The button: insert of the hut's grey paint, a flake peeling off in the heat, red under it.**
    1.5 s. Why: the red cross is coming back, and so is she.

**The same five beats for the other rescues** (the way in, the hero shot, their insert, the
lines, the button):

| Rescue    | The way in                              | Hero shot                                        | Their insert                            | The button                                           |
| --------- | --------------------------------------- | ------------------------------------------------ | --------------------------------------- | ---------------------------------------------------- |
| Big Mo    | The wall bulges, then gives             | Low, ducking through the hole                    | The minigun lifted like a baby          | His grandmother's pot, dented, in a corner           |
| Tilly     | Shed doors crack, splinters at the lens | Tank skids to a stop; she pops out               | The horn pressed: one honk              | An empty tin of grey paint rolling to a stop         |
| Ace       | The cage door clangs                    | Strolling out, the burning tower in her aviators | The launcher onto her shoulder          | The watchtower toppling behind her; she doesn't look |
| Pemberton | A storeroom door creaks                 | The panama hat set on, low                       | Dust brushed off the brim               | Clara's book in his pocket, a pressed flower showing |
| Gus       | Sparks; the last turret topples         | Peering out from under a bench, at his level     | His hidden wrench slid out of the floor | A turret folding into a backpack with a sad whir     |

Pemberton's button plants Clara's book for the storm story.

**For the owner:**
- One low full-length hero shot for every rescued hero?
- End each rescue on a small insert (the paint, the pot, the book)?
- Plant Clara's book in Pemberton's rescue, long before anyone knows whose it is?

### The first night with all seven (`fullCrew`): about 60 seconds

**Where and when:** the crew's beach at night: the big fire, the pot on it, everyone sitting round.
Firelight is the key light; the moon a cold rim from the sea.

**Who and where:** eight people. The Shaman sits on the sea side, his back to the water; the
Captain opposite, on the land side. Screen left of the fire (seen from the land): Mo at the pot,
then Tilly and Penny side by side. Screen right: Ace and Gus side by side, then Pemberton. Tank
parked at the edge of the light. The main line runs from the Shaman to the Captain; the pairs are
each filmed as a two-shot from their own side, so nobody swaps sides. (Today the stage shows seven
people at most.)

1. **Extreme wide from the sea; locked.** 3.5 s. The fire, eight small figures, sparks going up
   into the stars, Tank's dark shape at the edge. Heard: surf, fire, low laughter.
2. **Close-up on the Shaman, firelit.** Shaman: "Look at this. A fire, a full pot…"
3. **Insert: Mo's ladle in the pot, stew slopping into a tin bowl,** 1 s, then **medium on Mo.**
   Mo: "Seconds, anyone? Thirds?…"
4. **Two-shot of Tilly and Penny, held for all three lines:** "Tank wants thirds." / "Tank runs on
   diesel, Tilly." (Penny not looking up) / "Tank runs on LOVE, Penny." Why: the timing is between
   the two of them, and cutting would spoil it.
5. **Cutaway: Tank at the edge of the firelight, its hull ticking as it cools.** 1.5 s. Heard:
   laughter. Why: the subject of the joke gets the reaction.
6. **Through the flames; long lens; the fire soft in front: Gus with Ace's launcher in pieces on a
   cloth.** 1.5 s.
7. **Close-up on Ace; locked, and she doesn't move.** Ace: "Gus, stop taking my launcher apart."
8. **Insert: Gus's hands, a spring, three screws, a screwdriver going in.** Heard over it: "I'm not
   taking it apart, I'm improving it…" Why: the joke is in what we see.
9. **Low medium on Pemberton rising, tin cup up, the fire lighting him from below.** Pemberton:
   "Might I propose a toast? To the Captain, who came for each of us."
10. **Close-up on the Captain, turning the toothpick in his fingers, looking at no one.** Captain:
    "Wasn't just me…"
11. **Insert: tin cups knocked together over the fire.** 1 s. Heard: the clink.
12. **Pillow shot: the fire alone, a log settling, sparks lifting.** 2 s. The voices fade under the
    crackle.
13. **Close-up of the Shaman in profile; long lens; the crew laughing, soft, between him and the
    camera. He looks past them, out to sea.** 2 s.
14. **Cutaway: the dark sea; far out, lightning flickering inside one cloud, without a sound.** 2 s.
    Why: the harder days, without a word, and it's the storm that's coming.
15. **Close-up on the Shaman, turning back to them.** Shaman: "Remember tonight…" Hold after.
16. **Extreme wide as the first shot, craning slowly up and away until the fire's a spark on the
    dark island.** 4 s. Heard: very faint laughter, and the surf.

**For the owner:**
- Raise the stage's limit so all eight are there?
- Hold Tilly and Penny's exchange in one two-shot rather than cutting?
- The silent lightning on the horizon: a hint of the storms to come, or one hint too many?

### Professor Terror appears (`terror1Appears`): about 55 seconds

**Where and when:** two places, cut between. The crew's island at dusk, by the radar, the sky going
violet; and Terror's laboratory, with no daylight at all, lit by green jars and a brass desk lamp.
The crew's side is warm and orange and Terror's cold and green, so every cut says where we are.
This is the first scene with the tick of the Captain's watch under it.

**Who and where:** the Captain screen left and the Shaman screen right, by a radio on a crate under
the turning dish; the camera on the dish side. Terror alone at his microphone, always facing screen
left, as if speaking toward the crew's side of each cut.

1. **The map from above, as the game draws it; slow push down.** 2.5 s. Cloud parts over a dark
   island under a red flag. Heard: wind, radio static. (Build: the world map as a cutscene shot.)
2. **Medium on the Captain and the Shaman by the radio, the dish turning behind.** Captain: "New
   island on the map…"
3. **Close-up on the Shaman.** Shaman: "Not one of his little outposts…"
4. **Insert: the radio's needle swinging; the static thins into someone breathing close to a
   microphone.** 1 s. Heard: the watch's tick begins under the static.
5. **Insert in the lab: a brass microphone, a pale hand turning its dial, green jars soft behind.**
   Heard over it: Terror: "I see you've been busy, little crew…", cutting halfway through to:
6. **Close-up on the Shaman, listening, on "Freeing my prisoners."** Why: the man who was the
   prisoner hears himself counted as a theft. (One line over two shots.)
7. **Extreme close-up: the half-moon glasses with the green jars in them.** Terror: "Thieves, every
   one of you."
8. **Terror at last, medium, low; long lens; his face lit green from below; slow push in.** Terror:
   "Every gun on my islands…" Why: we see him whole only once he's said what he is.
9. **Close-up on the Captain, steady; he takes the toothpick out to speak into the radio.** Captain:
   "The crystals don't belong to you, Professor."
10. **Close-up on Terror, smiling at the microphone, almost fondly.** 1.5 s.
11. **The same.** Terror: "Everything belongs to someone, Captain. These belong to me." The
    giggle, then stone.
12. **Cutaway: the red flag on its island across the dusk water.** 2 s. The tick stops. Silence.
13. **Close-up on the Shaman.** Shaman: "That is the Professor…"
14. **Medium: the Shaman turning toward the dark forest.** Shaman: "His own islands are harder…"
15. **Cutaway: the deep forest at dusk, black between the trees.** Heard over it: "There's
    something in the forest I need to tell you about," and a faint low hum. Why: the Hourglass is
    promised in a picture.

**For the owner:**
- Show Terror's face now, or keep him to hands, glasses and voice until the creation island?
- The lab is a set to build: until it is, is he only a voice on the radio?
- Start the watch's tick here, in his first scene?

### The creation escape (`creationEscape`): about 50 seconds

**Where and when:** Terror's workshop island after the win, inside the long workshop, smoky and
dark, its far end open on a dock and a bright bay. Midday outside, so at the far end Terror is a
silhouette against the glare, lit from the front only by the crystal in his fist, green and red.

**Who and where:** the crew screen left, the Captain at the front; Terror screen right at the far
end. The line runs down the length of the hall.

1. **Wide from behind the crew, their backs soft in front; wide lens; handheld at walking pace.**
   3 s. The workshop in ruins, shelves down, smoke. Heard: glass crunching, glowing liquid fizzing
   as it drips. (Build: the workshop; walking. Today: they stand in the ruins.)
2. **Insert: a boot crunching glass into a puddle that glows.** 1 s.
3. **Long lens down the hall, as the crew sees it: Terror small at the far end, a silhouette
   against the bright doors; his crystal the only clean light in the smoke.** 2 s.
4. **Close-up on Terror, a jolt of the hand on the cut.** Terror: "Enough!"
5. **Medium on Terror, now locked and still, brushing dust from his sleeve.** Terror: "You think
   you've won?…"
6. **Close-up: he raises the crystal between his face and the camera, and its light floods his
   face.** Terror: "This is the only one that matters. Watch."
7. **The making, shown on faces: close-up on the Captain, green and red light sweeping across him,
   his eyes following something we don't see.** 1.5 s. Heard: a rising tone, water hissing. Then
   **the same light on Penny or Ace.** 1 s.
8. **Wide from the dock: a sleek speedboat already on the water, the last of the light folding
   into its hull.** 2 s. Why: cut away from the moment itself; light on faces, then the thing done.
   The finale's montage plays this exact frame backwards, so it's composed for that. (Build:
   speedboat, the light effect.)
9. **Close-up on Terror, delighted.** Terror: "Creation, my dears…"
10. **Close-up on the Captain, handheld, the engine starting.** Captain: "A boat. He made a boat out
    of thin air!"
11. **Wide: Terror already aboard (the cut hides the step); a little wave.** 1.5 s.
12. **Close-up on Terror in the boat, in sunlight for the first time.** Terror: "I'll be seeing
    you. Do try to keep up."
13. **Very wide and high from the dock; locked.** 2 s. The boat tears away, a white line across the
    bay. Heard: the engine pulling away; the rising tone cuts out.
14. **Close-up on the Captain at the dock's edge, handheld.** Captain: "He's getting away!"
15. **Pillow shot: the wake spreading on the water, glittering, smoke drifting over it.** 2 s.
    Heard: only the tick, and then that stops too.
16. **Insert: on Terror's desk in the ruins, under a fallen plan, the corner of a photograph lifting
    in the breeze.** 2 s. Why: the next scene's find, shown to the player a moment before the crew.

**For the owner:**
- The Captain mans the gunboat: is he at its wheel in the bay as the speedboat roars past, too fast
  to follow (needs both boats), or ashore with the crew as written?
- See the boat being made, or only its light on their faces?
- Show the photograph on the desk here, or keep the first look for the fire that evening?

### The chaos escape (`chaosEscape`): about 45 seconds

**Where and when:** the roof of the storm tower, rain lashing sideways, a dark noon. Lightning is
the key light; faces are fully seen only in the flashes. The storm's sound is a wall.

**Who and where:** Terror on the raised top of the roof, screen right and above; the crew below,
screen left, Ace at the front with her launcher and the Captain beside her. Shots of Terror are
from low, the crew's side; shots of the crew are from high, his side.

1. **Extreme wide: the island under the turning storm, the tower cracked open at its heart,
   lightning showing it.** 2.5 s. Heard: wind, thunder.
2. **Low; long lens: Terror on the roof, coat and tie whipping, rain streaking the lens.** 1 s.
3. **Close-up on Terror, shouting but amused.** Terror: "Clever children…"
4. **Insert: his hand rising with a crackling purple-blue crystal, lightning crawling between his
   fingers.** Heard over it: "But I always save the one that matters."
5. **Wide from the crew's level; wide lens.** 3 s. The storm answers: the rain swings in round the
   tower until it's a wall, and the crew are small in front of it. (Build: a wall of rain.)
6. **Low: Terror, arms wide, laughing into the storm.** Terror: "Chaos, my dears…" A flash on the
   cut.
7. **Cutaway into the rain: grey, nothing to see; the camera searches, handheld.** 1.5 s. Heard:
   rotor blades thumping, felt more than heard. Why: heard before it's seen, and never seen
   properly.
8. **Close-up on Ace, launcher up, tracking nothing; handheld.** Ace: "There's a helicopter in that
   storm!…"
9. **Close-up on the Captain, locked: the steadiest shot in the scene.** Captain: "Hold your
   fire…"
10. **Low, looking up into the rain: a dark shape rising, seen for one frame in a flash.** 2 s.
11. **The storm's sound drops out completely. Close-up on the Captain, rain running down his face;
    only his breath and rain on skin.** Heard over him, as if at his ear: Terror: "Give my regards
    to your Shaman."
12. **The same, pushing in.** Terror: "Ask him about the storm. The first one." Hold in the
    silence.
13. **Wide: the sound creeps back as hiss and drips, not a crash; the rain thinning, a pale sun
    through the cloud.** 2.5 s.
14. **Pillow shot: a puddle on the roof going still, the sky clearing in it, one last drop.** 2 s.
    A match cut into the storm story: the puddle's ripple becomes the fire's flicker.

**For the owner:**
- Never see the helicopter clearly, or give it one clear shot?
- Drop the storm's sound under his last two lines?
- Match cut from the puddle into the storm story's fire?

### The story of the storm (`chaosHome`): about 3 minutes

**Where and when:** now, the crew's beach at night after the rain, everything dripping, the fire
low and smoky. Then, in black and white with the photograph's grain: the same beach fifty years
ago, a village of huts where the crew's base now stands, first on a bright day, then in the storm
at night.

**Who and where:** now, the same setup as the story of the crystals, on purpose, since this is the
other side of that story: the Shaman screen right on the sea side of the fire, the Captain screen
left holding the photograph, Pemberton beside him, Penny and Mo across. Then: a boy (the Shaman),
his grandmother, young Theodore and Clara. Nobody in the past speaks; there's only the Shaman's
voice. The sound of the sea carries across every cut between now and then.

1. **Wide, high; locked.** 3 s. The crew round the fire, soaked and quiet. Heard: drips from the
   palms, the fire hissing.
2. **Close-up on the Captain.** Captain: "He said to ask you about a storm…"
3. **Close-up on the Shaman, a long breath out first.** Shaman: "...Sit down, all of you…"
4. **Insert: the Captain takes the photograph from his pocket and holds it to the firelight.** 2 s.
5. **Push in on the photograph until its beach fills the frame; the grain of the print becomes the
   grain of the picture, and the still beach starts to move: waves, palms, huts, a small boy on the
   sand.** 4 s. Heard: the fire crossfading into surf and gulls; over it, "Fifty years ago, when I
   was a boy…" Why: we go into the past through the object the story turns on.
6. **Then: full shot, a young man with black hair and a young woman with a sketchbook stepping off
   a little boat.** Heard over it: "A young man with black hair…"
7. **Then: one line over two shots.** "She drew every flower on our island." over Clara's pencil
   drawing a frangipani; "He asked my grandmother about the glowing stones." over Theodore kneeling
   before an old woman, a crystal lit in her palm.
8. **Now: close-up on Pemberton sitting up, the worn book in his hands** ("A young woman who drew
   flowers?…"), **an insert of the book's cover in firelight, and back on him** ("Clara Marlowe. My
   book…").
9. **Close-up on the Shaman.** Shaman: "She was. She laughed like the sea on a calm day."
10. **Then: big close-up on Clara laughing in the wind, then one on Theodore watching her.** Heard
    over them: "Her name was Clara. His name was Theodore.", each name on its face.
11. **Then: three quick shots for three lines, the pace tightening.** The sky darkening over the
    sea ("He heard of a crystal on the reef island…"); the grandmother shaking her head, and
    Theodore's back as he drags the boat down ("…He would not wait."); Clara stepping into the boat
    and looking back at the boy ("…because she loved him.").
12. **Now: pillow shot, rain dripping from a palm frond onto the sand by the fire.** 1.5 s. Why: a
    breath before the storm, and the present still wet from another one.
13. **Then: very wide, lightning, waves over the reef, the little boat thrown onto the rocks.** 4 s.
    Heard over it: "The storm threw their boat onto the reef…"
14. **Then: handheld in the surf, waves breaking over the lens, the boy dragging a young man by his
    collar.** Heard over it, whispered: "I pulled Theodore out of the waves."
15. **Then: the empty sea at dawn after the storm, flat calm, one plank floating; locked.** After a
    long silence, heard over it: "We never found Clara." Why: the most important line in the story
    lands on her absence, not on a face.
16. **Now: close-up on Penny.** Penny: "Oh, no..."
17. **Then: close on the young man's shaking hands on the sand, holding the wet photograph.** Heard
    over it: "When he woke…" and "He looked at it for three days…"
18. **Then: dusk, a dark fleet of sails on the horizon.** Heard over it: "When he came back, years
    later, he wasn't Theodore anymore."
19. **Match cut: the same photograph, now in the Captain's hands by the fire; colour floods back.**
    2 s.
20. **Now, the rest by the fire, a shot per speaker:** the Shaman ("He had ships and raiders and
    guns…"); the Captain, looking at the photograph ("He wants to bring her back."); the Shaman
    ("The oldest story says…"); Mo ("Shaman... that's the saddest thing…"); the Shaman ("It's the
    saddest thing I know.", then steadier, "And it doesn't change…" and "A whole world remade…");
    the Captain ("So we stop him."); the Shaman on a slow push in ("We stop him. And we don't hate
    him…").
21. **Insert: the Captain slides the photograph back into his pocket and buttons it; then the wide
    from the first shot, craning slowly up.** Black.

**For the owner:**
- Pure black and white in the past, or one touch of colour (the crystal in the grandmother's hand)?
- Show Clara's face clearly here, or keep it soft so her first clear face is if she comes back?
- Build the past village and its four people, or tell the past mostly in close shots (hands, sea,
  boat, sails) so less needs building?
- "We never found Clara" over the empty sea, or on the Shaman's face?

### The time escape (`timeEscape`): about 75 seconds

**Where and when:** the time island, a stone terrace above the shore where the great clock machine
stands; a grey morning, flat light, still water. When time stops, everything drains cold and blue,
dust hangs in the air, and there's no sound at all.

**Who and where:** Terror cornered by the machine, screen right; the crew charging in from screen
left, the Captain in front. When time stops only Terror moves: he walks between them, then away to
the shore, screen right.

1. **Wide, handheld, fast.** 1.5 s. The clock machine shattering, gears flying. Heard: grinding,
   shouting.
2. **Close-up on Terror, cornered, lifting a crystal of swirling silver light that lights his
   face.** 1.5 s.
3. **Extreme close-up on his mouth.** Terror: "Stop." (quiet)
4. **Wide, a slow track through the frozen scene: gears hanging, sparks like stars, the crew
   mid-stride, dust in the air, all drained cold.** 3.5 s. Heard: nothing at all, then a faint high
   ring. (Build: freezing the scene, mid-stride poses, the cold grade.)
5. **Insert: the Captain's watch on his frozen wrist, its second hand stopped between two ticks.**
   1.5 s. Why: the tick that's run under every Terror scene is gone, and the player feels the stop.
6. **Full shot tracking with Terror as he walks between the frozen crew, a purple mist curling round
   him; frozen figures pass between him and the camera, so we glimpse his hair darkening and his
   face changing but never see it whole.** 4 s. Heard: his footsteps on glass, a soft backwards
   whoosh. (Build: walking, the mist, the change of model.)
7. **Medium on young Terror stepping clear, stretching, his young face seen for the first time.**
   Young Terror: "Ahh. I'd forgotten how this felt…"
8. **The Captain's own view, frozen: a locked frame of what he's facing; young Terror walks into it
   and leans in until his face fills it.** Young Terror: "You can hear me, can't you?…" Why: we're
   stuck behind the Captain's eyes, and can't look away either.
9. **Big close-up on the Captain's frozen face, the toothpick frozen mid-chew.** Heard over it:
   "You think I'm a monster."
10. **Close-up on young Terror; long lens; cold light; slow push in.** Young Terror: "I'm a man who
    made one mistake…"
11. **Medium.** Young Terror: "When I'm finished, there will be no storm…"
12. **Wide: him walking away between the frozen crew toward the shore.** Young Terror: "And none of
    you will remember any of this."
13. **Overhead, looking straight down: his reflection in the still water, a wave frozen mid-break
    beside it, spray hanging. He touches his young face.** 3 s.
14. **Extreme close-up on the reflection.** Young Terror (whisper): "She'll know me now…" Why: the
    most honest thing he says, said to his own reflection.
15. **Insert: the watch's second hand jerks on: tick. Then the pause breaks: wide, gears crashing
    down, sparks falling, the seaplane roaring up off the water.** 3 s. Heard: everything at once.
16. **Close-up on Ace, handheld.** Ace: "That's a seaplane!…" (cut off)
17. **Close-up on the Captain, shaken.** Captain: "He's gone. And did everyone see his face?…"
18. **Insert: a gear on the stones, still spinning, slowing, starting to wobble. Cut to black before
    it falls.** 2 s. Why: a nod to Inception's top, and to time running down.

**For the owner:**
- The frozen view from the Captain's eyes: right for a crew of five, when the other players are
  playing other heroes?
- Half-hide his change, or show it in full?
- The spinning gear: a knowing nod, or too knowing?

### The finale (`finale`): about 95 seconds

**Where and when:** the heart of the fire mountain, a cathedral of rock, the three crystals
spinning together high above young Terror and pouring white light down through dust. No daylight:
the crystals are the only light, from above, so eyes are in shadow until someone looks up.

**Who and where:** young Terror under the crystals, screen right, his back to the crew at first;
the Shaman at the front of the crew, screen left, the Captain at his shoulder. The line runs from
the Shaman to Terror; when Terror spins round, the camera stays on the same side. Cross-cutting:
between lines, inserts of the three crystals drifting together, a little closer each time, are the
scene's clock. The rising tone climbs under all of it.

1. **Extreme wide, very low; wide lens; locked.** 4 s. The cavern lit white, the crystals spinning,
   young Terror tiny beneath. Heard: a deep hum, the rising tone beginning, rock ticking.
2. **Wide past Terror's back, soft and near: the crew and the Shaman at the cavern's mouth,
   battered, dust settling round them.** 2.5 s. (Build: the cavern.)
3. **Close-up on young Terror, lit from above, eyes on the crystals.** Young Terror: "You're too
   late. Listen…"
4. **Close-up on the Shaman.** Shaman: "Theodore. Please. She wouldn't want this."
5. **Insert: the crystals, a hand's breadth closer.** 1 s.
6. **Close-up, a whip as Terror spins round, then handheld.** Young Terror: "Don't. Don't you dare
   tell me what she'd want." / "You didn't find her…"
7. **Close-up on the Shaman, locked.** Shaman: "I looked for three days…"
8. **Close-up on young Terror, listening, over the Shaman's next line:** "And every year since, on
   the night of the storm, we've sung for her." Why: the line that breaks him lands on his face.
9. **Extreme close-up on his eyes: something cracks.** 2 s. Then, still on him: "...You did?"
10. **Close-up on the Shaman, taking a step.** Shaman: "Every year. We remember her too…"
11. **Insert: the crystals almost touching; the light climbs.** 1 s.
12. **Close-up on young Terror, handheld, quickening.** "Then you understand…" / "The storm, the
    reef…"
13. **Close-up on the Captain, the toothpick out.** Captain: "And who decides what's bad, Professor?
    You?"
14. **Close-up on young Terror, flat.** "Who else is there?" Hold.
15. **Insert: the crystals touch with a tiny click. Then wide: light floods the cavern and the rock
    cracks.** 2 s. Heard: the click, then the hum peaking.
16. **Close-up on the Shaman, handheld, turning to the crew.** Shaman: "It's too bright… Get behind
    me, all of you!"
17. **Slow motion, from behind the crew: the Shaman throws himself in front of them, arms wide, a
    dark shape against the white, hair lifting, the red crystal swinging up on its cord.** 3.5 s.
    Heard: everything falls away to one heartbeat and his breath. (Build: slow motion, the pose.)
18. **White.** Two seconds of white with only breathing, then the sound arrives late: one sharp
    crack and a long ring. Why: we never see the blast hit him; only the light, then what's left.
19. **Wide, still: dust drifting in shafts of light; where Terror stood, nothing.** 4 s. Heard:
    grit falling, the ring fading. **Then overhead: the Shaman lying small on the rock, dust lifting
    off him, glittering.** 2.5 s.
20. **Close-up on the Captain, handheld, the sound rushing back.** Captain: "Shaman! SHAMAN!"
    (Build: running. Today: cut to him already kneeling.)
21. **Low, from where the Shaman lies: the crew's faces above him against the white.** 2.5 s.
22. **Close-up on the Shaman; normal lens; soft light.** "Don't cry." / "Take care of the island..."
    with "...and each other." heard over the Captain's face.
23. **Insert: the Captain's hands holding the Shaman's arm as it turns to glittering dust through
    his fingers. Then from high above: the crew kneeling round an empty space, dust rising into the
    light.** 4 s. Heard: silence, then one low note.

**For the owner:**
- See the blast at all, or only the white and his shape against it?
- Leave the red crystal lying in the dust where he was? It's the strongest thing he has, but it
  might make players think the retry brought him back rather than the Captain's choice.
- Does the Captain drop his toothpick in the dust as he runs, and never pick it up?
- Two seconds of white and silence is long in a game: keep it?

### The Shaman returns, and the choice (`shamanReturns`): about 2½ minutes

**Where and when:** the same cavern, the light gone soft and grey, dust settling. The montage:
islands and raids from the whole game, played backwards, each in its own light. Then the cavern
again, the soul's warm light, and the choice.

**Who and where:** the Captain kneeling where the Shaman lay, the crew round him; once he's gone
to the crystal he's screen right, the crew screen left. The Shaman returns kneeling where he fell,
between them. Cross-cutting: the montage is cut against the Captain's watch, its hands spinning
backwards faster each time we see it.

1. **Wide, still.** 4 s. The crew kneeling where the Shaman lay; dust settling. Heard: only the
   mountain ticking as it cools.
2. **Close-up on the Captain, dust on his face; he looks up.** 1.5 s.
3. **Long lens from his eyes: a point of light on the rock ahead, out of focus; focus pulls to
   it.** 2 s.
4. **Macro: the crystal, no bigger than a thumb, white and flawless, pulsing like a heartbeat.**
   3.5 s. Heard: a soft tone on each pulse.
5. **Full shot: the Captain kneels by it (the cut hides the walk).** 2 s. **Insert: his hand closes
   on it; light runs up his arm like water and across the watch's face.** 2.5 s.
6. **Close-up on the Captain.** Captain (whisper): "Bring him back."
7. **Extreme close-up on his eyes: the pupils flare, then blaze white.** 2.5 s. Heard: a deep swell,
   the mountain breathing in.
8. **Extreme wide from far outside: the fire mountain at night, white light bursting out of it
   across the sea in a ring.** 3 s. Heard: the score breaks in.
9. **The montage, about 30 seconds, as written, each cut quicker,** with three additions: every
   fourth cut is the Captain's watch, its hands spinning backwards faster each time (the montage's
   clock, and a reminder that he's doing this); the world runs backwards in every shot but the
   white light travels forwards through it; and the rising tone climbs under the score to the end.
   The village growing back is framed exactly like the prologue's burned posts, so players know the
   place. The shots are the game's own islands and raids played backwards.
10. **White.** 2 s. The music peaks, holds, and cuts to silence.
11. **Medium on the Captain, eyes blazing, the crystal in his hand; the white fades from his eyes.**
    3.5 s. Heard: one tick of his watch, the first sound after the silence.
12. **Close-up: he looks down at the crystal, surprised.** 2.5 s. Heard: a faint high shimmer.
13. **A small warm light lifts out of the crystal; the camera drifts with it, focus on it, the only
    warm light in the grey cavern.** 4 s. Heard: a far choir.
14. **Low and wide: it sinks into the dust where the Shaman fell, and the dust rises in a slow
    glittering spiral.** 4.5 s.
15. **Cut away from the forming: close-ups of Penny and Mo, the spiral's glitter moving on their
    faces.** 2 s. **Then the Shaman, kneeling, eyes closed, already whole; he opens them.** 2.5 s.
    Heard: the choir fading on one warm chord.
16. **Close-up on the Shaman.** Shaman: "...Oh. Well. That was unexpected."
17. **Close-up on the Captain.** Captain: "Shaman!"
18. **Medium, the crew grabbing him.** Shaman: "Careful, Captain. I've only just been put back
    together." Then Mo, arms already wide: "Group hug…"
19. **Wide on the hug, then an insert: behind the Shaman's back, the crystal in the Captain's fist,
    still glowing.** 3 s. (Build: the embrace.)
20. **Close-up on the Shaman, quiet again** ("That crystal in your hand…"), **then over an insert
    of the crystal** ("It brought me back. And there's still light in it…").
21. **Pillow shot at ground level: a breeze moving the dust where Terror stood; a white corner of
    paper.** 2 s.
22. **Close-up on the Captain, kneeling to pick it up.** Captain: "Look. Where he was standing…"
23. **Insert: the black-and-white photograph in one hand, the white crystal in the other, both in
    the frame.** 2.5 s. Why: the choice in one picture.
24. **Close-up on the Shaman, slow push in** ("The crystal will do what your heart asks of it.
    Once."), **then over the photograph** ("You could bring them back…"), **then back on him** ("Or
    you could let them rest…").
25. **Penny, then Mo, a shot each.** "After everything he did?" / "After everything that was done to
    him."
26. **Close-up on the Shaman.** Shaman: "There's no wrong answer here. Only yours."
27. **The choice: a slow move round the crew, the photograph and the crystal in the Captain's hands
    at the centre.** Heard: nothing but the crystal's pulse.

**For the owner:**
- Should the montage reach back to the first storm (the boat lifting off the reef)? That would
  half-answer the choice still to come; stopping just short of it might be stronger.
- The watch running backwards through the montage?
- See the Shaman form, or only its light on the crew's faces?

### Let them rest (`rested`): about 25 seconds

**Where and when:** the cavern in its soft grey light; then outside the mountain, sunrise over the
sea.

**Who and where:** the Captain screen right with the crystal, the Shaman screen left, the crew round
them.

1. **Close-up on the Captain, a long breath first.** Captain: "Let them rest."
2. **Close-up on the Shaman.** Shaman: "Yes. I think they've earned it."
3. **Insert: the Captain's hand closing round the crystal; the light through his fingers dims and
   goes out.** 3.5 s. Heard: the pulse slowing and stopping.
4. **Close-up on the Shaman, a small smile.** Shaman: "There. The light has gone out of it…"
5. **Insert: the Captain slips the photograph into his pocket and buttons it.** Heard over it:
   "Let's take the photograph home…"
6. **Extreme wide from outside: the mouth of the mountain at sunrise, the crew small in the doorway
   of rock, looking at the sea.** 3 s. (Build: walking out. Today: they're there on the cut.)
7. **Pillow shot: the tide drawing back over shells on the crew's beach in the morning.** 3 s.
   Heard: the village's song for Clara begins, one voice humming.

**For the owner:**
- Begin the song here, or save it for the Hourglass in the next scene?
- End on the tide, or on the photograph?

### Bring them back (`revived`): about 50 seconds

**Where and when:** the cavern; the crystal's light pouring onto the photograph.

**Who and where:** Theodore and Clara in the middle, where the photograph lay; the Shaman screen
left; the Captain screen right; the crew round.

1. **Insert: the photograph on the rock, the Captain's hand above it with the crystal; light pours
   down and lifts off the picture in two shapes.** 3.5 s.
2. **Wide, framed exactly as the photograph, in black and white with its grain: a young man and a
   young woman on the rock, soaked; then colour seeps in from the edges.** 3.5 s. Heard: water
   dripping off them, and far off a storm, fading. Why: the photograph comes to life, in the storm
   story's language. (Build: colour seeping in.)
3. **Close-up on Clara, handheld: she's still in the storm.** Clara: "Theo? Theo, the boat…" Heard:
   the storm faintly under her, gone by the end of the line.
4. **Close-up on Theodore.** Theo: "Clara. Oh, Clara. You're here."
5. **Wide from behind Clara: the crew staring at her.** Heard over it: "Why are you crying? Why is
   everyone staring at us?…"
6. **Close-up on the Shaman.** Shaman: "Welcome back, flower woman…"
7. **Close-up on Clara, slow recognition.** Clara: "...Little Koa? No. It can't be. You're old!"
8. **Close-up on the Shaman, laughing.** Shaman: "Fifty years will do that."
9. **Close-up on Theodore.** Theo: "Clara, there's so much I have to tell you…"
10. **Two-shot from the side, Clara taking his hands.** Clara: "Then tell me slowly…" Hold.
11. **Insert: the photograph in the Captain's hand, now blank, white paper with only its grain
    left.** 2 s. Then black.

**For the owner:**
- Begin them in black and white and let the colour in?
- Leave the photograph blank, as if they'd walked out of it? It also sets up "In color, this time"
  at the wedding.
- "You're old!" needs the Shaman to look old (see "The Shaman").

## 3. How the plans become the script

The script is data the game plays. Today a cutscene is a list of beats: lines, and `shot(words,
seconds, sound?)`. `pace()` in `delivery.ts` turns them into timed cues; the stage cuts the camera
on every cue and picks the shot by rule; each line's recording is filed under `voiceKey(scene,
n)`, its place among the scene's lines. This proposes how the plans above go into that data
without losing what works.

### A planned shot, as data

A shot beat keeps its words (for anyone reading the script, and for a stand-in) and gains an
optional plan. A scene that has a `set` is **directed**: its lines are heard over the shot before
them, and the camera only cuts on a shot. A scene without one plays as now, so scenes can be
directed one at a time.

```ts
/** How big the subject is in the frame. */
export type Size =
  | "extremeWide"
  | "wide"
  | "full"
  | "medium"
  | "close"
  | "bigClose"
  | "extremeClose";

/** A planned camera: who or what it's on, from where, through what, doing what. */
export interface Frame {
  size: Size;
  /** Who it's on, two or more people, the place, or something on the set ("flagIsland"). */
  on: Speaker | readonly Speaker[] | "place" | Landmark;
  /** Seen past this person's shoulder, soft in front. */
  past?: Speaker;
  angle?: "eye" | "low" | "high" | "overhead" | "ground";
  /** Wide shows more of the place; long flattens it and softens what's behind; macro for tiny things. */
  lens?: "wide" | "normal" | "long" | "macro";
  move?:
    | "still"
    | "pushIn"
    | "pullOut"
    | "craneUp"
    | "craneDown"
    | "track"
    | "arc"
    | "pan"
    | "tilt";
  /** 0 is a locked camera, 1 a hand that shakes. */
  handheld?: number;
  /** What's sharp, or what the focus is pulled from and to during the shot. */
  focus?: FocusOn | { from: FocusOn; to: FocusOn };
  /** Where the key light comes from, as seen in the scene. */
  light?: "sun" | "fire" | "crystal" | "lightning" | "white";
  grade?: "colour" | "mono" | "cold";
  /** 1 as it happens, 0.25 slow motion, 0 frozen, -1 backwards. */
  speed?: number;
}

/** What the sound does from this shot on. */
export interface Sound {
  bed?: "sea" | "fire" | "wind" | "storm" | "rain" | "cave" | "none";
  music?: "none" | "in" | "swell" | "drop" | "cut" | { track: string };
  /** Recorded effects, by sample name, on the cut. */
  hits?: readonly string[];
  /** The Captain's watch under it, or not. */
  tick?: boolean;
  /** Everything out but voices and breath. */
  hush?: boolean;
}

export interface Shot {
  shot: string;
  /** Held before the lines heard over it, or all of it if none are. */
  seconds: number;
  sound?: string | Sound;
  frame?: Frame;
  /** A shot from the library of small shots, in place of a frame. */
  insert?: InsertId;
  /** What people do in it: poses and small actions. */
  act?: Partial<Record<Speaker | Extra, readonly Action[]>>;
  /** Shortest the shot may be, however quick its lines. */
  atLeast?: number;
  /** What isn't built yet. Until it is, `instead` plays, or the shot's left out. */
  needs?: readonly Need[];
  instead?: Frame;
}
```

A line says which shot it's heard over simply by where it sits: it's heard over the shot before
it. A line over a reaction shot follows a shot of the listener (the speaker's mouth still moves,
off screen, and the listener looks at them). A line over an insert follows the insert. For a cut
inside one line, the line carries its cuts, placed at a word:

```ts
["shaman", "No one should hold that much power. Not him. Not you. Not me.", {
  how: "slow and deliberate, a pause before each 'not', softest on 'me'",
  cuts: [
    { at: "Not him", to: shot("A lamp on the flag island", 0, { frame: { size: "wide", on: "flagIsland", lens: "long" } }) },
    { at: "Not you", to: shot("The Captain", 0, { frame: { size: "close", on: "rifleman", lens: "long" } }) },
    { at: "Not me", to: shot("The Shaman's closed hand", 0, { frame: { size: "close", on: "shaman" } }) },
  ],
}],
```

The scene gains a `set`: the place, the hour (the sun's height, or night), the light, where each
person stands and faces, any extras with no lines, and the line the camera keeps to. A few helpers
keep scripts readable where most shots are ordinary: `face("shaman")` for a close-up from the
scene's side of the line, `past("shaman", "rifleman")` for over the shoulder, `two("tank",
"medic")`, and `insert("sparks", 1.5)`.

People who aren't there yet: a shot on a hero the crew hasn't rescued is left out, like that
hero's lines, and the lines after it fall back to the shot before. A shot can go inside `together`
with the lines it frames (Tilly and Penny's two-shot), so they come and go as one.

### Keeping shots, lines and timing together

- **Where a cut lands.** A shot cuts in when the line before it ends, so the silence before the
  next line plays over the new picture; its `seconds` is a hold added on top. Today a shot resets
  the gaps `pace()` gives by mood, so a line after a shot starts with no pause at all. In a
  directed scene, a shot of 0 seconds shouldn't reset them, or every quiet line would come in too
  soon.
- **Recorded lengths.** `pace()` already takes each line's length as a function: words and mood
  now, the recording's length (trimmed of silence at its ends) later. Because every cut is tied to
  a beat, or to a word inside a line, and never to a clock time, all the cuts move with the
  recordings by themselves, and the pauses from `before`, `after` and mood stay.
- **Cuts inside a line.** Before there's a recording, a cut at a word lands at that word's share of
  the line's estimated length. Afterwards it lands at the word's time from the speech recognizer
  that already checks each take, kept beside the recording.
- **Shots that frame lines** grow and shrink with them; `atLeast` keeps a short line from making a
  shot too quick to read. Shots with no lines, like the montage, keep their exact lengths.
- **Music.** A scene's own score is made last, to the timing `pace()` gives once the voices are
  in; `scripts/make-music.mjs` could read that timing and put the swells and drops on the marked
  shots. Until then, music marks start and fade loops, which survive any change of length. A scene
  could give a tempo and have cuts nudged to the nearest beat, but never by shortening a line.
- **The timeline.** What `pace()` returns is already the cutscene's timeline: shots on one track,
  lines on another. The scrubber planned in `STORY.md` would show and edit it.

### Adding shots without re-filing the voices

- `voiceKey(scene, n)` counts lines only (`allLines` skips shots). So adding, removing, reframing or
  retiming shots, adding cuts inside a line, and changing `before` or `after` never re-file a
  recording. Directing a scene after it's recorded is safe.
- What does re-file them: adding, removing, splitting, joining or reordering lines in a scene.
  Changing a line's words or its `how` needs a new take, under the same key.
- So: settle each scene's lines before recording it, and direct it whenever. A line that has to be
  added to a recorded scene gets its own key (`key: "4a"`), and the lines after it keep theirs.
- A list of the recorded keys, each with a fingerprint of its line's words, checked by a test,
  would turn an accidental re-file into a failed check rather than the wrong voice playing.
- Renaming Sgt. Steele to the Captain moves no keys (they don't contain the speaker). The lines that
  say "Sergeant" need new takes.

### The prologue, written out

The same seven lines as now, in the same order, so their recordings stay `prologue/1` to
`prologue/7`; sixteen shots added round them.

```ts
{
  id: "prologue",
  when: { on: "start" },
  cutscene: true,
  set: {
    place: "landingBeach",
    sun: { elevation: 4, rising: true },
    mist: true,
    extras: { builder1: "builder", builder2: "builder" },
    marks: {
      rifleman: { x: 0, y: 0, facing: "island" },
      builder1: { x: 2.5, y: -1, facing: "rifleman" },
      builder2: { x: 3.2, y: 0.4, facing: "rifleman" },
    },
    line: ["island", "flagIsland"],
    side: "south",
  },
  lines: [
    shot("Black. Only the sea.", 2, {
      sound: { bed: "sea", music: "none", hits: ["outboardFar"] },
    }),
    shot("Dawn, high over the reef: mist on the water, the boat a speck threading the gap.", 6, {
      frame: { size: "extremeWide", on: "place", angle: "high", lens: "wide", move: "craneDown", focus: "deep" },
      sound: { hits: ["gull"] },
      needs: ["boat", "mist"],
    }),
    shot("The Captain at the bow, toothpick in, studying the shore.", 0.8, {
      frame: { size: "close", on: "rifleman", lens: "long", focus: "rifleman" },
      act: { rifleman: ["chew"] },
      needs: ["boat"],
    }),
    // prologue/1
    ["rifleman", "That's the one. Long beach, deep cove, fresh water up in the hills.",
      { how: "quiet and sure, studying the shore from the bow" }],
    shot("His chart on his knee, the corner lifting, a pencil ring round the island.", 0.3, {
      insert: "chart",
      needs: ["chart"],
    }),
    // prologue/2
    ["rifleman", "Charts say nobody's lived here for years.",
      { how: "a little puzzled, half to himself" }],
    shot("A crab crosses the wet sand; behind it, soft, the bow slides up the beach.", 3, {
      insert: "crab",
      sound: { hits: ["hullOnSand", "outboardCut"] },
      needs: ["boat"],
    }),
    shot("Past the palms, the grass full of blackened posts; the Captain small among them.", 4, {
      frame: { size: "wide", on: "place", lens: "normal", move: "still", focus: "deep" },
      sound: { bed: "wind" },
      needs: ["burnedPosts"],
    }),
    shot("He crouches by a charred post and takes the toothpick out.", 0.6, {
      frame: { size: "medium", on: "rifleman", angle: "low", lens: "normal" },
      act: { rifleman: ["crouch", "toothpickOut"] },
    }),
    // prologue/3
    ["rifleman", "Charts are wrong. Somebody lived here. A whole village.",
      { how: "slowing, the ease gone out of him, crouching by a charred post", before: 0.6 }],
    shot("His fingers rubbing soot; black on his thumb.", 0, { insert: "sootOnFingers" }),
    // prologue/4
    ["rifleman", "And not long ago. This wood's still black.",
      { how: "low and grim, rubbing soot between his fingers" }],
    shot("He looks up, off to the left.", 1, {
      frame: { size: "close", on: "rifleman", lens: "long" },
      act: { rifleman: ["lookAt:flagIsland"] },
    }),
    shot("Across the water, the red flag over a fortified camp: a skull in small round glasses.", 3.5, {
      frame: { size: "wide", on: "flagIsland", lens: "long", move: "still" },
      sound: { hits: ["flagSnap"] },
      needs: ["flagIsland"],
    }),
    shot("Close on him, the flag island soft over his shoulder.", 0, {
      frame: { size: "close", on: "rifleman", angle: "low", lens: "long", focus: "rifleman" },
    }),
    // prologue/5
    ["rifleman", "Whoever did this didn't go far.",
      { how: "very quiet, eyes on the flag", before: 0.8 }],
    shot("He turns to the builders prising open crates, and puts the toothpick back in.", 2, {
      frame: { size: "medium", on: ["rifleman", "builder1"], lens: "normal" },
      act: { rifleman: ["turnTo:builder1", "toothpickIn"], builder1: ["prise"], builder2: ["prise"] },
      needs: ["extras"],
      instead: { size: "close", on: "rifleman", lens: "normal" },
    }),
    // prologue/6
    ["rifleman", "We build. Shelter first, then walls, then a headquarters we can hold.",
      { how: "brisk and steady, taking charge, a breath before he starts" }],
    shot("A crowbar bites a crate lid; it cracks open on tools.", 1, {
      insert: "crateOpens",
      sound: { hits: ["woodCrack"] },
    }),
    shot("In profile, looking out at the flag; the focus moves from him to it as he speaks.", 0, {
      frame: { size: "close", on: "rifleman", lens: "long", focus: { from: "rifleman", to: "flagIsland" } },
    }),
    // prologue/7
    ["rifleman", "Then we find out who's flying that flag.",
      { how: "flat and quiet, a promise", after: 1 }],
    shot("From behind the first post going in, the crane rises until the flag is a speck.", 5, {
      frame: { size: "extremeWide", on: "place", angle: "high", lens: "wide", move: "craneUp" },
      act: { builder1: ["hammer"] },
      sound: { hits: ["hammerOnPost"], music: { track: "prologue" } },
    }),
  ],
}
```

Played today, the shots that need a boat, mist, a chart, burned posts, the flag island or extras
fall back to their `instead` or drop out, so the scene opens on the Captain among the posts with
the motor cutting out over black, and still plays.

## 4. What the engine would need

In order of how many of these fourteen scenes need each thing:

1. **Directed shots (all 14):** the stage playing a planned shot (size, angle, lens, move, focus)
   instead of picking one by rule; lines heard over another shot; cuts inside a line; the `set`
   with marks and the line.
2. **Inserts (all 14):** a small set for close-ups of hands and things, with a macro lens and soft
   background: the library in `DIRECTING.md`, plus the ones these plans add (the chart, soot on
   fingers, a crate opening, the watch, the bag, the ladle, cups, a glowing puddle, the photograph
   in a hand).
3. **Things in hands and on the set (all 14):** crystals, the photograph, the book, a sketchbook,
   the chart, crates, a crowbar, a pot, a ladle, tin cups, launcher pieces, a med bag, the radio,
   a microphone, jars, the toothpick in and out.
4. **Sound by the shot (all 14):** beds that change on a cut, silence, effects on the cut, the
   watch's tick, the rising tone, music in and out.
5. **Faces for close-ups (all 14):** blinks, brows and eyes on whoever's speaking, and heads
   detailed enough for the big close-ups of the Captain, the Shaman, Terror and Clara.
6. **Light from things in the shot (9):** a crystal or jar lighting a face in its own colour, white
   light from above, a desk lamp (`firstCrystal`, `terror1Appears`, `creationEscape`,
   `chaosEscape`, `timeEscape`, `finale`, `shamanReturns`, `rested`, `revived`).
7. **Moving between marks (8):** walking, running, wading, coming through a door; until then, cuts
   that hide it (`prologue`, `shamanFreed`, `medicWon`, `creationEscape`, `timeEscape`, `finale`,
   `shamanReturns`, `rested`).
8. **New poses (7):** shading the eyes, hands on hips, standing up from sitting, a raised cup, arms
   wide, an embrace, crying (`shamanFreed`, `medicWon`, `fullCrew`, `chaosEscape`, `finale`,
   `shamanReturns`, `revived`).
9. **More people (7):** more than seven on the stage, and extras with no lines: builders, the past
   village (`prologue`, `fullCrew`, `chaosHome`, `finale`, `shamanReturns`, `rested`, `revived`).
10. **Boats and aircraft in a scene (7):** the Captain's boat, the speedboat, the helicopter as a
    shape, the seaplane, the little boat of fifty years ago, raider ships (`prologue`,
    `shamanFreed`, `creationEscape`, `chaosEscape`, `chaosHome`, `timeEscape`, `shamanReturns`).
11. **Weather and air (7):** sea mist, a wall of rain, dust in shafts of light, dust and spray
    hanging still (`prologue`, `shamanFreed`, `chaosEscape`, `chaosHome`, `timeEscape`, `finale`,
    `shamanReturns`).
12. **Interiors (6):** Terror's lab, the workshop, the heart of the mountain (`terror1Appears`,
    `creationEscape`, `finale`, `shamanReturns`, `rested`, `revived`).
13. **Professor Terror, old and young, and the change between them (5):** `terror1Appears`,
    `creationEscape`, `chaosEscape`, `timeEscape`, `finale`.
14. **Time and colour on the picture (5):** slow motion, freezing, running backwards, the white-out,
    black and white with grain, colour seeping in, the cold pause (`chaosHome`, `timeEscape`,
    `finale`, `shamanReturns`, `revived`).
15. **Sets dressed for the story (4):** the burned village's posts, the flag island in view of the
    beach, the radar with a radio, the village of fifty years ago (`prologue`, `firstCrystal`,
    `terror1Appears`, `chaosHome`).
16. **The night camp (3):** a fire pit, a pot, people sitting round it (`firstCrystal`, `fullCrew`,
    `chaosHome`).
17. **Light that makes things (3):** the boat folding out of light, light running up an arm, the
    soul, the dust spiral, the photograph's people lifting off it (`creationEscape`,
    `shamanReturns`, `revived`).
18. **Animals (1, and the library):** the crab in the prologue; the library's crab and gull for any
    beach scene.
19. **The world map as a shot (1):** `terror1Appears`.
