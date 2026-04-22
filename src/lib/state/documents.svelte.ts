import { PERSIST_DELAY_MS } from '../constants';
import { deleteRecord, listRecords, loadRecord, saveRecord } from '../db/documents';
import { clearDraft, readDraft, writeDraft } from '../utils/session-draft';
import { syncChannelName } from '../utils/storage-keys';
import { compareVersions, createRecord, isVersionNewer, toVersion } from '../utils/versions';
import type { DocumentRecord, SortMode, SyncMessage, Version } from '../types';

function generateTabId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

function createSyncMessage(version: Version): SyncMessage {
  return {
    type: 'text-updated',
    updatedAt: version.updatedAt,
    sourceTabId: version.sourceTabId,
    saveSequence: version.saveSequence,
  };
}

function parseSyncMessage(value: unknown): SyncMessage | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.type !== 'text-updated') return null;
  if (typeof v.updatedAt !== 'number' || typeof v.sourceTabId !== 'string' || typeof v.saveSequence !== 'number') {
    return null;
  }
  return { type: 'text-updated', updatedAt: v.updatedAt, sourceTabId: v.sourceTabId, saveSequence: v.saveSequence };
}

export type ApplyTextCallback = (nextText: string) => void;

class DocumentsState {
  currentSlug: string = $state('current');
  text: string = $state('');
  records: DocumentRecord[] = $state([]);
  sortMode: SortMode = $state('alpha');

  #tabId = generateTabId();
  #localSaveSequence = 0;
  #persistedVersion: Version | null = null;
  #pendingVersion: Version | null = null;
  #hasPendingEdits = false;
  #persistTimeout: ReturnType<typeof setTimeout> | null = null;
  #persistChain: Promise<void> = Promise.resolve();
  #broadcastChannel: BroadcastChannel | null = null;
  /** Callback registered by the Editor component to surgically update the textarea while preserving cursor. */
  #applyText: ApplyTextCallback | null = null;

  registerApplyText(cb: ApplyTextCallback): void {
    this.#applyText = cb;
  }

  setSlug(slug: string): void {
    this.currentSlug = slug;
  }

  /**
   * Switch to a different document. Flushes any pending edits on the outgoing
   * slug, rotates the per-slug broadcast channel, clears in-memory text to
   * avoid a flash of the previous document, then loads the new slug from
   * IndexedDB (or sessionStorage draft).
   */
  async switchToSlug(slug: string): Promise<void> {
    if (slug === this.currentSlug) return;

    await this.flushPersistence().catch(() => {});
    this.closeBroadcastChannel();

    this.currentSlug = slug;
    this.text = '';
    this.#persistedVersion = null;
    this.#pendingVersion = null;
    this.#hasPendingEdits = false;
    this.#applyText?.('');

    this.openBroadcastChannel();
    await this.initPersistence();
  }

  setSortMode(mode: SortMode): void {
    this.sortMode = mode;
  }

