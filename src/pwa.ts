import { registerSW } from "virtual:pwa-register";

export function setupPwa(): void {
  const updateServiceWorker = registerSW({
    onNeedRefresh() {
      showUpdateBanner(() => updateServiceWorker(true));
    },
  });

  // Safari can clear storage for sites that aren't used for a while; ask it to keep saves.
  navigator.storage?.persist?.().catch(() => {});
}

function showUpdateBanner(onAccept: () => void): void {
  const banner = document.createElement("button");
  banner.className = "update-banner";
  banner.textContent = "New version available. Tap to update";
  banner.addEventListener("click", onAccept, { once: true });
  document.body.append(banner);
}
