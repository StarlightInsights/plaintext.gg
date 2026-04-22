import type { FontFamily } from './types';

export const DEFAULT_FONT_SIZE = 16;
export const FONT_STEP = 2;
export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 34;

export const DEFAULT_FONT_WEIGHT = 300;
export const MIN_FONT_WEIGHT = 200;
export const MAX_FONT_WEIGHT = 600;
export const FONT_WEIGHT_STEP = 100;
export const FONT_WEIGHTS = [200, 300, 600] as const;

export const DEFAULT_FONT_FAMILY: FontFamily = 'mono';
export const FONT_FAMILIES: readonly FontFamily[] = ['mono', 'sans-serif', 'serif', 'dyslexic'];

export const FONT_FAMILY_WEIGHTS: Readonly<Record<FontFamily, readonly number[]>> = {
  mono: [200, 300, 600],
  'sans-serif': [200, 300, 600],
  serif: [300, 600],
  dyslexic: [300, 600],
};

export const FONT_STACK: Readonly<Record<FontFamily, string>> = {
  mono: '"CommitMono", ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  'sans-serif': '"Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
  serif: '"EBGaramond", "Georgia", "Times New Roman", serif',
  dyslexic: '"OpenDyslexic", "Comic Sans MS", cursive, sans-serif',
};

export const FONT_WEIGHT_MAP: Readonly<Record<FontFamily, readonly [number, number, number]>> = {
  mono: [200, 300, 600],
  'sans-serif': [200, 300, 400],
  serif: [400, 400, 500],
  dyslexic: [400, 400, 700],
};

export const COPY_FEEDBACK_MS = 400;
export const PERSIST_DELAY_MS = 300;
/** Must match `--animate-toolbar-slide-in` duration in app.css. */
export const TOOLBAR_SLIDE_IN_MS = 200;

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const MAX_SLUG_LENGTH = 64;
export const DEFAULT_SLUG = 'current';

export const STORAGE_KEYS = {
  theme: 'plaintext:theme',
  fontSize: 'plaintext:fontSize',
  fontFamily: 'plaintext:fontFamily',
  fontWeight: 'plaintext:fontWeight',
  fontItalic: 'plaintext:fontItalic',
  toolbarIcons: 'plaintext:toolbarIcons',
} as const;

export const SESSION_KEYS = {
  textDraft: 'plaintext:textDraft',
} as const;

export const THEME_COLORS: Readonly<Record<'light' | 'dark', string>> = {
  light: '#fffdf7',
  dark: '#38342e',
};
