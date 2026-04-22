<script lang="ts">
  import { onMount } from 'svelte';
  import DesktopToolbarToggle from './DesktopToolbarToggle.svelte';
  import Editor from './Editor.svelte';
  import LiveRegion from './LiveRegion.svelte';
  import MobileToolbarToggle from './MobileToolbarToggle.svelte';
  import SkipLink from './SkipLink.svelte';
  import Toolbar from './Toolbar.svelte';
  import DocumentsDialog from './dialogs/DocumentsDialog.svelte';
  import InfoDialog from './dialogs/InfoDialog.svelte';
  import SettingsDialog from './dialogs/SettingsDialog.svelte';
  import { TOOLBAR_SLIDE_IN_MS } from '$lib/constants';
  import { documents } from '$lib/state/documents.svelte';
  import { preferences } from '$lib/state/preferences.svelte';
  import { saveCurrentDocument } from '$lib/utils/save';

  let loading = $state(true);
  let enableMotion = $state(false);
  let toolbarHeight = $state(0);
  let editorEl: HTMLTextAreaElement | undefined = $state(undefined);

  let infoDialog: InfoDialog;
  let settingsDialog: SettingsDialog;
  let documentsDialog: DocumentsDialog;
  let editor: Editor;

  onMount(() => {
    documents.openBroadcastChannel();

    (async () => {
      try {
        await documents.initPersistence();
        handleStartupQuery();
        if (document.fonts) await document.fonts.ready;
      } catch {
        /* fall through to reveal UI */
      }
      requestAnimationFrame(() => {
        loading = false;
        requestAnimationFrame(() => {
          enableMotion = true;
        });
      });
    })();

    return () => {
      documents.closeBroadcastChannel();
    };
  });

  function handleStartupQuery(): void {
    if (!window.location.search) return;
    const params = new URLSearchParams(window.location.search);
    let didHandle = false;

    if (params.get('action') === 'new') {
      documentsDialog?.show();
      didHandle = true;
    }

    const shared = [params.get('title'), params.get('text'), params.get('url')]
      .filter((s) => s && s.length)
      .join('\n\n');
    if (shared && editorEl) {
      const current = editorEl.value;
      const combined = current ? current.replace(/\s*$/, '') + '\n\n' + shared : shared;
      editorEl.value = combined;
      documents.handleInput(combined);
      didHandle = true;
    }

    if (didHandle) {
      history.replaceState(null, '', window.location.pathname);
    }
  }

  function onStorage(e: StorageEvent) {
    preferences.handleStorageEvent(e);
  }

  function onPageHide() {
    documents.flushPersistence();
  }

  function onFocus() {
    documents.refreshFromPersistence();
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      documents.flushPersistence();
    } else {
      documents.refreshFromPersistence();
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentDocument();
    }
  }

  async function handleFilesSelected(files: FileList) {
    const content = await editor.readFiles(files);
    editor.insertAtCursor(content);
  }

  // First toolbar show after reveal animates; subsequent toggles also animate.
  // Drop the slide-in class once the animation ends (matches original behavior).
  let slideIn = $state(false);
  let lastToolbarVisible = false;
  $effect(() => {
    const visible = preferences.toolbarVisible;
    if (!enableMotion || !visible || lastToolbarVisible) {
      lastToolbarVisible = visible;
      return;
    }
    slideIn = true;
    lastToolbarVisible = visible;
    const t = setTimeout(() => { slideIn = false; }, TOOLBAR_SLIDE_IN_MS);
    return () => clearTimeout(t);
  });
</script>

<svelte:window
  onstorage={onStorage}
  onpagehide={onPageHide}
  onfocus={onFocus}
  onkeydown={onKeydown}
/>
<svelte:document onvisibilitychange={onVisibilityChange} />

<div
  id="app-shell"
  class={[
    'app-shell',
    'relative grid grid-rows-[1fr] min-h-dvh bg-bg text-fg font-main',
    'transition-colors duration-[180ms] ease-out',
    loading && 'loading invisible pointer-events-none',
  ]}
>
  <SkipLink />
  <LiveRegion />
  <Toolbar
    bind:clientHeight={toolbarHeight}
    {slideIn}
    onInfoClick={() => infoDialog.show()}
    onDocumentsClick={() => documentsDialog.show()}
    onSettingsClick={() => settingsDialog.show()}
    onFilesSelected={handleFilesSelected}
  />
  <DesktopToolbarToggle />
  <MobileToolbarToggle />
  <h1 class="sr-only">plaintext.gg editor</h1>
  <Editor bind:this={editor} bind:editorEl {toolbarHeight} {enableMotion} />
  <InfoDialog bind:this={infoDialog} />
  <SettingsDialog bind:this={settingsDialog} />
  <DocumentsDialog bind:this={documentsDialog} />
</div>
