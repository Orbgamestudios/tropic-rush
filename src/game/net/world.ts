// The phone's line to the world's directory of crews: who's out there to raid, and word to a rival
// crew of what happened on their island. Without a server (offline, or `npm run dev`) these quietly
// come back empty, and stand-in crews keep the player islands filled.

import type { Rival } from "../logic/worldMap";
import type { RaidReport } from "./protocol";

export async function fetchRivals(code: string, hq: number): Promise<Rival[]> {
  try {
    const response = await fetch("/api/world/rivals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, hq }),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { crews?: unknown };
    return Array.isArray(body.crews) ? (body.crews as Rival[]) : [];
  } catch {
    return [];
  }
}

export async function reportRaid(report: RaidReport): Promise<void> {
  try {
    await fetch("/api/world/raid", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
    });
  } catch {
    // The rival never hears about it, which is no loss to anyone.
  }
}
