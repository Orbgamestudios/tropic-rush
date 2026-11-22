import { expect, type Page, test } from "@playwright/test";
import { preview } from "vite";

// The story's opening takes the screen on a new phone, so tests that aren't about it turn it off.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("tropic-rush:story-off", "1"));
});

test("opens with the story, then talks over the first raid", async ({ page }) => {
  // The opening draws at one or two frames a second in a software-drawn test browser.
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.removeItem("tropic-rush:story-off"));
  await page.goto("/?testhooks");
  await hooksReady(page);
  // The prologue is a cutscene: black bars, and Sergeant Steele's first line as a subtitle.
  await expect(page.locator(".story.film")).toBeVisible({ timeout: 60_000 });
  // A test browser draws too slowly to wait a shot out, so a tap moves it on to his line.
  await expect(async () => {
    await page.mouse.click(300, 150);
    await expect(page.locator(".story-sub-name")).toHaveText("Sgt. Steele", { timeout: 1500 });
  }).toPass({ timeout: 60_000 });
  // A tap moves it on a line; enough of them see it out.
  await expect(async () => {
    await page.mouse.click(300, 150);
    await expect(page.locator(".story")).toBeHidden({ timeout: 250 });
  }).toPass({ timeout: 60_000 });
  type Hooks = { tropicRush: { raidAs(kind: string): void; save(): { storySeen: string[] } } };
  expect(
    await page.evaluate(() => (window as unknown as Hooks).tropicRush.save().storySeen),
  ).toEqual(["prologue"]);
  await page.evaluate(() => (window as unknown as Hooks).tropicRush.raidAs("rifleman"));
  await expect(page.locator(".story.bark .story-name")).toHaveText("Sgt. Steele", {
    timeout: 60_000,
  });
  expect(errors).toEqual([]);
});

test("boots without errors and fills the screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  const canvas = page.locator("#game > canvas");
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(box?.width).toBeCloseTo(viewport?.width ?? 0, 0);
  expect(box?.height).toBeCloseTo(viewport?.height ?? 0, 0);
  expect(errors).toEqual([]);
});

/** Through the boat: Ready, on to the console (skipping the walk), Set off, and skip the landing. */
async function throughTheBoat(page: Page): Promise<void> {
  await page.locator(".boat-ready").click({ timeout: 90_000 });
  await page
    .locator(".boat-skip")
    .click({ timeout: 30_000 })
    .catch(() => undefined);
  await page.locator(".boat-setoff").click({ timeout: 90_000 });
  await page.locator(".boat-skip").click({ timeout: 60_000 });
}
/** The test hooks go on once the game has started, which can be a moment after the page loads. */
async function hooksReady(page: Page): Promise<void> {
  await page.waitForFunction(() => "tropicRush" in window, null, { polling: 250 });
}

async function openMap(page: Page): Promise<void> {
  await page.goto("/?testhooks");
  await hooksReady(page);
  await page.evaluate(() =>
    (window as unknown as { tropicRush: { openHeroes(): void } }).tropicRush.openHeroes(),
  );
  await page.getByRole("button", { name: "Raid", exact: true }).click();
}

test("gets through to a raid with block figures when no models load", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*.glb", (route) => route.abort());

  await openMap(page);
  await page.locator("button.map-pin:not(.map-ship-pin):visible").first().click();
  await page.getByRole("button", { name: "Attack" }).click();
  await throughTheBoat(page);
  await expect(page.locator(".hud-objective-time")).toBeVisible({ timeout: 90_000 });
  expect(errors).toEqual([]);
});

