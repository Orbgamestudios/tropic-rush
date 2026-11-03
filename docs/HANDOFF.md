# Handoff

Where the work stands, for a Claude picking this up on another computer. Written 2026-11-02. Update
or delete this note as things change. This repo is public, so keep anything private out of it.

Read `CLAUDE.md` first, then `docs/DESIGN.md` before any gameplay or art work.

## Waiting on the owner

- **iPhone feedback:** nothing below has been tried on a real iPhone. Ask about game speed, sound,
  haptics, the notch, the location card, how dark nights are, and battery.
- **Hero unlock spacing:** a hero joins every three HQ levels: Heavy 3, Medic 6, Grenadier 9,
  Bazooka 12, Engineer 15, Tank 18. The owner asked for "every few", and the spacing was Claude's
  choice. It's a stand-in until the game has a story arc.
- **Building sizes:** the owner said "mines and refinery 4x4". The refinery is still a Proposed
  building, and "mines" was read as all the producers, so confirm both if they come up.
- **Tides:** the two-week abilities in `docs/HERO_TREES.md` aren't built.
- **Balance:** tree prices, checkpoint sizes, the watchtower's numbers and blueprint odds are first
  passes. So are the second batch's: production, what the headquarters asks for, the sprint, and
  the chip each building takes off the headquarters.
- **Music:** the scouting, raid and victory tracks are made by a script, and Claude can only
  measure them, not hear them. Ask how they sound. To change one, edit `scripts/make-music.mjs`,
  run it, and copy any new loop length it prints into `LOOPS` in `src/game/audio/music.ts`. Keep them
  at 112 kbps or more: below that the encoder quietly drops to 32 kHz.

## Last finished

Everything in "Added 2026-11-02" in `docs/DESIGN.md`: hero trees and checkpoints, crystals, shaped
enemy islands with volcanoes and cliffs, player islands and rival raids, night loot, blueprints,
HQ-only storage, raid notifications, statues, sniper watchtowers, scouting and readying up as a
team, and accounts that stay apart.

After that: all six heroes on foot have real TRELLIS.2 models with skeletons, moved by one animator,
a shared grass pattern, one island gold, crew-shared upgrades, heroes tied to the headquarters,
account switching, 15% weaker starting heroes, and the cleaned-up map tags.

Then a real Tank model, and the second batch in "Added 2026-11-02, second batch" in
`docs/DESIGN.md`: sprint, firing from the gunboat, taking a whole base, headquarters requirements,
crystal trades, dearer checkpoints, splotchy clouds, a new crosshair, a new run, and new music.

For battery, screens nobody's touching run at 30 frames, shadows redraw less often, nothing draws
behind the tree screen, the picture starts a little softer, and there are fewer clouds.

## Not checked yet

- Battery use hasn't been measured on a phone. One frame costs about 125,000 triangles in a raid
  and 430,000 on the crew island, whose forest is the heavy part.
- Team-up, rival raids, account switching and shared upgrades were run on `npx wrangler dev` with
  two pages, not on the live site.
- Hero animation has only been seen in a desktop browser, so check it on a phone. The running and
  aiming poses were looked at on the Rifleman and Heavy, but the others only standing.
- 15% weaker heroes were tried on a bot, not by a person: a bot that dodges mortars wins 16 of 24
  first islands with about 19% health left.
- Gold from before there was one pool sits in the save and moves onto the island as it finds room.
- Rival crews stand in until real ones are in the directory, so a live world starts mostly with
  stand-ins.
- An account that already picked up another account's progress keeps it: only "Reset game" clears
  that. New logins and logouts can't mix them any more.
- "Use my location" has never run with a real location. The card was only shown, and "Not now"
  tapped.
- No screenshot has shown the moon in the sky dome. The cameras rarely see above the horizon: only
  the back view with the tilt set low does.
- Night lighting hasn't been seen on a dense base: the busiest one checked was an early island.

## Known small gaps

- A drag on the world map can't start in the notch strip, because the map's touch area is inside
  the safe area.
- The world map has lamps for 70 islands at most, so a very large world leaves some unlit.
- From iOS 26.5, only a real finger can trigger haptics, so buttons buzz but explosions don't. That's
  Apple's limit, not a bug (`audio/haptics.ts`).
- At the owner's request new-moon nights are very dark. If that hurts play, `DARKEST` in
  `render/sky.ts` is the number to raise.

## Standing direction

