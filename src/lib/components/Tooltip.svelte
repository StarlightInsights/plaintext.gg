<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { css } from 'styled-system/css';
  import { Tooltip } from '@ark-ui/svelte/tooltip';
  import { Portal } from '@ark-ui/svelte/portal';

  // A button with an Ark UI tooltip — the app's single tooltip implementation.
  // The trigger renders a real <button>, so all button attributes/handlers
  // (id, aria-*, class, onclick) pass straight through and existing DOM/test
  // hooks are preserved.
  type Props = HTMLButtonAttributes & {
    text: string;
    placement?: 'top' | 'bottom';
    children: Snippet;
  };
  let { text, placement = 'bottom', children, ...triggerProps }: Props = $props();

  const content = css({
    bg: 'fg',
    color: 'bg',
    fontFamily: 'header',
    fontWeight: '300',
    fontSize: '0.75rem',
    lineHeight: '1',
    px: '1.5',
    py: '1',
    borderRadius: '2px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 30,
  });
</script>

<Tooltip.Root openDelay={0} closeDelay={0} positioning={{ placement, gutter: 4 }}>
  <Tooltip.Trigger>
    {#snippet asChild(props)}
      <button {...props({ type: 'button', ...triggerProps })}>{@render children()}</button>
    {/snippet}
  </Tooltip.Trigger>
  <Portal>
    <Tooltip.Positioner>
      <Tooltip.Content class={content}>{text}</Tooltip.Content>
    </Tooltip.Positioner>
  </Portal>
</Tooltip.Root>
