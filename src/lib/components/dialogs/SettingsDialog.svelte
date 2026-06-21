<script lang="ts">
  import { css, cx } from 'styled-system/css';
  import Dialog from './Dialog.svelte';
  import Icon from '../Icon.svelte';
  import { pillButton, stepButton } from '../button-classes';
  import { FONT_STEP, MAX_FONT_SIZE, MIN_FONT_SIZE } from '$lib/constants';
  import { isWeightSupported } from '$lib/utils/fonts';
  import { preferences } from '$lib/state/preferences.svelte';
  import type { FontFamily } from '$lib/types';

  let dialog: Dialog | undefined = $state(undefined);

  export function show(): void {
    dialog?.show();
  }

  const fontOptions: { id: string; key: FontFamily; label: string; title?: string }[] = [
    { id: 'btn-font-mono', key: 'mono', label: 'mono' },
    { id: 'btn-font-sans', key: 'sans-serif', label: 'sans-serif' },
    { id: 'btn-font-serif', key: 'serif', label: 'serif' },
    { id: 'btn-font-dyslexic', key: 'dyslexic', label: 'dyslexic', title: 'OpenDyslexic — a typeface designed to aid readers with dyslexia' },
  ];

  const weightOptions: { id: string; weight: number; label: string }[] = [
    { id: 'btn-weight-light', weight: 200, label: 'light' },
    { id: 'btn-weight-regular', weight: 300, label: 'regular' },
    { id: 'btn-weight-bold', weight: 600, label: 'bold' },
  ];

  const toggleClass = `setting-toggle ${pillButton}`;
  const stepClass = `btn setting-step ${stepButton}`;

  const settingRow = css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '4',
  });
  // Segmented control: zero gap with a 1px negative margin so borders overlap.
  const controlGroup = css({
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    '& > button + button': { marginLeft: '-1px' },
  });
  const settingControl = css({ display: 'flex', alignItems: 'center', gap: '2' });
</script>

<Dialog
  bind:this={dialog}
  id="dialog-settings"
  title="settings"
  titleId="dialog-settings-title"
>
  <div class={cx('setting', settingRow)}>
    <div
      class={cx('setting-control setting-control--group', controlGroup, css({ flex: '1' }))}
      role="radiogroup"
      aria-label="Font family"
    >
      {#each fontOptions as opt (opt.id)}
        <button
          type="button"
          class={cx(toggleClass, css({ flex: '1' }))}
          id={opt.id}
          role="radio"
          aria-checked={preferences.fontFamily === opt.key}
          data-font={opt.key}
          title={opt.title}
          onclick={() => preferences.setFontFamily(opt.key)}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>

  <div class={cx('setting', settingRow)}>
    <span class="setting-label">font size</span>
    <div class={cx('setting-control', settingControl)}>
      <button
        type="button"
        class={stepClass}
        aria-label="Decrease font size"
        data-tooltip="smaller"
        id="btn-font-down"
        disabled={preferences.fontSize <= MIN_FONT_SIZE}
        onclick={() => preferences.setFontSize(preferences.fontSize - FONT_STEP)}
      >
        <Icon name="minus" size="small" />
      </button>
      <span
        class={cx('setting-value', css({ minW: '4ch', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }))}
        id="font-size-value"
      >{preferences.fontSize}px</span>
      <button
        type="button"
        class={stepClass}
        aria-label="Increase font size"
        data-tooltip="larger"
        id="btn-font-up"
        disabled={preferences.fontSize >= MAX_FONT_SIZE}
        onclick={() => preferences.setFontSize(preferences.fontSize + FONT_STEP)}
      >
        <Icon name="plus" size="small" />
      </button>
    </div>
  </div>

  <div class={cx('setting', settingRow)}>
    <span class="setting-label">weight</span>
    <div
      class={cx('setting-control setting-control--group', controlGroup)}
      role="radiogroup"
      aria-label="Font weight"
    >
      {#each weightOptions as opt (opt.id)}
        <button
          type="button"
          class={toggleClass}
          id={opt.id}
          role="radio"
          aria-checked={preferences.fontWeight === opt.weight}
          data-weight={opt.weight}
          disabled={!isWeightSupported(preferences.fontFamily, opt.weight)}
          onclick={() => preferences.setFontWeight(opt.weight)}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>

  <div class={cx('setting', settingRow)}>
    <span class="setting-label">italic</span>
    <div class={cx('setting-control', settingControl)}>
      <button
        type="button"
        class={toggleClass}
        id="btn-italic"
        role="switch"
        aria-checked={preferences.fontItalic}
        onclick={() => preferences.toggleItalic()}
      >
        {preferences.fontItalic ? 'on' : 'off'}
      </button>
    </div>
  </div>

  <div class={cx('setting setting-reset', css({ display: 'flex', justifyContent: 'flex-end', gap: '4', marginTop: '1' }))}>
    <button
      type="button"
      class={toggleClass}
      id="btn-reset"
      onclick={() => preferences.resetFonts()}
    >
      reset
    </button>
  </div>
</Dialog>
