<script lang="ts">
  import '../app.css';
  import { preferences } from '$lib/state/preferences.svelte';

  let { children } = $props();

  // Seed preference state from localStorage synchronously so CSS variables
  // driven by `[data-theme=dark]` + font settings apply before first paint.
  preferences.hydrate();

  // Mirror the theme preference to <html data-theme> so CSS selectors like
  // [data-theme="dark"] pick it up. theme-init.js runs before Svelte mounts
  // and seeds this attribute; this effect keeps it in sync as the user toggles.
  $effect(() => {
    const theme = preferences.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.documentElement.style.backgroundColor = preferences.themeColor;
    document.querySelectorAll('meta[name="theme-color"]').forEach((el) => {
      if (el instanceof HTMLMetaElement) el.content = preferences.themeColor;
    });
  });
</script>

{@render children()}
