import { defineConfig } from "@pandacss/dev";

// Shared monospace fallback stack (matches the previous Tailwind @theme fonts).
const MONO_FALLBACK =
  'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

export default defineConfig({
  // Static codegen mode: Panda extracts to `styled-system/styles.css`, which
  // `src/app.css` imports. No PostCSS/Vite plugin — vite-plus uses lightningcss.
  // Panda's preflight is the app's CSS reset now that Tailwind is removed.
  preflight: true,

  include: ["./src/**/*.{js,ts,svelte}"],
  exclude: [],
  outdir: "styled-system",

  // Remap the built-in `_dark` condition to this app's runtime selector. The
  // theme is toggled via `html[data-theme="dark"]` (set in +layout.svelte), not
  // a `.dark` class, so semantic tokens emit their dark value under this scope.
  conditions: {
    extend: {
      dark: '[data-theme="dark"] &',
      // Gate hover styles behind a hover-capable pointer, matching Tailwind v4's
      // default `hover:` behavior (so touch devices get no sticky hover state).
      // Used as a nested wrapper: `_hoverable: { _hover: { ... } }`.
      hoverable: "@media (hover: hover)",
    },
  },

  theme: {
    extend: {
      tokens: {
        fonts: {
          main: { value: `"CommitMono", ${MONO_FALLBACK}` },
          header: { value: `"CommitMono-250", ${MONO_FALLBACK}` },
          dialog: { value: `"CommitMono-200", ${MONO_FALLBACK}` },
        },
      },

      // Light = base, dark = `[data-theme="dark"]`. Values are the exact OKLCH
      // colors previously defined as runtime CSS vars in app.css.
      semanticTokens: {
        colors: {
          bg: { value: { base: "oklch(1 0 89.88)", _dark: "oklch(0.218 0 89.88)" } },
          panel: { value: { base: "oklch(1 0 89.88)", _dark: "oklch(0.252 0 89.88)" } },
          line: { value: { base: "oklch(0.922 0 89.88)", _dark: "oklch(0.285 0 89.88)" } },
          panelLine: { value: { base: "oklch(0.8 0 89.88)", _dark: "oklch(0.321 0 89.88)" } },
          fg: { value: { base: "oklch(0.218 0 89.88)", _dark: "oklch(0.907 0 89.88)" } },
          muted: { value: { base: "oklch(0.5 0 89.88)", _dark: "oklch(0.51 0 89.88)" } },
          secondary: { value: { base: "oklch(0.683 0 89.88)", _dark: "oklch(0.51 0 89.88)" } },
          placeholder: { value: { base: "oklch(0.845 0 89.88)", _dark: "oklch(0.387 0 89.88)" } },
          error: { value: { base: "oklch(0.58 0.18 23)", _dark: "oklch(0.72 0.17 23)" } },
          overlay: { value: { base: "oklch(0 0 0 / 0.4)", _dark: "oklch(0 0 0 / 0.667)" } },
        },
      },

      keyframes: {
        "toolbar-slide-in": {
          from: { opacity: "0", transform: "translateY(-10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Ark Dialog sets `hidden` on the content while closed, so an opacity
        // *transition* can't run on reveal — an entrance animation does. Mirrors
        // the old native-<dialog> @starting-style fade-in.
        "dialog-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
    },
  },
});
