import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Replace public/icon.svg with your own artwork; every icon size is generated from it at build time.
const background = "#0b1020";

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    // iOS fills transparent pixels with black, so give Home Screen icons a solid background.
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background } },
  },
  images: ["public/icon.svg"],
});
