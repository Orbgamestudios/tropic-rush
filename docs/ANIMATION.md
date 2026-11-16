# Animation

The Captain's animation clips: what's in the library, how they were made, how the game plays and
blends them, and a study of how the stock animations move, measured off the clips, for making new
ones by hand or in code.

The converted clips are in the repo: see [Licence](#licence).

## What's in the library

Thirteen clips in `public/models/anims/`, one GLB each, listed with what they are in
`public/models/anims/clips.json`. They are ActorCore stock animations (bought for this skeleton
family: Character Creator, the bones AccuRig gave the Captain), turned into clips for his skeleton
by `scripts/blender/convert_clips.py`. None has a rifle in it: the hands hold one that isn't there,
for the game to put its own in.

Lengths below are in his height (`h`): he is 0.998 units tall in his model, as loaded. For a person
of 1.8 m, multiply by 1.8 to get meters.

| Clip               | Kind     | Seconds | Loops | Travels         | What it is                                                                                                                         |
| ------------------ | -------- | ------- | ----- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `idle`             | idle     | 18.0    | yes   | no              | Standing at ease, weight shifting: hands to hips, scratches his head, leans over hands on knees, straightens                       |
| `sit-talk`         | sit      | 23.3    | yes   | no              | Sitting on a knee-high seat (nothing under him: the game gives him a crate), forearms on knees, leaning back now and then, talking |
| `walk-think`       | wander   | 34.0    | no    | wanders         | Pacing deep in thought: arms folded, hand to chin, hands behind his back, stopping and turning back                                |
| `walk`             | walk     | 2.03    | yes   | 0.31 h a cycle  | One stride cut from `walk-think`: a slow, unhurried walk, arms loose                                                               |
| `gun-run-start`    | start    | 2.43    | no    | 0.78 h          | At the ready for 1.45 s, then drops into a crouch and sets off                                                                     |
| `gun-run`          | run      | 0.63    | yes   | 0.78 h a cycle  | Running hunched, rifle held low across the body                                                                                    |
| `gun-run-stop`     | stop     | 2.83    | no    | 1.39 h          | Out of the run in three strides to a stop, back to the ready                                                                       |
| `gun-shoot`        | action   | 3.93    | yes   | no              | At the ready; sinks into a braced stance, fires three shots with recoil, rises back                                                |
| `gun-turn-right`   | turn     | 2.83    | no    | turns 90° right | At the ready, steps round a quarter turn                                                                                           |
| `crouch-turn-left` | turn     | 3.00    | no    | turns 180° left | Crouched low, pivots a half turn                                                                                                   |
| `crouch-shoot`     | action   | 10.4    | yes   | no              | Kneeling side-on, rifle to his eye, fires, lowers it                                                                               |
| `cover-reload`     | action   | 4.88    | yes   | no              | Kneeling behind cover, facing back, reloads                                                                                        |
| `blast-fall`       | reaction | 2.08    | no    | 2.02 h          | Running, thrown forward by a blast, left lying face down                                                                           |

`clips.json` gives for each: `seconds`, `loops`, `rootMotion` (whether it carries him somewhere or
turns him, which the game should take over), `travel` (where the hip ends up, across and ahead),
`turnDegrees`, `facingDegrees` (which way his hips face as it starts: the rifle clips stand bladed,
hips about 45° to his right of forward; `crouch-shoot` and `cover-reload` face back), `reach` (the
furthest the hip strays), and for the walks and runs `distancePerCycle`, `speed` and `footfalls`,
the times each foot lands. `checks` are the converter's own measurements (below). His forward is
+z in the model, as loaded.

What's missing for a full set: a brisk walk (the only walk is a thoughtful amble, about half normal
pace), an unarmed run, jumps, hits that don't knock him down, a death, and turns on the move.

## How the clips were made

`blender -b -P scripts/blender/convert_clips.py -- models-wip/anims/raw public/models/captain-raid.glb public/models/anims models-wip/anims/stats.json`

The downloads (`new work/stock animations/*.zip`) are unpacked one to a folder under
`models-wip/anims/raw/`. Each holds an FBX made for Unity with the stock actor's skeleton, and a
JSON of physics settings the converter doesn't use.

