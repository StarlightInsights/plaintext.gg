<script lang="ts">
  import { css, cx } from 'styled-system/css';
  import { RadioGroup } from '@ark-ui/svelte/radio-group';
  import { Switch } from '@ark-ui/svelte/switch';
  import { NumberInput } from '@ark-ui/svelte/number-input';
  import Dialog from './Dialog.svelte';
  import Icon from '../Icon.svelte';
  import { pillButton, stepButton } from '../button-classes';
  import { FONT_STEP, MAX_FONT_SIZE, MIN_FONT_SIZE } from '$lib/constants';
  import { isWeightSupported } from '$lib/utils/fonts';
  import { preferences } from '$lib/state/preferences.svelte';
  import { ui } from '$lib/state/ui.svelte';
  import type { FontFamily } from '$lib/types';

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
  // Ark radio items render as <label>, so target any adjacent children.
  const controlGroup = css({
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    '& > * + *': { marginLeft: '-1px' },
  });
  const settingControl = css({ display: 'flex', alignItems: 'center', gap: '2' });
  const valueLabel = cx(
    'setting-value',
    css({ minW: '4ch', textAlign: 'center', fontVariantNumeric: 'tabular-nums' })
  );
  // The NumberInput needs an input to drive its machine, but this is a bounded
  // stepper with no free typing — keep it out of the layout and tab order.
  const hiddenInput = css({ srOnly: true });
</script>

<Dialog bind:open={ui.settingsOpen} id="dialog-settings" title="settings" titleId="dialog-settings-title">
  <div class={cx('setting', settingRow)}>
    <RadioGroup.Root
      value={preferences.fontFamily}
      onValueChange={(e) => preferences.setFontFamily(e.value as FontFamily)}
      class={cx('setting-control setting-control--group', controlGroup, css({ flex: '1' }))}
      aria-label="Font family"
    >
      {#each fontOptions as opt (opt.id)}
        <RadioGroup.Item
          value={opt.key}
          id={opt.id}
          class={cx(toggleClass, css({ flex: '1' }))}
          data-font={opt.key}
          title={opt.title}
        >
          <RadioGroup.ItemText>{opt.label}</RadioGroup.ItemText>
          <RadioGroup.ItemHiddenInput />
        </RadioGroup.Item>
      {/each}
    </RadioGroup.Root>
  </div>

  <div class={cx('setting', settingRow)}>
    <span class="setting-label">font size</span>
    <NumberInput.Root
      value={String(preferences.fontSize)}
      min={MIN_FONT_SIZE}
      max={MAX_FONT_SIZE}
      step={FONT_STEP}
      onValueChange={(e) => preferences.setFontSize(e.valueAsNumber)}
      class={cx('setting-control', settingControl)}
      aria-label="Font size"
    >
      <NumberInput.DecrementTrigger
        id="btn-font-down"
        class={stepClass}
        aria-label="Decrease font size"
        data-tooltip="smaller"
      >
        <Icon name="minus" size="small" />
      </NumberInput.DecrementTrigger>
      <span class={valueLabel} id="font-size-value">{preferences.fontSize}px</span>
      <NumberInput.IncrementTrigger
        id="btn-font-up"
        class={stepClass}
        aria-label="Increase font size"
        data-tooltip="larger"
      >
        <Icon name="plus" size="small" />
      </NumberInput.IncrementTrigger>
      <NumberInput.Input class={hiddenInput} tabindex={-1} aria-hidden="true" />
    </NumberInput.Root>
  </div>

  <div class={cx('setting', settingRow)}>
    <span class="setting-label">weight</span>
    <RadioGroup.Root
      value={String(preferences.fontWeight)}
      onValueChange={(e) => preferences.setFontWeight(Number(e.value))}
      class={cx('setting-control setting-control--group', controlGroup)}
      aria-label="Font weight"
    >
      {#each weightOptions as opt (opt.id)}
        <RadioGroup.Item
          value={String(opt.weight)}
          id={opt.id}
          class={toggleClass}
          data-weight={opt.weight}
          disabled={!isWeightSupported(preferences.fontFamily, opt.weight)}
        >
          <RadioGroup.ItemText>{opt.label}</RadioGroup.ItemText>
          <RadioGroup.ItemHiddenInput />
        </RadioGroup.Item>
      {/each}
    </RadioGroup.Root>
  </div>

  <div class={cx('setting', settingRow)}>
    <span class="setting-label">italic</span>
    <div class={cx('setting-control', settingControl)}>
      <Switch.Root
        checked={preferences.fontItalic}
        onCheckedChange={() => preferences.toggleItalic()}
        ids={{ root: 'btn-italic' }}
        class={toggleClass}
      >
        {preferences.fontItalic ? 'on' : 'off'}
        <Switch.HiddenInput />
      </Switch.Root>
    </div>
  </div>

  <div class={cx('setting setting-reset', css({ display: 'flex', justifyContent: 'flex-end', gap: '4', marginTop: '1' }))}>
    <button type="button" class={toggleClass} id="btn-reset" onclick={() => preferences.resetFonts()}>
      reset
    </button>
  </div>
</Dialog>
