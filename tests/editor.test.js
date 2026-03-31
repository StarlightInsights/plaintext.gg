import test from 'node:test';
import assert from 'node:assert/strict';

// Inline the pure utility functions that are tested.
// These are the same functions defined in public/app.js.

const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 34;

function clampFontSize(n) {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, n));
}

function parseStoredFontSize(v) {
  return v === null ? NaN : Number(v);
}

function normalizeTheme(v) {
  return v === 'dark' ? 'dark' : 'light';
}

function normalizeToolbarIconsVisibility(v) {
  return v === 'visible';
}

function comparePersistedTextVersions(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
  if (a.sourceTabId !== b.sourceTabId) return a.sourceTabId.localeCompare(b.sourceTabId);
  return a.saveSequence - b.saveSequence;
}

function isPersistedTextVersionNewer(candidate, current) {
  return comparePersistedTextVersions(candidate, current) > 0;
}

function createPersistedTextRecord(text, version) {
  return {
    id: 'current',
    text,
    updatedAt: version.updatedAt,
    sourceTabId: version.sourceTabId,
    saveSequence: version.saveSequence
  };
}

// Tests

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

test('normalizeToolbarIconsVisibility defaults unknown values to hidden', () => {
  assert.equal(normalizeToolbarIconsVisibility('collapsed'), false);
});

test('normalizeToolbarIconsVisibility keeps visible mode', () => {
  assert.equal(normalizeToolbarIconsVisibility('visible'), true);
});

test('comparePersistedTextVersions orders newer timestamps first', () => {
  assert.equal(
    comparePersistedTextVersions(
      { updatedAt: 20, sourceTabId: 'tab-a', saveSequence: 1 },
      { updatedAt: 10, sourceTabId: 'tab-b', saveSequence: 9 }
    ) > 0,
    true
  );
});

test('comparePersistedTextVersions breaks ties by tab id and sequence', () => {
  assert.equal(
    comparePersistedTextVersions(
      { updatedAt: 20, sourceTabId: 'tab-b', saveSequence: 2 },
      { updatedAt: 20, sourceTabId: 'tab-b', saveSequence: 1 }
    ) > 0,
    true
  );
});

test('comparePersistedTextVersions treats two missing versions as equal', () => {
  assert.equal(comparePersistedTextVersions(null, null), 0);
});

test('isPersistedTextVersionNewer handles missing current version', () => {
  assert.equal(
    isPersistedTextVersionNewer(
      { updatedAt: 20, sourceTabId: 'tab-a', saveSequence: 1 },
      null
    ),
    true
  );
});

test('isPersistedTextVersionNewer returns false when versions are equal', () => {
  assert.equal(
    isPersistedTextVersionNewer(
      { updatedAt: 20, sourceTabId: 'tab-a', saveSequence: 1 },
      { updatedAt: 20, sourceTabId: 'tab-a', saveSequence: 1 }
    ),
    false
  );
});

test('createPersistedTextRecord uses the current document id and version', () => {
  assert.deepEqual(
    createPersistedTextRecord('hello', {
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