- **The quarter turn.** Like the Captain's own FBX (`retexture_rig.py`), each stock skeleton rests
  lying on its side: Unity's "up" is a quarter turn about x from Blender's, and the importer stands
  only the animation up, through the root bone. Copied channel for channel onto the Captain, whose
  skeleton `retexture_rig.py` turned upright and made plain, every clip would play a quarter turn
  over. The converter instead plays each frame on the stock skeleton and reads off where every
  bone points in the world, and points the Captain's bones the same way. It still finds the turn
  that stands the stock rest up (-90° about x for all ten; bones 74° off as stored, 21° once
  turned, the rest being arm pose), because the hip needs it: AccuRig fits the hip to each body
  (the Captain's leans back 37° at rest), so his hip moves from his own rest by as much as the
  stock hip moves from its rest, where every other bone takes the stock bone's whole orientation
  (both rigs keep Character Creator's bone axes; checked bone by bone, children lie along each
  bone's y in both, and the hands' roll agrees within 15°).
- **Scale.** Travel and the hip's drop are scaled by leg length (thigh plus shin), not height: his
  legs swing through the stock actor's angles, so a planted foot only stays put if the hip moves
  his leg's length for each of theirs. His legs are short for his height (a cartoon's), 0.345 of
  the stock actors', where his height is 0.57 of theirs.
- **Feet and floor.** His shoes are big (the tip 0.063 h ahead of the ball of the foot), so the
  stock actor's toe turns put his shoes into the floor by up to 7% of his height. Each frame his
  soles are checked (heel, ball and tip); a leg whose shoe would sink is bent (two-bone IK) to
  lift that foot just clear, eased in and out over 0.08 s. Knees, elbows, hands, head, chest and
  hips are checked too, and the whole body lifted if one would sink (only `cover-reload` needed it,
  by 0.03 h). While a foot is planted, its ball is held where the stock actor's was (scaled), so his
  feet creep no more than theirs did: in `gun-run` that took the worst creep in a plant from 0.019 h
  to 0.003 h.
- **Loops.** `walk` is the cleanest single stride in `walk-think`: from one left landing to the
  next, whose ends look most alike (2.1° a bone apart), walking straight; it is turned to travel
  along +z and its ends are made to meet (the difference spread evenly over the cycle). The takes
  made to loop are closed the same way, after the feet are fixed.
- **Keys** are thinned until leaving one more out would move a bone by 0.25° or the hip by 0.15% of
  his height. The 13 clips come to 1.5 MB.

### Checked, and how

The converter measures every clip on the Captain (`checks` in `clips.json`): his feet's lowest
heights against where they rest, how far a planted foot creeps from landing to lifting, how near
each hand comes to the spine, and how far a loop's two ends differ. Then
`models-wip/debug/rig/clips.html` plays them on `captain-raid.glb` through the game's own
`ClipPlayer`, and `node models-wip/debug/rig/clips-shoot.mjs <folder>` takes strips of eight frames
of each from the side, front, three-quarters and floor level, finds the lowest point of his skin
over each clip (every one within 0.008 h of the floor, none more than that into it), and runs three
transitions (stand, walk, run, stop, stand; a rifle raised over a walk; a run into the blast).
Looked at: feet on the floor and not sliding, knees and arms bending the right way, hands meeting
on the rifle grip without passing through each other or the body, the kneels with the knee on the
ground, the fall ending flat on the floor.

## Playing them: `src/game/render/clipLibrary.ts`

```ts
const library = await ClipLibrary.load("/models/anims/"); // or a list of the names wanted
const player = new ClipPlayer(captainScene, library); // any model with the CC skeleton
player.play("idle");
player.play("walk"); // picks the blend; returns it (seconds, ease, why)
player.play("gun-run"); // gait change: same footfall, strides kept in step
player.play("gun-run-stop", { next: "idle" });
player.gesture("gun-shoot"); // upper body only; the legs keep walking
// every frame:
const { move } = player.update(dt); // travel the clips took out, in the model's parent space
captainScene.position.add(move); // or feed it to the game's movement
```

