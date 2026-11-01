// The seven heroes. Looks are Decided in docs/DESIGN.md; these gameplay numbers are the
// unreviewed first pass ("Proposed"), tuned only enough to make the draft playable.

export type HeroKind =
  | "rifleman"
  | "medic"
  | "tank"
  | "heavy"
  | "bazooka"
  | "grenadier"
  | "engineer";

export const HERO_KINDS: readonly HeroKind[] = [
  "rifleman",
  "medic",
  "tank",
  "heavy",
  "bazooka",
  "grenadier",
  "engineer",
];

export type HeroAttack =
  | {
      kind: "burst";
      range: number;
      damage: number;
      reload: number;
      speed: number;
      shots: number;
      interval: number;
    }
  | {
      kind: "minigun";
      range: number;
      damage: number;
      /** Seconds between shots when fully spun up, and when just starting. */
      fastInterval: number;
      slowInterval: number;
      spinUp: number;
      spread: number;
      speed: number;
    }
  | {
      kind: "shell";
      range: number;
      damage: number;
      reload: number;
      speed: number;
      /** Splash radius; 0 for a plain bullet. */
      splash: number;
      buildingBonus: number;
    }
  | {
      kind: "lob";
      range: number;
      damage: number;
      reload: number;
      splash: number;
      flightTime: number;
    }
  | {
      kind: "spray";
      range: number;
      damage: number;
      heal: number;
      reload: number;
      coneHalfAngle: number;
    };

/**
 * Half-width of a hero's shot spread in radians: how far shots stray either side of the aim.
 * The aim cone on screen is drawn this wide.
 */
export function shotSpread(kind: HeroKind): number {
  const atk = HEROES[kind].attack;
  switch (atk.kind) {
    case "minigun":
      return atk.spread;
    case "spray":
      return atk.coneHalfAngle;
    case "burst":
      return 0.05;
    case "shell":
      return 0.03;
    case "lob":
      return 0.06;
  }
}

export interface HeroSpec {
  name: string;
  role: string;
  hp: number;
  /** Meters per second. */
  speed: number;
  radius: number;
  attack: HeroAttack;
  /** Harpoons do bonus damage to heavy heroes. */
  heavy: boolean;
}

export const HEROES: Record<HeroKind, HeroSpec> = {
  rifleman: {
    name: "Rifleman",
    role: "All-rounder",
    hp: 1500,
    speed: 6.2,
    radius: 0.55,
    attack: {
      kind: "burst",
      range: 15,
      damage: 55,
      reload: 0.85,
      speed: 34,
      shots: 3,
      interval: 0.09,
    },
    heavy: false,
  },
  medic: {
    name: "Medic",
    role: "Keeps the crew alive",
    hp: 1250,
    speed: 5.6,
    radius: 0.55,
    attack: { kind: "spray", range: 7, damage: 26, heal: 30, reload: 0.15, coneHalfAngle: 0.6 },
    heavy: false,
  },
  tank: {
    name: "Tank",
    role: "Armored building-breaker",
    hp: 4200,
    speed: 3.8,
    radius: 1.4,
    attack: {
      kind: "shell",
      range: 16,
      damage: 240,
      reload: 1.6,
      speed: 26,
      splash: 2.2,
      buildingBonus: 1.3,
    },
    heavy: true,
  },
  heavy: {
    name: "Heavy",
    role: "Front-line protector",
    hp: 2800,
    speed: 4.6,
    radius: 0.75,
    attack: {
      kind: "minigun",
      range: 10,
      damage: 18,
      fastInterval: 0.07,
      slowInterval: 0.22,
      spinUp: 1.8,
      spread: 0.1,
      speed: 32,
    },
    heavy: true,
  },
  bazooka: {
    name: "Bazooka",
    role: "Fragile defense-killer",
    hp: 1100,
    speed: 5.4,
    radius: 0.55,
    attack: {
      kind: "shell",
      range: 19,
      damage: 330,
      reload: 2.2,
      speed: 22,
      splash: 2.4,
      buildingBonus: 1,
    },
    heavy: false,
  },
  grenadier: {
    name: "Grenadier",
    role: "Hits things behind cover",
    hp: 1300,
    speed: 5.4,
    radius: 0.55,
    attack: { kind: "lob", range: 14, damage: 170, reload: 1.3, splash: 3, flightTime: 0.9 },
    heavy: false,
  },
  engineer: {
    name: "Engineer",
    role: "Turrets and repairs",
    hp: 1500,
    speed: 5.4,
    radius: 0.55,
    attack: {
      kind: "shell",
      range: 13,
      damage: 38,
      reload: 0.32,
      speed: 30,
      splash: 0,
      buildingBonus: 1,
    },
    heavy: false,
  },
};

/** Heroes a new player can pick right away (the Barracks unlocks are a later step). */
export const STARTER_HEROES: readonly HeroKind[] = ["rifleman", "heavy", "medic"];
