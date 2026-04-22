export type Theme = 'light' | 'dark';

export type FontFamily = 'mono' | 'sans-serif' | 'serif' | 'dyslexic';

export interface Version {
  updatedAt: number;
  sourceTabId: string;
  saveSequence: number;
}

export interface DocumentRecord {
  id: string;
  text: string;
  updatedAt: number;
  sourceTabId: string;
  saveSequence: number;
}

export interface SessionDraft {
  text: string;
  version: Version;
}

export interface SyncMessage {
  type: 'text-updated';
  updatedAt: number;
  sourceTabId: string;
  saveSequence: number;
}

export type SortMode = 'alpha' | 'recent';
