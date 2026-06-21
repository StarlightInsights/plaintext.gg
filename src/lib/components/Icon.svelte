<script lang="ts">
  import { css, cx } from 'styled-system/css';
  import { ICON_PATHS, type IconName } from './icons';

  type Props = {
    name: IconName;
    id?: string;
    size?: 'default' | 'small' | 'close';
    hidden?: boolean;
  };

  let { name, id, size = 'default', hidden = false }: Props = $props();

  const sizeClass = $derived(
    size === 'small'
      ? css({ w: '4', h: '4' })
      : size === 'close'
        ? css({ w: '18px', h: '18px' })
        : css({ w: '5', h: '5' })
  );
</script>

<svg
  {id}
  class={cx('icon', css({ flexShrink: 0, fill: 'currentColor', pointerEvents: 'none' }), sizeClass)}
  aria-hidden="true"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
  style:display={hidden ? 'none' : undefined}
>
  {#each ICON_PATHS[name] as path}
    <path d={path.d} opacity={path.opacity}></path>
  {/each}
</svg>