test("picks a hero and starts a raid", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // On a phone you tap the Heroes button; the hook opens the same screen.
  await page.goto("/?testhooks");
  await hooksReady(page);
  await page.evaluate(() =>
    (window as unknown as { tropicRush: { openHeroes(): void } }).tropicRush.openHeroes(),
  );
  await page.getByRole("button", { name: "Rifleman", exact: true }).click();
  await page.getByRole("button", { name: "Raid", exact: true }).click();
  await page.locator("button.map-pin:not(.map-ship-pin):visible").first().click();
  await page.getByRole("button", { name: "Attack" }).click();
  await throughTheBoat(page);

  const timer = page.locator(".hud-objective-time");
  // After the run in and the landing.
  await expect(timer).toBeVisible({ timeout: 90_000 });
  await expect(timer).toHaveText(/^4:\d\d$/, { timeout: 40_000 });
  await expect(page.locator(".hud-objective-pct")).toHaveText("0%");
  // The hero's health bar floats over them.
  await expect(page.locator(".bar-crew").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("drags round the world map, and says what lifts the next cloud", async ({ page }) => {
  await openMap(page);
  await expect(page.locator(".map-progress")).toContainText("to lift a cloud", { timeout: 60_000 });
  const pin = page.locator("button.map-pin:not(.map-ship-pin):visible").first();
  const before = await pin.evaluate((node) => (node as HTMLElement).style.transform);
  await page.mouse.move(400, 180);
  await page.mouse.down();
  await page.mouse.move(300, 150, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(() => pin.evaluate((node) => (node as HTMLElement).style.transform), { timeout: 40_000 })
    .not.toBe(before);
});

test("opens the gunboat's view from wherever the hero is", async ({ page }) => {
  // The boat scene draws at about a frame a second in a software-drawn test browser.
  test.setTimeout(240_000);
  await openMap(page);
  await page.locator("button.map-pin:not(.map-ship-pin):visible").first().click();
  await page.getByRole("button", { name: "Attack" }).click();
  await throughTheBoat(page);
  const boat = page.locator(".hud-boat");
  await expect(boat).toBeVisible({ timeout: 60_000 });
  await boat.click();
  await expect(page.locator(".hud-tray-box")).toBeVisible({ timeout: 40_000 });
});

test("sends a medic to attack on her own", async ({ page }) => {
  await page.goto("/?testhooks");
  await hooksReady(page);
  await page.evaluate(() => {
    const { tropicRush } = window as unknown as {
      tropicRush: { openHeroes(): void; syncNow(changes: { unlocked: string[] }): void };
    };
    tropicRush.syncNow({ unlocked: ["rifleman", "medic"] });
    tropicRush.openHeroes();
  });
  await page.getByRole("button", { name: "Medic", exact: true }).click();
  await page.getByRole("button", { name: "Raid", exact: true }).click();
  await page.locator("button.map-pin:not(.map-ship-pin):visible").first().click();
  await expect(page.getByRole("button", { name: "Attack" })).toBeEnabled();
});

test("scouts an island, then attacks it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openMap(page);
  await page.locator("button.map-pin:not(.map-ship-pin):visible").first().click();
  await page.getByRole("button", { name: "Scout" }).click();
  await expect(page.locator(".scout-tile").first()).toBeVisible({ timeout: 60_000 });

  await page.locator(".scout-attack").click();
  await throughTheBoat(page);
  await expect(page.locator(".hud-objective-time")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".scout-tile").first()).toBeHidden();
  expect(errors).toEqual([]);
});

test("backs out of scouting and scouts again", async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openMap(page);
  for (let round = 0; round < 2; round++) {
    await page.locator("button.map-pin:not(.map-ship-pin):visible").first().click();
    await page.getByRole("button", { name: "Scout" }).click();
    await expect(page.locator(".scout-tile").first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Back to map" }).click();
    await expect(page.locator("button.map-pin:not(.map-ship-pin):visible").first()).toBeVisible({
      timeout: 60_000,
    });
  }
  expect(errors).toEqual([]);
});

test("is installable to the Home Screen", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);

  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await request.get(href ?? "")).json();
  expect(manifest).toMatchObject({ display: "standalone", start_url: "/" });
  expect(manifest.icons).toContainEqual(expect.objectContaining({ sizes: "512x512" }));
});

test("works offline after the first visit", async ({ page }) => {
  // Shut down a server of our own instead of using context.setOffline(): in WebKit, Playwright's
  // offline emulation (and request routing) also blocks pages the service worker serves from cache.
  const server = await preview({ preview: { port: 0 }, logLevel: "silent" });
  await page.goto(server.resolvedUrls?.local[0] ?? "");
  await page.evaluate(() => navigator.serviceWorker.ready);

  await server.close();
  await page.reload();
  await expect(page.locator("#game > canvas")).toBeVisible();
});

