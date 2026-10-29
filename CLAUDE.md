# CLAUDE.md

Mobile web game: Phaser 4 + TypeScript (strict) + Vite 8, shipped as an iPhone PWA via
vite-plugin-pwa, hosted on Cloudflare Workers static assets (`wrangler.jsonc`).

## Commands

- `npm run check`: typecheck + Biome lint + Vitest. Run before every commit.
- `npm run fix`: Biome format and autofix.
- `npm run build`: production build into `dist/` (also generates icons and `sw.js`).
- `npm run e2e`: Playwright tests against the production build (`e2e/`).
- `npm run phone`: dev server + Cloudflare quick tunnel + QR code for testing on a real iPhone.
- `npm run deploy`: build + `wrangler deploy`.

## Conventions

- Game rules live in `src/game/logic/` as pure functions with no Phaser imports, each with a
  colocated `*.test.ts`. Scenes in `src/game/scenes/` stay thin: input → logic → render.
- Coordinates are in the 720x1280 design space (`src/game/config.ts`, Scale.EXPAND); one axis
  grows to fit the device, so lay out from `this.scale.width/height` and handle the RESIZE event.
- Save data goes through `src/game/save.ts`; bump the key's version suffix on breaking changes.
- New asset file types must match `workbox.globPatterns` in `vite.config.ts` or they won't work offline.

## Cloud sessions

- The container starts without `node_modules`: run `npm ci` first.
- `npm run phone` (public tunnel) isn't available here. Check changes with `npm run check`,
  `npm run e2e` and Playwright screenshots at an iPhone viewport, then push to GitHub; the
  owner tests on their iPhone through the deployed Cloudflare URL.

## iOS constraints

- Touch only: make hit areas generous (`TOUCH_FORGIVENESS`), no hover states.
- Audio starts only after a user gesture; no Vibration API; no element fullscreen on iPhone.
- Keep UI inside the safe area (already handled by `#game` in `src/style.css`).