With nothing else asked for, the owner wants quality-of-life work and optimization that doesn't
cost quality. Battery matters: keep Lambert materials, baked models and few draw calls.

## How the owner works

- They send requests in batches, often while work is underway, and test on their iPhone through
  the live site. Fit each new message into the running work.
- They say "push" when they want a push. Don't push or commit without being asked: the repo's `main`
  deploys to the live site. Install whatever tools you need without asking.
- They care about what the game does, so report in plain words, not code.
- Respect Decided, Proposed and Open in `docs/DESIGN.md`, and ask before building on Proposed items.
- The owner's pronouns aren't known, so use they/them. The Medic is "she" by design.

## Rules that are easy to break

- Never commit `.claude/`, `docs/ui-preview*.jpg`, `models-wip/` or `my-pwa-game.zip`.
- Never create accounts on the live site. Use test accounts on localhost only, generated by the
  test script, and don't repeat their passwords in chat.
- The player's location stays on the phone: never put it in a URL, the synced save or a request.
- Only CC0 audio goes in `public/audio/`, listed in `CREDITS.md`. One gunshot pack was dropped
  because its zip said CC-BY although its page said CC0.
- Run `npm run check` before every commit.

## Making hero models

TRELLIS.2 needs about 24 GB of graphics memory, so it can't run on the owner's computer. Use the
hosted `Upsampler/trellis-2` Space, which asks for only 45 seconds of GPU a run. Anonymous use stops
after a run or so a day. Signed in on huggingface.co, the Space page's own `zerogpu-headers` message
gives headers that count against the owner's free allowance: that's how the five latest were made.
Never buy anything there.

Save the output in `models-wip/`, which is never committed, then add the joints to
`scripts/rig-hero.mjs` and run `node scripts/rig-hero.mjs <hero>`. Joints are shares of the model's
height: measure them, because TRELLIS leaves each body at a different offset. Rig from T-poses: a
model with lowered arms bends badly. The script writes a light copy for raids and a detailed one for
the hero screen. Their hands are large in the art, so the game scales them down and curls the fingers.

The Tank goes through the same script but lists a height and a middle instead of joints, so it comes
out as one solid piece with no skeleton. Its turret doesn't turn on its own.

Raid copies are made in four steps, because TRELLIS textures are many small patches and their seams
stop a simplifier well short of its target: weld the seams, simplify, unwrap afresh with xatlas, then
bake a new texture from the full model at twice the size and scale it down. Never use the
simplifier's `Permissive` flag without that bake: collapsing across seams smears the old texture all
over the hero. The head is simplified apart from the body, to 7,000 triangles against the body's
8,000, and unwrapped 1.7 times too big so it gets more of the texture. With one shared budget the
face flattens and the eyes smear. The Tank has no head, and gets 14,000.

Raid copies also carry a 512 normal map, baked from the full model the same way as the color. That's
what stops them looking low-poly: at 5,000 triangles round glasses came out octagonal and hair and
cheeks showed flat facets, and no amount of texture hides that. It's baked in the same frame
three.js builds in its shader for a mesh with no tangents, so no tangents are stored, and
`MeshLambertMaterial` takes a normal map with no trouble. At 16,000 triangles with its weapon a hero
is about 15% of what a raid draws: the player looks at them more than anything else, so that's
money well spent.

The source models top out at about 57,000 triangles and a 1024 texture, which the hero screen copy
now uses in full. Going further means generating them again at a higher texture size.

A head turns as one piece. Nothing above the neck can go with the chest, and bone weights stop
blending a little over the neck, or the chin stays behind and the face warps as the head turns.

How a hero holds something is a `Grip` in `heroAnimator.ts`: where the palm goes, the way the hand
reaches it, and the way the palm faces, all in the weapon's own axes. Heroes' arms are short and all
different, so a weapon that's held out too far pulls in until both hands reach it. Weapons are built
in `heroModels.ts` and baked into one mesh. `tropicRush.heroLook(distance, height)` puts the camera
right up to the hero on the pedestal, `tropicRush.heroRaidCopy(true)` puts the raid copy there
instead, `tropicRush.raidAs(kind)` starts a raid with anyone, Medic included, and
`tropicRush.snapshot()` renders a frame and hands it back as an image. `tropicRush.heroCost(kind)`
says what a hero takes to draw.

Nothing waits on a model. A hero screen shows the best copy that's arrived and swaps the detailed
one in when it lands, and a raid that starts before the light copies arrive uses block figures. Keep
those working: `human()` in `heroModels.ts` only runs on a slow connection, and a browser test
loads the game with every model blocked to make sure it still does.

