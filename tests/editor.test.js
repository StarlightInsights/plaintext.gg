import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampFontSize,
  parseStoredFontSize,
  clampFontWeight,
  parseStoredFontWeight,
  parseStoredFontItalic,
  normalizeTheme,
  normalizeToolbarVisibility,
  normalizeFontFamily,
  compareVersions,
  isVersionNewer,
  createRecord,
  DEFAULT_FONT_SIZE,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  DEFAULT_FONT_WEIGHT,
  MIN_FONT_WEIGHT,
  MAX_FONT_WEIGHT,
  DEFAULT_FONT_FAMILY,
  FONT_FAMILIES,
  FONT_FAMILY_WEIGHTS,
} from '../public/shared.js';

test('parseStoredFontSize returns NaN for missing values', () => {
  assert.equal(Number.isNaN(parseStoredFontSize(null)), true);
});

test('parseStoredFontSize parses numeric strings', () => {
  assert.equal(parseStoredFontSize(String(DEFAULT_FONT_SIZE)), DEFAULT_FONT_SIZE);
});

test('clampFontSize respects the minimum', () => {
  assert.equal(clampFontSize(MIN_FONT_SIZE - 10), MIN_FONT_SIZE);
});

test('clampFontSize respects the maximum', () => {
  assert.equal(clampFontSize(MAX_FONT_SIZE + 10), MAX_FONT_SIZE);
});

test('clampFontWeight snaps below minimum to nearest valid weight', () => {
  assert.equal(clampFontWeight(100), MIN_FONT_WEIGHT);
});

test('clampFontWeight snaps above maximum to nearest valid weight', () => {
  assert.equal(clampFontWeight(800), MAX_FONT_WEIGHT);
});

test('clampFontWeight snaps to nearest valid weight', () => {
  assert.equal(clampFontWeight(251), 300);
  assert.equal(clampFontWeight(249), 200);
  assert.equal(clampFontWeight(450), 300);
  assert.equal(clampFontWeight(451), 600);
  assert.equal(clampFontWeight(500), 600);
  assert.equal(clampFontWeight(300), 300);
});

test('parseStoredFontWeight returns default for null', () => {
  assert.equal(parseStoredFontWeight(null), DEFAULT_FONT_WEIGHT);
});

test('parseStoredFontWeight parses valid weight strings', () => {
  assert.equal(parseStoredFontWeight('600'), 600);
  assert.equal(parseStoredFontWeight('200'), 200);
});

test('parseStoredFontWeight returns default for non-numeric strings', () => {
  assert.equal(parseStoredFontWeight('abc'), DEFAULT_FONT_WEIGHT);
});

test('parseStoredFontItalic returns false for null', () => {
  assert.equal(parseStoredFontItalic(null), false);
});

test('parseStoredFontItalic returns true for "true"', () => {
  assert.equal(parseStoredFontItalic('true'), true);
});

test('parseStoredFontItalic returns false for other strings', () => {
  assert.equal(parseStoredFontItalic('false'), false);
  assert.equal(parseStoredFontItalic('yes'), false);
});

test('normalizeTheme defaults unknown values to light', () => {
  assert.equal(normalizeTheme('sepia'), 'light');
});

test('normalizeTheme keeps dark mode', () => {
  assert.equal(normalizeTheme('dark'), 'dark');
});

test('normalizeTheme defaults missing values to light', () => {
  assert.equal(normalizeTheme(null), 'light');
});

test('normalizeToolbarVisibility defaults unknown values to hidden', () => {
  assert.equal(normalizeToolbarVisibility('collapsed'), false);
});

test('normalizeToolbarVisibility keeps visible mode', () => {
  assert.equal(normalizeToolbarVisibility('visible'), true);
});

test('compareVersions orders newer timestamps first', () => {
  assert.equal(
    compareVersions(
      { updatedAt: 20, sourceTabId: 'tab-a', saveSequence: 1 },
      { updatedAt: 10, sourceTabId: 'tab-b', saveSequence: 9 }
    ) > 0,
    true
  );
});

test('compareVersions breaks ties by tab id and sequence', () => {
  assert.equal(
    compareVersions(
      { updatedAt: 20, sourceTabId: 'tab-b', saveSequence: 2 },
      { updatedAt: 20, sourceTabId: 'tab-b', saveSequence: 1 }
    ) > 0,
    true
  );
});

test('compareVersions treats two missing versions as equal', () => {
  assert.equal(compareVersions(null, null), 0);
});

test('isVersionNewer handles missing current version', () => {
  assert.equal(
    isVersionNewer(
      { updatedAt: 20, sourceTabId: 'tab-a', saveSequence: 1 },
      null
    ),
    true
  );
});

test('isVersionNewer returns false when versions are equal', () => {
  assert.equal(
    isVersionNewer(
      { updatedAt: 20, sourceTabId: 'tab-a', saveSequence: 1 },
      { updatedAt: 20, sourceTabId: 'tab-a', saveSequence: 1 }
    ),
    false
  );
});

test('createRecord uses the current document id and version', () => {
  assert.deepEqual(
    createRecord('hello', {
      updatedAt: 20,
      sourceTabId: 'tab-a',
      saveSequence: 1
    }),
    {
      id: 'current',
      text: 'hello',
      updatedAt: 20,
      sourceTabId: 'tab-a',
      saveSequence: 1
    }
  );
});

test('normalizeFontFamily returns mono for null', () => {
  assert.equal(normalizeFontFamily(null), 'mono');
});

test('normalizeFontFamily returns mono for unknown strings', () => {
  assert.equal(normalizeFontFamily('comic-sans'), 'mono');
});

test('normalizeFontFamily keeps sans-serif', () => {
  assert.equal(normalizeFontFamily('sans-serif'), 'sans-serif');
});

test('normalizeFontFamily keeps serif', () => {
  assert.equal(normalizeFontFamily('serif'), 'serif');
});

test('normalizeFontFamily keeps dyslexic', () => {
  assert.equal(normalizeFontFamily('dyslexic'), 'dyslexic');
});

test('normalizeFontFamily returns mono for empty string', () => {
  assert.equal(normalizeFontFamily(''), 'mono');
});

test('FONT_FAMILY_WEIGHTS mono supports all 3 weights', () => {
  assert.deepEqual(FONT_FAMILY_WEIGHTS['mono'], [200, 300, 600]);
});

test('FONT_FAMILY_WEIGHTS sans-serif supports all 3 weights', () => {
  assert.deepEqual(FONT_FAMILY_WEIGHTS['sans-serif'], [200, 300, 600]);
});

test('FONT_FAMILY_WEIGHTS serif only supports regular and bold', () => {
  assert.deepEqual(FONT_FAMILY_WEIGHTS['serif'], [300, 600]);
});

test('FONT_FAMILY_WEIGHTS dyslexic only supports regular and bold', () => {
  assert.deepEqual(FONT_FAMILY_WEIGHTS['dyslexic'], [300, 600]);
});

test('DEFAULT_FONT_FAMILY equals mono', () => {
  assert.equal(DEFAULT_FONT_FAMILY, 'mono');
});

test('FONT_FAMILIES contains exactly the four supported families', () => {
  assert.deepEqual(FONT_FAMILIES, ['mono', 'sans-serif', 'serif', 'dyslexic']);
});
