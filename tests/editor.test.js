import test from 'node:test';
import assert from 'node:assert/strict';

import {
	clampFontSize,
	comparePersistedTextVersions,
	DEFAULT_FONT_SIZE,
	isPersistedTextVersionNewer,
	MAX_FONT_SIZE,
	MIN_FONT_SIZE,
	normalizeTheme,
	parseStoredFontSize
} from '../src/lib/editor.ts';

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

test('isPersistedTextVersionNewer handles missing current version', () => {
	assert.equal(
		isPersistedTextVersionNewer(
			{ updatedAt: 20, sourceTabId: 'tab-a', saveSequence: 1 },
			null
		),
		true
	);
});
