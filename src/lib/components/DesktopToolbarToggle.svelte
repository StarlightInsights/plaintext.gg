<script lang="ts">
  import { css, cx } from 'styled-system/css';
  import Icon from './Icon.svelte';
  import Tooltip from './Tooltip.svelte';
  import { iconButton } from './button-classes';
  import { toolbarToggleLabel } from '$lib/constants';
  import { preferences } from '$lib/state/preferences.svelte';

  const label = $derived(toolbarToggleLabel(preferences.toolbarVisible));
  const tooltip = $derived(preferences.toolbarVisible ? 'hide' : 'show');
</script>

<div
  class={cx(
    'toggle-desktop',
    css({
      position: 'absolute',
      // The toolbar icons sit at 8px (header py-2). The eye glyph is ~20% shorter
      // than the other Phosphor icons, so geometric centering leaves it reading as
      // a couple pixels high; +1px nudges it down to sit level with the rest.
      top: 'max(9px, env(safe-area-inset-top))',
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