  #createNextVersion(): Version {
    return {
      updatedAt: Date.now(),
      sourceTabId: this.#tabId,
      saveSequence: ++this.#localSaveSequence,
    };
  }

  #clearPersistTimer(): void {
    if (this.#persistTimeout) {
      clearTimeout(this.#persistTimeout);
      this.#persistTimeout = null;
    }
  }

  #schedulePersist(nextText: string): void {
    this.#clearPersistTimer();
    this.#persistTimeout = setTimeout(() => {
      this.#persistTimeout = null;
      this.#persistText(nextText);
    }, PERSIST_DELAY_MS);
  }

  #broadcastUpdate(version: Version): void {
    if (this.#broadcastChannel) {
      this.#broadcastChannel.postMessage(createSyncMessage(version));
    }
  }

  #persistText(nextText: string): Promise<void> {
    if (!this.#hasPendingEdits) return Promise.resolve();

    const nextVersion = this.#pendingVersion ?? this.#createNextVersion();
    const slug = this.currentSlug;

    if (!nextText) {
      this.#persistChain = this.#persistChain.catch(() => {}).then(async () => {
        await deleteRecord(slug);
        this.#persistedVersion = nextVersion;
        this.#pendingVersion = null;
        this.#hasPendingEdits = false;
        clearDraft(slug);
        this.#broadcastUpdate(nextVersion);
      });
      return this.#persistChain.catch(() => {});
    }

    const nextRecord = createRecord(nextText, nextVersion, slug);

    this.#persistChain = this.#persistChain.catch(() => {}).then(async () => {
      const written = await saveRecord(nextRecord);
      const writtenVersion = toVersion(written);
      this.#persistedVersion = writtenVersion;

      if (this.#pendingVersion && compareVersions(this.#pendingVersion, writtenVersion) <= 0) {
        this.#pendingVersion = null;
      }

      if (this.text === written.text && !this.#pendingVersion) {
        this.#hasPendingEdits = false;
        clearDraft(slug);
      }

      this.#broadcastUpdate(writtenVersion);
    });

    return this.#persistChain.catch(() => {});
  }

  handleInput(nextText: string): void {
    this.text = nextText;
    this.#hasPendingEdits = true;
    this.#pendingVersion = this.#createNextVersion();
    writeDraft(this.currentSlug, nextText, this.#pendingVersion);
    this.#schedulePersist(nextText);
  }

  flushPersistence(): Promise<void> {
    this.#clearPersistTimer();
    return this.#persistText(this.text);
  }

  #updateTextFromPersistence(nextText: string, nextVersion: Version): void {
    this.#hasPendingEdits = false;
    this.#persistedVersion = nextVersion;

    if (this.text === nextText) return;

    this.text = nextText;
    // Ask the editor component to mirror this into the textarea while preserving cursor.
    this.#applyText?.(nextText);
  }

  async refreshFromPersistence(minimumVersion?: Version): Promise<void> {
    try {
      const record = await loadRecord(this.currentSlug);
      if (!record) return;
      const nv = toVersion(record);
      if (minimumVersion && compareVersions(nv, minimumVersion) < 0) return;
      if (!isVersionNewer(nv, this.#persistedVersion)) return;
      if (this.#hasPendingEdits) return;
      this.#clearPersistTimer();
      this.#pendingVersion = null;
      clearDraft(this.currentSlug);
      this.#updateTextFromPersistence(record.text, nv);
    } catch {
      /* ignore */
    }
  }

  async initPersistence(): Promise<void> {
    const draft = readDraft(this.currentSlug);
    try {
      const record = await loadRecord(this.currentSlug);

      if (draft && (!record || isVersionNewer(draft.version, record))) {
        this.#updateTextFromPersistence(draft.text, draft.version);
        this.#pendingVersion = draft.version;
        this.#hasPendingEdits = true;
        this.#schedulePersist(draft.text);
        return;
      }

      if (!record) return;

      const nv = toVersion(record);
      if (this.#hasPendingEdits) {
        if (isVersionNewer(nv, this.#persistedVersion)) this.#persistedVersion = nv;
        return;
      }

      this.#pendingVersion = null;
      clearDraft(this.currentSlug);
      this.#updateTextFromPersistence(record.text, nv);
    } catch {
      if (!draft) return;
      this.#updateTextFromPersistence(draft.text, draft.version);
      this.#pendingVersion = draft.version;
      this.#hasPendingEdits = true;
      this.#schedulePersist(draft.text);
    }
  }

  openBroadcastChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    this.#broadcastChannel?.close();
    this.#broadcastChannel = new BroadcastChannel(syncChannelName(this.currentSlug));
    this.#broadcastChannel.onmessage = (event) => this.#handleBroadcast(event);
  }

  closeBroadcastChannel(): void {
    this.#broadcastChannel?.close();
    this.#broadcastChannel = null;
  }

  #handleBroadcast(event: MessageEvent): void {
    const msg = parseSyncMessage(event.data);
    if (!msg || msg.sourceTabId === this.#tabId) return;
    const nv = toVersion(msg);
    if (!isVersionNewer(nv, this.#persistedVersion)) return;
    this.refreshFromPersistence(nv);
  }

  async reloadList(): Promise<void> {
    try {
      this.records = await listRecords();
    } catch {
      /* ignore */
    }
  }
}

export const documents = new DocumentsState();
