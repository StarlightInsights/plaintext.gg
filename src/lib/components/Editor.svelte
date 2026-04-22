<script lang="ts">
  import { onMount } from 'svelte';
  import { FONT_STACK, FONT_WEIGHT_MAP } from '$lib/constants';
  import { documents } from '$lib/state/documents.svelte';
  import { preferences } from '$lib/state/preferences.svelte';
  import { readFilesAsText } from '$lib/utils/files';

  type Props = {
    editorEl?: HTMLTextAreaElement;
    toolbarHeight: number;
    enableMotion: boolean;
  };

  let { editorEl = $bindable(), toolbarHeight, enableMotion }: Props = $props();

  let dragover = $state(false);

  // Abstract weight (200/300/600) → concrete CSS weight for this font family.
  const computedWeight = $derived.by(() => {
    const map = FONT_WEIGHT_MAP[preferences.fontFamily] ?? FONT_WEIGHT_MAP.mono;
    const slot = preferences.fontWeight === 200 ? 0 : preferences.fontWeight === 600 ? 2 : 1;
    return String(map[slot]);
  });

  const paddingTop = $derived(
    preferences.toolbarVisible ? `${toolbarHeight + 12}px` : '40px'
  );
  const paddingRight = $derived(preferences.toolbarVisible ? '' : '56px');

  // Once init finishes, padding transitions are enabled so toggling the
  // toolbar feels like a slide. Before then, instant.
  const transition = $derived(
    enableMotion
      ? 'background-color 180ms ease-out, color 180ms ease-out, caret-color 180ms ease-out, padding-top 180ms ease-out, padding-right 180ms ease-out'
      : 'background-color 180ms ease-out, color 180ms ease-out, caret-color 180ms ease-out'
  );

  function handleInput(e: Event) {
    documents.handleInput((e.currentTarget as HTMLTextAreaElement).value);
  }

  function handleDragover(e: DragEvent) {
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      dragover = true;
    }
  }

  function handleDragleave(e: DragEvent) {
    if (e.relatedTarget === null || !editorEl?.contains(e.relatedTarget as Node)) {
      dragover = false;
    }
  }

  function handleDrop(e: DragEvent) {
    dragover = false;
    if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    readFilesAsText(e.dataTransfer.files).then(insertAtCursor);
  }

  export async function readFiles(files: FileList | File[]): Promise<string> {
    return readFilesAsText(files);
  }

  export function insertAtCursor(content: string): void {
    if (!editorEl) return;
    editorEl.focus();
    document.execCommand('insertText', false, content);
  }

  // Persistence -> surgical textarea update preserving cursor.
  // Runs once at mount; the state singleton retains the latest callback.
  onMount(() => {
    documents.registerApplyText((nextText) => {
      if (!editorEl || editorEl.value === nextText) return;
      const wasFocused = document.activeElement === editorEl;
      const ss = editorEl.selectionStart;
      const se = editorEl.selectionEnd;
      const sd = editorEl.selectionDirection ?? 'none';
      editorEl.value = nextText;
      if (wasFocused) {
        editorEl.setSelectionRange(
          Math.min(ss, nextText.length),
          Math.min(se, nextText.length),
          sd
        );
      }
    });
  });
</script>

<main class:dragover class="relative min-h-0 overflow-hidden">
  <label for="editor" class="sr-only">Plain text editor</label>
  <textarea
    id="editor"
    class={[
      'editor',
      'block w-full h-full min-h-0 resize-none border-0 bg-transparent',
      'p-3 sm:p-4',
      'leading-[1.65] text-fg caret-fg outline-none',
      'placeholder:text-placeholder',
      dragover && 'bg-line',
    ]}
    bind:this={editorEl}
    oninput={handleInput}
    ondragover={handleDragover}
    ondragleave={handleDragleave}
    ondrop={handleDrop}
    style:font-size="{preferences.fontSize}px"
    style:font-family={FONT_STACK[preferences.fontFamily] ?? FONT_STACK.mono}
    style:font-weight={computedWeight}
    style:font-style={preferences.fontItalic ? 'italic' : 'normal'}
    style:padding-top={paddingTop}
    style:padding-right={paddingRight}
    style:transition={transition}
    autocorrect="off"
    aria-autocomplete="none"
    placeholder="just plain text..."
    spellcheck="false"
    autocapitalize="none"
    autocomplete="off"
    inputmode="text"
    enterkeyhint="enter"
    data-form-type="other"
    data-lpignore="true"
    data-1p-ignore="true"
    data-bwignore="true"
    data-gramm="false"
    data-gramm_editor="false"
    data-enable-grammarly="false"
    data-ms-editor="false"
    translate="no"
  ></textarea>
  {#if dragover}
    <div
      aria-hidden="true"
      class="absolute bottom-6 left-1/2 -translate-x-1/2 px-3.5 py-1.5 text-muted font-dialog text-[0.8125rem] whitespace-nowrap pointer-events-none z-10"
    >drop to insert at cursor</div>
  {/if}
</main>
