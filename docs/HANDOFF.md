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

Don't turn on the simplifier's `Permissive` flag to get raid models smaller. It reaches 5,000
triangles easily, but TRELLIS textures are many small patches, and collapsing across their seams
smears them into streaks all over the hero. The models that stop short of the target stop there
because of those seams.

How a hero holds something is a `Grip` in `heroAnimator.ts`: where the palm goes, the way the hand
reaches it, and the way the palm faces, all in the weapon's own axes. Heroes' arms are short and all
different, so a weapon that's held out too far pulls in until both hands reach it. Weapons are built
in `heroModels.ts` and baked into one mesh. `tropicRush.heroLook(distance, height)` puts the camera
right up to the hero on the pedestal, and `tropicRush.heroCost(kind)` says what they take to draw.

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
