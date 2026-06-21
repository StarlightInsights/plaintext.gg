<script lang="ts">
  import { css, cx } from 'styled-system/css';
</script>

<a
  href="#editor"
  class={cx(
    'skip-link',
    css({
      position: 'absolute',
      left: '4',
      top: '-100%',
      zIndex: 100,
      px: '4',
      py: '2',
      bg: 'fg',
      color: 'bg',
      fontFamily: 'header',
      fontSize: 'sm',
      textDecoration: 'none',
      borderBottomLeftRadius: '0.25rem',
      borderBottomRightRadius: '0.25rem',
      transitionProperty: 'top',
      transitionDuration: '160ms',
      transitionTimingFunction: 'ease-out',
      _focus: { top: '0' },
    })
  )}
  id="skip-link"
>Skip to editor</a>
