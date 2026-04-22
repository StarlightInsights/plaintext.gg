<script lang="ts">
  import { page } from '$app/state';
  import AppShell from '$lib/components/AppShell.svelte';
  import { DEFAULT_SLUG } from '$lib/constants';
  import { documents } from '$lib/state/documents.svelte';

  // Seed slug synchronously so AppShell.onMount sees the right value on first
  // render. On subsequent SPA navigations between documents, the effect below
  // flushes the outgoing document and initializes the incoming one.
  documents.setSlug(page.params.slug ?? DEFAULT_SLUG);
  let seeded = false;

  $effect(() => {
    const slug = page.params.slug ?? DEFAULT_SLUG;
    if (!seeded) {
      seeded = true;
      return;
    }
    documents.switchToSlug(slug);
  });
</script>

<AppShell />
