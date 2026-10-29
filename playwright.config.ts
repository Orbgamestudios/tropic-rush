import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the production build, service worker included.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // The test browsers draw 3D in software, which is slow: run two at a time and allow more time.
  workers: 2,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    // WebKit is Safari's engine: the closest you can get to an iPhone without one.
    // The game is played sideways, so test the landscape iPhone.
    { name: "iphone-webkit", use: { ...devices["iPhone 15 landscape"] } },
    {
      name: "iphone-chromium",
      use: { ...devices["iPhone 15 landscape"], browserName: "chromium" },
    },
  ],
});
