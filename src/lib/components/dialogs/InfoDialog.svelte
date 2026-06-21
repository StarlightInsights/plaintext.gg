<script lang="ts">
  import { css } from 'styled-system/css';
  import Dialog from './Dialog.svelte';
  import { dialogLink } from '../button-classes';

  let dialog: Dialog | undefined = $state(undefined);

  export function show(): void {
    dialog?.show();
  }

  const p = css({ m: '0' });
  const strong = css({ fontFamily: 'main', fontWeight: 'semibold' });
  const srOnly = css({ srOnly: true });
</script>

<Dialog
  bind:this={dialog}
  id="dialog-info"
  title="about"
  titleId="dialog-info-title"
  descId="dialog-info-desc"
  wide
>
  <p class={p}>plaintext.gg is a simple text editor.</p>
  <p class={p}>no ai. no formatting. no cookies. no analytics. no tracking. no accounts.</p>
  <p class={p}>
    your text is saved locally in your browser. nothing is sent to any server.
    <strong class={strong}>ever</strong>.
  </p>
  <p class={p}>
    thank you
    <a class={dialogLink} href="https://commitmono.com/?utm_source=plaintext.gg" target="_blank" rel="noopener noreferrer">Commit Mono<span class={srOnly}> (opens in new tab)</span></a>.
    thank you
    <a class={dialogLink} href="https://opendyslexic.org/" target="_blank" rel="noopener noreferrer">OpenDyslexic<span class={srOnly}> (opens in new tab)</span></a>.
    thank you
    <a class={dialogLink} href="https://phosphoricons.com/?utm_source=plaintext.gg" target="_blank" rel="noopener noreferrer">Phosphor<span class={srOnly}> (opens in new tab)</span></a>.
  </p>
  <p class={p}>
    self hostable and open sourced at
    <a class={dialogLink} href="https://github.com/StarlightInsights/plaintext.gg" target="_blank" rel="noopener noreferrer">GitHub<span class={srOnly}> (opens in new tab)</span></a>.
  </p>
  <p class={p}><strong class={strong}>sister sites:</strong></p>
  <p class={p}>
    <a class={dialogLink} href="https://youshallnotpass.io/" target="_blank" rel="noopener noreferrer">YouShallNotPass.io<span class={srOnly}> (opens in new tab)</span></a>
  </p>
</Dialog>
