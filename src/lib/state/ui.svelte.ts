import { documents } from "./documents.svelte";

/**
 * Open/closed state for the app's modal dialogs. The dialogs migrated from the
 * imperative native `<dialog>.showModal()` API to Ark UI's controlled `Dialog`
 * (driven by `bind:open`), so their visibility now lives here instead of in
 * `bind:this` component refs. Each `open*` method is the single entry point a
 * trigger calls; closing happens by Ark flipping the bound boolean (Esc,
 * backdrop click, or close button), so no explicit `close*` plumbing is needed.
 */
class UiState {
  infoOpen: boolean = $state(false);
  settingsOpen: boolean = $state(false);
  documentsOpen: boolean = $state(false);

  openInfo(): void {
    this.infoOpen = true;
  }

  openSettings(): void {
    this.settingsOpen = true;
  }

  /** Refresh the document list before revealing the picker (was in the old `show()`). */
  openDocuments(): void {
    void documents.reloadList();
    this.documentsOpen = true;
  }
}

export const ui = new UiState();
