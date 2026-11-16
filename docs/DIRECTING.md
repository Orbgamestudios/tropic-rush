# Directing the cutscenes (plan)

**A plan, to go over with the owner before the scripts are rewritten.** How every cutscene is shot:
where people stand, where the camera goes, what it cuts to and why. The owner wants them to feel
like Christopher Nolan's films (2026-11-13) and asked for cuts away to small things between the
talking: a crab crossing the sand, sparks lifting off a fire as someone stokes it (2026-11-14).
What's built is at the end.

## What Nolan's films do, and what we take from them

From writing on his style and his editor Lee Smith
([Cinematic style of Christopher Nolan](https://en.wikipedia.org/wiki/Cinematic_style_of_Christopher_Nolan),
[Lee Smith on editing](https://www.ibc.org/interviews/craft-leaders-lee-smith-editor/4082.article),
[cross-cutting](https://laughingsquid.com/christopher-nolan-crosscut-sequences/),
[Interstellar's edit](https://www.postmagazine.com/Publications/Post-Magazine/2014/December-1-2014/Interstellar-Editor-Lee-Smith-ACE.aspx)):

- **Felt in the frame, not in the cutting.** The weight comes from what's staged and how it's framed:
  scale, real light, real distance. So our sets are the game's real islands and light.
- **Cutting away from the big moment.** He often cuts away just before or after the money shot
  rather than holding on it. Our blast, the crystal, the Shaman's fall: we show the cause and the
  aftermath, and let the moment itself be short.
- **Cross-cutting** between parallel action that builds to one climax: Terror at his microphone
  against the crew getting ready, the storm against the Shaman's story.
- **Objects that carry the story:** the spinning top, the watch, the photograph. Our photograph is
  that object, and it gets its own insert shots every time it appears.
- **Flat, still shots that float** apart from the action, which Smith describes using: our
  pillow shots (below).
- **Quick cutting:** Insomnia averages under two seconds a shot. Ours are slower in the quiet
  scenes, faster as tension builds (the finale's montage already goes from four seconds down to
  under half of one).

## The two kinds of cut away

From the usual definitions
([insert vs cutaway](https://filmdaft.com/?p=32368), [cutaways](https://www.studiobinder.com/blog/cutaway-shot/),
[inserts](https://en.wikipedia.org/wiki/Insert_(filmmaking))):

- **Inserts**, inside the scene: a close look at a detail that's there. Hands stoking the fire and
  sparks lifting; a boot print filling with sea water; the toothpick moved from one side of the
  Captain's mouth to the other; the photograph in Terror's fingers; the Shaman's shark teeth as he
  turns.
- **Cutaways**, out of the scene: somewhere else, to give it air or say something without words. A
  crab crossing the sand while two people don't talk; the gunboat rocking at anchor; a gull lifting
  off a post; the red flag across the water; the tide drawing back over the shells.

They do three jobs: they let a scene **breathe** between lines, they **say something** (the crab
going about its business while the crew argues: the island doesn't care), and they **hide a jump**
(people can move between shots without walking across the screen).

## Rules for every scene

1. **Open wide, then go in.** A scene starts by showing where we are (an establishing shot), then
   comes in to faces. It doesn't open on a close-up unless that's the point.
2. **The 180-degree line.** Two people talking stay on their own sides of the screen: the camera
   never crosses the line between them unless a shot shows it moving across.
3. **Eyeline and look room.** Someone looking right has space on the right of the frame.
4. **Thirds.** Eyes on the upper third; the horizon on a third, never through the middle.
5. **A line lands on a face; a reaction lands on the listener.** The best shot for an important line
   is often the person hearing it.
6. **One insert or cutaway every three or four lines** in a quiet scene, none in an argument, and the
   cut lands at the end of a line or on a sound (a log settling, a wave).
7. **Light follows the story** (built, see below): warmer and harder when things are fine, colder
   and softer when they aren't, firelight at night.
8. **Silence is allowed.** A held shot with nothing said is often the strongest beat in a scene.

## The library of small shots (to build)

Each is a short self-contained shot the director can put anywhere it fits, each with its own little
set, made once:

| Shot                                                   | Kind    | Used for                        |
| ------------------------------------------------------ | ------- | ------------------------------- |
| A crab crossing the sand, sideways, stopping, going on | Cutaway | A pause on the beach            |
| Sparks lifting off a fire as a log's turned            | Insert  | Night scenes by the fire        |
| The tide drawing back over shells                      | Cutaway | Time passing, a goodbye         |
| A gull lifting off a post                              | Cutaway | Breaking a silence              |
| The gunboat rocking at anchor                          | Cutaway | The Captain's thoughts, leaving |
| The red flag across the water, flapping                | Cutaway | The Professor's presence        |
| Footprints filling with sea water                      | Insert  | Walking scenes                  |
| Palm fronds against the sun, the light flaring through | Cutaway | Dawn, hope                      |
| The photograph                                         | Insert  | Every scene it's in             |
| A hand turning a crystal, light inside it              | Insert  | Crystal scenes                  |
| The toothpick, moved across the mouth                  | Insert  | The Captain thinking            |

## Scenes that move

The owner asked for scenes with people doing things, not standing in a ring: walking along the
beach, sitting by the fire, in the headquarters. To build:

- **Walking and talking:** the cast walks a path; the camera leads them, moving backwards in front,
  then drops behind to watch them go.
- **By the fire:** the cast sits round a fire (sitting is in the animator already), the fire lights
  their faces from below (built), with inserts of sparks and hands.
- **In the headquarters:** a set inside it, lit by a lamp, for the planning scenes.

## Built so far

- No black bars and no words for what a shot shows: every cutscene fills the screen, with only the
  line being said, low over the picture. A choice is put inside the cutscene, as a line to tap.
- The camera cuts between over-the-shoulder shots of the speaker, shots across two people talking,
  a listener for a voice on the radio, and, for shots the script only describes, a view out to sea,
  up at the cast against the sky, round them, or wide. Each has its own lens, a slow move, a little
  handheld drift when tempers are up, and its focus pulled to the speaker.
- **Lighting that moves with every cut:** a key light beside the camera so faces have shape, a rim
  light behind the speaker to lift them off the background, less key on a sad or quiet line and a
  harder rim on an angry one, firelight flickering from the middle of a night scene, and lightning
  in a storm. The sun is put where the scene wants it, low over the island in the morning or going
  down over the sea, so there's always long light, a flare and a glitter on the water.
- **The film look:** bloom, the sun's flare down the lens, soft focus off the speaker, a grade,
  grain and a vignette (`render/cinema.ts`).
- People act: they turn to whoever's speaking, hold themselves the way the line's mood says, talk
  with their heads and hands, point, nod, salute, kneel, pray and sit; mouths keep time with the
  words.
