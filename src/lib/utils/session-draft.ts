import { SESSION_KEYS } from '../constants';
import { sessionDraftKey } from './storage-keys';
import { toVersion } from './versions';
import type { SessionDraft } from '../types';

export function readDraft(slug: string): SessionDraft | null {
  try {
    const key = sessionDraftKey(slug);
    if (slug === 'current' && !sessionStorage.getItem(key)) {
      const oldDraft = sessionStorage.getItem(SESSION_KEYS.textDraft);
      if (oldDraft) {
        sessionStorage.setItem(key, oldDraft);
        sessionStorage.removeItem(SESSION_KEYS.textDraft);
      }
    }
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as unknown;
    if (!d || typeof d !== 'object') return null;
    const obj = d as Record<string, unknown>;
    const v = obj.version as Record<string, unknown> | undefined;
    if (
      typeof obj.text !== 'string' ||
      !v ||
      typeof v.updatedAt !== 'number' ||
      typeof v.sourceTabId !== 'string' ||
      typeof v.saveSequence !== 'number'
    ) {
      return null;
    }
    return { text: obj.text, version: toVersion(v as { updatedAt: number; sourceTabId: string; saveSequence: number }) };
  } catch {
    return null;
  }
}

export function writeDraft(slug: string, text: string, version: { updatedAt: number; sourceTabId: string; saveSequence: number }): void {
  try {
    sessionStorage.setItem(sessionDraftKey(slug), JSON.stringify({ text, version }));
  } catch {
    /* ignore */
  }
}

export function clearDraft(slug: string): void {
  try {
    sessionStorage.removeItem(sessionDraftKey(slug));
  } catch {
    /* ignore */
  }
}
