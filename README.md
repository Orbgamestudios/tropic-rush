# My PWA Game

A mobile web game built with **Phaser 4 + TypeScript + Vite**, installable on iPhone from Safari
(Share → Add to Home Screen), working offline, and hosted on **Cloudflare**.

The included "Tap Rush" demo is just a placeholder that proves the whole pipeline works.
Replace it with your game.

## First-time setup

1. Install [Node.js](https://nodejs.org) 22 or newer.
2. In this folder: `npm install`
3. `npm run dev`, then open http://localhost:5173

Recommended editor: [VS Code](https://code.visualstudio.com). It will offer to install the
recommended extensions (Biome, Vitest, Playwright), which format on save and run tests inline.

## Commands

| Command                 | What it does                                                                    |
| ----------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`           | Dev server with hot reload on your computer                                     |
| `npm run phone`         | Play on your iPhone: dev server + HTTPS tunnel + a QR code to scan              |
| `npm run phone:preview` | Same, using the production build with the service worker (test install/offline) |
| `npm run check`         | Typecheck + lint + unit tests (run before every commit)                         |
| `npm run fix`           | Auto-format and fix lint issues                                                 |
| `npm run e2e`           | Browser tests on the production build in an emulated iPhone                     |
| `npm run cf:dev`        | Run the build locally in Cloudflare's runtime                                   |
| `npm run deploy`        | Build and deploy to Cloudflare                                                  |

## Testing on your iPhone

`npm run phone` prints a QR code. Point the iPhone camera at it and the game opens in Safari.
Saving a file on your computer reloads it on the phone instantly. It works on any network
(Wi-Fi or cellular) because it goes through a free Cloudflare quick tunnel. No account is needed.

- **The tunnel URL changes every run**, so don't add that one to your Home Screen. Install from
  your deployed Cloudflare URL instead.
- **Debugging on the phone:** open the game with `?debug` on the end of the URL to get an on-screen
  console (it stays on, even in the installed app; `?debug=0` turns it off).
- **With a Mac:** on the iPhone, Settings → Apps → Safari → Advanced → Web Inspector. Plug it in,
  then use Safari's Develop menu on the Mac for full devtools.

## Deploying to Cloudflare

**Option A: automatic (recommended).** Push this project to GitHub, then in the Cloudflare
dashboard go to _Workers & Pages → Create → Import a repository_ and pick it. Use build command
`npm run build` and deploy command `npx wrangler deploy`. Every push to `main` deploys, and
other branches can get their own preview URLs.

**Option B: from your computer.** Run `npx wrangler login` once, then `npm run deploy`.
It prints your game's URL (`https://my-pwa-game.<you>.workers.dev`); add a custom domain in the
dashboard whenever you like.

Then on the iPhone: open the URL in Safari → Share → **Add to Home Screen**. When you deploy a
new version, the installed game shows a "New version available" button. It never reloads mid-game.

## Project layout

```
src/
  main.ts              entry point
  pwa.ts               service worker registration + update button
  debug.ts             ?debug on-screen console
  game/
    config.ts          Phaser config (720x1280 portrait design size, EXPAND scaling)
    scenes/            TitleScene, PlayScene
    logic/             pure game rules, no Phaser, unit tested
    save.ts            localStorage save data
public/
  icon.svg             source for every app icon (generated at build time)
  _headers             Cloudflare caching rules
e2e/                   Playwright tests (boot, installability, offline)
scripts/phone.mjs      the `npm run phone` script
wrangler.jsonc         Cloudflare deployment config
```

Keep game rules in `src/game/logic/` as plain functions and test them with Vitest. Scenes should
mostly wire input and rendering to those functions.

## Renaming the game

Search for `My PWA Game`, `My Game` and `my-pwa-game` in `vite.config.ts`, `index.html`,
`wrangler.jsonc`, `package.json` and `src/game/save.ts`. Replace `public/icon.svg` with your icon.

## iPhone things to know

- iOS ignores the manifest's `orientation`, so design for portrait and let EXPAND scaling
  handle the rest. The canvas stays inside the safe area (notch, Dynamic Island, home bar).
- Sound can only start after the first tap. Phaser unlocks audio automatically on that tap.
- There's no vibration API on iOS Safari.
- The installed Home Screen app has its own storage, separate from Safari tabs.
