import { describe, expect, test } from 'vitest';
import { getSlugFromPath } from '../../src/lib/utils/slug';
import { sessionDraftKey, syncChannelName } from '../../src/lib/utils/storage-keys';

describe('getSlugFromPath', () => {
  test('returns current for root', () => {
    expect(getSlugFromPath('/')).toBe('current');
  });

  test('extracts simple slug', () => {
    expect(getSlugFromPath('/my-doc')).toBe('my-doc');
  });

  test('lowercases the slug', () => {
    expect(getSlugFromPath('/My-Doc')).toBe('my-doc');
  });

  test('returns null for paths with dots (static files)', () => {
    expect(getSlugFromPath('/app.js')).toBeNull();
    expect(getSlugFromPath('/favicon.ico')).toBeNull();
    expect(getSlugFromPath('/manifest.webmanifest')).toBeNull();
  });

  test('returns null for paths with multiple segments', () => {
    expect(getSlugFromPath('/fonts/commitmono')).toBeNull();
  });

  test('returns null for slugs with leading hyphen', () => {
    expect(getSlugFromPath('/-my-doc')).toBeNull();
  });

  test('returns null for slugs with trailing hyphen', () => {
    expect(getSlugFromPath('/my-doc-')).toBeNull();
  });

  test('returns current for empty segment after slash', () => {
    expect(getSlugFromPath('/')).toBe('current');
  });

  test('accepts alphanumeric with hyphens', () => {
    expect(getSlugFromPath('/meeting-notes-2024')).toBe('meeting-notes-2024');
    expect(getSlugFromPath('/a')).toBe('a');
    expect(getSlugFromPath('/123')).toBe('123');
  });

  test('rejects slugs over 64 chars', () => {
    const longSlug = '/' + 'a'.repeat(65);
    expect(getSlugFromPath(longSlug)).toBeNull();
  });

  test('accepts slugs of exactly 64 chars', () => {
    const slug = 'a'.repeat(64);
    expect(getSlugFromPath('/' + slug)).toBe(slug);
  });

  test('rejects special characters', () => {
    expect(getSlugFromPath('/my_doc')).toBeNull();
    expect(getSlugFromPath('/my doc')).toBeNull();
    expect(getSlugFromPath('/my@doc')).toBeNull();
  });

  test('strips trailing slashes', () => {
    expect(getSlugFromPath('/my-doc/')).toBe('my-doc');
    expect(getSlugFromPath('/my-doc///')).toBe('my-doc');
  });

  test('accepts consecutive hyphens', () => {
    expect(getSlugFromPath('/my--doc')).toBe('my--doc');
  });

  test('returns current for bare trailing slashes', () => {
    expect(getSlugFromPath('///')).toBe('current');
  });

  test('rejects single hyphen', () => {
    expect(getSlugFromPath('/-')).toBeNull();
  });
});

describe('syncChannelName', () => {
  test('returns scoped channel name', () => {
    expect(syncChannelName('my-doc')).toBe('plaintext:text-sync:my-doc');
    expect(syncChannelName('current')).toBe('plaintext:text-sync:current');
  });
});

describe('sessionDraftKey', () => {
  test('returns scoped session key', () => {
    expect(sessionDraftKey('my-doc')).toBe('plaintext:textDraft:my-doc');
    expect(sessionDraftKey('current')).toBe('plaintext:textDraft:current');
  });
});
