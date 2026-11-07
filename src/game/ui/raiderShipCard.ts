// What a raider ship's card says, on the map and in the night raid panel: who they are, how hard,
// when they're likely to strike, who's aboard, and what holding them off pays.

import { CRYSTAL_KINDS } from "../logic/crystals";
import { costText } from "../logic/economy";
import { HEROES, type HeroKind } from "../logic/heroes";
import type { RaiderShip } from "../logic/raiderShip";
import { costChips, crystalChip, el } from "./kit/dom";

const hourOf = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric" });

/** "3 Tanks · Medic · Rifleman": who's aboard, the most numerous first. */
export function armyText(kinds: readonly HeroKind[]): string {
  const counts = new Map<HeroKind, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, n]) => (n > 1 ? `${n} ${HEROES[kind].name}s` : HEROES[kind].name))
    .join(" · ");
}

/** The body of a ship's card. */
export function shipDetails(ship: RaiderShip): HTMLElement {
  const box = el("div", "ship-details");
  const rating = el(
    "div",
    `ship-rating map-${ship.difficulty.toLowerCase()}`,
    `${ship.difficulty} · Headquarters ${ship.hq}`,
  );
  const when = el(
    "div",
    "ship-when",
    `Likely to strike between ${hourOf(ship.window.from)} and ${hourOf(ship.window.to)}`,
  );
  const army = el("div", "ship-army");
  army.append(el("span", "ship-plan", `${ship.plan.name}: `), el("span", "", armyText(ship.kinds)));
  const pays = el("div", "ship-pays");
  pays.append(
    el("span", "ship-pays-label", "Hold them off for"),
    ...CRYSTAL_KINDS.flatMap((k) => {
      const n = ship.reward.crystals[k];
      return n ? [crystalChip(k, n)] : [];
    }),
    costChips(costText(ship.reward.purse)),
  );
  box.append(rating, when, army, pays);
  return box;
}
