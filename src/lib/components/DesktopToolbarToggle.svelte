<script lang="ts">
  import { css, cx } from 'styled-system/css';
  import Icon from './Icon.svelte';
  import Tooltip from './Tooltip.svelte';
  import { iconButton } from './button-classes';
  import { preferences } from '$lib/state/preferences.svelte';

  const label = $derived(
    preferences.toolbarVisible
      ? 'Hide navigation icons and editor controls'
      : 'Show navigation icons and editor controls'
  );
  const tooltip = $derived(preferences.toolbarVisible ? 'hide' : 'show');
</script>

<div
  class={cx(
    'toggle-desktop',
    css({
      position: 'absolute',
      // Align with the toolbar row icons (header has py-2 = 8px), not 12px,
      // so the floating eye sits level with the rest of the controls.
      top: 'max(8px, env(safe-area-inset-top))',
      right: 'max(16px, env(safe-area-inset-right))',
      zIndex: 30,
      smDown: { display: 'none' },
    })
  )}
  id="toggle-desktop"
>
  <Tooltip
    text={tooltip}
    id="btn-toggle-desktop"
    class={iconButton}
    aria-pressed={!preferences.toolbarVisible}
    aria-label={label}
    onclick={() => preferences.toggleToolbar()}
  >
    <Icon name="eye-open" id="icon-eye-open" hidden={!preferences.toolbarVisible} />
    <Icon name="eye-closed" id="icon-eye-closed" hidden={preferences.toolbarVisible} />
  </Tooltip>
</div>
