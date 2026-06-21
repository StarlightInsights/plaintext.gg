<script lang="ts">
  import { onMount } from 'svelte';
  import { dev } from '$app/environment';
  import { base } from '$app/paths';
  import '../app.css';
  import { preferences } from '$lib/state/preferences.svelte';

  let { children } = $props();

  // Seed preference state from localStorage synchronously so CSS variables
  // driven by `[data-theme=dark]` + font settings apply before first paint.
  preferences.hydrate();

  // Service worker lifecycle. SvelteKit's auto-registration is disabled
  // (see svelte.config.js) so we control it explicitly:
  //  - Production: register it (offline shell + PWA / share target).
  //  - Development: it must NOT run — against the Vite dev server it intercepts
  //    navigations and serves a cached shell that fights the module graph, which
  //    intermittently renders a raw JS module as the page. Tear down any worker a
  //    prior prod build (or the old auto-registration) left on this origin, drop
  //    its caches, and reload once so assets come straight from Vite.
  onMount(() => {
    if (!('serviceWorker' in navigator)) return;

    if (dev) {
      void navigator.serviceWorker.getRegistrations().then(async (regs) => {
        const hadWorker = regs.length > 0;
        await Promise.all(regs.map((r) => r.unregister()));
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if (hadWorker && navigator.serviceWorker.controller) location.reload();
      });
      return;
    }

    void navigator.serviceWorker.register(`${base}/service-worker.js`, { type: 'classic' });
  });

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
