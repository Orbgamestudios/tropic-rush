// The player icons a profile can use, two for most heroes. The pictures are in public/avatars.

export const AVATARS = [
  "rifleman-1",
  "rifleman-2",
  "medic-1",
  "medic-2",
  "heavy-1",
  "heavy-2",
  "tank-1",
  "tank-2",
  "bazooka-1",
  "bazooka-2",
  "grenadier-1",
  "grenadier-2",
  "engineer-1",
  "engineer-2",
] as const;

export type Avatar = (typeof AVATARS)[number];

export const DEFAULT_AVATAR: Avatar = "rifleman-1";

/** Reads an icon from anywhere untrusted, falling back to the default. */
export function readAvatar(value: unknown): Avatar {
  return AVATARS.find((a) => a === value) ?? DEFAULT_AVATAR;
}

export function avatarUrl(avatar: Avatar): string {
  return `/avatars/${avatar}.jpg`;
}
