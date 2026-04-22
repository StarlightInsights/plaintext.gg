import { announcer } from '$lib/state/announce.svelte';
import { documents } from '$lib/state/documents.svelte';
import { DEFAULT_SLUG } from '$lib/constants';

export function filenameForSlug(slug: string): string {
  return slug === DEFAULT_SLUG ? 'plaintext.txt' : `${slug}.txt`;
}

function triggerDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download the current document as a .txt file and announce the save. */
export function saveCurrentDocument(): void {
  const filename = filenameForSlug(documents.currentSlug);
  triggerDownload(documents.text, filename);
  announcer.announce(`File saved as ${filename}`);
}