## Puzzle islands

`logic/puzzles.ts` holds about thirty layouts, made from a dozen shapes (`SHAPES`) each filled with
different defenses, each a list of spots in meters from the headquarters, forward towards the beach
and across. `fill` picks how many to put down, to match an ordinary base's firepower. `enemyBase.ts` lays them right after the headquarters, a tile apart
rather than the rings' two, and moves anything the island has no ground for to the nearest spot that
fits. `puzzles.test.ts` checks how often they come up, their firepower, and that each mostly stands
where it was drawn. To see one, `tropicRush.visit(seed, hq)` scouts any island, and `puzzleFor` says
which seeds are puzzles.

Each shape lists the kinds of island it suits (`SUITS`), and each layout the headquarters levels it
turns up at (`from` and `to`). Both came from measuring: how much of each layout held its shape on
each kind of island, and where its firepower stayed between 0.85 and 1.4 of an ordinary base's. If
a layout's `from` level comes before any island kind it suits, it never turns up, so check both
together. Changing what a defense is worth (`WORTH`, or a defense's stats) moves those ranges:
`puzzles.test.ts` says which.

A plain bot with no upgrades can't tell much above headquarters 4, ordinary island or puzzle. It did
show one outlier: it fights from 12 m, just outside a flamethrower's reach, so it cleared a bare flame
gauntlet. That's why the gauntlet has mortars and guns behind it now.

## One-off changes to old islands

`LAYOUT_VERSION` in `crewIsland.ts` says which one-off changes an island has had: `sanitizeLayout`
makes any it hasn't, once, and the server runs the same code, so every phone agrees. Version 1 moved
gun turrets from 10 levels to 30. Hero upgrades from older trees are given back on every load
that finds one, which is once: the island's gold goes into `owed`, paid into the stock as there's
room, and the player's crystals back into their save. `oldTrees.ts` keeps what the old upgrades
cost for that: the two-path trees (ids `kind-name`) as a table, and the four-branch trees (ids
`kind:name`) as the names on each branch, priced by tier. Today's ids are `kind/name`, and a
checkpoint is named for its stretch, such as `rifleman/assault-1`.

## Building models

Buildings are modeled in Blender by script, with no window: install the portable build anywhere (it
was put in `%LOCALAPPDATA%\Programs\blender` here) and run

    blender -b -P scripts/blender/make_buildings.py -- gunTurret --sheet
    node scripts/pack-buildings.mjs gunTurret

The first writes `models-wip/buildings/` (never committed): one file holding all ten looks, nodes
`s1` to `s10`, the two texture atlases, and with `--sheet` a picture of all ten side by side, which
is the quickest way to judge a change. The second squeezes the model into `public/models/kit/`
and the atlases into `public/textures/`. `tropicRush.stagePictures(type)` draws every look in the
game's own lighting.

`scripts/blender/kit.py` holds the parts every building is made of: boxes, cylinders, beams, plank
walls, sandbags and rivets, each cut out of one square of a shared texture atlas named for its
material. Paint squares come out in raiders' rust or crew blue in a second copy of the atlas, which is
all that tells the sides apart. Light is baked into each corner by rays cast round it, so the game
draws a look with one Lambert material.

Three things learned the hard way. Bevelling a box in bmesh rebuilds its faces, so texture them after
the bevel or their big faces read from an empty corner of the atlas. A bevelled box shades each corner
as the side it belongs to, so the box shares its vertices: shading each face apart cost four times the
vertices, and the file twice the size. And a part that moves (a head, the guns, a radar dish) is an
empty at its pivot holding the mesh, because packing moves a mesh's own origin to suit the
compression. Empty leaves, such as the `muzzle` points, survive packing only with
`prune({ keepLeaves: true })`.

The game looks a building up in `render/buildingKit.ts`, and falls back to the old model built from
primitives in `models.ts` until the file arrives or for buildings not modeled yet. The world map
bakes its tiny buildings into its islands, so it asks for the plain ones (`buildingModel(..., plain)`). The gunboat and its
shells are `MODELS` in the Blender script rather than `BUILDINGS`: one look each, in crew paint, in
`gunboat.glb` (about 60 KB). Scenery built before the files arrive, the home island's boat and the
map's, swaps the model in when they land (`GunboatScenery`). The gun turret's
file is about 250 KB for all ten looks, 1,100 to 2,900 triangles each, the mortar's 190 KB, the
harpoon launcher's 270 KB and the headquarters' 250 KB. The defenses lost their sandbags, which
were the dear part. They're drawn 15% bigger with `grow()`, which scales every part, its pivot
and its points before the light is baked, and then gets the ground pad added at its usual size.
`--crew` with `--sheet` draws the crew's blue instead of the raiders' red. A part can be tilted on its pivot (`Group(..., tilt=...)`): it's drawn as
if it weren't and the tilt stands it up, which is how the mortar's tube kicks back along itself.

## Baked art

`node scripts/make-clouds.mjs` bakes the world map's cloud tile into `public/textures`. Its red
channel is thickness and its green is light, so `mapClouds.ts` only has to look it up. It's balls of
cloud stacked on balls, lit as real shapes, because noise never read as puffy. The tile spans 118
map units: at 170 the owner found the puffs too big, and past that they blur into a white sheet. How
soft and wandering the edge is comes from the `alpha` band and the `flow` sample in the shader, and
how far the band reaches comes from how wide the mask is blurred.

## The picture and battery

Everything draws straight to the screen with the browser's own antialiasing. So the screen holds
finished color, not light. Anything that blends onto it has to think in those terms: a lamp's pool
in `lightPool.ts` takes its strength to the power of 1/2.2 for that reason, or it goes neon. There's no bloom and no
pass over the finished picture, because each of those is a whole screen of extra work on every
frame. So a custom shader finishes its own color with `#include <tonemapping_fragment>` and
`#include <colorspace_fragment>`, or it comes out too dark. The vignette is a page element, and the
touch of extra color is part of tone mapping, in `stage.ts`.

Anything lying on the ground has to allow for the terrain mesh being coarser than `height()`, or
hills poke through it. Use `laidOnGround()` from `shapes.ts`: the ground draws first of all, and this
draws next, ignoring depth, so the ground can't cut it and whatever stands on it still covers it.
That order costs an iPhone nothing, as its GPU drops hidden pixels whatever order they arrive in.
Danger circles stay plain `depthTest: false` instead, because they must show over trees and walls.

The sea on the world map leaves no depth, so it can't hide the edge of the land, and a map island's
mesh is the coast. `addLand` cuts its cells along the shoreline for that reason.

Quality steps down during fights if frames stay under 27 a second, and never comes back up. That
limit sits under 30 on purpose: Low Power Mode holds an iPhone to exactly 30, which is no reason to
spoil the picture. The hero screen, tree and map have little to draw and aren't affected: they stay
at 2× sharpness and get their savings from running at 30 frames when nobody's touching them.

## Testing tips

- Software browsers run at a few frames a second, so the full browser test run takes about 16
  minutes. Use `page.waitForFunction` with `polling: 1000`.
- `?testhooks` adds `window.tropicRush`. `?fullquality` stops quality dropping during screenshots.
- `tropicRush.sky(hour, place, date)` shows any time and day, such as a new moon. `hour` is local
  time, and `place` is `{ lat, lon }`. Pass `null` to go back to the clock.
- `tropicRush.syncNow(changes)` changes the save, which is how a test unlocks a hero.
- `tropicRush.heroShot()` has the hero on the pedestal fire or throw once.
- `tropicRush.heroPose(move)` has the hero on the pedestal run, aim or fall, close up. Hide
  `.screen-heroes` to see them properly.
- `tropicRush.visit(seed, hq)` scouts any island, `findStatue(kind)` brings a statue to light,
  `crewLook(x, y, distance)` points the home camera, and `win()` ends a raid in victory.
- Two pages on one crew need different origins, or they'd share a save: use `localhost:8787` and
  `127.0.0.1:8787`. Crew codes have no I, L, O, 0 or 1.
- Node tools on a computer running Avast need `NODE_USE_SYSTEM_CA=1`.
- Frame timing needs `gl.readPixels` to force the frame to finish: `requestAnimationFrame` alone
  gives bogus numbers.
- `npx wrangler dev` rebuilds when `src/` changes, so don't edit `src/` during a test run against it.
- To test raiding together, run `npx wrangler dev` and open two browser pages. Put both in one crew
  with `tropicRush.joinCrew(code, name, id)`, and move a hero with `tropicRush.holdMove(x, y)`.
- WebKit has failed once with "Target page closed" and passed on a rerun, so rerun that before
  chasing it. Anything else that fails is worth reading.
