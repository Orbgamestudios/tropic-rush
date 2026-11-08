// How hard a base or a raiding party is, against the crew's own headquarters: five bands from Easy
// (green) to Impossible (purple), shared by the map's islands and the raider ships. Enemy bases
// follow the crew's headquarters, a few levels either side, with the odd much stronger one, up to
// headquarters 50. No engine imports.

export const DIFFICULTIES = ["Easy", "Medium", "Hard", "Extreme", "Impossible"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** How many raiders each band calls for: one for an easy island, the whole crew of five at worst. */
export const RAIDERS: Record<Difficulty, number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
  Extreme: 4,
  Impossible: 5,
};

/** The strongest an enemy headquarters gets. */
export const MAX_ENEMY_HQ = 50;

/** How many levels above the crew's headquarters each band's bases stand, least and most. */
const BAND_GAPS: Record<Difficulty, readonly [number, number]> = {
  Easy: [-3, -1],
  Medium: [0, 1],
  Hard: [2, 3],
  Extreme: [4, 6],
  Impossible: [7, 12],
};

/** How often each band turns up, near home; further out the odds lean harder. */
const BAND_ODDS: Record<Difficulty, number> = {
  Easy: 0.3,
  Medium: 0.3,
  Hard: 0.2,
  Extreme: 0.13,
  Impossible: 0.07,
};

/** Where a headquarters level stands against the crew's. */
export function difficultyOf(hq: number, yourHq: number): Difficulty {
  const gap = hq - yourHq;
  for (let i = DIFFICULTIES.length - 1; i > 0; i--) {
    const band = DIFFICULTIES[i] as Difficulty;
    if (gap >= BAND_GAPS[band][0]) return band;
  }
  return "Easy";
}

/** Picks a band from `roll` (0 to 1). `lean` shifts the odds: above 0 harder, below easier. */
export function rollBand(roll: number, lean = 0): Difficulty {
  const shifted = Math.min(0.999, Math.max(0, roll + lean));
  let total = 0;
  for (const band of DIFFICULTIES) {
    total += BAND_ODDS[band];
    if (shifted < total) return band;
  }
  return "Impossible";
}

/** A headquarters level in a band, `depth` (0 to 1) of the way through it. */
export function hqInBand(band: Difficulty, yourHq: number, depth: number): number {
  const [least, most] = BAND_GAPS[band];
  const gap = least + Math.floor(depth * (most - least + 1));
  return Math.max(1, Math.min(MAX_ENEMY_HQ, yourHq + Math.min(most, gap)));
}
