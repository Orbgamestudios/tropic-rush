import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Every icon size is generated from public/icon.png at build time. The artwork fills the whole
// icon, so nothing gets a padded border.
const background = "#0b1020";

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    // iOS fills transparent pixels with black, so give Home Screen icons a solid background.
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background } },
  },
  images: ["public/icon.png"],
});
