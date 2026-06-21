import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [sveltekit()],
  // Target modern browsers so lightningcss preserves color-mix(), backdrop-filter
  // (unprefixed), and other evergreen features. Without this, compiled CSS
  // strips backdrop-filter for older Safari compat.
  build: {
    cssTarget: ["chrome120", "firefox120", "safari17"],
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
  fmt: {},
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
});
