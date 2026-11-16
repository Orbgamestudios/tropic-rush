// The whole script in one place. See script.ts for how it's put together.

import { FINALE } from "./finale";
import { OPENING } from "./opening";
import { RESCUES } from "./rescues";
import type { Scene } from "./script";
import { TERROR } from "./terror";

export * from "./delivery";
export * from "./hints";
export { QUESTIONS } from "./life";
export * from "./progress";
export * from "./script";

export const SCENES: readonly Scene[] = [...OPENING, ...RESCUES, ...TERROR, ...FINALE];

export function scene(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}
