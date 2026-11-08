// The whole script in one place. See script.ts for how it's put together.

import { FINALE } from "./finale";
import { CAMPFIRES } from "./life";
import { OPENING } from "./opening";
import { RESCUES } from "./rescues";
import type { Scene } from "./script";
import { TERROR } from "./terror";

export { CHATTER, QUESTIONS } from "./life";
export * from "./script";

export const SCENES: readonly Scene[] = [
  ...OPENING,
  ...RESCUES,
  ...TERROR,
  ...FINALE,
  ...CAMPFIRES,
];

export function scene(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}
