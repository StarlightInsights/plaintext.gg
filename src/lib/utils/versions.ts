import type { DocumentRecord, Version } from '../types';

export function compareVersions(a: Version | null, b: Version | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
  if (a.sourceTabId !== b.sourceTabId) return a.sourceTabId.localeCompare(b.sourceTabId);
  return a.saveSequence - b.saveSequence;
}

export function isVersionNewer(candidate: Version | null, current: Version | null): boolean {
  return compareVersions(candidate, current) > 0;
}

export function toVersion(v: {
  updatedAt: number;
  sourceTabId: string;
  saveSequence: number;
}): Version {
  return { updatedAt: v.updatedAt, sourceTabId: v.sourceTabId, saveSequence: v.saveSequence };
}

export function createRecord(text: string, version: Version, slug: string): DocumentRecord {
  return {
    id: slug,
    text,
    updatedAt: version.updatedAt,
    sourceTabId: version.sourceTabId,
    saveSequence: version.saveSequence,
  };
}
