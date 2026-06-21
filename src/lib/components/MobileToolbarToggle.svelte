<script lang="ts">
  import { css, cx } from 'styled-system/css';
  import Icon from './Icon.svelte';
  import Tooltip from './Tooltip.svelte';
  import { iconButton } from './button-classes';
  import { toolbarToggleLabel } from '$lib/constants';
  import { preferences } from '$lib/state/preferences.svelte';
</script>

<div
  class={cx(
    'toggle-mobile',
    css({
      position: 'absolute',
      top: 'max(8px, env(safe-area-inset-top))',
      right: 'max(12px, env(safe-area-inset-right))',
      zIndex: 30,
      sm: { display: 'none' },
    }),
    preferences.toolbarVisible && 'hidden',
  )}
  id="toggle-mobile"
>
  <Tooltip
    text="show"
    placement="top"
    id="btn-toggle-mobile"
    aria-pressed="true"
    aria-label={toolbarToggleLabel(false)}
    class={cx(
      iconButton,
      'btn-float',
      css({
        opacity: 0.6,
        _hoverable: { _hover: { opacity: 1 } },
        _focusVisible: { opacity: 1 },
      })
    )}
    onclick={() => preferences.toggleToolbar()}
  >
    <Icon name="eye-closed" />
  </Tooltip>
</div>
