<script lang="ts">
  import { page } from '$app/state';
  import AppShell from '$lib/components/AppShell.svelte';
  import { DEFAULT_SLUG } from '$lib/constants';
  import { documents } from '$lib/state/documents.svelte';

  // Set slug synchronously so AppShell's onMount sees the correct value.
  // Document dialog links use `data-sveltekit-reload`, so this runs once per load.
  documents.setSlug(page.params.slug ?? DEFAULT_SLUG);
</script>

<AppShell />
