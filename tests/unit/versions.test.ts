import { describe, expect, test } from 'vitest';
import { compareVersions, createRecord, isVersionNewer } from '../../src/lib/utils/versions';

describe('compareVersions', () => {
  test('orders newer timestamps first', () => {
    expect(
      compareVersions(
        { updatedAt: 20, sourceTabId: 'tab-a', saveSequence: 1 },
        { updatedAt: 10, sourceTabId: 'tab-b', saveSequence: 9 }
      )
    ).toBeGreaterThan(0);
  });

  test('breaks ties by tab id and sequence', () => {
    expect(
      compareVersions(
        { updatedAt: 20, sourceTabId: 'tab-b', saveSequence: 2 },
        { updatedAt: 20, sourceTabId: 'tab-b', saveSequence: 1 }
      )
    ).toBeGreaterThan(0);
  });

  test('treats two missing versions as equal', () => {
    expect(compareVersions(null, null)).toBe(0);
  });
});

describe('isVersionNewer', () => {
  test('handles missing current version', () => {
    expect(
      isVersionNewer({ updatedAt: 20, sourceTabId: 'tab-a', saveSequence: 1 }, null)
    ).toBe(true);
  });

  test('returns false when versions are equal', () => {
    expect(
      isVersionNewer(
        { updatedAt: 20, sourceTabId: 'tab-a', saveSequence: 1 },
        { updatedAt: 20, sourceTabId: 'tab-a', saveSequence: 1 }
      )
    ).toBe(false);
  });
});

describe('createRecord', () => {
  test('uses the given slug as document id', () => {
    expect(
      createRecord('hello', { updatedAt: 20, sourceTabId: 'tab-a', saveSequence: 1 }, 'my-doc')
    ).toEqual({
      id: 'my-doc',
      text: 'hello',
      updatedAt: 20,
      sourceTabId: 'tab-a',
      saveSequence: 1,
    });
  });

  test('with current slug preserves backward compat', () => {
    expect(
      createRecord('hello', { updatedAt: 20, sourceTabId: 'tab-a', saveSequence: 1 }, 'current')
    ).toEqual({
      id: 'current',
      text: 'hello',
      updatedAt: 20,
      sourceTabId: 'tab-a',
      saveSequence: 1,
    });
  });
});
