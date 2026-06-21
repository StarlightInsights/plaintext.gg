<script lang="ts">
  import { css, cx } from 'styled-system/css';
  import DocumentTitle from './DocumentTitle.svelte';
  import Icon from './Icon.svelte';
  import Tooltip from './Tooltip.svelte';
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

  let fileInputEl: HTMLInputElement | undefined = $state(undefined);
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
    if (!fileInputEl) return;
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

  const btnIcon = iconButton;
</script>

<header
  id="toolbar"
  class={cx(
    'toolbar',
    css({
      position: 'absolute',
      insetInline: '0',
      top: '0',
      zIndex: 20,
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: '3',
      rowGap: '2',
      px: '5',
      py: '2',
      borderBottomWidth: '1px',
      borderBottomStyle: 'solid',
      borderBottomColor: 'line',
      backgroundColor: 'color-mix(in oklab, token(colors.bg) 72%, transparent)',
      // backdrop-filter is applied via a raw rule in app.css — see note there.
      fontFamily: 'header',
      fontWeight: '300',
      fontSize: '0.9375rem',
      transitionProperty: 'background-color, color, border-color',
      transitionDuration: '180ms',
      transitionTimingFunction: 'ease-out',
      smDown: { px: '3', justifyContent: 'start', fontSize: 'md', gap: '2px' },
      sm: { paddingRight: '52px' },
    }),
    !preferences.toolbarVisible && 'hidden',
    slideIn &&
      preferences.toolbarVisible &&
      css({ animation: 'toolbar-slide-in 180ms ease-out' }),
  )}
  bind:clientHeight
>
  <nav
    class={cx(
      'toolbar-nav',
      css({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1',
        smDown: { display: 'contents' },
      })
    )}
    aria-label="Info"
  >
    <Tooltip text="about" id="btn-info" class={btnIcon} aria-label="Why plaintext?" onclick={onInfoClick}>
      <Icon name="info" />
    </Tooltip>
  </nav>
  <DocumentTitle />
  <div
    class={cx(
      'toolbar-controls',
      css({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1',
        marginInlineStart: 'auto',
        smDown: { display: 'contents' },
        sm: { paddingInlineStart: '2' },
      })
    )}
    role="group"
    aria-label="Editor controls"
  >
    <Tooltip text="documents" id="btn-documents" class={btnIcon} aria-label="Documents" onclick={onDocumentsClick}>
      <Icon name="documents" />
    </Tooltip>
    <Tooltip text="settings" id="btn-settings" class={btnIcon} aria-label="Settings" onclick={onSettingsClick}>
      <Icon name="settings" />
    </Tooltip>
    <Tooltip text="save" id="btn-save" class={btnIcon} aria-label="Save as plaintext file" onclick={saveCurrentDocument}>
      <Icon name="save" />
    </Tooltip>
    <Tooltip text="upload" id="btn-upload" class={btnIcon} aria-label="Upload text file" onclick={handleUploadClick}>
      <Icon name="upload" />
    </Tooltip>
    <input
      type="file"
      id="file-upload"
      multiple
      hidden
      bind:this={fileInputEl}
      onchange={handleFileChange}
    />
    <Tooltip
      text={copyTooltip}
      id="btn-copy"
      aria-label={copyLabel}
      onclick={handleCopy}
      onpointerleave={clearCopyFeedback}
      class={cx(
        btnIcon,
        copyState === 'success' && cx('copy-success', css({ color: 'fg' })),
        copyState === 'error' && cx('copy-error', css({ color: 'error' })),
      )}
    >
      <Icon name="copy" id="icon-copy" hidden={copyState !== 'idle'} />
      <Icon name="copy-feedback" id="icon-copy-feedback" hidden={copyState === 'idle'} />
    </Tooltip>
    <Tooltip
      text="theme"
      id="btn-theme"
      class={btnIcon}
      aria-pressed={preferences.theme === 'dark'}
      aria-label={`Toggle theme. Current theme: ${preferences.theme}.`}
      onclick={() => {
        preferences.toggleTheme();
        announcer.announce('Theme switched to ' + preferences.theme);
      }}
    >
      <Icon name="theme-light" id="icon-theme-light" hidden={preferences.theme !== 'light'} />
      <Icon name="theme-dark" id="icon-theme-dark" hidden={preferences.theme !== 'dark'} />
    </Tooltip>
    <Tooltip
      text="hide"
      id="btn-hide-mobile"
      class={cx(btnIcon, 'mobile-hide-btn', css({ sm: { display: 'none' } }))}
      aria-pressed="false"
      aria-label="Hide navigation icons and editor controls"
      onclick={() => preferences.toggleToolbar()}
    >
      <Icon name="eye-open" />
    </Tooltip>
  </div>
</header>
