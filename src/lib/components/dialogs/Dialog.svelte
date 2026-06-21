<script lang="ts">
  import type { Snippet } from 'svelte';
  import { css, cx } from 'styled-system/css';
  import { Dialog } from '@ark-ui/svelte/dialog';
  import { Portal } from '@ark-ui/svelte/portal';
  import Icon from '../Icon.svelte';

  type Props = {
    id: string;
    title: string;
    titleId: string;
    descId?: string;
    /** Controlled open state — Ark flips this on Esc, backdrop click, or close. */
    open: boolean;
    /** Extra width for dialogs that want more room (e.g. about, documents). */
    wide?: boolean;
    children: Snippet;
  };

  let { id, title, titleId, descId, open = $bindable(false), wide = false, children }: Props =
    $props();

  // Dimmed overlay — replaces the native `dialog::backdrop` (overlay token).
  const backdrop = css({
    position: 'fixed',
    inset: '0',
    zIndex: 40,
    bg: 'overlay',
  });

  // Full-viewport flexbox that centers the content (Ark gives the positioner no
  // layout of its own). Equal margins fall out of `margin: auto` + max-width.
  const positioner = css({
    position: 'fixed',
    inset: '0',
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  const content = css({
    margin: 'auto',
    maxW: 'calc(100% - 16px)',
    maxH: 'calc(100dvh - 16px)',
    overflowY: 'auto',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'panelLine',
    bg: 'panel',
    p: '0',
    color: 'fg',
    outline: 'none',
    transitionProperty: 'background-color, color, border-color',
    transitionDuration: '180ms',
    transitionTimingFunction: 'ease-out',
    // Ark keeps the content mounted but `hidden` while closed, so reveal it with
    // an entrance animation rather than an opacity transition.
    '&[data-state=open]': { animation: 'dialog-fade-in 160ms ease-out' },
  });
  const narrowW = css({ w: '26rem' });
  const wideW = css({ w: '28rem' });

  const inner = css({ display: 'grid', gap: '5', p: '4' });
  const header = css({
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '4',
  });
  const titleCss = css({ m: '0', fontFamily: 'main', fontSize: 'md', fontWeight: 'bold' });
  const closeCss = css({
    appearance: 'none',
    bg: 'transparent',
    borderWidth: '0',
    p: '0',
    color: 'secondary',
    cursor: 'pointer',
    transitionProperty: 'color',
    transitionDuration: '180ms',
    transitionTimingFunction: 'ease-out',
    _hoverable: { _hover: { color: 'fg' } },
    _focusVisible: {
      color: 'fg',
      outlineWidth: '2px',
      outlineStyle: 'solid',
      outlineColor: 'muted',
      outlineOffset: '2px',
      borderRadius: '2px',
    },
  });
  const bodyCss = css({
    display: 'grid',
    gap: '4',
    lineHeight: '1.65',
    color: 'fg',
    fontFamily: 'dialog',
  });
</script>

<Dialog.Root
  bind:open
  ids={descId ? { content: id, title: titleId, description: descId } : { content: id, title: titleId }}
>
  <Portal>
    <Dialog.Backdrop class={backdrop} />
    <Dialog.Positioner class={positioner}>
      <Dialog.Content class={cx('dialog', content, wide ? wideW : narrowW)}>
        <div class={inner}>
          <div class={cx('dialog-header', header)}>
            <Dialog.Title class={cx('dialog-title', titleCss)}>{title}</Dialog.Title>
            <Dialog.CloseTrigger
              class={cx('dialog-close', closeCss)}
              aria-label="Close dialog"
              data-tooltip="close"
            >
              <Icon name="close" size="close" />
            </Dialog.CloseTrigger>
          </div>
          {#if descId}
            <Dialog.Description>
              {#snippet asChild(props)}
                <!-- Render a <div> (not Ark's default <p>) so block children like
                     <p>/<ul>/<form> nest validly while keeping aria-describedby. -->
                <div {...props({ class: cx('dialog-body', bodyCss) })}>
                  {@render children()}
                </div>
              {/snippet}
            </Dialog.Description>
          {:else}
            <div class={cx('dialog-body', bodyCss)}>
              {@render children()}
            </div>
          {/if}
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog.Root>
