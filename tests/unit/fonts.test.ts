import { describe, expect, test } from 'vitest';
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_WEIGHT,
  FONT_FAMILIES,
  FONT_FAMILY_WEIGHTS,
  MAX_FONT_SIZE,
  MAX_FONT_WEIGHT,
  MIN_FONT_SIZE,
  MIN_FONT_WEIGHT,
} from '../../src/lib/constants';
import {
  clampFontSize,
  clampFontWeight,
  normalizeFontFamily,
  parseStoredFontItalic,
  parseStoredFontSize,
  parseStoredFontWeight,
} from '../../src/lib/utils/fonts';

describe('parseStoredFontSize', () => {
  test('returns NaN for missing values', () => {
    expect(Number.isNaN(parseStoredFontSize(null))).toBe(true);
  });

  test('parses numeric strings', () => {
    expect(parseStoredFontSize(String(DEFAULT_FONT_SIZE))).toBe(DEFAULT_FONT_SIZE);
  });
});

describe('clampFontSize', () => {
  test('respects the minimum', () => {
    expect(clampFontSize(MIN_FONT_SIZE - 10)).toBe(MIN_FONT_SIZE);
  });

  test('respects the maximum', () => {
    expect(clampFontSize(MAX_FONT_SIZE + 10)).toBe(MAX_FONT_SIZE);
  });
});

describe('clampFontWeight', () => {
  test('snaps below minimum to nearest valid weight', () => {
    expect(clampFontWeight(100)).toBe(MIN_FONT_WEIGHT);
  });

  test('snaps above maximum to nearest valid weight', () => {
    expect(clampFontWeight(800)).toBe(MAX_FONT_WEIGHT);
  });

  test('snaps to nearest valid weight', () => {
    expect(clampFontWeight(251)).toBe(300);
    expect(clampFontWeight(249)).toBe(200);
    expect(clampFontWeight(450)).toBe(300);
    expect(clampFontWeight(451)).toBe(600);
    expect(clampFontWeight(500)).toBe(600);
    expect(clampFontWeight(300)).toBe(300);
  });
});

describe('parseStoredFontWeight', () => {
  test('returns default for null', () => {
    expect(parseStoredFontWeight(null)).toBe(DEFAULT_FONT_WEIGHT);
  });

  test('parses valid weight strings', () => {
    expect(parseStoredFontWeight('600')).toBe(600);
    expect(parseStoredFontWeight('200')).toBe(200);
  });

  test('returns default for non-numeric strings', () => {
    expect(parseStoredFontWeight('abc')).toBe(DEFAULT_FONT_WEIGHT);
  });
});

describe('parseStoredFontItalic', () => {
  test('returns false for null', () => {
    expect(parseStoredFontItalic(null)).toBe(false);
  });

  test('returns true for "true"', () => {
    expect(parseStoredFontItalic('true')).toBe(true);
  });

  test('returns false for other strings', () => {
    expect(parseStoredFontItalic('false')).toBe(false);
    expect(parseStoredFontItalic('yes')).toBe(false);
  });
});

describe('normalizeFontFamily', () => {
  test('returns mono for null', () => {
    expect(normalizeFontFamily(null)).toBe('mono');
  });

  test('returns mono for unknown strings', () => {
    expect(normalizeFontFamily('comic-sans')).toBe('mono');
  });

  test('keeps sans-serif', () => {
    expect(normalizeFontFamily('sans-serif')).toBe('sans-serif');
  });

  test('keeps serif', () => {
    expect(normalizeFontFamily('serif')).toBe('serif');
  });

  test('keeps dyslexic', () => {
    expect(normalizeFontFamily('dyslexic')).toBe('dyslexic');
  });

  test('returns mono for empty string', () => {
    expect(normalizeFontFamily('')).toBe('mono');
  });
});

describe('Font family constants', () => {
  test('FONT_FAMILY_WEIGHTS mono supports all 3 weights', () => {
    expect(FONT_FAMILY_WEIGHTS.mono).toEqual([200, 300, 600]);
  });

  test('FONT_FAMILY_WEIGHTS sans-serif supports all 3 weights', () => {
    expect(FONT_FAMILY_WEIGHTS['sans-serif']).toEqual([200, 300, 600]);
  });

  test('FONT_FAMILY_WEIGHTS serif only supports regular and bold', () => {
    expect(FONT_FAMILY_WEIGHTS.serif).toEqual([300, 600]);
  });

  test('FONT_FAMILY_WEIGHTS dyslexic only supports regular and bold', () => {
    expect(FONT_FAMILY_WEIGHTS.dyslexic).toEqual([300, 600]);
  });

  test('DEFAULT_FONT_FAMILY equals mono', () => {
    expect(DEFAULT_FONT_FAMILY).toBe('mono');
  });

  test('FONT_FAMILIES contains exactly the four supported families', () => {
    expect(FONT_FAMILIES).toEqual(['mono', 'sans-serif', 'serif', 'dyslexic']);
  });
});
