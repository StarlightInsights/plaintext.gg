<script lang="ts">
  import Dialog from './Dialog.svelte';
  import { pillButton } from '../button-classes';
  import { getSlugFromPath } from '$lib/utils/slug';
  import { announcer } from '$lib/state/announce.svelte';
  import { documents } from '$lib/state/documents.svelte';

  let dialog: Dialog;
  let createInput: HTMLInputElement;
  let createError = $state('');

  export function show(): void {
    documents.reloadList();
    dialog.show();
  }

  const nonEmptyRecords = $derived(documents.records.filter((r) => r.text));

  const sortedRecords = $derived.by(() => {
    const list = [...nonEmptyRecords];
    if (documents.sortMode === 'recent') {
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    } else {
      list.sort((a, b) => {
        if (a.id === 'current') return -1;
        if (b.id === 'current') return 1;
        return a.id.localeCompare(b.id);
      });
    }
    return list;
  });

  function showError(message: string) {
    createError = message;
    announcer.announce(message);
  }

  function clearError() {
    if (createError) createError = '';
  }

  function handleCreateInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    input.value = input.value.toLowerCase().replace(/\s+/g, '-');
    clearError();
  }

  function handleCreateSubmit(e: SubmitEvent) {
    e.preventDefault();
    const raw = createInput.value.trim();
    if (!raw) {
      showError('Enter a name for the document.');
      createInput.focus();
      return;
    }
    const slug = getSlugFromPath('/' + raw);
    if (!slug) {
      showError('Use only lowercase letters, numbers, and hyphens.');
      createInput.focus();
      return;
    }
    if (slug === 'current') {
      showError('"current" is reserved. Pick a different name.');
      createInput.focus();
      return;
    }
    window.location.href = '/' + slug;
  }

  function formatLink(id: string): string {
    return id === 'current' ? '/' : '/' + id;
  }

  const sortToggle = `setting-toggle flex-1 ${pillButton}`;
</script>

<Dialog
  bind:this={dialog}
  id="dialog-documents"
  title="documents"
  titleId="dialog-documents-title"
  wide
>
  <form class="documents-create flex flex-wrap gap-0" id="documents-create" onsubmit={handleCreateSubmit}>
    <label for="documents-create-input" class="sr-only">New document name</label>
    <input
      type="text"
      class="documents-create-input peer flex-1 appearance-none bg-transparent border border-line px-2.5 py-1
        text-fg font-dialog text-[0.8125rem] outline-none min-w-0
        placeholder:text-placeholder
        transition-[border-color,color] duration-[180ms] ease-out
        focus:border-muted focus:outline-2 focus:outline-muted focus:outline-offset-[-1px]"
      id="documents-create-input"
      bind:this={createInput}
      oninput={handleCreateInput}
      placeholder="new-document"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="none"
      spellcheck="false"
      required
      pattern="[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?"
      maxlength="64"
      title="Lowercase letters, numbers, and hyphens. Must start and end with a letter or number."
      aria-describedby="documents-create-hint documents-create-error"
    />
    <button
      type="submit"
      class="setting-toggle documents-create-btn -ml-px peer-focus:border-muted {pillButton}"
    >create</button>
    <p id="documents-create-hint" class="sr-only">Lowercase letters, numbers, and hyphens. Must start and end with a letter or number.</p>
    <p
      id="documents-create-error"
      class="documents-create-error w-full mt-1.5 text-error font-dialog text-xs"
      role="alert"
      hidden={!createError}
    >{createError}</p>
  </form>

  <div
    class="documents-sort setting-control--group flex gap-0 [&>button+button]:-ml-px"
    role="radiogroup"
    aria-label="Sort order"
  >
    <button
      type="button"
      class={sortToggle}
      id="btn-sort-alpha"
      role="radio"
      aria-checked={documents.sortMode === 'alpha'}
      onclick={() => documents.setSortMode('alpha')}
    >a-z</button>
    <button
      type="button"
      class={sortToggle}
      id="btn-sort-recent"
      role="radio"
      aria-checked={documents.sortMode === 'recent'}
      onclick={() => documents.setSortMode('recent')}
    >recent</button>
  </div>

  <ul class="documents-list list-none m-0 p-0 max-h-[60vh] overflow-y-auto" id="documents-list">
    {#each sortedRecords as record, i (record.id)}
      <li>
        <a
          href={formatLink(record.id)}
          class={[
            'block px-1 py-2 font-dialog text-sm no-underline transition-colors duration-[160ms] ease-out',
            'hover:text-fg focus-visible:text-fg focus-visible:outline-2 focus-visible:outline-muted focus-visible:outline-offset-1 focus-visible:rounded-[2px]',
            record.id === documents.currentSlug ? 'active text-fg' : 'text-muted',
            i > 0 && 'border-t border-line',
          ]}
          data-sveltekit-reload
        >{formatLink(record.id)}</a>
      </li>
    {/each}
  </ul>
  {#if sortedRecords.length === 0}
    <p class="documents-empty m-0 text-muted font-dialog text-sm" id="documents-empty">no documents yet</p>
  {/if}
</Dialog>
