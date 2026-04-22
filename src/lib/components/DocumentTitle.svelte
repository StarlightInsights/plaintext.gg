<script lang="ts">
  import { DEFAULT_SLUG } from '$lib/constants';
  import { documents } from '$lib/state/documents.svelte';
</script>

{#if documents.currentSlug !== DEFAULT_SLUG}
  <span
    class={[
      'doc-title pointer-events-none select-none truncate min-w-0',
      'font-dialog text-[0.8125rem] leading-none text-muted',
      'sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-[40%]',
      'max-sm:order-[10] max-sm:ms-2 max-sm:max-w-full',
    ]}
    title={'/' + documents.currentSlug}
    aria-label="Current document"
  >/{documents.currentSlug}</span>
{/if}
