# CLAUDE.md

Tropic Rush: a co-op island-raid game for iPhone. Three.js + TypeScript (strict) + Vite 8, shipped
as a landscape PWA via vite-plugin-pwa, hosted on Cloudflare Workers static assets
(`wrangler.jsonc`).

Live at https://tropic-rush.solitary-sky-76c1.workers.dev. The GitHub repo
(Orbgamestudios/tropic-rush) is connected in the Cloudflare dashboard, so every push to `main`
deploys (deploy command `npx wrangler deploy`, which builds first). Cloudflare doesn't post build
results to GitHub; check the live site or ask the owner for the build log.

The game's design is in `docs/DESIGN.md`, with concept art in `docs/concept/`. Read it before
gameplay or art work, and respect its Decided / Proposed / Open labels: confirm Proposed items with
the owner before building on them. Gemini prompts for every model are in `docs/ASSET_PROMPTS.md`.

The code is a playable draft of the solo raid. Every model is a placeholder built from primitives
at the design doc's real sizes, waiting for GLB models from the art pipeline.

## Commands

- `npm run check`: typecheck + Biome lint + Vitest. Run before every commit.
- `npm run fix`: Biome format and autofix.
- `npm run build`: production build into `dist/` (also generates icons and `sw.js`).
- `npm run e2e`: Playwright tests against the production build (`e2e/`), landscape iPhone.
- `npm run phone`: dev server + Cloudflare quick tunnel + QR code for testing on a real iPhone.
- `npm run deploy`: build + `wrangler deploy`.

## Code layout

- `src/game/logic/`: the rules, with no Three.js or DOM imports. Each file has a colocated
  `*.test.ts`. `raid.ts` is the raid simulation and updates its state in place for speed; it is
  meant to move to a Durable Object server for multiplayer later.
  - `island.ts`: the one island every crew and raid uses: coastline (a rounded diamond with a
    south-west landing beach), terrain height (`terrainHeight` for raids, `homeHeight` for the
    crew's flatter build ground) and the seeded raid layout generator.
  - `buildings.ts`: building stats and the HQ-level table.
  - `heroes.ts`: hero stats.
  - `gunboat.ts`: gunboat abilities and energy costs.
  - `squad.ts`: the AI squadmates' input (heroes 1 and up when raiding without friends).
- `src/game/render/`: Three.js. It draws the state and never changes it.
  - `raidView.ts` mirrors a raid into the scene and turns events into effects.
  - `models.ts` holds the placeholder building models; `heroModels.ts` the hero models (swap
    these for GLBs).
  - `scenery.ts` maps the trail, the base's clearing and the jungle; `terrain.ts` (ground and
    shader sea) and `props.ts` (instanced, wind-swayed plants in culled chunks) use it.
  - `cameraRig.ts` is the MOBA follow camera, the gunboat view and the menu orbit.
- `src/game/ui/`: HTML HUD, menus and floating health bars.
- `src/game/controls.ts`: touch sticks, mouse and keyboard turned into `HeroInput`.
- `src/game/Game.ts`: wires controls → rules (fixed 60 Hz steps) → view.
- Crew island (real-time building with up to 5 crewmates):
  - `src/game/logic/crewIsland.ts`: the tile grid, the place/move/remove rules, and the
    overgrowth (obstacles cleared with tools that come with HQ levels).
    `render/overgrowth.ts` draws it.
  - `src/game/net/`: the message protocol and the phone's reconnecting client.
  - `worker/index.ts`: the Cloudflare Worker, with one `CrewIsland` Durable Object per crew code.
    It checks every change with the same `crewIsland.ts` rules and sends the whole layout to
    everyone.
  - `src/game/logic/economy.ts`: resources, costs, HQ-level limits and level caps, shared with
    the server.
  - `src/game/render/crewIslandView.ts`: the crew island, built from the same `terrain.ts`,
    `props.ts` and `clouds.ts` as a raid. `tileGrid.ts` is the grid shown while placing.
  - `src/game/crew/crewMode.ts`: touch handling and syncing.
- UI: every screen is HTML over the 3D view, styled in `src/styles/` and built from the kit in
  `src/game/ui/kit/`:
  - `dom.ts`: buttons, panels, plates, pills, stat bars, tiles.
  - `icons.ts`: the hand-drawn SVG icon set.
  - `fx.ts`: synthesized UI sounds and sparkles.

  The game opens on the crew island (no title screen). The screens are `heroSelect.ts` (with
  `render/showcase.ts`, the 3D pedestal), `hud.ts`, `pause.ts` (with settings), `results.ts` and
  `crewUi.ts`. `controlsEditor.ts` moves and sizes the sticks and Super.
  `render/aimCone.ts` draws the aim cone and lock-on crosshairs. `render/thumbnails.ts` renders hero
  portraits and building icons from the 3D models. `logic/heroProgress.ts` holds hero levels,
  unlocks and raid rewards.
- Real models live in `public/models/` (meshopt-compressed GLB; `render/heroAssets.ts` loads
  them). Raw TRELLIS outputs stay in the untracked `models-wip/`.
- To test the crew server locally, run `npx wrangler dev`. It builds, then serves the game and
  runs the Durable Object. `npm run dev` and `npm run phone` have no crew server, so the crew
  island falls back to offline mode there.

## Conventions

- World units are meters on the ground plane: x is east and y is south, towards the landing
  beach. The renderer maps logic (x, y) to Three.js (x, height, y). A hero is about 1.8 m tall.
- Models face +x; a facing angle `a` becomes `rotation.y = -a`.
- Save data goes through `src/game/save.ts`; bump the key's version suffix on breaking changes.
- New asset file types must match `workbox.globPatterns` in `vite.config.ts` or they won't work
  offline. `.glb` is already included.

## Cloud sessions

- The container starts without `node_modules`: run `npm ci` first.
- `npm run phone` (public tunnel) isn't available here. Check changes with `npm run check`,
  `npm run e2e` and Playwright screenshots at an iPhone landscape viewport, then push to GitHub;
  the owner tests on their iPhone through the deployed Cloudflare URL.
- Software-rendered test browsers manage only a few frames per second, so real-time play is in slow
  motion there. Open the game with `?testhooks` to get `window.tropicRush.{state, teleport,
  advance}` for screenshot scripts: place the hero and fast-forward the rules.

## iOS constraints

- Touch only: make hit areas generous, no hover states.
- Audio starts only after a user gesture; no Vibration API; no element fullscreen on iPhone.
- iOS ignores the manifest's orientation; a "turn your phone sideways" overlay covers portrait.
- Keep UI inside the safe area (already handled by `#game` in `src/style.css`).