Every clip is split in two at load: the lower body (hip, pelvis, legs, waist, and the hip's travel)
and the upper (`CC_Base_Spine01` and everything under it). Both halves play as their own actions in
step. A gesture plays its upper half only, and the clip below gives up as much of its upper half's
weight as the gesture takes, so a raised rifle sits on striding legs; a one-off gesture settles back
over 0.5 s as it ends.

Travel is taken out of clips that travel (`rootMotion`, or `play(name, { rootMotion })`): a loop
loses only its steady travel, the straight line from its first frame to its last, so the hip still
sways and surges on each step; a one-off loses all of its travel along the ground. `update` returns
the travel taken out, blended by the clips' weights, for the game to move him by. Turns aren't taken
out: a turning clip turns him itself, and the game should face him the new way when it ends
(`turnDegrees`).

The choices are plain functions, tested in `clipLibrary.test.ts`: `transitionFor` (which blend),
`eased`, `stridePhase` / `timeAtPhase` / `matchedStart` (where in the stride), `syncedTimeScales`
(two strides in step), `splitTracks`, `extractTravel` / `travelBetween`.

### Blends, and why

| From → to                     | Blend                                                              | Why                                                                                   |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| anything → a hit (`reaction`) | 0.08 s, quick then slow                                            | A hit lands at once; a long blend reads as him seeing it coming                       |
| walk ↔ run                    | half a step (0.2–0.4 s), even, foot for foot, strides kept in step | The same motion at another pace: blends well, but only with the same foot down        |
| run → stop                    | 0.2 s, picked up at the same footfall                              | The stop starts mid-stride: it reads as the run slowing                               |
| standing → moving             | 0.15–0.2 s, quick then slow                                        | The controls must feel answered; legs blending slowly from standing look like skating |
| sitting ↔ standing            | 0.6 s, eased both ends                                             | The whole body changes; quick, the hips swim through the seat                         |
| moving → standing             | 0.3 s, eased                                                       | Weight takes longer to stop than to start                                             |
| gesture, turn or stop → idle  | 0.5 s, eased both ends (a settle)                                  | The arms drift home rather than snap                                                  |
| standing → gesture            | 0.25 s, eased                                                      | Brisk, so it reads as meant                                                           |
| anything else                 | 0.4 s, eased                                                       |                                                                                       |

Gait changes keep both strides at one pace while they blend: each plays at the rate that takes it
round its cycle as often as the other, that rate sliding from the old clip's to the new one's as
the weight moves. Without it the two strides drift apart during the blend and the legs scissor.

## How the stock animations move

Numbers measured off the clips on the Captain (`models-wip/anims/stats.json`, written by the
converter). Lengths in his height `h`, angles in degrees.

### Standing (`idle`)

- **Never still.** Between moves the body keeps a slow drift: summed over eleven bones (hips,
  chest, head, upper arms, forearms, thighs, shins), 35–60° a second, so about 4° a second each.
  A procedural idle needs this much: a breathing chest and a slow sway, not a frozen pose.
- **Holds and moves.** Eight moves in 18 s, each 0.3–1.9 s long (median 1.1 s), with holds of 1.5 to
  3.5 s between. The moves ease in and out evenly: their fastest moment is at the middle (median
  52% of the way through).
- **Weight shifts** carry the hips sideways up to 0.16 h from where they started, and drop them a
  little (2.4% of height, leaning over to his knees). Standing on one leg, the hip on that side
  rises and the other knee bends.
- **The head is steadiest.** Over the clip the hips' orientation wanders 61°, the chest 54°, the
  head only 32°: the head counters the trunk to keep looking ahead. It turns up to 36° from the
  chest when it does look about.

### Walking (`walk`)

A slow, thoughtful walk, not a brisk one:

- **Pace:** 0.98 steps a second (59 a minute), 0.156 h a step, 0.153 h a second. (A brisk walk is
  about 1.8 steps a second and 0.4 h a step: double both for a normal walk.)
- **Feet:** each foot is down 67–70% of the cycle, so both are down 37% of the time. A swinging
  foot clears the floor by 0.11 h at most.
- **Hip:** lowest 15% of a step after a foot lands (taking the weight), highest at 52% (passing over
  the planted foot). It rises and falls by only 0.009 h (1.5 cm on a 1.8 m person): the slower the
  walk, the flatter.
- **Legs:** the thigh swings from 5° behind straight down to 30° in front.
- **Arms** hang loose and swing little: 25° on one side, 13° on the other. The arms in this walk are
  loose, not driven.
- **Trunk:** the pelvis turns 19° about the vertical over a stride and rolls 11° side to side; the
  chest turns 17°. The head pitches 10° over a stride against the chest's 9° and the hips' 4°.

### Running (`gun-run`)

- **Pace:** 3.16 steps a second (190 a minute), 0.39 h a step, 1.24 h a second (2.2 m/s at 1.8 m).
- **Flight:** each foot is down only 26–36% of the cycle, so 38% of it has no foot on the ground.
- **Hip:** held low, a crouched run, at 0.33–0.36 h against 0.41 standing (15–20% lower). It bobs
  0.031 h (5.6 cm at 1.8 m), more than three times the walk's: lowest 26% of a step after landing
  (the leg soaking up the landing), highest at 79% (in flight).
- **Legs:** the thigh swings from 8° behind to 55° in front, 62° in all, against the walk's 25–35°.
- **Arms** hold the rifle: the right upper arm stays 43–49° forward, the left 9–17°. They don't
  swing, so the trunk takes the stride: the pelvis turns only 4°, the chest 10° and rolls 7°.
- **The head is held still:** 4° of pitch over a stride, while it leans 33° back from the chest to
  keep looking ahead over a body pitched forward.

### Setting off and stopping

- **Anticipation before setting off** (`gun-run-start`): after a 1.45 s hold the hip drops 6% of his
  height over 0.4 s, and the drop starts 0.2 s before he moves at all. Full speed comes 0.68 s after
  he starts moving.
- **Stopping** (`gun-run-stop`) takes three strides and 1.2 s from full run to still. The hip goes
  lowest (0.30 h, 8% under the run) on the last braking step, at 1.1 s, then rises to the ready
  stance in 0.3 s, overshoots it by 0.5% of height and settles back over the next 0.5 s. Turning
  speed through the body falls from over 3000°/s to under 50°/s in 0.5 s: a quick stop of the big
  parts with a slower settle of the small.
- **Turning on the spot** (`gun-turn-right`, 90° in 0.42 s; `crouch-turn-left`, 180° in 0.68 s): a
  dip of the hip (3% of height) just before the turn, the turn itself fastest a little before
  half-way (40–44%), then 0.5 s to settle. The crouched turn rises 0.04 h to pivot and sinks back.

### Actions

- **Shooting** (`gun-shoot`): the brace drops the hip 6% of his height in 0.3 s and holds it. Each
  shot is a 0.25 s move whose fastest moment comes 20–27% of the way in: a sharp kick, then a
  slower recovery. Shots are 0.6 s apart. Rising back takes 0.85 s, overshooting the stance by 0.5%
  of height. The head stays down at the sights, 43° from the chest.
- **Reloading in cover** (`cover-reload`): three moves of 0.5–1.2 s, fastest a third of the way in
  (31–48%). The head turns a lot more than the body (it wanders 41° against the hips' 14°): checking
  around while the hands work.
- **Talking seated** (`sit-talk`): gestures are short, 0.48 s (median), fastest a third of the way
  in (35%): accents hit early and fade.
- **Thrown by a blast** (`blast-fall`): the hit lands 0.7 s in; the hip falls 0.25 h in 0.4 s and is
  flat on the ground by 1.1 s. Movement fades out over the next 0.6–0.9 s, the limbs settling after
  the trunk has stopped (follow-through).

### Patterns to keep

- **Ease.** Shifts of weight and posture ease in and out evenly (fastest at the middle). Effort and
  impact (a shot, a gesture's accent, a hit) are fast in and slow out: fastest at 20–35%. Nothing
  starts or stops at full speed.
- **Anticipation** is small and short: a dip of 3–6% of height, starting 0.1–0.2 s before the move.
- **Follow-through** is a small overshoot (about 0.5% of height on the hip) and a settle two to three
  times as long as the move's last part; the hands and head settle after the trunk.
- **Holds** in an idle last 1.5–3.5 s, with the slow drift going on underneath.
- **The head is the steadiest part** of every clip: it counters the trunk to keep the eyes level and
  looking ahead, in the idle, the walk and the run alike.
- **Durations:** a weight shift about 1 s; a gesture 0.3–0.5 s; a shot 0.25 s; a quarter turn 0.4 s,
  a half turn 0.7 s; reaching full run 0.7 s; stopping from a run 1.2 s.
- **Blends** (above): short where the player is waiting on him (setting off, a hit), longer where
  weight has to come to rest (stopping, settling, sitting), and foot for foot between strides.

## Licence

The owner confirmed on 2026-11-16 that the converted clips can go in this public repository (the
game isn't sold for profit), so `public/models/anims/` (the 13 clip GLBs and `clips.json`) is
committed. The raw downloads stay out: `new work/` is git-ignored.

Their unpacked copies (`models-wip/anims/raw/`) are excluded locally with the rest of
`models-wip/`, and must stay out too. The code (`scripts/blender/convert_clips.py`,
`src/game/render/clipLibrary.ts`) and this document hold no ActorCore content and can be
committed. Note that `vite.config.ts` precaches every `.glb` and `.json` under `public/`, so once
the clips are in, the offline app downloads all 1.5 MB of them.
