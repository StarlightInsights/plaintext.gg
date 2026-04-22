<script lang="ts">
  import type { Snippet } from 'svelte';
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

  let dialogEl: HTMLDialogElement;
  let triggerEl: HTMLElement | null = null;

  export function show(): void {
    triggerEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogEl.showModal();
    const closeBtn = dialogEl.querySelector('.dialog-close');
    if (closeBtn instanceof HTMLElement) closeBtn.focus();
  }

  export function close(): void {
    dialogEl.close();
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
  class={[
    'dialog',
    'm-auto max-w-[calc(100%-16px)] max-h-[calc(100dvh-16px)] overflow-y-auto',
    'border border-panel-line bg-panel p-0 text-fg outline-none',
    'transition-colors duration-[180ms] ease-out',
    wide ? 'w-[28rem]' : 'w-[26rem]',
  ]}
  aria-labelledby={titleId}
  aria-describedby={descId}
  bind:this={dialogEl}
  onclick={handleBackdropClick}
  onclose={handleClose}
>
  <div class="dialog-inner grid gap-5 p-4">
    <div class="dialog-header flex items-start justify-between gap-4">
      <h2 class="dialog-title m-0 font-main text-base font-bold" id={titleId}>{title}</h2>
      <button
        type="button"
        class="dialog-close appearance-none bg-transparent border-0 p-0 text-secondary cursor-pointer transition-colors duration-[180ms] ease-out hover:text-fg focus-visible:text-fg focus-visible:outline-2 focus-visible:outline-muted focus-visible:outline-offset-2 focus-visible:rounded-[2px]"
        aria-label="Close dialog"
        data-tooltip="close"
        onclick={() => dialogEl.close()}
      >
        <Icon name="close" size="close" />
      </button>
    </div>
    <div class="dialog-body grid gap-4 leading-[1.65] text-fg font-dialog" id={descId}>
      {@render children()}
    </div>
  </div>
</dialog>
