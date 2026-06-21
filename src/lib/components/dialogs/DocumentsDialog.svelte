<script lang="ts">
  import { css, cx } from 'styled-system/css';
  import Dialog from './Dialog.svelte';
  import { pillButton } from '../button-classes';
  import { goto } from '$app/navigation';
  import { DEFAULT_SLUG } from '$lib/constants';
  import { getSlugFromPath } from '$lib/utils/slug';
  import { announcer } from '$lib/state/announce.svelte';
  import { documents } from '$lib/state/documents.svelte';
  import type { DocumentRecord } from '$lib/types';

  let dialog: Dialog | undefined = $state(undefined);
  let createInput: HTMLInputElement | undefined = $state(undefined);
  let createError = $state('');

  export function show(): void {
    documents.reloadList();
    dialog?.show();
  }

  // The root document (`/`) is always shown first, even when empty, so users
  // always have a way back to it from the picker.
  const sortedRecords = $derived.by(() => {
    const others = documents.records.filter((r) => r.id !== DEFAULT_SLUG && r.text);
    if (documents.sortMode === 'recent') {
      others.sort((a, b) => b.updatedAt - a.updatedAt);
    } else {
      others.sort((a, b) => a.id.localeCompare(b.id));
    }
    const current = documents.records.find((r) => r.id === DEFAULT_SLUG);
    const currentRecord: DocumentRecord = current ?? {
      id: DEFAULT_SLUG,
      text: '',
      updatedAt: 0,
      sourceTabId: '',
      saveSequence: 0,
    };
    return [currentRecord, ...others];
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

  async function handleCreateSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!createInput) return;
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
    if (slug === DEFAULT_SLUG) {
      showError('"current" is reserved. Pick a different name.');
      createInput.focus();
      return;
    }
    dialog?.close();
    await goto('/' + slug);
  }

  function formatLink(id: string): string {
    return id === DEFAULT_SLUG ? '/' : '/' + id;
  }

  const sortToggle = cx('setting-toggle', css({ flex: '1' }), pillButton);
</script>

<Dialog
  bind:this={dialog}
  id="dialog-documents"
  title="documents"
  titleId="dialog-documents-title"
  wide
>
  <form class={cx('documents-create', css({ display: 'flex', flexWrap: 'wrap', gap: '0' }))} id="documents-create" onsubmit={handleCreateSubmit}>
    <label for="documents-create-input" class={css({ srOnly: true })}>New document name</label>
    <input
      type="text"
      class={cx(
        'documents-create-input',
        css({
          flex: '1',
          appearance: 'none',
          bg: 'transparent',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'line',
          px: '2.5',
          py: '1',
          color: 'fg',
          fontFamily: 'dialog',
          fontSize: '0.8125rem',
          outline: 'none',
          minW: '0',
          _placeholder: { color: 'placeholder' },
          transitionProperty: 'border-color, color',
          transitionDuration: '180ms',
          transitionTimingFunction: 'ease-out',
          _focus: {
            borderColor: 'muted',
            outlineWidth: '2px',
            outlineStyle: 'solid',
            outlineColor: 'muted',
            outlineOffset: '-1px',
          },
        })
      )}
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
      class={cx(
        'setting-toggle documents-create-btn',
        css({
          marginLeft: '-1px',
          // Mirror the input's focus border so the segmented pair stays in sync.
          '#documents-create-input:focus ~ &': { borderColor: 'muted' },
        }),
        pillButton
      )}
    >create</button>
    <p id="documents-create-hint" class={css({ srOnly: true })}>Lowercase letters, numbers, and hyphens. Must start and end with a letter or number.</p>
    <p
      id="documents-create-error"
      class={cx('documents-create-error', css({ w: 'full', marginTop: '1.5', color: 'error', fontFamily: 'dialog', fontSize: 'xs' }))}
      role="alert"
      hidden={!createError}
    >{createError}</p>
  </form>

  <div
    class={cx(
      'documents-sort setting-control--group',
      css({ display: 'flex', gap: '0', '& > button + button': { marginLeft: '-1px' } })
    )}
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

  <ul
    class={cx('documents-list', css({ listStyle: 'none', m: '0', p: '0', maxH: '60vh', overflowY: 'auto' }))}
    id="documents-list"
  >
    {#each sortedRecords as record, i (record.id)}
      <li>
        <a
          href={formatLink(record.id)}
          class={cx(
            css({
              display: 'block',
              px: '1',
              py: '2',
              fontFamily: 'dialog',
              fontSize: 'sm',
              textDecoration: 'none',
              transitionProperty: 'color',
              transitionDuration: '160ms',
              transitionTimingFunction: 'ease-out',
              _hoverable: { _hover: { color: 'fg' } },
              _focusVisible: {
                color: 'fg',
                outlineWidth: '2px',
                outlineStyle: 'solid',
                outlineColor: 'muted',
                outlineOffset: '1px',
                borderRadius: '2px',
              },
            }),
            record.id === documents.currentSlug ? cx('active', css({ color: 'fg' })) : css({ color: 'muted' }),
            i > 0 && css({ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: 'line' }),
          )}
          onclick={() => dialog?.close()}
        >{formatLink(record.id)}</a>
      </li>
    {/each}
  </ul>
</Dialog>
