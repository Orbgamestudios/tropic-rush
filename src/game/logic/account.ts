// Player accounts: the rules for names and passwords, shared by the phone and the server. An
// account is a name and a password, with no email, so a lost password can't be recovered. It holds
// the player's save, so the same player can pick up on another phone. No engine imports.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;
export const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

/** The most a saved game may weigh, in characters. */
export const MAX_SAVE_CHARS = 200_000;

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;

/** What's wrong with a username, or null if it's fine. */
export function usernameProblem(name: string): string | null {
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX)
    return `Names are ${USERNAME_MIN} to ${USERNAME_MAX} characters`;
  if (!USERNAME_PATTERN.test(name)) return "Use only letters, numbers and _";
  return null;
}

/** What's wrong with a password, or null if it's fine. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Passwords need ${PASSWORD_MIN} characters or more`;
  if (password.length > PASSWORD_MAX) return "That password is too long";
  return null;
}

/** Sign-in names don't care about capitals: "Ann" and "ann" are the same account. */
export function accountKey(name: string): string {
  return name.toLowerCase();
}

/** A session token starts with the account's key, which says where to look it up. */
export function tokenAccount(token: string): string | null {
  const key = token.split(".")[0] ?? "";
  return usernameProblem(key) === null ? key : null;
}
