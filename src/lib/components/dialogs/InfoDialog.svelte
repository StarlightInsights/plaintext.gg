<script lang="ts">
  import Dialog from './Dialog.svelte';
  import { dialogLink } from '../button-classes';

  let dialog: Dialog | undefined = $state(undefined);

  export function show(): void {
    dialog?.show();
  }
</script>

<Dialog
  bind:this={dialog}
  id="dialog-info"
  title="about"
  titleId="dialog-info-title"
  descId="dialog-info-desc"
  wide
>
  <p class="m-0">plaintext.gg is a simple text editor.</p>
  <p class="m-0">no ai. no formatting. no cookies. no analytics. no tracking. no accounts.</p>
  <p class="m-0">
    your text is saved locally in your browser. nothing is sent to any server.
    <strong class="font-main font-semibold">ever</strong>.
  </p>
  <p class="m-0">
    thank you
    <a class={dialogLink} href="https://commitmono.com/?utm_source=plaintext.gg" target="_blank" rel="noopener noreferrer">Commit Mono<span class="sr-only"> (opens in new tab)</span></a>.
    thank you
    <a class={dialogLink} href="https://opendyslexic.org/" target="_blank" rel="noopener noreferrer">OpenDyslexic<span class="sr-only"> (opens in new tab)</span></a>.
    thank you
    <a class={dialogLink} href="https://phosphoricons.com/?utm_source=plaintext.gg" target="_blank" rel="noopener noreferrer">Phosphor<span class="sr-only"> (opens in new tab)</span></a>.
  </p>
  <p class="m-0">
    self hostable and open sourced at
    <a class={dialogLink} href="https://github.com/StarlightInsights/plaintext.gg" target="_blank" rel="noopener noreferrer">GitHub<span class="sr-only"> (opens in new tab)</span></a>.
  </p>
  <p class="m-0"><strong class="font-main font-semibold">sister sites:</strong></p>
  <p class="m-0">
    <a class={dialogLink} href="https://youshallnotpass.io/" target="_blank" rel="noopener noreferrer">YouShallNotPass.io<span class="sr-only"> (opens in new tab)</span></a>
  </p>
</Dialog>
