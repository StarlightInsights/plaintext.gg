import { describe, expect, test } from 'vitest';
import { normalizeTheme, normalizeToolbarVisibility } from '../../src/lib/utils/theme';

describe('normalizeTheme', () => {
  test('defaults unknown values to light', () => {
    expect(normalizeTheme('sepia')).toBe('light');
  });

  test('keeps dark mode', () => {
    expect(normalizeTheme('dark')).toBe('dark');
  });

  test('defaults missing values to light', () => {
    expect(normalizeTheme(null)).toBe('light');
  });
});

describe('normalizeToolbarVisibility', () => {
  test('defaults unknown values to hidden', () => {
    expect(normalizeToolbarVisibility('collapsed')).toBe(false);
  });

  test('keeps visible mode', () => {
    expect(normalizeToolbarVisibility('visible')).toBe(true);
  });
});
