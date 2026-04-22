<script lang="ts">
  import { ICON_PATHS, type IconName } from './icons';

  type Props = {
    name: IconName;
    id?: string;
    size?: 'default' | 'small' | 'close';
    hidden?: boolean;
  };

  let { name, id, size = 'default', hidden = false }: Props = $props();

  const sizeClass = $derived(
    size === 'small' ? 'w-4 h-4' : size === 'close' ? 'w-[18px] h-[18px]' : 'w-5 h-5'
  );
</script>

<svg
  {id}
  class={['icon shrink-0 fill-current pointer-events-none', sizeClass]}
  aria-hidden="true"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
  style:display={hidden ? 'none' : undefined}
>
  {#each ICON_PATHS[name] as path}
    <path d={path.d} opacity={path.opacity}></path>
  {/each}
</svg>
