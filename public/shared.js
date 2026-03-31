// Pure utility functions shared between app.js and tests.
// No DOM, no side effects — safe to import in Node.

export var DEFAULT_FONT_SIZE = 14;
export var FONT_STEP = 2;
export var MIN_FONT_SIZE = 10;
export var MAX_FONT_SIZE = 34;
export var COPY_FEEDBACK_MS = 400;
export var PERSIST_DELAY_MS = 300;
export var SYNC_CHANNEL = 'plaintext:text-sync';

export var STORAGE_KEYS = {
  theme: 'plaintext:theme',
  fontSize: 'plaintext:fontSize',
  toolbarIcons: 'plaintext:toolbarIcons'
};

export var SESSION_KEYS = {
  textDraft: 'plaintext:textDraft'
};

export var THEME_COLORS = { light: '#fffdf7', dark: '#38342e' };

export function clampFontSize(n) {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, n));
}

export function parseStoredFontSize(v) {
  return v === null ? NaN : Number(v);
}

export function normalizeTheme(v) {
  return v === 'dark' ? 'dark' : 'light';
}

export function normalizeToolbarVisibility(v) {
  return v === 'visible';
}

export function compareVersions(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
  if (a.sourceTabId !== b.sourceTabId) return a.sourceTabId.localeCompare(b.sourceTabId);
  return a.saveSequence - b.saveSequence;
}

export function isVersionNewer(candidate, current) {
  return compareVersions(candidate, current) > 0;
}

export function toVersion(v) {
  return { updatedAt: v.updatedAt, sourceTabId: v.sourceTabId, saveSequence: v.saveSequence };
}

export function createRecord(text, version) {
  return {
    id: 'current',
    text: text,
    updatedAt: version.updatedAt,
    sourceTabId: version.sourceTabId,
    saveSequence: version.saveSequence
  };
}
