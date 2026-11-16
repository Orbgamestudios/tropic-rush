// Keeps the game in landscape, filling the whole screen, however the phone is held and however it
// was started.
//
// iPhones don't let a web app lock its orientation, and ignore the manifest's. So when the phone
// reports portrait, the game itself is turned a quarter turn and laid across the screen's length:
// it's the same landscape game either way, and there's nothing to turn. Everything that reads where
// a touch landed, or where something sits on the screen, is handed the answer in the game's own
// landscape frame, so nothing else has to know.
//
// A home-screen app started sideways can also come up a strip short of the screen until the phone
// is turned and turned back, because iOS tells the page the wrong height at first. The game is
// sized from the screen itself there, not from what the page is told.

/** The events that say where on the screen something happened. */
const POINTED = [
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointercancel",
  "pointerover",
  "pointerout",
  "pointerenter",
  "pointerleave",
  "mousedown",
  "mousemove",
  "mouseup",
  "click",
  "dblclick",
  "contextmenu",
  "wheel",
] as const;

let turned = false;
/** The screen's width as the phone reports it, upright: the turned game's height. */
let across = 0;

function standalone(): boolean {
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios || window.matchMedia("(display-mode: standalone)").matches;
}

function touchScreen(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

/** The size of what the page can draw on, as the phone's holding it now: width, then height. */
function viewport(): [number, number] {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (!standalone() || !touchScreen()) return [w, h];
  // A home-screen app has the whole screen, and the screen always says its size upright.
  const long = Math.max(window.screen.width, window.screen.height);
  const short = Math.min(window.screen.width, window.screen.height);
  return h > w ? [short, long] : [long, short];
}

function fitScreen(game: HTMLElement): void {
  const [w, h] = viewport();
  turned = touchScreen() && h > w;
  across = w;
  document.documentElement.classList.toggle("turned", turned);
  game.style.width = `${turned ? h : w}px`;
  game.style.height = `${turned ? w : h}px`;
}

/** Where a point on the screen is in the game's own landscape frame. */
function toGame(x: number, y: number): [number, number] {
  return turned ? [y, across - x] : [x, y];
}

/**
 * Sizes the game to the screen and keeps it landscape. Call once, before the game starts measuring
 * anything.
 */
export function keepLandscape(game: HTMLElement): void {
  const refit = () => fitScreen(game);
  refit();
  for (const type of ["resize", "orientationchange", "pageshow"]) {
    window.addEventListener(type, refit);
  }
  window.visualViewport?.addEventListener("resize", refit);
  // iOS settles on its real size a moment after a sideways start, without saying so.
  for (const ms of [50, 250, 800, 2000]) setTimeout(refit, ms);

  for (const type of POINTED) {
    window.addEventListener(
      type,
      (event) => {
        if (!turned) return;
        const e = event as MouseEvent;
        const [x, y] = toGame(e.clientX, e.clientY);
        const [mx, my] = [e.movementY, -e.movementX];
        for (const [name, value] of [
          ["clientX", x],
          ["clientY", y],
          ["pageX", x],
          ["pageY", y],
          ["x", x],
          ["y", y],
          ["movementX", mx],
          ["movementY", my],
        ] as const) {
          Object.defineProperty(e, name, { value, configurable: true });
        }
      },
      { capture: true },
    );
  }

  const measure = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
    const rect = measure.call(this);
    if (!turned || !game.contains(this)) return rect;
    return new DOMRect(rect.top, across - rect.right, rect.height, rect.width);
  };
}
