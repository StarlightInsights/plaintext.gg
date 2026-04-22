import type { Theme } from '../types';

export function normalizeTheme(v: string | null): Theme {
  return v === 'dark' ? 'dark' : 'light';
}

export function normalizeToolbarVisibility(v: string | null): boolean {
  return v === 'visible';
}
