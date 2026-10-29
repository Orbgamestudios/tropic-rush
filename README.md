# Tropic Rush

A co-op island-raid game for iPhone, built with **Three.js + TypeScript + Vite**. It installs from
Safari (Share → Add to Home Screen), works offline, and is hosted on **Cloudflare**.

This is a playable draft of a solo raid with placeholder models. The game's design is in
[docs/DESIGN.md](docs/DESIGN.md).

## First-time setup

1. Install [Node.js](https://nodejs.org) 22 or newer.
2. In this folder: `npm install`
3. `npm run dev`, then open http://localhost:5173

Recommended editor: [VS Code](https://code.visualstudio.com). It will offer to install the
recommended extensions (Biome, Vitest, Playwright), which format on save and run tests inline.

## How to play the draft

Hold the phone sideways. Pick a hero and an island, then destroy the enemy headquarters before
the timer runs out. There are no respawns.

| On a phone                                              | On a computer         | Does                         |
| ------------------------------------------------------- | --------------------- | ---------------------------- |
| Drag on the left half                                   | WASD or arrow keys    | Move                         |
| Drag on the right half                                  | Hold the mouse button | Aim and fire                 |
| Quick tap on the right half                             | Q                     | Fire at the nearest building |
| Super button (fills as you deal damage)                 | Space                 | Use your super               |
| "Board gunboat" (appears near the boat)                 | E                     | Board or leave the gunboat   |
| In the gunboat: pick an ability, tap the island to fire | 1, 2, 3 and click     | Artillery, Barrage, Heal     |

Destroying buildings earns gunboat energy (⚡). Each ability costs more every time you use it.

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
dashboard go to _Workers & Pages → Create → Import a repository_ and pick it. The deploy command
`npx wrangler deploy` is all it needs: it builds the game first (`build` in `wrangler.jsonc`), so
the build command can stay empty. Every push to `main` deploys, and other branches can get their
own preview URLs.

**Option B: from your computer.** Run `npx wrangler login` once, then `npm run deploy`.
It prints your game's URL (`https://tropic-rush.<you>.workers.dev`); add a custom domain in the
dashboard whenever you like.

Then on the iPhone: open the URL in Safari → Share → **Add to Home Screen**. When you deploy a
new version, the installed game shows a "New version available" button. It never reloads mid-game.

## Project layout

```
src/
  main.ts              entry point
  pwa.ts               service worker registration + update button
  debug.ts             ?debug on-screen console
  style.css            HUD, menus and joystick styles
  game/
    Game.ts            menus, raid loop, wiring
    controls.ts        touch sticks, mouse and keyboard
    save.ts            localStorage save data
    logic/             the rules (island, heroes, buildings, raid, gunboat), unit tested
    render/            Three.js: island, placeholder models, effects, camera
    ui/                HUD, menus, health bars
docs/
  DESIGN.md            the game design
  ASSET_PROMPTS.md     Gemini prompts for every model
  concept/             concept art and T-pose references
public/
  icon.svg             source for every app icon (generated at build time)
  _headers             Cloudflare caching rules
e2e/                   Playwright tests (boot, raid start, installability, offline)
scripts/phone.mjs      the `npm run phone` script
wrangler.jsonc         Cloudflare deployment config
```

Keep game rules in `src/game/logic/` as plain functions with no Three.js imports, and test them
with Vitest. The renderer only draws the rules' state.

## iPhone things to know

- iOS ignores the manifest's `orientation`, so the game shows a "turn your phone sideways" screen
  when held upright. The canvas stays inside the safe area (notch, Dynamic Island, home bar).
- Sound can only start after the first tap.
- There's no vibration API on iOS Safari.
- The installed Home Screen app has its own storage, separate from Safari tabs.
- On slower phones the game lowers its resolution, then its shadow detail, to keep frames smooth.
