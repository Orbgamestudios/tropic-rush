import { describe, expect, it } from "vitest";
import { accountKey, passwordProblem, tokenAccount, usernameProblem } from "./account";

describe("accounts", () => {
  it("checks usernames", () => {
    expect(usernameProblem("Ann_42")).toBeNull();
    expect(usernameProblem("ab")).toMatch(/3 to 16/);
    expect(usernameProblem("a".repeat(17))).toMatch(/3 to 16/);
    expect(usernameProblem("no spaces")).toMatch(/letters/);
    expect(usernameProblem("../etc")).toMatch(/letters/);
  });

  it("wants a real password", () => {
    expect(passwordProblem("short")).toMatch(/8 characters/);
    expect(passwordProblem("long enough")).toBeNull();
    expect(passwordProblem("x".repeat(129))).toMatch(/too long/);
  });

  it("treats capitals as the same account", () => {
    expect(accountKey("AnN")).toBe(accountKey("ann"));
  });

  it("finds the account a token belongs to, and rejects rubbish", () => {
    expect(tokenAccount("ann.abc123")).toBe("ann");
    expect(tokenAccount("")).toBeNull();
    expect(tokenAccount("../x.abc")).toBeNull();
  });
});
