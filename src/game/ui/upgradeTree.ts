// The hero's upgrade tree, in the style of the owner's mockup: thirteen brass-rimmed tiles joined
// by lines of small checkpoints, which light up gold as they're bought, the chosen one on a cream
// spec card at the right, and the wallet in the corner. Bought with personal gold and crystals.

import { CRYSTAL_KINDS, payCrystals } from "../logic/crystals";
import type { HeroKind } from "../logic/heroes";
import { HERO_NAMES } from "../logic/heroProgress";
import {
  canBuy,
  heroTree,
  lineAt,
  lockedBy,
  type TreeUpgrade,
  treePaths,
} from "../logic/heroTrees";
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
  save(): SaveData;
  update(changes: Partial<SaveData>): void;
  onBack(): void;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const BOARD_W = 1000;
const BOARD_H = 640;

/** Points a stretch of line is drawn with, so it follows the curve between checkpoints. */
const WIRE_POINTS = 6;

/** Where an upgrade sits on the board, as shares of its width and height. */
function spot(u: { column: number; row: number }): { x: number; y: number } {
  return { x: 0.06 + u.column * 0.215, y: 0.07 + u.row * 0.122 };
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
    purse.append(this.gold.root, this.wallet.root);

    this.root.append(top, this.board, spec, purse, this.fx);
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
  }

  hide(): void {
    this.root.style.display = "none";
  }

  private buildBoard(kind: HeroKind): void {
    for (const node of this.nodes.values()) node.remove();
    this.nodes.clear();
    this.wires.length = 0;
    this.lines.replaceChildren();
    for (const label of this.board.querySelectorAll(".tree-path")) label.remove();
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
      const node = el("button", u.line ? "tree-node tree-step" : `tree-node tree-tier-${u.tier}`);
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
    // Each path's name, above where it starts.
    treePaths(kind).forEach((name, i) => {
      const label = el("div", "tree-path", name);
      label.style.left = `${(0.06 + 0.215) * 100}%`;
      label.style.top = `${(0.07 + (i * 4 + 1.5) * 0.122 - 0.125) * 100}%`;
      this.board.append(label);
    });
  }

  private refresh(): void {
    const save = this.host.save();
    const kind = this.hero;
    const owned = save.upgrades[kind];
    this.gold.set(save.gold);
    this.wallet.set(save.crystals);
    for (const u of heroTree(kind)) {
      const node = this.nodes.get(u.id);
      if (!node) continue;
      const has = owned.includes(u.id);
      node.classList.toggle("owned", has);
      node.classList.toggle("open", !has && lockedBy(kind, u, owned) === null);
      node.classList.toggle("ready", canBuy(kind, u, owned, save.gold, save.crystals));
      node.classList.toggle("selected", u === this.selected);
      const shut = !u.line && !has && lockedBy(kind, u, owned) !== null;
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
    const has = owned.includes(u.id);
    this.specIcon.replaceChildren(icon(u.icon as IconName));
    this.specName.textContent = u.name;
    this.specPath.textContent = u.line
      ? `${u.path}: checkpoint`
      : u.tier === 5
        ? `${u.path}: capstone`
        : (u.path ?? "First upgrade");
    this.specText.textContent = u.text;
    const coin = el("span", "tree-coin");
    coin.classList.toggle("short", save.gold < u.gold);
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
    this.specNote.textContent = has
      ? "Owned"
      : blocked
        ? "First buy what comes before it"
        : canBuy(kind, u, owned, save.gold, save.crystals)
          ? ""
          : "Win more raids for gold and crystals";
    this.buy.style.display = has ? "none" : "";
    this.buy.disabled = !canBuy(kind, u, owned, save.gold, save.crystals);
    setLabel(this.buy, "Upgrade");
  }

  private purchase(): void {
    const u = this.selected;
    if (!u) return;
    const save = this.host.save();
    const kind = this.hero;
    const owned = save.upgrades[kind];
    if (!canBuy(kind, u, owned, save.gold, save.crystals)) {
      sfx.error();
      return;
    }
    this.host.update({
      gold: save.gold - u.gold,
      crystals: payCrystals(save.crystals, u.crystals),
      upgrades: { ...save.upgrades, [kind]: [...owned, u.id] },
    });
    const node = this.nodes.get(u.id);
    if (u.line) {
      sfx.coin();
      if (node) sparkleAt(this.fx, node, { count: 8, spread: 40 });
      // Straight on to the next one, so a line can be bought with one button.
      this.select(heroTree(kind).find((next) => next.needs.includes(u.id)) ?? u);
      return;
    }
    sfx.levelUp();
    if (node) sparkleAt(this.fx, node, { count: 24, spread: 90 });
    this.refresh();
    if (u.tier === 5) this.reveal.show(HERO_NAMES[kind], heroPortrait(kind), u);
  }
}
