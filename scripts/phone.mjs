// Open the game on your iPhone with one command.
// Starts Vite, exposes it through a free Cloudflare quick tunnel (real HTTPS, works on any
// network, no account needed) and prints a QR code to scan with the iPhone camera.
//
//   npm run phone          dev server with hot reload
//   npm run phone:preview  production build with the service worker (test install + offline)
import { existsSync } from "node:fs";
import { bin, install, Tunnel } from "cloudflared";
import qrcode from "qrcode-terminal";
import { createServer, preview } from "vite";

const isPreview = process.argv.includes("--preview");
const port = isPreview ? 4173 : 5173;

if (!existsSync(bin)) {
  console.log("Downloading cloudflared (first run only)...");
  await install(bin);
}

const server = isPreview
  ? await preview({ preview: { port, strictPort: true } })
  : await (await createServer({ server: { port, strictPort: true } })).listen();
server.printUrls();

const tunnel = Tunnel.quick(`http://localhost:${port}`);
tunnel.once("url", (url) => {
  console.log(`\n  Scan with your iPhone camera, or open: ${url}\n`);
  qrcode.generate(url, { small: true });
  console.log("  Add ?debug to the URL for an on-screen console. Ctrl+C to stop.\n");
});
tunnel.on("error", (error) => console.error("Tunnel error:", error.message));

const shutdown = async () => {
  tunnel.stop();
  await server.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
