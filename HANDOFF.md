# Handoff from the cloud session

Notes from the Claude Code cloud session that set this project up. Project conventions live in
`CLAUDE.md`; this file is only the starting state. Delete it once the first steps are done.

## The owner and the goal

- Building a mobile game as a PWA for iPhone, hosted on Cloudflare. Works on Linux, tests on an
  iPhone, and sometimes drives Claude from the Claude iPhone app.
- Wants the workspace saved on their own machine and the game hosted on Cloudflare.
- **Phaser 4 was my default; they never explicitly chose it.** Confirm it fits their game before
  building much on it. The "Tap Rush" demo is a placeholder that exists to prove the pipeline.
- The game has no name yet: "My PWA Game" / `my-pwa-game` are placeholders (README → Renaming).

## Current state

Stack: Phaser 4.2, TypeScript 7 (native `tsc`), Vite 8 (Rolldown), vite-plugin-pwa 2 with
generated icons, Vitest 5, Biome 2, Playwright 1.63, Wrangler 4 (Workers static assets).

Verified in the cloud session:

- `npm run check` (typecheck, lint, 8 unit tests) and `npm run build` pass.
- `npx playwright test --project=iphone-chromium`: 3/3 pass (boots, installable manifest, works offline).
- A full round played in an emulated iPhone 15 (Chromium): title → play → scoring → round end →
  best score saved and shown.
- `npm run cf:dev`: `/assets/*` gets immutable caching, `sw.js` gets `max-age=0, must-revalidate`,
  `_headers` isn't served, unknown paths fall back to `index.html`.

Never run yet:

- `npm run phone` / `phone:preview`: the cloud blocks public tunnels, so only the parts before the
  tunnel were checked (imports, dev server start, QR rendering).
- The `iphone-webkit` Playwright project (WebKit wasn't installed); CI runs only `iphone-chromium`
  for that reason.
- A real Cloudflare deploy, a real iPhone install, and the GitHub Actions workflow (no remote yet).

Done on the owner's machine (2026-10-29, ChromeOS Linux / Debian 12):

- Steps 1 and 3 below. Node 22 comes from nvm in `~/.config/nvm`, loaded from `~/.profile` so
  non-interactive shells find it too. `npm run check`, `npm run build` and `npm run e2e` pass,
  with all 6 tests (`iphone-chromium` and `iphone-webkit`), and CI now runs both projects.
- The offline e2e test now shuts down a server it starts itself instead of using
  `context.setOffline()`. In Playwright's WebKit, offline emulation and request routing both
  block page loads that the service worker would serve from cache. With the server really
  stopped, WebKit loads the game from the cache fine.
- Step 2: `npm run phone` and `npm run phone:preview` both work. The owner confirmed on their
  iPhone that the game loads and plays, installs to the Home Screen, and opens and plays in
  airplane mode.
- Step 4: public repo https://github.com/Orbgamestudios/tropic-rush; its first CI run passed.
  Commits here use the repo-local identity `Orbgamestudios <284842900+Orbgamestudios@users.noreply.github.com>`.
- Step 5: live at https://tropic-rush.solitary-sky-76c1.workers.dev, deployed on every push to
  `main`. The Worker is renamed to `tropic-rush` to match the repo. The first Cloudflare build ran
  no build command, so `wrangler deploy` failed on a missing `dist/`; `wrangler.jsonc` now has
  `build.command`, so the deploy command builds the game itself. Checked live: same build as
  local, caching headers as intended, boots without errors (Chromium, WebKit), works offline.
- Step 6 in progress: the game design (co-op island raids, 7 heroes, art direction) is in
  `docs/DESIGN.md` with concept art in `docs/concept/`. The engine switch (Phaser to Three.js)
  and screen orientation are still open there; no game code has been written yet.

## First steps

1. `npm install` (Node 22+, see `.nvmrc`), then `npm run check`.
2. `npm run phone`; have the owner scan the QR code with their iPhone and confirm the game loads
   and hot reload works. Then `npm run phone:preview` and check Add to Home Screen and that it
   still opens in airplane mode.
3. `npx playwright install --with-deps chromium webkit` (system libraries need sudo), then
   `npm run e2e`. If `iphone-webkit` passes, add it to `.github/workflows/ci.yml`.
4. Help the owner create a GitHub repository and push `main`.
5. Cloudflare: `npx wrangler login` then `npm run deploy`, or connect the GitHub repository in the
   dashboard (Workers & Pages → Create → Import a repository; build `npm run build`, deploy
   `npx wrangler deploy`). Give the owner the workers.dev URL to install on their iPhone.
6. Ask what game they actually want to make, confirm the engine, pick a name, replace the demo.

## Gotchas

- `npm audit` reports 4 low-severity advisories (deepmerge via workbox-build, build-time only).
  Don't run `npm audit fix --force`: it "fixes" them by downgrading vite-plugin-pwa to 0.2.1.
- Vite 8 uses Rolldown: chunk splitting is `build.rolldownOptions.output.codeSplitting`, not
  `rollupOptions.manualChunks`.
- The quick-tunnel URL changes every run, so a Home Screen install from it won't last; install
  from the Cloudflare URL.
