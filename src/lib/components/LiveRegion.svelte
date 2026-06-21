<script lang="ts">
  import { css } from 'styled-system/css';
  import { announcer } from '$lib/state/announce.svelte';
</script>

<div role="status" aria-live="polite" id="a11y-announce" class={css({ srOnly: true })}>{announcer.message}</div>
