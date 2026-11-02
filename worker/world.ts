// The world's directory of crews: one Durable Object that every crew's island keeps itself listed
// in, so other crews can find a base of about their strength to raid. It holds what a raid needs
// (the buildings and their levels) and nothing about the people in the crew beyond a crew name.

import { DurableObject } from "cloudflare:workers";
import type { CrewEntry } from "../src/game/net/protocol";

/** How much stronger or weaker a rival can be, in headquarters levels, before looking further. */
const NEAR_LEVELS = 3;

interface Row extends Record<string, SqlStorageValue> {
  entry: string;
}

export class WorldDirectory extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never);
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS crews (
         code TEXT PRIMARY KEY,
         hq INTEGER NOT NULL,
         updated INTEGER NOT NULL,
         entry TEXT NOT NULL
       );
       CREATE INDEX IF NOT EXISTS crews_hq ON crews (hq);`,
    );
  }

  publish(entry: CrewEntry): void {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO crews (code, hq, updated, entry) VALUES (?, ?, ?, ?)",
      entry.code,
      entry.hq,
      Date.now(),
      JSON.stringify(entry),
    );
  }

  /** Crews near this strength, most recently active first, leaving out the one asking. */
  rivals(code: string, hq: number, count: number): CrewEntry[] {
    const pick = (low: number, high: number) =>
      this.ctx.storage.sql
        .exec<Row>(
          `SELECT entry FROM crews WHERE code != ? AND hq BETWEEN ? AND ?
           ORDER BY updated DESC LIMIT ?`,
          code,
          low,
          high,
          count,
        )
        .toArray()
        .map((row) => JSON.parse(row.entry) as CrewEntry);
    const near = pick(hq - NEAR_LEVELS, hq + NEAR_LEVELS);
    return near.length >= count ? near : pick(1, 99);
  }
}
