import { expect, type Page, test } from "@playwright/test";
import { preview } from "vite";

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

async function openMap(page: Page): Promise<void> {
  await page.goto("/?testhooks");
  await page.evaluate(() =>
    (window as unknown as { tropicRush: { openHeroes(): void } }).tropicRush.openHeroes(),
  );
  await page.getByRole("button", { name: "Raid", exact: true }).click();
}

test("picks a hero and starts a raid", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // On a phone you tap a strolling hero; the hook opens the same screen without chasing one.
  await page.goto("/?testhooks");
  await page.evaluate(() =>
    (window as unknown as { tropicRush: { openHeroes(): void } }).tropicRush.openHeroes(),
  );
  await page.getByRole("button", { name: "Rifleman", exact: true }).click();
  await page.getByRole("button", { name: "Raid", exact: true }).click();
  await page.locator(".map-pin:visible").first().click();
  await page.getByRole("button", { name: "Attack" }).click();

  const timer = page.locator(".hud-objective-time");
  await expect(timer).toBeVisible();
  await expect(timer).toHaveText(/^4:\d\d$/, { timeout: 40_000 });
  await expect(page.locator(".hud-objective-pct")).toHaveText("0%");
  // The hero's health bar floats over them.
  await expect(page.locator(".bar-crew").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("drags round the world map, with clouds saying what lifts them", async ({ page }) => {
  await openMap(page);
  await expect(page.locator(".map-cloud-plate").first()).toBeAttached({ timeout: 60_000 });
  const pin = page.locator(".map-pin:visible").first();
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
  await openMap(page);
  await page.locator(".map-pin:visible").first().click();
  await page.getByRole("button", { name: "Attack" }).click();
  const boat = page.locator(".hud-boat");
  await expect(boat).toBeVisible({ timeout: 60_000 });
  await boat.click();
  await expect(page.locator(".hud-tray-box")).toBeVisible({ timeout: 40_000 });
});

test("won't send a medic to attack on her own", async ({ page }) => {
  await page.goto("/?testhooks");
  await page.evaluate(() =>
    (window as unknown as { tropicRush: { openHeroes(): void } }).tropicRush.openHeroes(),
  );
  await page.getByRole("button", { name: "Medic", exact: true }).click();
  await page.getByRole("button", { name: "Raid", exact: true }).click();
  await page.locator(".map-pin:visible").first().click();
  await expect(page.getByRole("button", { name: "Attack" })).toBeDisabled();
  await expect(page.locator(".map-card-note")).toHaveText(/can't hurt buildings/);
});

test("scouts an island, then attacks it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openMap(page);
  await page.locator(".map-pin:visible").first().click();
  await page.getByRole("button", { name: "Scout" }).click();
  await expect(page.locator(".scout-tile").first()).toBeVisible({ timeout: 60_000 });

  await page.locator(".scout-attack").click();
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
    await page.locator(".map-pin:visible").first().click();
    await page.getByRole("button", { name: "Scout" }).click();
    await expect(page.locator(".scout-tile").first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Back to map" }).click();
    await expect(page.locator(".map-pin:visible").first()).toBeVisible({ timeout: 60_000 });
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
  await page.getByRole("button", { name: "Profile and crew" }).click();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  await page.getByRole("button", { name: "Close profile" }).click();
  await expect(page.getByRole("button", { name: "Create account" })).toBeHidden();

  await page.getByRole("button", { name: "World map" }).click();
  await expect(page.locator(".map-pin:visible").first()).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
});

test("runs a night raid, replays it and reports the result", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Night raid", exact: true }).click();
  await page.getByRole("button", { name: "Raid now" }).click();
  await expect(page.locator(".replay-title")).toBeVisible({ timeout: 40_000 });
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.locator(".crew-night-result")).toHaveText(/Island (held|overrun)!/, {
    timeout: 40_000,
  });
  expect(errors).toEqual([]);
});
