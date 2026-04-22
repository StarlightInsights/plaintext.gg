<script lang="ts">
  import Icon from './Icon.svelte';
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
  class="toggle-desktop absolute top-[max(12px,env(safe-area-inset-top))] right-[max(16px,env(safe-area-inset-right))] z-30 max-sm:hidden"
  id="toggle-desktop"
>
  <button
    type="button"
    id="btn-toggle-desktop"
    aria-pressed={!preferences.toolbarVisible}
    aria-label={label}
    data-tooltip={tooltip}
    onclick={() => preferences.toggleToolbar()}
    class="btn btn-icon {iconButton}"
  >
    <Icon name="eye-open" id="icon-eye-open" hidden={!preferences.toolbarVisible} />
    <Icon name="eye-closed" id="icon-eye-closed" hidden={preferences.toolbarVisible} />
  </button>
</div>
