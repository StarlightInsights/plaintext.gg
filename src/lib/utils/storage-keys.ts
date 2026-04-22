export function syncChannelName(slug: string): string {
  return 'plaintext:text-sync:' + slug;
}

export function sessionDraftKey(slug: string): string {
  return 'plaintext:textDraft:' + slug;
}
