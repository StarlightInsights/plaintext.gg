<script lang="ts">
  import { css, cx } from 'styled-system/css';
  import { DEFAULT_SLUG } from '$lib/constants';
  import { documents } from '$lib/state/documents.svelte';
</script>

{#if documents.currentSlug !== DEFAULT_SLUG}
  <span
    class={cx(
      'doc-title',
      css({
        pointerEvents: 'none',
        userSelect: 'none',
        truncate: true,
        minW: '0',
        fontFamily: 'dialog',
        fontSize: '0.8125rem',
        lineHeight: '1',
        color: 'muted',
        sm: {
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          maxW: '40%',
        },
        smDown: { order: 10, marginInlineStart: '2', maxW: 'full' },
      })
    )}
    title={'/' + documents.currentSlug}
    aria-label="Current document"
  >/{documents.currentSlug}</span>
{/if}
