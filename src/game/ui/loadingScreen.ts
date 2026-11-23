// The loading screen, in the game's navy and brass: its name, a bar that fills as what's being
// fetched comes in, and a word on what for. It's up while a screen's models load, so nothing ever
// stands in for them (the owner's call, 2026-11-23). The first one is in the page itself
// (index.html), there before any of the game's code has arrived; this takes it over and keeps it
// for every load after.

/** A load quicker than this never puts the screen up. */
const SHOW_AFTER_MS = 150;
/** Once up, it stays at least this long, so it never flickers. */
const LEAST_SHOWN_MS = 450;

class LoadingScreen {
  private readonly root: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly note: HTMLElement;
  private total = 0;
  private done = 0;
  /** How many loads are being covered just now. */
  private covering = 0;
  /** When it went up, or 0 while it's down. */
  private shownAt = 0;
  private showTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.root = document.getElementById("loading") ?? LoadingScreen.build();
    this.fill = this.root.querySelector(".loading-fill") as HTMLElement;
    this.note = this.root.querySelector(".loading-note") as HTMLElement;
    // The page's own is up already, as the game starts.
    if (!this.root.classList.contains("gone")) this.shownAt = performance.now();
  }

  private static build(): HTMLElement {
    const root = document.createElement("div");
    root.id = "loading";
    root.className = "gone";
    root.setAttribute("role", "progressbar");
    root.innerHTML = `<div class="loading-middle"><div class="loading-title">Tropic Rush</div><div class="loading-bar"><div class="loading-fill"></div></div><div class="loading-note"></div></div>`;
    document.body.append(root);
    return root;
  }

  /**
   * Keeps the screen up until every one of these has settled, fetched or failed, and resolves
   * then; it only goes up if they take a moment. `note` says what's loading.
   */
  async cover(work: readonly Promise<unknown>[], note: string): Promise<void> {
    this.covering++;
    this.total += work.length;
    this.note.textContent = note;
    this.draw();
    if (this.shownAt === 0 && !this.showTimer) {
      this.showTimer = setTimeout(() => this.show(), SHOW_AFTER_MS);
    }
    await Promise.all(
      work.map((p) =>
        p.then(
          () => this.step(),
          () => this.step(),
        ),
      ),
    );
    this.covering--;
    if (this.covering > 0) return;
    if (this.showTimer) clearTimeout(this.showTimer);
    this.showTimer = null;
    if (this.shownAt > 0) {
      const left = LEAST_SHOWN_MS - (performance.now() - this.shownAt);
      if (left > 0) await new Promise((r) => setTimeout(r, left));
      if (this.covering > 0) return;
      this.root.classList.add("gone");
      this.shownAt = 0;
    }
    this.total = 0;
    this.done = 0;
  }

  private step(): void {
    this.done++;
    this.draw();
  }

  private show(): void {
    this.showTimer = null;
    if (this.covering === 0) return;
    this.root.classList.remove("gone");
    this.shownAt = performance.now();
  }

  private draw(): void {
    const share = this.total > 0 ? this.done / this.total : 0;
    this.fill.style.width = `${Math.round(8 + share * 92)}%`;
    this.root.setAttribute("aria-valuenow", String(Math.round(share * 100)));
  }
}

let screen: LoadingScreen | null = null;

/** The one loading screen. */
export function loadingScreen(): LoadingScreen {
  screen ??= new LoadingScreen();
  return screen;
}

/** Resolves after this many frames have been drawn: for the first picture to be up before uncovering it. */
export function frames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const next = (left: number) =>
      left <= 0 ? resolve() : requestAnimationFrame(() => next(left - 1));
    next(count);
  });
}
