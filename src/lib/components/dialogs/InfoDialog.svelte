<script lang="ts">
  import Dialog from './Dialog.svelte';

  let dialog: Dialog;

  export function show(): void {
    dialog.show();
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
    <a class="text-muted hover:text-fg focus-visible:text-fg focus-visible:outline-2 focus-visible:outline-muted focus-visible:outline-offset-1 focus-visible:rounded-[2px] transition-colors duration-[180ms] ease-out" href="https://commitmono.com/?utm_source=plaintext.gg" target="_blank" rel="noopener noreferrer">Commit Mono<span class="sr-only"> (opens in new tab)</span></a>.
    thank you
    <a class="text-muted hover:text-fg focus-visible:text-fg focus-visible:outline-2 focus-visible:outline-muted focus-visible:outline-offset-1 focus-visible:rounded-[2px] transition-colors duration-[180ms] ease-out" href="https://opendyslexic.org/" target="_blank" rel="noopener noreferrer">OpenDyslexic<span class="sr-only"> (opens in new tab)</span></a>.
    thank you
    <a class="text-muted hover:text-fg focus-visible:text-fg focus-visible:outline-2 focus-visible:outline-muted focus-visible:outline-offset-1 focus-visible:rounded-[2px] transition-colors duration-[180ms] ease-out" href="https://phosphoricons.com/?utm_source=plaintext.gg" target="_blank" rel="noopener noreferrer">Phosphor<span class="sr-only"> (opens in new tab)</span></a>.
  </p>
  <p class="m-0">
    self hostable and open sourced at
    <a class="text-muted hover:text-fg focus-visible:text-fg focus-visible:outline-2 focus-visible:outline-muted focus-visible:outline-offset-1 focus-visible:rounded-[2px] transition-colors duration-[180ms] ease-out" href="https://github.com/StarlightInsights/plaintext.gg" target="_blank" rel="noopener noreferrer">GitHub<span class="sr-only"> (opens in new tab)</span></a>.
  </p>
</Dialog>
