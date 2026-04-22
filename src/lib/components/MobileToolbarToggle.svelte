<script lang="ts">
  import Icon from './Icon.svelte';
  import { iconButton } from './button-classes';
  import { preferences } from '$lib/state/preferences.svelte';
</script>

<div
  class={[
    'toggle-mobile absolute top-[max(8px,env(safe-area-inset-top))] right-[max(12px,env(safe-area-inset-right))] z-30 sm:hidden',
    preferences.toolbarVisible && 'hidden',
  ]}
  id="toggle-mobile"
>
  <button
    type="button"
    id="btn-toggle-mobile"
    aria-pressed="true"
    aria-label="Show navigation icons and editor controls"
    data-tooltip="show"
    class={[
      'btn btn-icon btn-float tooltip-up',
      iconButton,
      'opacity-60 hover:opacity-100 focus-visible:opacity-100',
    ]}
    onclick={() => preferences.toggleToolbar()}
  >
    <Icon name="eye-closed" />
  </button>
</div>
