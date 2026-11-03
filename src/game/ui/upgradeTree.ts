// The hero's upgrade tree, in the style of the owner's mockup: brass-rimmed tiles joined by lines
// of mini upgrades, which light up gold as they're bought, the chosen one on a cream spec card
// at the right, and the wallet in the corner. A trunk with two short side paths splits in two, and
// each of those in two again.
// The board is wider than the screen, and scrolls sideways.

import { CRYSTAL_KINDS } from "../logic/crystals";
import type { HeroKind } from "../logic/heroes";
import { HERO_NAMES } from "../logic/heroProgress";
import { canBuy, heroTree, lineAt, lockedBy, TIERS, type TreeUpgrade } from "../logic/heroTrees";
import { heroPortrait } from "../render/thumbnails";
import type { SaveData } from "../save";
import {
  backButton,
  button,
  CrystalWallet,
  CurrencyPill,
  crystalChip,
  el,
  formatNumber,
  plate,
  setLabel,
} from "./kit/dom";
import { sfx, sparkleAt } from "./kit/fx";
import { type IconName, icon } from "./kit/icons";
import { LevelUpReveal } from "./levelUp";

export interface UpgradeTreeHost {
  onTrade(): void;
  save(): SaveData;
  /** The island's gold, which pays for upgrades. */
  gold(): number;
  /** The crew's headquarters level, which sets how far up the tree a hero can go. */
  hq(): number;
  /** False if the crew's island turned it down. */
  buy(kind: HeroKind, upgrade: TreeUpgrade): boolean;
  onBack(): void;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const BOARD_W = 1000;
const BOARD_H = 640;

/** Points a stretch of line is drawn with, so it follows the curve between checkpoints. */
const WIRE_POINTS = 6;

/** Where an upgrade sits on the board, as shares of its width and height. */
function spot(u: { column: number; row: number }): { x: number; y: number } {
  return { x: 0.035 + u.column * 0.104, y: 0.14 + u.row * 0.245 };
}

/** The stretch of line from an upgrade or checkpoint to the next, as an SVG path. */
function wirePath(
  from: TreeUpgrade,
  to: TreeUpgrade,
  byId: ReadonlyMap<string, TreeUpgrade>,
): string {
  const line = to.line ?? from.line;
  const start = line && byId.get(line.from);
  const end = line && byId.get(line.to);
  if (!line || !start || !end) return "";
  const t0 = from.line?.at ?? 0;
  const t1 = to.line?.at ?? 1;
  const points = Array.from({ length: WIRE_POINTS + 1 }, (_, i) => {
    const { x, y } = spot(lineAt(start, end, t0 + ((t1 - t0) * i) / WIRE_POINTS));
    return `${x * BOARD_W} ${y * BOARD_H}`;
  });
  return `M${points.join("L")}`;
}

export class UpgradeTree {
  readonly root = el("div", "screen screen-tree");
  private readonly fx = el("div", "fx-layer");
  private readonly heroName = el("span", "tree-hero");
  private readonly scroller = el("div", "tree-scroll");
  private readonly board = el("div", "tree-board");
  private readonly lines = document.createElementNS(SVG_NS, "svg");
  private readonly nodes = new Map<string, HTMLButtonElement>();
  private readonly wires: { from: string; to: string; path: SVGPathElement }[] = [];
  private readonly gold = new CurrencyPill("coin", "Gold");
  private readonly wallet = new CrystalWallet();
  private readonly specIcon = el("div", "tree-spec-icon");
  private readonly specName = el("div", "tree-spec-name");
  private readonly specPath = el("div", "tree-spec-path");
  private readonly specText = el("div", "tree-spec-text");
  private readonly specCost = el("div", "tree-spec-cost");
  private readonly specNote = el("div", "tree-spec-note");
  private readonly buy: HTMLButtonElement;
  private readonly reveal: LevelUpReveal;
  private hero: HeroKind = "rifleman";
  private selected: TreeUpgrade | null = null;

