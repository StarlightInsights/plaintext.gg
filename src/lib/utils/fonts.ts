import {
  DEFAULT_FONT_WEIGHT,
  FONT_WEIGHTS,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
} from '../constants';
import type { FontFamily } from '../types';

export function clampFontSize(n: number): number {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, n));
}

export function parseStoredFontSize(v: string | null): number {
  return v === null ? NaN : Number(v);
}

export function clampFontWeight(n: number): number {
  let best: number = FONT_WEIGHTS[0];
  for (let i = 1; i < FONT_WEIGHTS.length; i++) {
    if (Math.abs(n - FONT_WEIGHTS[i]) < Math.abs(n - best)) {
      best = FONT_WEIGHTS[i];
    }
  }
  return best;
}

export function parseStoredFontWeight(v: string | null): number {
  if (v === null) return DEFAULT_FONT_WEIGHT;
  const n = Number(v);
  return Number.isFinite(n) ? clampFontWeight(n) : DEFAULT_FONT_WEIGHT;
}

export function parseStoredFontItalic(v: string | null): boolean {
  return v === 'true';
}

export function normalizeFontFamily(v: string | null): FontFamily {
  if (v === 'sans-serif' || v === 'serif' || v === 'dyslexic') return v;
  return 'mono';
}
