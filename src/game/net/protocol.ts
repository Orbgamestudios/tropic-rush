// Messages between a phone and its crew's island server (a Cloudflare Durable Object).
// The server checks every change with the same rules the phone uses (logic/crewIsland.ts),
// then sends the whole layout to every crewmate. Layouts are small, so this stays simple.

import type { CrewLayout, LayoutOp } from "../logic/crewIsland";

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
  online: boolean;
}

/** A building a crewmate has picked up; nobody else can change it until they let go. */
export interface Hold {
  buildingId: string;
  memberId: string;
  name: string;
}

export type ClientMessage =
  | { t: "hello"; memberId: string; name: string }
  | { t: "op"; op: LayoutOp; opId: number }
  | { t: "hold"; buildingId: string | null };

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
  | { t: "full" };