  constructor(
    parent: HTMLElement,
    private readonly host: UpgradeTreeHost,
  ) {
    const top = el("div", "tree-top");
    top.append(
      backButton(() => host.onBack()),
      plate("Upgrade tree", "tree-title"),
      this.heroName,
    );
    this.lines.setAttribute("viewBox", `0 0 ${BOARD_W} ${BOARD_H}`);
    this.lines.setAttribute("preserveAspectRatio", "none");
    this.lines.classList.add("tree-lines");
    this.board.append(this.lines);
    this.scroller.append(this.board);
    // The sky behind the board slides along slower than it, a layer at a time, as it scrolls.
    this.scroller.addEventListener(
      "scroll",
      () => {
        this.root.style.setProperty("--tree-scroll", String(this.scroller.scrollLeft));
      },
      { passive: true },
    );
    // A mouse wheel only goes up and down, and there's nowhere up or down to go.
    this.scroller.addEventListener(
      "wheel",
      (e) => {
        this.scroller.scrollLeft += e.deltaY;
      },
      { passive: true },
    );

    const spec = el("div", "tree-spec");
    this.buy = button({
      label: "Upgrade",
      icon: "up",
      variant: "gold",
      size: "md",
      className: "tree-buy",
      onClick: () => this.purchase(),
    });
    spec.append(
      plate("Technical specs", "tree-spec-plate"),
      this.specIcon,
      this.specName,
      this.specPath,
      this.specText,
      this.specCost,
      this.specNote,
      this.buy,
    );

    const purse = el("div", "tree-purse");
    const trade = button({
      label: "Trade",
      variant: "steel",
      size: "sm",
      aria: "Trade crystals",
      onClick: () => host.onTrade(),
    });
    purse.append(trade, this.gold.root, this.wallet.root);

    const sky = el("div", "tree-sky");
    sky.append(
      el("div", "tree-sky-layer tree-sky-glow"),
      el("div", "tree-sky-layer tree-sky-crystals"),
      el("div", "tree-sky-layer tree-sky-grid"),
      el("div", "tree-sky-layer tree-sky-sparks"),
    );
    this.root.append(sky, top, this.scroller, spec, purse, this.fx);
    this.reveal = new LevelUpReveal(this.root);
    this.root.style.display = "none";
    parent.append(this.root);
  }

  show(kind: HeroKind): void {
    this.hero = kind;
    this.heroName.textContent = HERO_NAMES[kind];
    this.buildBoard(kind);
    this.root.style.display = "grid";
    const owned = this.host.save().upgrades[kind];
    // Start on whatever's next, the way a player would look for it.
    const next = heroTree(kind).find((u) => !owned.includes(u.id) && !lockedBy(kind, u, owned));
    this.select(next ?? heroTree(kind)[0] ?? null);
    this.bringIntoView("auto");
  }

  /** Scrolls the board to the chosen upgrade. */
  private bringIntoView(behavior: ScrollBehavior): void {
    if (!this.selected) return;
    const left = spot(this.selected).x * this.board.clientWidth - this.scroller.clientWidth / 2;
    this.scroller.scrollTo({ left, behavior });
  }

  hide(): void {
    this.root.style.display = "none";
  }

  private buildBoard(kind: HeroKind): void {
    for (const node of this.nodes.values()) node.remove();
    this.nodes.clear();
    this.wires.length = 0;
    this.lines.replaceChildren();
    const tree = heroTree(kind);
    const byId = new Map(tree.map((u) => [u.id, u]));
    for (const u of tree) {
      for (const id of u.needs) {
        const parent = byId.get(id);
        if (!parent) continue;
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", wirePath(parent, u, byId));
        this.lines.append(path);
        this.wires.push({ from: id, to: u.id, path });
      }
    }
    for (const u of tree) {
      const { x, y } = spot(u);
      const big = u.tier === 1 || u.tier === TIERS;
      const node = el(
        "button",
        u.line ? "tree-node tree-step" : `tree-node${big ? " tree-big" : ""}`,
      );
      node.style.left = `${x * 100}%`;
      node.style.top = `${y * 100}%`;
      node.setAttribute("aria-label", u.line ? u.text : u.name);
      node.append(el("span", "tree-node-face"));
      if (!u.line) node.append(el("span", "tree-node-label", u.name));
      node.querySelector(".tree-node-face")?.append(icon(u.icon as IconName, "tree-node-icon"));
      node.addEventListener("click", () => {
        sfx.tick();
        this.select(u);
      });
      this.board.append(node);
      this.nodes.set(u.id, node);
    }
  }

