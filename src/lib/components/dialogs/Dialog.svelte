<script lang="ts">
  import type { Snippet } from 'svelte';
  import { css, cx } from 'styled-system/css';
  import Icon from '../Icon.svelte';

  type Props = {
    id: string;
    title: string;
    titleId: string;
    descId?: string;
    /** Extra width for dialogs that want more room (e.g. about, documents). */
    wide?: boolean;
    children: Snippet;
  };

  let { id, title, titleId, descId, wide = false, children }: Props = $props();

  let dialogEl: HTMLDialogElement | undefined = $state(undefined);
  let triggerEl: HTMLElement | null = null;

  export function show(): void {
    if (!dialogEl) return;
    triggerEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogEl.showModal();
    const closeBtn = dialogEl.querySelector('.dialog-close');
    if (closeBtn instanceof HTMLElement) closeBtn.focus();
  }

  export function close(): void {
    dialogEl?.close();
  }

  export function isOpen(): boolean {
    return dialogEl?.open ?? false;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === dialogEl) dialogEl.close();
  }

  function handleClose() {
    if (triggerEl) {
      triggerEl.focus();
      triggerEl = null;
    } else {
      document.getElementById('editor')?.focus();
    }
  }
</script>

<dialog
  {id}
  class={cx(
    'dialog',
    css({
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
    }),
    wide ? css({ w: '28rem' }) : css({ w: '26rem' }),
  )}
  aria-labelledby={titleId}
  aria-describedby={descId}
  bind:this={dialogEl}
  onclick={handleBackdropClick}
  onclose={handleClose}
>
  <div class={cx('dialog-inner', css({ display: 'grid', gap: '5', p: '4' }))}>
    <div
      class={cx(
        'dialog-header',
        css({ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '4' })
      )}
    >
      <h2
        class={cx('dialog-title', css({ m: '0', fontFamily: 'main', fontSize: 'base', fontWeight: 'bold' }))}
        id={titleId}
      >{title}</h2>
      <button
        type="button"
        class={cx(
          'dialog-close',
          css({
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
          })
        )}
        aria-label="Close dialog"
        data-tooltip="close"
        onclick={() => dialogEl?.close()}
      >
        <Icon name="close" size="close" />
      </button>
    </div>
    <div
      class={cx('dialog-body', css({ display: 'grid', gap: '4', lineHeight: '1.65', color: 'fg', fontFamily: 'dialog' }))}
      id={descId}
    >
      {@render children()}
    </div>
  </div>
</dialog>
