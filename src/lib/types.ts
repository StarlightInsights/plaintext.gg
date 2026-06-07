export type Theme = "light" | "dark";

export type FontFamily = "mono" | "sans-serif" | "serif" | "dyslexic";

export interface Version {
  updatedAt: number;
  sourceTabId: string;
  saveSequence: number;
}

export interface DocumentRecord extends Version {
  id: string;
  text: string;
}

export interface SessionDraft {
  text: string;
  version: Version;
}

export type SyncMessage = Version & { type: "text-updated" };

export type SortMode = "alpha" | "recent";