  refresh(): void {
    const save = this.host.save();
    const kind = this.hero;
    const owned = save.upgrades[kind];
    const hq = this.host.hq();
    this.gold.set(this.host.gold());
    this.wallet.set(save.crystals);
    for (const u of heroTree(kind)) {
      const node = this.nodes.get(u.id);
      if (!node) continue;
      const has = owned.includes(u.id);
      const open = lockedBy(kind, u, owned) === null && u.hq <= hq;
      node.classList.toggle("owned", has);
      node.classList.toggle("open", !has && open);
      node.classList.toggle("ready", canBuy(kind, u, owned, this.host.gold(), save.crystals, hq));
      node.classList.toggle("selected", u === this.selected);
      const shut = !u.line && !has && !open;
      const lock = node.querySelector(".tree-node-lock");
      if (shut && !lock) node.append(icon("lock", "tree-node-lock"));
      if (!shut) lock?.remove();
    }
    for (const { from, to, path } of this.wires) {
      path.classList.toggle("on", owned.includes(from) && owned.includes(to));
      path.classList.toggle("next", owned.includes(from) && !owned.includes(to));
    }
    this.refreshSpec();
  }

  private select(u: TreeUpgrade | null): void {
    this.selected = u;
    this.refresh();
  }

  private refreshSpec(): void {
    const u = this.selected;
    if (!u) return;
    const save = this.host.save();
    const kind = this.hero;
    const owned = save.upgrades[kind];
    const hq = this.host.hq();
    const has = owned.includes(u.id);
    this.specIcon.replaceChildren(icon(u.icon as IconName));
    this.specName.textContent = u.name;
    this.specPath.textContent = u.line
      ? `${u.path}: mini upgrade`
      : u.tier === TIERS
        ? `${u.path}: capstone`
        : (u.path ?? "First upgrade");
    this.specText.textContent = u.text;
    const coin = el("span", "tree-coin");
    coin.classList.toggle("short", this.host.gold() < u.gold);
    coin.append(icon("coin", "tree-coin-icon"), el("span", "", formatNumber(u.gold)));
    this.specCost.replaceChildren(
      coin,
      ...CRYSTAL_KINDS.flatMap((k) => {
        const need = u.crystals[k];
        if (!need) return [];
        return [crystalChip(k, need, save.crystals[k] < need ? "short" : "")];
      }),
    );
    this.specCost.style.display = has ? "none" : "";
    const blocked = lockedBy(kind, u, owned);
    const ready = canBuy(kind, u, owned, this.host.gold(), save.crystals, hq);
    this.specNote.textContent = has
      ? "Owned"
      : u.hq > hq
        ? `Needs headquarters ${u.hq}`
        : blocked
          ? "First buy what comes before it"
          : ready
            ? ""
            : "Win more raids for gold and crystals";
    this.buy.style.display = has ? "none" : "";
    this.buy.disabled = !ready;
    setLabel(this.buy, "Upgrade");
  }

  private purchase(): void {
    const u = this.selected;
    if (!u) return;
    const save = this.host.save();
    const kind = this.hero;
    const owned = save.upgrades[kind];
    if (!canBuy(kind, u, owned, this.host.gold(), save.crystals, this.host.hq())) {
      sfx.error();
      return;
    }
    if (!this.host.buy(kind, u)) {
      sfx.error();
      return;
    }
    const node = this.nodes.get(u.id);
    if (u.line) {
      sfx.coin();
      if (node) sparkleAt(this.fx, node, { count: 8, spread: 40 });
      // Straight on to the next one, so a line can be bought with one button.
      this.select(heroTree(kind).find((next) => next.needs.includes(u.id)) ?? u);
      this.bringIntoView("smooth");
      return;
    }
    sfx.levelUp();
    if (node) sparkleAt(this.fx, node, { count: 24, spread: 90 });
    this.refresh();
    if (u.tier === TIERS) this.reveal.show(HERO_NAMES[kind], heroPortrait(kind), u);
  }
}
