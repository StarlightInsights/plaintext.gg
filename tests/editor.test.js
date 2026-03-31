import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampFontSize,
  parseStoredFontSize,
  normalizeTheme,
  normalizeToolbarVisibility,
  compareVersions,
  isVersionNewer,
  createRecord,
  DEFAULT_FONT_SIZE,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
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
