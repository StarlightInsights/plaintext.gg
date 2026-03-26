import test from 'node:test';
import assert from 'node:assert/strict';

import {
	clampFontSize,
	DEFAULT_FONT_SIZE,
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
