// Trading crystals: three of one kind and some of the island's gold for one of another, for when
// the raids haven't turned up the kind an upgrade needs.

import { CRYSTAL_KINDS, CRYSTAL_LABELS, CRYSTAL_SWAP, type CrystalKind } from "../logic/crystals";
import type { SaveData } from "../save";
import {
  button,
  closeOnBackdrop,
  closeSoftly,
  crystalChip,
  crystalIcon,
  el,
  formatNumber,
  openSoftly,
  panel,
} from "./kit/dom";
import { sfx } from "./kit/fx";

export interface CrystalSwapHost {
  save(): SaveData;
  /** The island's gold, which pays for the trade. */
  gold(): number;
  /** Makes the trade; false if the island said no. */
  swap(from: CrystalKind, to: CrystalKind): boolean;
  /** Something changed that the screen behind should show. */
  onTraded(): void;
}

export class CrystalSwap {
  readonly root = el("div", "swap");
  private readonly gives = el("div", "swap-row");
  private readonly gets = el("div", "swap-row");
  private readonly deal = el("div", "swap-deal");
  private readonly trade: HTMLButtonElement;
  private from: CrystalKind | null = null;
  private to: CrystalKind | null = null;

  constructor(
    parent: HTMLElement,
    private readonly host: CrystalSwapHost,
  ) {
    const box = panel("Trade crystals", "swap-panel");
    this.trade = button({
      label: "Trade",
      variant: "gold",
      size: "md",
      onClick: () => this.make(),
    });
    const close = button({
      label: "Close",
      variant: "steel",
      size: "md",
      onClick: () => this.show(false),
    });
    const actions = el("div", "swap-actions");
    actions.append(close, this.trade);
    box.body.append(
      el("div", "swap-label", `Give ${CRYSTAL_SWAP.give}`),
      this.gives,
      el("div", "swap-label", "Get 1"),
      this.gets,
      this.deal,
      actions,
    );
    this.root.append(box.root);
    closeOnBackdrop(this.root, () => this.show(false));
    this.root.style.display = "none";
    parent.append(this.root);
  }

  show(on: boolean): void {
    if (on) openSoftly(this.root);
    else closeSoftly(this.root);
    if (on) this.draw();
  }

  private draw(): void {
    const { crystals } = this.host.save();
    if (this.from && crystals[this.from] < CRYSTAL_SWAP.give) this.from = null;
    if (this.to === this.from) this.to = null;
    this.gives.replaceChildren(
      ...CRYSTAL_KINDS.map((kind) => {
        const tile = el("button", "swap-tile");
        tile.append(crystalChip(kind, crystals[kind]));
        tile.setAttribute("aria-label", `Give ${CRYSTAL_LABELS[kind]}`);
        tile.disabled = crystals[kind] < CRYSTAL_SWAP.give;
        tile.classList.toggle("selected", kind === this.from);
        tile.addEventListener("click", () => this.pick("from", kind));
        return tile;
      }),
    );
    this.gets.replaceChildren(
      ...CRYSTAL_KINDS.map((kind) => {
        const tile = el("button", "swap-tile");
        tile.append(crystalIcon(kind));
        tile.setAttribute("aria-label", `Get ${CRYSTAL_LABELS[kind]}`);
        tile.disabled = kind === this.from;
        tile.classList.toggle("selected", kind === this.to);
        tile.addEventListener("click", () => this.pick("to", kind));
        return tile;
      }),
    );
    const gold = this.host.gold();
    const price = `${formatNumber(CRYSTAL_SWAP.gold)} gold`;
    this.deal.textContent =
      this.from && this.to
        ? `${CRYSTAL_SWAP.give} ${CRYSTAL_LABELS[this.from]} + ${price} for 1 ${CRYSTAL_LABELS[this.to]}`
        : `Costs ${price} a trade`;
    this.deal.classList.toggle("short", gold < CRYSTAL_SWAP.gold);
    this.trade.disabled = !this.from || !this.to || gold < CRYSTAL_SWAP.gold;
  }

  private pick(side: "from" | "to", kind: CrystalKind): void {
    sfx.tick();
    this[side] = this[side] === kind ? null : kind;
    this.draw();
  }

  private make(): void {
    if (!this.from || !this.to) return;
    if (!this.host.swap(this.from, this.to)) {
      sfx.error();
      return;
    }
    sfx.coin();
    this.host.onTraded();
    this.draw();
  }
}
