<script lang="ts">
  import { announcer } from '$lib/state/announce.svelte';
</script>

<div role="status" aria-live="polite" id="a11y-announce" class="sr-only">{announcer.message}</div>
