import { expect, test } from "@playwright/test";
import { preview } from "vite";

test("boots without errors and fills the screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  const canvas = page.locator("#game canvas");
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(box?.width).toBeCloseTo(viewport?.width ?? 0, 0);
  expect(box?.height).toBeCloseTo(viewport?.height ?? 0, 0);
  expect(errors).toEqual([]);
});

test("starts a raid from the menus", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByRole("button", { name: /Rifleman/ }).click();
  await page.getByRole("button", { name: "Start raid" }).click();

  const timer = page.locator(".hud-timer");
  await expect(timer).toBeVisible();
  await expect(timer).toHaveText(/^4:\d\d$/, { timeout: 40_000 });
  await expect(page.locator(".hud-destroyed")).toHaveText("0% destroyed");
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
  await expect(page.locator("#game canvas")).toBeVisible();
});
