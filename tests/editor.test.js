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
  compareVersions,
  isVersionNewer,
  createRecord,
  DEFAULT_FONT_SIZE,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  DEFAULT_FONT_WEIGHT,
  MIN_FONT_WEIGHT,
  MAX_FONT_WEIGHT,
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
  assert.equal(clampFontWeight(350), 400);
  assert.equal(clampFontWeight(249), 200);
  assert.equal(clampFontWeight(551), 700);
  assert.equal(clampFontWeight(500), 400);
  assert.equal(clampFontWeight(600), 700);
  assert.equal(clampFontWeight(300), 200);
});

test('parseStoredFontWeight returns default for null', () => {
  assert.equal(parseStoredFontWeight(null), DEFAULT_FONT_WEIGHT);
});

test('parseStoredFontWeight parses valid weight strings', () => {
  assert.equal(parseStoredFontWeight('700'), 700);
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