test("builds on the crew island offline", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // The game opens on the crew island; with no crew yet it's this phone's own island.
  await page.goto("/?testhooks");
  await hooksReady(page);
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("button", { name: /Gun turret/ }).click();

  const count = () =>
    page.evaluate(
      () =>
        (
          window as unknown as { tropicRush: { crew(): { layout: { buildings: unknown[] } } } }
        ).tropicRush.crew().layout.buildings.length,
    );
  await expect.poll(count, { timeout: 40_000 }).toBe(2);
  await expect(page.getByRole("button", { name: "Rotate" })).toBeVisible();

  // Removing asks again first, since it can't be undone. Both taps go in one step: a test
  // browser's slow clicks would outlast the few seconds it stays armed.
  const counts = await page.getByRole("button", { name: "Remove" }).evaluate((b: HTMLElement) => {
    const { tropicRush } = window as unknown as {
      tropicRush: { crew(): { layout: { buildings: unknown[] } } };
    };
    const buildings = () => tropicRush.crew().layout.buildings.length;
    b.click();
    const afterOne = buildings();
    b.click();
    return [afterOne, buildings()];
  });
  expect(counts).toEqual([2, 1]);
  expect(errors).toEqual([]);
});

test("opens the profile from the crew bar, and the map from its button", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?testhooks");
  await hooksReady(page);
  await page.getByRole("button", { name: "Profile and crew" }).click();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  await page.getByRole("button", { name: "Close profile" }).click();
  await expect(page.getByRole("button", { name: "Create account" })).toBeHidden();

  await page.getByRole("button", { name: "World map" }).click();
  await expect(page.locator("button.map-pin:not(.map-ship-pin):visible").first()).toBeVisible({
    timeout: 60_000,
  });
  expect(errors).toEqual([]);
});

test("resets the game from the settings, only after confirming", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("/?testhooks");
  await hooksReady(page);
  type Hooks = { tropicRush: { save(): { gold: number }; syncNow(c: object): Promise<void> } };
  await page.evaluate(() => (window as unknown as Hooks).tropicRush.syncNow({ gold: 9999 }));
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Reset game" }).click();
  // Backing out leaves everything as it was.
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(await page.evaluate(() => (window as unknown as Hooks).tropicRush.save().gold)).toBe(9999);
  await page.getByRole("button", { name: "Reset game" }).click();
  await page.getByRole("button", { name: "Erase everything" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Hooks).tropicRush?.save().gold), {
      timeout: 120_000,
    })
    .toBe(0);
});

test("runs a night raid, replays it and reports the result", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // A raider ship has struck since this phone last looked: the raid plays out on the way in.
  await page.addInitScript(() => {
    localStorage.setItem("tropic-rush:save:v1", JSON.stringify({ nightChecked: 1 }));
  });
  await page.goto("/");
  await expect(page.locator(".crew-night-result")).toHaveText(/Island (held|overrun)!/, {
    timeout: 60_000,
  });
  await expect(page.locator(".crew-night-ship")).toContainText("Likely to strike between");
  await page.getByRole("button", { name: "Watch replay" }).click();
  await expect(page.locator(".replay-title")).toBeVisible({ timeout: 40_000 });
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.locator(".crew-night-result")).toHaveText(/Island (held|overrun)!/, {
    timeout: 40_000,
  });
  expect(errors).toEqual([]);
});

test("keeps tools and statues under Build, and heroes beside the map", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await expect(page.locator(".crew-tool-rows")).toBeVisible();
  await page.locator(".crew-tools").getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("button", { name: "Statues", exact: true }).click();
  await expect(page.locator(".crew-statue-rows")).toBeVisible();
  await page.locator(".crew-statues").getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Heroes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Raid", exact: true })).toBeVisible();
});

test("buys the first upgrade, and holds the next back for a better headquarters", async ({
  page,
}) => {
  await page.goto("/?testhooks");
  await hooksReady(page);
  await page.evaluate(() => {
    const { tropicRush } = window as unknown as {
      tropicRush: {
        openHeroes(): void;
        syncNow(changes: { crystals: Record<string, number> }): void;
        crewOp(op: { kind: "loot"; purse: { gold: number } }): boolean;
      };
    };
    tropicRush.syncNow({ crystals: { nature: 9, fire: 9, ice: 9, dark: 9 } });
    tropicRush.crewOp({ kind: "loot", purse: { gold: 700 } });
    tropicRush.openHeroes();
  });
  await page.getByRole("button", { name: "Upgrades" }).click();
  const buy = page.locator(".tree-buy");
  await expect(page.locator(".tree-spec-name")).toHaveText("Basic Training");
  await buy.click();
  // The first mini leads to tier 2, at headquarters 2.
  await page.locator(".tree-step").first().click();
  await expect(page.locator(".tree-spec-path")).toHaveText(/mini/i);
  await expect(page.locator(".tree-spec-note")).toHaveText("Needs headquarters 2");
  await expect(buy).toBeDisabled();
});
