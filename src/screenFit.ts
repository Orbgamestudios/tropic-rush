// Fills the whole screen with the game, and asks for the phone to be turned sideways when it's held
// upright (the owner's call, 2026-11-21: no more turning the game itself to lie along an upright
// phone).
//
// iPhones don't let a web app lock its orientation, and ignore the manifest's. So when a phone is
// held upright, a picture of a phone turning sideways is laid over everything, over a sunset sea:
// the game waits underneath until it's turned.
//
// A home-screen app started sideways can also come up a strip short of the screen until the phone
// is turned and turned back, because iOS tells the page the wrong height at first. The game is
// sized from the screen itself there, not from what the page is told; and in Safari from the
// visual viewport, which follows the toolbar as it comes and goes (the page's own height lags it,
// which left a strip along the bottom).

function standalone(): boolean {
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios || window.matchMedia("(display-mode: standalone)").matches;
}

function touchScreen(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

/** The size of what the page can draw on, as the phone's holding it now: width, then height. */
function viewport(): [number, number] {
  const seen = window.visualViewport;
  const w = Math.round(seen?.width ?? window.innerWidth);
  const h = Math.round(seen?.height ?? window.innerHeight);
  if (!standalone() || !touchScreen()) return [w, h];
  // A home-screen app has the whole screen, and the screen always says its size upright.
  const long = Math.max(window.screen.width, window.screen.height);
  const short = Math.min(window.screen.width, window.screen.height);
  return h > w ? [short, long] : [long, short];
}

function fitScreen(game: HTMLElement): void {
  const [w, h] = viewport();
  document.documentElement.classList.toggle("upright", touchScreen() && h > w);
  game.style.width = `${w}px`;
  game.style.height = `${h}px`;
  // The page itself the same size, so nothing behind the game can show past its edge.
  document.documentElement.style.setProperty("--screen-h", `${h}px`);
}

/** The picture asking for the phone to be turned: a phone on a sunset sea, turning sideways. */
function turnPrompt(): HTMLElement {
  const prompt = document.createElement("div");
  prompt.id = "turn-phone";
  prompt.setAttribute("role", "alert");
  prompt.innerHTML = `
    <div class="turn-sky"></div>
    <div class="turn-sun"></div>
    <svg class="turn-isle" viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path d="M0 120 C60 96 110 84 170 90 C230 96 260 78 320 86 C360 92 385 100 400 104 L400 120 Z" />
      <g class="turn-palm" transform="translate(96 92)">
        <path d="M0 0 C-2 -22 2 -44 10 -62" fill="none" stroke-width="5" stroke-linecap="round" />
        <path d="M10 -62 C-6 -70 -24 -66 -34 -54 C-20 -60 -6 -60 10 -62 Z" />
        <path d="M10 -62 C24 -74 44 -72 54 -60 C38 -64 24 -64 10 -62 Z" />
        <path d="M10 -62 C2 -80 -12 -88 -26 -86 C-12 -80 0 -72 10 -62 Z" />
        <path d="M10 -62 C22 -82 38 -88 50 -84 C36 -78 22 -72 10 -62 Z" />
        <path d="M10 -62 C12 -76 8 -90 0 -98 C8 -84 10 -74 10 -62 Z" />
      </g>
      <g class="turn-palm" transform="translate(300 86) scale(0.8)">
        <path d="M0 0 C2 -24 -4 -46 -12 -62" fill="none" stroke-width="5" stroke-linecap="round" />
        <path d="M-12 -62 C-28 -72 -48 -70 -58 -58 C-42 -62 -28 -64 -12 -62 Z" />
        <path d="M-12 -62 C4 -72 24 -68 32 -56 C18 -62 2 -62 -12 -62 Z" />
        <path d="M-12 -62 C-22 -82 -38 -88 -50 -84 C-36 -78 -22 -72 -12 -62 Z" />
        <path d="M-12 -62 C-2 -80 12 -88 24 -86 C12 -80 0 -72 -12 -62 Z" />
      </g>
    </svg>
    <div class="turn-sea"><i></i><i></i><i></i></div>
    <div class="turn-card">
      <div class="turn-stage" aria-hidden="true">
        <svg class="turn-arrows" viewBox="0 0 200 200">
          <path d="M44 62 A70 70 0 0 1 130 32" />
          <path d="M120 22 L134 33 L118 42" />
          <path d="M156 138 A70 70 0 0 1 70 168" />
          <path d="M80 178 L66 167 L82 158" />
        </svg>
        <svg class="turn-device" viewBox="0 0 80 140">
          <rect x="3" y="3" width="74" height="134" rx="14" class="turn-case" />
          <rect x="9" y="14" width="62" height="112" rx="5" class="turn-glass" />
          <rect x="30" y="7" width="20" height="4" rx="2" class="turn-notch" />
          <path d="M9 96 C24 90 36 92 50 88 C58 86 66 88 71 90 L71 121 Q71 126 66 126 L14 126 Q9 126 9 121 Z" class="turn-water" />
          <path d="M24 92 L46 92 L50 86 L28 86 Z" class="turn-boat" />
          <path d="M34 86 L34 76 L44 76 Z" class="turn-boat" />
        </svg>
      </div>
      <div class="turn-title">Turn your phone</div>
      <div class="turn-text">Tropic Rush plays sideways</div>
    </div>`;
  return prompt;
}

/**
 * Sizes the game to the screen, and shows the turn-your-phone picture while it's held upright.
 * Call once, before the game starts measuring anything.
 */
export function fitToScreen(game: HTMLElement): void {
  document.body.append(turnPrompt());
  const refit = () => fitScreen(game);
  refit();
  for (const type of ["resize", "orientationchange", "pageshow"]) {
    window.addEventListener(type, refit);
  }
  window.visualViewport?.addEventListener("resize", refit);
  // iOS settles on its real size a moment after a start or a turn, without saying so.
  for (const ms of [50, 250, 800, 2000]) setTimeout(refit, ms);
  window.addEventListener("orientationchange", () => {
    for (const ms of [120, 400, 900]) setTimeout(refit, ms);
  });
}
