// Hand-drawn SVG icons in the game's chunky style: bold dark outlines, glossy gradients and a
// highlight. Each call gets its own gradient ids, so icons can be shown, hidden and repeated
// freely without one copy's gradients breaking another's.

let serial = 0;

const OUTLINE = "#1a2232";

/** Linear gradient, top to bottom, with the given stops. */
const lg = (id: string, ...stops: string[]): string =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops
    .map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`)
    .join("")}</linearGradient>`;

const rg = (id: string, inner: string, outer: string): string =>
  `<radialGradient id="${id}" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="${inner}"/><stop offset="1" stop-color="${outer}"/></radialGradient>`;

type Draw = (id: (name: string) => string) => string;

const ICONS = {
  coin: (id) => `
    <defs>${rg(id("a"), "#fff3a8", "#f2b322")}${lg(id("b"), "#ffd84d", "#d9890f")}</defs>
    <ellipse cx="32" cy="35" rx="25" ry="25" fill="#a25d07" stroke="${OUTLINE}" stroke-width="3"/>
    <circle cx="32" cy="31" r="25" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3"/>
    <circle cx="32" cy="31" r="17.5" fill="url(#${id("b")})" stroke="#b9700b" stroke-width="2.5"/>
    <path d="M32 19l3.7 7.6 8.3 1.2-6 5.9 1.4 8.3L32 38l-7.4 4 1.4-8.3-6-5.9 8.3-1.2z" fill="#fff0a0" stroke="#c07a0c" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M14 22a20 20 0 0 1 14-10" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  timber: (id) => `
    <defs>${lg(id("a"), "#e7a35d", "#a8602a")}${lg(id("b"), "#f6d3a0", "#d79a5a")}</defs>
    <g stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round">
      <path d="M6 40l30-10 22 9-30 11z" fill="url(#${id("a")})"/>
      <path d="M6 40v9l22 10v-9z" fill="#8a4a1d"/><path d="M28 50v9l30-11v-9z" fill="#a85d27"/>
      <path d="M8 27l30-10 20 8-30 11z" fill="url(#${id("a")})"/>
      <path d="M8 27v8l20 9v-8z" fill="#8a4a1d"/><path d="M28 36v8l30-11v-8z" fill="#a85d27"/>
      <ellipse cx="17" cy="40" rx="4" ry="3" fill="url(#${id("b")})" stroke-width="2"/>
      <ellipse cx="45" cy="21" rx="4" ry="3" fill="url(#${id("b")})" stroke-width="2"/>
    </g>
    <path d="M14 26l20-7" stroke="#ffd9a8" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>`,
  stone: (id) => `
    <defs>${lg(id("a"), "#d9dee6", "#8a94a3")}${lg(id("b"), "#b7bfcb", "#6c7584")}</defs>
    <g stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round">
      <path d="M8 44l6-16 16-4 10 10-4 18-20 2z" fill="url(#${id("b")})"/>
      <path d="M28 28l10-14 16 2 6 16-8 14-16-2z" fill="url(#${id("a")})"/>
    </g>
    <path d="M38 18l12 1" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
    <path d="M14 32l10-3" stroke="#eef2f7" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>`,
  scrap: (id) => `
    <defs>${lg(id("a"), "#c9d3de", "#6b7787")}</defs>
    <path d="M32 6l5 6 8-2 2 8 8 3-2 8 6 5-6 5 2 8-8 3-2 8-8-2-5 6-5-6-8 2-2-8-8-3 2-8-6-5 6-5-2-8 8-3 2-8 8 2z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="32" cy="32" r="9" fill="#3c4656" stroke="${OUTLINE}" stroke-width="3"/>
    <path d="M18 20a18 18 0 0 1 10-6" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".75"/>`,
  medal: (id) => `
    <defs>${rg(id("a"), "#fff3a8", "#e8a11b")}</defs>
    <path d="M18 4h12l6 22H24z" fill="#2f6fd6" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M46 4H34l-6 22h12z" fill="#d6413a" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="32" cy="40" r="18" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3"/>
    <path d="M32 29l3.2 6.5 7.2 1-5.2 5.1 1.2 7.2-6.4-3.4-6.4 3.4 1.2-7.2-5.2-5.1 7.2-1z" fill="#fff6c2" stroke="#b9700b" stroke-width="1.5" stroke-linejoin="round"/>`,
  heart: (id) => `
    <defs>${lg(id("a"), "#8ef06a", "#2c9a2f")}</defs>
    <path d="M32 56S6 40 6 22c0-8 6-14 13-14 6 0 10 4 13 9 3-5 7-9 13-9 7 0 13 6 13 14 0 18-26 34-26 34z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M14 20c0-4 3-6 6-6" stroke="#eaffdc" stroke-width="4" stroke-linecap="round" fill="none"/>`,
  sword: (id) => `
    <defs>${lg(id("a"), "#f2f6fb", "#9aa7b8")}</defs>
    <g stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M52 6l6 0 0 6-28 28-6-6z" fill="url(#${id("a")})"/>
      <path d="M16 36l12 12-4 4-12-12z" fill="#e0a43a"/>
      <path d="M20 44l-12 12" stroke-width="7"/><path d="M20 44l-12 12" stroke="#8a4a1d" stroke-width="3"/>
    </g>
    <path d="M50 11L32 29" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  speed: (id) => `
    <defs>${lg(id("a"), "#9bf56f", "#2f9f33")}</defs>
    <g stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round">
      <path d="M30 14l22 18-22 18v-10H8V24h22z" fill="url(#${id("a")})"/>
    </g>
    <path d="M4 22h8M2 32h6M4 42h8" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round"/>
    <path d="M34 22l10 9" stroke="#eaffdc" stroke-width="3" stroke-linecap="round"/>`,
  range: (id) => `
    <defs>${lg(id("a"), "#ffcf7a", "#d77b18")}</defs>
    <g stroke="${OUTLINE}" stroke-width="3" fill="none" stroke-linecap="round">
      <path d="M14 8c26 6 40 20 42 42" stroke-width="7"/>
      <path d="M14 8c26 6 40 20 42 42" stroke="url(#${id("a")})" stroke-width="3.5"/>
      <path d="M14 8l42 42" stroke="#e9eef5" stroke-width="2"/>
      <path d="M8 52l40-40" stroke-width="3.5"/>
    </g>
    <path d="M48 12l8-6 0 10z" fill="#e0e6ee" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M6 54l6-2-4-4z" fill="#d6413a" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>`,
  shield: (id) => `
    <defs>${lg(id("a"), "#9fd4ff", "#1f6fe0")}${lg(id("b"), "#e6f4ff", "#7bbcff")}</defs>
    <path d="M32 4l22 8v16c0 14-9 25-22 32C19 53 10 42 10 28V12z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M32 11l15 5.5V28c0 10-6 18-15 23z" fill="url(#${id("b")})" opacity=".75"/>
    <path d="M17 17l11-4" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  grenade: (id) => `
    <defs>${rg(id("a"), "#a9c27a", "#4c6430")}</defs>
    <rect x="25" y="5" width="14" height="10" rx="2" fill="#8d97a6" stroke="${OUTLINE}" stroke-width="3"/>
    <path d="M39 8c8 0 12 4 12 10" stroke="${OUTLINE}" stroke-width="3" fill="none"/>
    <circle cx="51" cy="20" r="4" fill="none" stroke="${OUTLINE}" stroke-width="3"/>
    <ellipse cx="32" cy="38" rx="18" ry="21" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3"/>
    <path d="M15 32h34M14 44h36M32 17v42" stroke="#2f3e1f" stroke-width="2.5" opacity=".7"/>
    <path d="M21 26c2-4 5-6 8-6" stroke="#e6f5c8" stroke-width="3" stroke-linecap="round" fill="none"/>`,
  medkit: (id) => `
    <defs>${lg(id("a"), "#ffffff", "#c9d3df")}</defs>
    <path d="M24 12h16v8H24z" fill="none" stroke="${OUTLINE}" stroke-width="3.5"/>
    <rect x="6" y="18" width="52" height="38" rx="7" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M27 26h10v8h8v10h-8v8H27v-8h-8V34h8z" fill="#e5413a" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>`,
  crosshair: () => `
    <g fill="none" stroke="${OUTLINE}" stroke-width="5" stroke-linecap="round">
      <circle cx="32" cy="32" r="20"/><path d="M32 4v14M32 46v14M4 32h14M46 32h14"/>
    </g>
    <g fill="none" stroke="#f4f7fb" stroke-width="2.5" stroke-linecap="round">
      <circle cx="32" cy="32" r="20"/><path d="M32 5v12M32 47v12M5 32h12M47 32h12"/>
    </g>
    <path d="M32 24c4 2 5 6 5 10v6H27v-6c0-4 1-8 5-10z" fill="#e8b04a" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>`,
  pause: () => `
    <rect x="16" y="12" width="11" height="40" rx="3" fill="#fff" stroke="${OUTLINE}" stroke-width="3"/>
    <rect x="37" y="12" width="11" height="40" rx="3" fill="#fff" stroke="${OUTLINE}" stroke-width="3"/>`,
  back: () => `
    <path d="M40 8L14 32l26 24" fill="none" stroke="${OUTLINE}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M40 8L14 32l26 24" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  lock: (id) => `
    <defs>${lg(id("a"), "#ffe27a", "#d98c12")}</defs>
    <path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" stroke="${OUTLINE}" stroke-width="9"/>
    <path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" stroke="#b8c2cf" stroke-width="4.5"/>
    <rect x="12" y="27" width="40" height="30" rx="6" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5"/>
    <circle cx="32" cy="40" r="4" fill="${OUTLINE}"/><path d="M32 42v7" stroke="${OUTLINE}" stroke-width="4" stroke-linecap="round"/>`,
  star: (id) => `
    <defs>${lg(id("a"), "#fff2a0", "#f2a91a")}</defs>
    <path d="M32 4l8.6 17.6 19.4 2.8-14 13.6 3.3 19.3L32 48.2 14.7 57.3 18 38 4 24.4l19.4-2.8z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M22 26l8-1" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  hammer: (id) => `
    <defs>${lg(id("a"), "#dfe6ee", "#7f8b9b")}</defs>
    <path d="M30 30L10 50a4 4 0 0 0 6 6l20-20" fill="#c07a3a" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M24 16l14-10 20 20-10 14-8-8-6 4-6-6 4-6z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M38 11l10 10" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  up: (id) => `
    <defs>${lg(id("a"), "#a6f57a", "#2c9a2f")}</defs>
    <path d="M32 4l24 26H42v28H22V30H8z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M30 12L17 26" stroke="#eaffdc" stroke-width="3" stroke-linecap="round"/>`,
  rotate: () => `
    <path d="M50 30a18 18 0 1 1-6-13" fill="none" stroke="${OUTLINE}" stroke-width="11" stroke-linecap="round"/>
    <path d="M50 30a18 18 0 1 1-6-13" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M38 4l14 10-16 6z" fill="#fff" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>`,
  trash: (id) => `
    <defs>${lg(id("a"), "#ffffff", "#c6d0dc")}</defs>
    <path d="M10 14h44M26 14V8h12v6" fill="none" stroke="${OUTLINE}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M14 18h36l-4 38H18z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M25 26v22M32 26v22M39 26v22" stroke="#7e8a9a" stroke-width="3" stroke-linecap="round"/>`,
  check: () => `
    <path d="M10 34l14 14 30-32" fill="none" stroke="${OUTLINE}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M10 34l14 14 30-32" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  close: () => `
    <path d="M14 14l36 36M50 14L14 50" stroke="${OUTLINE}" stroke-width="14" stroke-linecap="round"/>
    <path d="M14 14l36 36M50 14L14 50" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`,
  share: (id) => `
    <defs>${lg(id("a"), "#9fd4ff", "#2a78e0")}</defs>
    <path d="M12 30v22h40V30" fill="none" stroke="${OUTLINE}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 30v22h40V30" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M32 40V8M20 18L32 6l12 12" fill="none" stroke="${OUTLINE}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M32 40V8M20 18L32 6l12 12" fill="none" stroke="url(#${id("a")})" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  crew: (id) => `
    <defs>${lg(id("a"), "#9fd4ff", "#2a78e0")}${lg(id("b"), "#ffd9b0", "#e3a26a")}</defs>
    <g stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round">
      <path d="M4 56c0-10 6-16 14-16s14 6 14 16z" fill="#5b8fd6"/>
      <circle cx="18" cy="30" r="9" fill="url(#${id("b")})"/>
      <path d="M26 58c0-13 8-20 18-20s18 7 18 20z" fill="url(#${id("a")})"/>
      <circle cx="44" cy="25" r="11" fill="url(#${id("b")})"/>
      <path d="M32 22c0-8 6-12 12-12s12 4 12 12z" fill="#2a5fae"/>
    </g>`,
  anchor: (id) => `
    <defs>${lg(id("a"), "#e9eef5", "#8794a6")}</defs>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M32 18v38M20 26h24M10 38c2 12 12 18 22 18s20-6 22-18" stroke="${OUTLINE}" stroke-width="11"/>
      <path d="M32 18v38M20 26h24M10 38c2 12 12 18 22 18s20-6 22-18" stroke="url(#${id("a")})" stroke-width="5"/>
    </g>
    <circle cx="32" cy="11" r="6.5" fill="none" stroke="${OUTLINE}" stroke-width="9"/>
    <circle cx="32" cy="11" r="6.5" fill="none" stroke="#e9eef5" stroke-width="4"/>`,
  energy: (id) => `
    <defs>${lg(id("a"), "#fff3a0", "#f0a21a")}</defs>
    <path d="M38 4L12 36h16l-4 24 28-34H36z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M34 12L22 28" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  clock: (id) => `
    <defs>${lg(id("a"), "#ffffff", "#cdd6e2")}</defs>
    <circle cx="32" cy="34" r="24" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M32 20v14l9 7" stroke="${OUTLINE}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <rect x="27" y="4" width="10" height="7" rx="2" fill="#e5413a" stroke="${OUTLINE}" stroke-width="2.5"/>`,
  skull: (id) => `
    <defs>${lg(id("a"), "#ffffff", "#cfd8e4")}</defs>
    <path d="M32 6C18 6 9 15 9 28c0 8 4 13 9 16v10h28V44c5-3 9-8 9-16C55 15 46 6 32 6z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>
    <circle cx="23" cy="30" r="6" fill="${OUTLINE}"/><circle cx="41" cy="30" r="6" fill="${OUTLINE}"/>
    <path d="M28 44h8M27 54v-6M32 54v-6M37 54v-6" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round"/>`,
  flame: (id) => `
    <defs>${lg(id("a"), "#fff07a", "#ff6a1a")}</defs>
    <path d="M32 4c4 12 18 18 18 34a18 18 0 0 1-36 0c0-9 5-13 8-18 2 6 5 8 8 8-4-8-2-16 2-24z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M32 54a8 8 0 0 1-8-8c0-5 4-7 6-11 2 5 10 7 10 13a8 8 0 0 1-8 6z" fill="#fff6c2"/>`,
  artillery: (id) => `
    <defs>${lg(id("a"), "#9aa6b6", "#3c4656")}</defs>
    <path d="M18 46L46 18a8 8 0 0 1 11 11L29 57z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M46 18l11 11" stroke="#e5413a" stroke-width="5"/>
    <path d="M18 46l11 11-9 3-5-5z" fill="#e8b04a" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M10 54l-5 5M8 44l-5 1M20 58l-1 5" stroke="#ff9a2a" stroke-width="3.5" stroke-linecap="round"/>`,
  barrage: (id) => `
    <defs>${lg(id("a"), "#d9e0ea", "#6f7c8e")}</defs>
    <g stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round">
      <path d="M8 40l22-22 6 6-22 22z" fill="url(#${id("a")})"/><path d="M30 18l8-4-2 10z" fill="#e5413a"/>
      <path d="M22 54l22-22 6 6-22 22z" fill="url(#${id("a")})"/><path d="M44 32l8-4-2 10z" fill="#e5413a"/>
      <path d="M26 26l22-22 6 6-22 22z" fill="url(#${id("a")})"/><path d="M48 4l8-2-2 10z" fill="#e5413a"/>
    </g>
    <path d="M8 46l-4 4M22 60l-4 3M26 32l-4 4" stroke="#ff9a2a" stroke-width="3.5" stroke-linecap="round"/>`,
  heal: (id) => `
    <defs>${lg(id("a"), "#9bf56f", "#2c9a2f")}</defs>
    <circle cx="32" cy="32" r="26" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M27 14h10v13h13v10H37v13H27V37H14V27h13z" fill="#fff" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>`,
  smoke: (id) => `
    <defs>${lg(id("a"), "#f4f6fa", "#a7b2c2")}</defs>
    <path d="M14 50a10 10 0 0 1 0-20 12 12 0 0 1 22-8 11 11 0 0 1 18 10 9 9 0 0 1-2 18z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M20 34a6 6 0 0 1 6-5" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>`,
  turret: (id) => `
    <defs>${lg(id("a"), "#9fd4ff", "#2a78e0")}</defs>
    <path d="M14 56h36l-4-14H18z" fill="#6c7788" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="18" y="28" width="26" height="16" rx="5" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3"/>
    <path d="M40 32h18v8H40" fill="#3c4656" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M22 32h10" stroke="#e6f4ff" stroke-width="3" stroke-linecap="round"/>`,
  rocket: (id) => `
    <defs>${lg(id("a"), "#a8bd76", "#56692f")}</defs>
    <path d="M10 54l8-16 26-26c6-6 12-6 12-6s0 6-6 12L24 44z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M44 12l8 8" stroke="#e5413a" stroke-width="5"/>
    <path d="M10 54l3-12 9 9z" fill="#ff9a2a" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>`,
  ram: (id) => `
    <defs>${lg(id("a"), "#ffe7a6", "#c9a05a")}</defs>
    <rect x="6" y="24" width="38" height="24" rx="6" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M44 28h8l6 8-6 8h-8z" fill="#8d97a6" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M2 30h4M0 38h6" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="16" cy="50" r="6" fill="#3c4656" stroke="${OUTLINE}" stroke-width="3"/><circle cx="34" cy="50" r="6" fill="#3c4656" stroke="${OUTLINE}" stroke-width="3"/>`,
  map: (id) => `
    <defs>${lg(id("a"), "#f6e7bf", "#d8bd82")}</defs>
    <path d="M6 12l16-6 20 6 16-6v46l-16 6-20-6-16 6z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M22 6v46M42 12v46" stroke="#b08a4a" stroke-width="2.5"/>
    <path d="M30 24l8 8M38 24l-8 8" stroke="#e5413a" stroke-width="4" stroke-linecap="round"/>`,
  gear: (id) => `
    <defs>${lg(id("a"), "#e3e9f1", "#8693a5")}</defs>
    <path d="M27 4h10l2 8 6 3 7-4 7 7-4 7 3 6 8 2v10l-8 2-3 6 4 7-7 7-7-4-6 3-2 8H27l-2-8-6-3-7 4-7-7 4-7-3-6-8-2V27l8-2 3-6-4-7 7-7 7 4 6-3z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="32" cy="32" r="9" fill="#3c4656" stroke="${OUTLINE}" stroke-width="3"/>`,
  play: (id) => `
    <defs>${lg(id("a"), "#ffffff", "#d6e6ff")}</defs>
    <path d="M18 8l38 24-38 24z" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="4" stroke-linejoin="round"/>`,
  sword2: (id) => `
    <defs>${lg(id("a"), "#ffffff", "#aab7c8")}${lg(id("b"), "#ffd27a", "#c47a1a")}</defs>
    <g stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M8 6h8l26 26-6 6L10 12z" fill="url(#${id("a")})"/>
      <path d="M56 6h-8L22 32l6 6 26-26z" fill="url(#${id("a")})"/>
      <path d="M30 36l-6-6-6 4 10 10zM34 36l6-6 6 4-10 10z" fill="url(#${id("b")})"/>
      <path d="M22 44l-10 10M42 44l10 10" stroke-width="8"/>
      <path d="M22 44l-10 10M42 44l10 10" stroke="#8a4a1d" stroke-width="3.5"/>
      <circle cx="10" cy="56" r="4" fill="url(#${id("b")})"/><circle cx="54" cy="56" r="4" fill="url(#${id("b")})"/>
    </g>
    <path d="M12 9l20 20M52 9L32 29" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/>`,
  island: (id) => `
    <defs>${lg(id("a"), "#7fe3d8", "#1f9fc4")}${lg(id("b"), "#8fe06a", "#3f9e3a")}</defs>
    <ellipse cx="32" cy="46" rx="28" ry="12" fill="url(#${id("a")})" stroke="${OUTLINE}" stroke-width="3"/>
    <ellipse cx="32" cy="42" rx="20" ry="8" fill="#f2d79b" stroke="${OUTLINE}" stroke-width="3"/>
    <path d="M30 40c0-10 2-18 6-24" stroke="#8a4a1d" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M36 16c-8-6-18-4-22 2 8-2 14 0 22-2zM36 16c6-8 16-8 20-2-8 0-14 0-20 2zM36 16c-2 8-8 12-14 12 4-6 8-10 14-12zM36 16c6 2 10 8 10 14-4-6-8-10-10-14z" fill="url(#${id("b")})" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>`,
  // Brass insignia for the navy theme.
  rank: (id) => `
    <defs>${lg(id("a"), "#fff1b8", "#e2b45a", "#a8752c")}</defs>
    <g fill="url(#${id("a")})" stroke="#2a1c08" stroke-width="3" stroke-linejoin="round">
      <path d="M8 30l24 13 24-13v9L32 52 8 39z"/>
      <path d="M8 43l24 13 24-13v7L32 63 8 50z"/>
      <path d="M32 6l4 8.5 9.3 1.3-6.8 6.4 1.7 9.2L32 27l-8.2 4.4 1.7-9.2-6.8-6.4 9.3-1.3z"/>
    </g>`,
  anchorGold: (id) => `
    <defs>${lg(id("a"), "#fff1b8", "#e2b45a", "#a8752c")}</defs>
    <g fill="none" stroke="#2a1c08" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="32" cy="12" r="5"/><path d="M32 18v38M20 26h24M10 38c2 12 12 18 22 18s20-6 22-18"/>
    </g>
    <g fill="none" stroke="url(#${id("a")})" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="32" cy="12" r="5"/><path d="M32 18v38M20 26h24M10 38c2 12 12 18 22 18s20-6 22-18"/>
    </g>
    <path d="M4 40l7-5 5 8zM60 40l-7-5-5 8z" fill="url(#${id("a")})" stroke="#2a1c08" stroke-width="2.5" stroke-linejoin="round"/>`,
  bullet: (id) => `
    <defs>${lg(id("a"), "#fff1b8", "#e2b45a", "#a8752c")}</defs>
    <circle cx="32" cy="32" r="22" fill="none" stroke="#2a1c08" stroke-width="8"/>
    <circle cx="32" cy="32" r="22" fill="none" stroke="url(#${id("a")})" stroke-width="4"/>
    <path d="M32 2v14M32 48v14M2 32h14M48 32h14" stroke="#2a1c08" stroke-width="8" stroke-linecap="round"/>
    <path d="M32 2v14M32 48v14M2 32h14M48 32h14" stroke="url(#${id("a")})" stroke-width="4" stroke-linecap="round"/>
    <path d="M26 44V28c0-6 3-11 6-13 3 2 6 7 6 13v16z" fill="url(#${id("a")})" stroke="#2a1c08" stroke-width="3" stroke-linejoin="round"/>
    <path d="M26 37h12" stroke="#2a1c08" stroke-width="2.5"/>`,
} satisfies Record<string, Draw>;

export type IconName = keyof typeof ICONS;

/** An icon as an SVG string. */
export function iconSvg(name: IconName): string {
  const n = ++serial;
  const draw: Draw = ICONS[name];
  return `<svg class="icon icon-${name}" viewBox="0 0 64 64" aria-hidden="true">${draw((s) => `i${n}${s}`)}</svg>`;
}

/** An icon as an element. */
export function icon(name: IconName, className = ""): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = `icon-wrap${className ? ` ${className}` : ""}`;
  span.innerHTML = iconSvg(name);
  return span;
}
