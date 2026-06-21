<script lang="ts">
  import { onMount } from 'svelte';
  import { css, cx } from 'styled-system/css';
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

  let infoDialog: InfoDialog | undefined = $state(undefined);
  let settingsDialog: SettingsDialog | undefined = $state(undefined);
  let documentsDialog: DocumentsDialog | undefined = $state(undefined);
  let editor: Editor | undefined = $state(undefined);

  onMount(() => {
    documents.openBroadcastChannel();

    (async () => {
      try {
        await documents.initPersistence();
        await handleStartupQuery();
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

  // Cache key the service worker stashes a POST share-target payload under.
  // Must match SHARE_STASH_PATH in service-worker.ts.
  const SHARE_STASH_PATH = '/__shared__';

  function joinShared(title: unknown, text: unknown, url: unknown): string {
    return [title, text, url].filter((s): s is string => typeof s === 'string' && s.length > 0).join('\n\n');
  }

  // Read (and consume) the shared payload the service worker stashed for the
  // POST share target. Deletes the entry from every cache so it's one-shot.
  async function readSharedStash(): Promise<string> {
    if (typeof caches === 'undefined') return '';
    try {
      const res = await caches.match(SHARE_STASH_PATH);
      const keys = await caches.keys();
      await Promise.all(
        keys.map(async (k) => {
          const c = await caches.open(k);
          await c.delete(SHARE_STASH_PATH);
        })
      );
      if (!res) return '';
      const data = (await res.json()) as { title?: string; text?: string; url?: string };
      return joinShared(data.title, data.text, data.url);
    } catch {
      return '';
    }
  }

  async function handleStartupQuery(): Promise<void> {
    if (!window.location.search) return;
    const params = new URLSearchParams(window.location.search);
    let didHandle = false;

    if (params.get('action') === 'new') {
      documentsDialog?.show();
      didHandle = true;
    }

    // Shared text arrives via the POST share target (stashed on-device by the
    // service worker, flagged with ?share-target) or, for installs that
    // predate the POST switch, as legacy GET params. Both stay on-device.
    const shared = params.has('share-target')
      ? await readSharedStash()
      : joinShared(params.get('title'), params.get('text'), params.get('url'));
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
    if (!editor) return;
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
  class={cx(
    'app-shell',
    css({
      position: 'relative',
      display: 'grid',
      gridTemplateRows: '1fr',
      minH: '100dvh',
      bg: 'bg',
      color: 'fg',
      fontFamily: 'main',
      transitionProperty: 'background-color, color, border-color',
      transitionDuration: '180ms',
      transitionTimingFunction: 'ease-out',
    }),
    loading && cx('loading', css({ visibility: 'hidden', pointerEvents: 'none' })),
  )}
>
  <SkipLink />
  <LiveRegion />
  <Toolbar
    bind:clientHeight={toolbarHeight}
    {slideIn}
    onInfoClick={() => infoDialog?.show()}
    onDocumentsClick={() => documentsDialog?.show()}
    onSettingsClick={() => settingsDialog?.show()}
    onFilesSelected={handleFilesSelected}
  />
  <DesktopToolbarToggle />
  <MobileToolbarToggle />
  <h1 class={css({ srOnly: true })}>plaintext.gg editor</h1>
  <Editor bind:this={editor} bind:editorEl {toolbarHeight} {enableMotion} />
  <InfoDialog bind:this={infoDialog} />
  <SettingsDialog bind:this={settingsDialog} />
  <DocumentsDialog bind:this={documentsDialog} />
</div>
