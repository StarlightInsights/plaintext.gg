import { DEFAULT_SLUG, MAX_SLUG_LENGTH, SLUG_PATTERN } from '../constants';

export function getSlugFromPath(pathname: string): string | null {
  const stripped = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!stripped) return DEFAULT_SLUG;
  if (stripped.indexOf('/') !== -1) return null;
  const segment = stripped.toLowerCase();
  if (segment.length > MAX_SLUG_LENGTH) return null;
  if (segment.indexOf('.') !== -1) return null;
  if (!SLUG_PATTERN.test(segment)) return null;
  return segment;
}

export function isValidSlug(slug: string): boolean {
  return slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug);
}
