// What a raid sounds and feels like: turns the rules' events into recorded sounds, quieter with
// distance from the player, and taps of the vibration motor for what's close.

import { HEROES } from "../logic/heroes";
import type { RaidEvent, RaidHero, RaidState } from "../logic/raid";
import { distance, type Vec2 } from "../logic/vec";
import { sfx } from "../ui/kit/fx";
import { haptic } from "./haptics";
import { playSample, type Sample } from "./samples";

/** Past this many meters from the player, nothing can be heard. */
const HEARING = 60;
const NEAR = 14;

function shotSound(e: Extract<RaidEvent, { type: "shot" }>, state: RaidState): Sample | null {
  switch (e.kind) {
    case "vial":
      return null;
    case "grenade":
    case "harpoon":
      return "thump";
    case "rocket":
    case "shell":
    case "mortar":
      return "cannon";
    case "artillery":
      return null;
    case "bullet": {
      if (e.team === "enemy") return "turret";
      const owner = state.heroes.find((h) => h.id === e.ownerId);
      return owner && HEROES[owner.kind].attack.kind === "burst" ? "rifle" : "gun";
    }
  }
}

export function playRaidEvents(
  events: readonly RaidEvent[],
  state: RaidState,
  player: RaidHero | undefined,
): void {
  const from = player?.pos;
  const volume = (pos: Vec2) => (from ? Math.max(0, 1 - distance(from, pos) / HEARING) ** 2 : 0.5);
  const near = (pos: Vec2) => (from ? distance(from, pos) < NEAR : false);
  for (const e of events) {
    switch (e.type) {
      case "shot": {
        const sound = shotSound(e, state);
        const mine = e.ownerId === player?.id;
        if (sound) playSample(sound, volume(e.pos) * (mine ? 0.8 : 0.5));
        if (mine) haptic("light");
        break;
      }
      case "explosion":
        playSample(e.radius >= 3 ? "bigblast" : "blast", volume(e.pos));
        if (near(e.pos)) haptic(e.radius >= 3 ? "heavy" : "medium");
        break;
      case "hit":
        playSample("hit", volume(e.pos) * 0.4);
        break;
      case "healBurst":
        playSample("heal", volume(e.pos) * 0.7);
        break;
      case "destroyed":
        playSample("collapse", volume(e.pos), 0.85);
        haptic("heavy");
        break;
      case "loot":
        playSample("loot", volume(e.pos) * 0.8);
        break;
      case "heroDown":
        if (e.id === player?.id) haptic("heavy");
        break;
      case "boatFire":
        playSample("cannon", 0.8, 0.8);
        haptic("medium");
        break;
      case "mineTriggered":
        sfx.tick();
        break;
      default:
        break;
    }
  }
}
