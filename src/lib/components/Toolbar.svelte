<script lang="ts">
  import Icon from './Icon.svelte';
  import { iconButton } from './button-classes';
  import { COPY_FEEDBACK_MS } from '$lib/constants';
  import { announcer } from '$lib/state/announce.svelte';
  import { documents } from '$lib/state/documents.svelte';
  import { preferences } from '$lib/state/preferences.svelte';
  import { saveCurrentDocument } from '$lib/utils/save';

  type Props = {
    clientHeight?: number;
    slideIn: boolean;
    onInfoClick: () => void;
    onDocumentsClick: () => void;
    onSettingsClick: () => void;
    onFilesSelected: (files: FileList) => void;
  };

  let {
    clientHeight = $bindable(0),
    slideIn,
    onInfoClick,
    onDocumentsClick,
    onSettingsClick,
    onFilesSelected,
  }: Props = $props();

  let fileInputEl: HTMLInputElement;
  let copyState = $state<'idle' | 'success' | 'error'>('idle');
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  function clearCopyFeedback() {
    if (copyTimer) {
      clearTimeout(copyTimer);
      copyTimer = null;
    }
    copyState = 'idle';
  }

  function showCopyFeedback(success: boolean) {
    clearCopyFeedback();
    copyState = success ? 'success' : 'error';
    announcer.announce(success ? 'Text copied to clipboard' : 'Copy failed');
    copyTimer = setTimeout(() => {
      copyState = 'idle';
      copyTimer = null;
    }, COPY_FEEDBACK_MS);
  }

  async function handleCopy() {
    const value = documents.text;
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        const item = new ClipboardItem({
          'text/plain': new Blob([value], { type: 'text/plain' }),
        });
        await navigator.clipboard.write([item]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        throw new Error('No clipboard API available');
      }
      showCopyFeedback(true);
    } catch {
      showCopyFeedback(false);
    }
  }

  function handleUploadClick() {
    fileInputEl.value = '';
    fileInputEl.click();
  }

  function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    onFilesSelected(input.files);
  }

  const copyLabel = $derived(
    copyState === 'success' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy plain text'
  );
  const copyTooltip = $derived(
    copyState === 'success' ? 'copied' : copyState === 'error' ? 'copy failed' : 'copy'
  );

  const btnIcon = `btn btn-icon ${iconButton}`;
</script>

<header
  id="toolbar"
  class={[
    'toolbar',
    'absolute inset-x-0 top-0 z-20',
    'flex flex-wrap items-center justify-between gap-x-3 gap-y-2',
    'px-5 py-2 max-sm:px-3 max-sm:[justify-content:start] max-sm:text-base max-sm:gap-[2px]',
    'sm:pr-[52px]',
    'border-b border-line bg-bg/72 backdrop-blur-md',
    'font-header font-light text-[0.9375rem]',
    'transition-colors duration-[180ms] ease-out',
    !preferences.toolbarVisible && 'hidden',
    slideIn && preferences.toolbarVisible && 'animate-toolbar-slide-in',
  ]}
  bind:clientHeight
>
  <nav class="toolbar-nav flex flex-wrap items-center gap-1 max-sm:contents" aria-label="Info">
    <button
      type="button"
      class={btnIcon}
      aria-label="Why plaintext?"
      data-tooltip="about"
      id="btn-info"
      onclick={onInfoClick}
    >
      <Icon name="info" />
    </button>
  </nav>
  <div
    class="toolbar-controls flex flex-wrap items-center gap-1 ms-auto max-sm:contents sm:ps-2"
    role="group"
    aria-label="Editor controls"
  >
    <button
      type="button"
      class={btnIcon}
      aria-label="Documents"
      data-tooltip="documents"
      id="btn-documents"
      onclick={onDocumentsClick}
    >
      <Icon name="documents" />
    </button>
    <button
      type="button"
      class={btnIcon}
      aria-label="Settings"
      data-tooltip="settings"
      id="btn-settings"
      onclick={onSettingsClick}
    >
      <Icon name="settings" />
    </button>
    <button
      type="button"
      class={btnIcon}
      aria-label="Save as plaintext file"
      data-tooltip="save"
      id="btn-save"
      onclick={saveCurrentDocument}
    >
      <Icon name="save" />
    </button>
    <button
      type="button"
      class={btnIcon}
      aria-label="Upload text file"
      data-tooltip="upload"
      id="btn-upload"
      onclick={handleUploadClick}
    >
      <Icon name="upload" />
    </button>
    <input
      type="file"
      id="file-upload"
      multiple
      hidden
      bind:this={fileInputEl}
      onchange={handleFileChange}
    />
    <button
      type="button"
      id="btn-copy"
      aria-label={copyLabel}
      data-tooltip={copyTooltip}
      onclick={handleCopy}
      onpointerleave={clearCopyFeedback}
      class={[
        btnIcon,
        copyState === 'success' && 'copy-success text-fg',
        copyState === 'error' && 'copy-error text-error',
      ]}
    >
      <Icon name="copy" id="icon-copy" hidden={copyState !== 'idle'} />
      <Icon name="copy-feedback" id="icon-copy-feedback" hidden={copyState === 'idle'} />
    </button>
    <button
      type="button"
      class={btnIcon}
      aria-pressed={preferences.theme === 'dark'}
      aria-label={`Toggle theme. Current theme: ${preferences.theme}.`}
      data-tooltip="theme"
      id="btn-theme"
      onclick={() => {
        preferences.toggleTheme();
        announcer.announce('Theme switched to ' + preferences.theme);
      }}
    >
      <Icon name="theme-light" id="icon-theme-light" hidden={preferences.theme !== 'light'} />
      <Icon name="theme-dark" id="icon-theme-dark" hidden={preferences.theme !== 'dark'} />
    </button>
    <button
      type="button"
      class={[btnIcon, 'mobile-hide-btn sm:hidden']}
      aria-pressed="false"
      aria-label="Hide navigation icons and editor controls"
      data-tooltip="hide"
      id="btn-hide-mobile"
      onclick={() => preferences.toggleToolbar()}
    >
      <Icon name="eye-open" />
    </button>
  </div>
</header>
