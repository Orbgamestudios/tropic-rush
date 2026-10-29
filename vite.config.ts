/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Lets `npm run phone` reach the dev/preview server through a Cloudflare quick tunnel.
const tunnelHosts = [".trycloudflare.com"];

export default defineConfig({
  server: { allowedHosts: tunnelHosts },
  preview: { allowedHosts: tunnelHosts },
  build: {
    // Phaser alone is ~1.3 MB; that's expected for a game and gets cached by the service worker.
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        // Keep Phaser in its own chunk so shipping a game update doesn't re-download the engine.
        codeSplitting: { groups: [{ name: "phaser", test: /node_modules[\\/]phaser/ }] },
      },
      onLog(level, log, handler) {
        // eruda (the ?debug console) uses eval internally; nothing to fix on our side.
        if (log.code === "EVAL" && log.id?.includes("eruda")) return;
        handler(level, log);
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
  plugins: [
    VitePWA({
      // Ask before swapping in a new version so an update never reloads mid-game.
      registerType: "prompt",
      // Generates favicon, apple-touch-icon and manifest icons from pwa-assets.config.ts.
      pwaAssets: { config: true },
      manifest: {
        name: "My PWA Game",
        short_name: "My Game",
        description: "A mobile web game.",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        background_color: "#0b1020",
        theme_color: "#0b1020",
      },
      workbox: {
        // Precache everything the game needs so it runs fully offline once installed.
        globPatterns: ["**/*.{js,css,html,svg,png,webp,jpg,ico,json,mp3,ogg,m4a,wav,woff2}"],
        // The ?debug console is only fetched on demand.
        globIgnores: ["**/eruda-*.js"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
});
