import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import webExtension from "vite-plugin-web-extension";

const target = process.env.TARGET ?? "chrome";

export default defineConfig({
  plugins: [
    tailwindcss(),
    webExtension({
      browser: target,
      manifest: "src/manifest.json",
    }),
  ],
  build: {
    outDir: `dist-${target}`,
    emptyOutDir: true,
  },
});
