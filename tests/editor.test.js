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
  getSlugFromPath,
  syncChannelName,
  sessionDraftKey,
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

test('createRecord uses the given slug as document id', () => {
  assert.deepEqual(
    createRecord('hello', {
      updatedAt: 20,
      sourceTabId: 'tab-a',
      saveSequence: 1
    }, 'my-doc'),
    {
      id: 'my-doc',
      text: 'hello',
      updatedAt: 20,
      sourceTabId: 'tab-a',
      saveSequence: 1
    }
  );
});

test('createRecord with current slug preserves backward compat', () => {
  assert.deepEqual(
    createRecord('hello', {
      updatedAt: 20,
      sourceTabId: 'tab-a',
      saveSequence: 1
    }, 'current'),
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

// ---- getSlugFromPath ----

test('getSlugFromPath returns current for root', () => {
  assert.equal(getSlugFromPath('/'), 'current');
});

test('getSlugFromPath extracts simple slug', () => {
  assert.equal(getSlugFromPath('/my-doc'), 'my-doc');
});

test('getSlugFromPath lowercases the slug', () => {
  assert.equal(getSlugFromPath('/My-Doc'), 'my-doc');
});

test('getSlugFromPath returns null for paths with dots (static files)', () => {
  assert.equal(getSlugFromPath('/app.js'), null);
  assert.equal(getSlugFromPath('/favicon.ico'), null);
  assert.equal(getSlugFromPath('/manifest.webmanifest'), null);
});

test('getSlugFromPath returns null for paths with multiple segments', () => {
  assert.equal(getSlugFromPath('/fonts/commitmono'), null);
});

test('getSlugFromPath returns null for slugs with leading hyphen', () => {
  assert.equal(getSlugFromPath('/-my-doc'), null);
});

test('getSlugFromPath returns null for slugs with trailing hyphen', () => {
  assert.equal(getSlugFromPath('/my-doc-'), null);
});

test('getSlugFromPath returns null for empty segment after slash', () => {
  assert.equal(getSlugFromPath('/'), 'current');
});

test('getSlugFromPath accepts alphanumeric with hyphens', () => {
  assert.equal(getSlugFromPath('/meeting-notes-2024'), 'meeting-notes-2024');
  assert.equal(getSlugFromPath('/a'), 'a');
  assert.equal(getSlugFromPath('/123'), '123');
});

test('getSlugFromPath rejects slugs over 64 chars', () => {
  var longSlug = '/' + 'a'.repeat(65);
  assert.equal(getSlugFromPath(longSlug), null);
});

test('getSlugFromPath accepts slugs of exactly 64 chars', () => {
  var slug = 'a'.repeat(64);
  assert.equal(getSlugFromPath('/' + slug), slug);
});

test('getSlugFromPath rejects special characters', () => {
  assert.equal(getSlugFromPath('/my_doc'), null);
  assert.equal(getSlugFromPath('/my doc'), null);
  assert.equal(getSlugFromPath('/my@doc'), null);
});

// ---- syncChannelName ----

test('syncChannelName returns scoped channel name', () => {
  assert.equal(syncChannelName('my-doc'), 'plaintext:text-sync:my-doc');
  assert.equal(syncChannelName('current'), 'plaintext:text-sync:current');
});

// ---- sessionDraftKey ----

test('sessionDraftKey returns scoped session key', () => {
  assert.equal(sessionDraftKey('my-doc'), 'plaintext:textDraft:my-doc');
  assert.equal(sessionDraftKey('current'), 'plaintext:textDraft:current');
});
