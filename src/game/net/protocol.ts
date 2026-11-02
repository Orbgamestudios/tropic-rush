// Messages between a phone and its crew's island server (a Cloudflare Durable Object).
// The server checks every change with the same rules the phone uses (logic/crewIsland.ts),
// then sends the whole layout to every crewmate. Layouts are small, so this stays simple.

import type { Avatar } from "../logic/avatars";
import type { RaidSnapshot, Seat } from "../logic/coop";
import type { CrewLayout, LayoutOp, PlacedBuilding } from "../logic/crewIsland";
import type { Purse } from "../logic/economy";
import type { HeroKind } from "../logic/heroes";
import type { HeroInput } from "../logic/raid";
import type { MapIsland } from "../logic/worldMap";

export const MAX_CREW = 5;
export const MAX_NAME_LENGTH = 16;

/** Crew invite codes: 6 characters, leaving out look-alikes (0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CREW_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

export function newCrewCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

export function normalizeCrewCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function cleanName(input: string): string {
  return input.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

export interface Member {
  id: string;
  name: string;
  /** The icon they've picked. */
  avatar: Avatar;
  online: boolean;
}

/** A building a crewmate has picked up; nobody else can change it until they let go. */
export interface Hold {
  buildingId: string;
  memberId: string;
  name: string;
}

/** Passed from phone to phone through the crew's server, which doesn't look inside. */
export type RaidMessage =
  /**
   * A crewmate is heading out: from the moment they open their heroes, and on through the raid,
   * so everyone else's phone can show it. `island` stays null until they've picked one.
   */
  | {
      k: "invite";
      raidId: string;
      host: string;
      island: MapIsland | null;
      /** The raid's under way: too late to join, but the map can still show it. */
      raiding: boolean;
    }
  | { k: "cancel"; raidId: string }
  | { k: "join"; raidId: string; name: string; hero: HeroKind; upgrades: string[] }
  | { k: "seats"; raidId: string; seats: Seat[]; ready: string[]; island: MapIsland | null }
  /** A crewmate has scouted the island and is good to go, or has thought better of it. */
  | { k: "ready"; raidId: string; ready: boolean }
  | { k: "leave"; raidId: string }
  | { k: "start"; raidId: string; seats: Seat[]; island: MapIsland }
  | { k: "input"; raidId: string; seat: number; input: HeroInput }
  | { k: "snap"; raidId: string; snap: RaidSnapshot };

export type ClientMessage =
  | { t: "hello"; memberId: string; name: string; avatar: Avatar }
  | { t: "op"; op: LayoutOp; opId: number }
  | { t: "hold"; buildingId: string | null }
  /** To one crewmate, or with no `to` to everyone else online. */
  | { t: "relay"; data: RaidMessage; to?: string };

export type ServerMessage =
  | {
      t: "state";
      layout: CrewLayout;
      members: Member[];
      holds: Hold[];
      by: string | null;
      /** The server's clock (milliseconds), so phones can work out the resources right now. */
      now: number;
    }
  | { t: "reject"; opId: number; reason: string }
  | { t: "relay"; from: string; data: RaidMessage }
  | { t: "full" };

/** The most a relayed message may weigh, in characters. */
export const MAX_RELAY = 64_000;

/** One entry in the world's directory of crews, which other crews can find and raid. */
export interface CrewEntry {
  code: string;
  name: string;
  hq: number;
  buildings: PlacedBuilding[];
  buffs: { health: number; damage: number };
}

/** A crew's report of raiding a real rival's island. */
export interface RaidReport {
  target: string;
  by: string;
  won: boolean;
  destroyedPercent: number;
  loot: Partial<Purse>;
}
