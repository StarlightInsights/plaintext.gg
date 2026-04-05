// Pure utility functions shared between app.js and tests.
// No DOM, no side effects — safe to import in Node.

// ---- Type definitions ----

/**
 * Version vector used for conflict resolution across tabs.
 * @typedef {Object} Version
 * @property {number} updatedAt - Unix timestamp (ms) of last edit
 * @property {string} sourceTabId - UUID identifying the originating browser tab
 * @property {number} saveSequence - Monotonically increasing counter per tab
 */

/**
 * The document shape stored in IndexedDB.
 * @typedef {Object} DocumentRecord
 * @property {string} id - Document slug ('current' for root, or the URL slug)
 * @property {string} text - The document content
 * @property {number} updatedAt - Unix timestamp (ms)
 * @property {string} sourceTabId - Tab that last wrote the record
 * @property {number} saveSequence - Save counter from that tab
 */

/**
 * Draft stored in sessionStorage for crash recovery.
 * @typedef {Object} SessionDraft
 * @property {string} text - The draft text content
 * @property {Version} version - Version vector of this draft
 */

/**
 * BroadcastChannel message shape for cross-tab text sync.
 * @typedef {Object} SyncMessage
 * @property {'text-updated'} type - Message discriminator
 * @property {number} updatedAt - Unix timestamp (ms)
 * @property {string} sourceTabId - Tab that sent the update
 * @property {number} saveSequence - Save counter from that tab
 */

/**
 * @typedef {'light' | 'dark'} Theme
 */

/**
 * @typedef {'mono' | 'sans-serif' | 'serif' | 'dyslexic'} FontFamily
 */

// ---- Constants ----

/** @type {number} */
export var DEFAULT_FONT_SIZE = 16;
/** @type {number} */
export var FONT_STEP = 2;
/** @type {number} */
export var MIN_FONT_SIZE = 10;
/** @type {number} */
export var MAX_FONT_SIZE = 34;
/** @type {number} */
export var DEFAULT_FONT_WEIGHT = 300;
/** @type {number} */
export var MIN_FONT_WEIGHT = 200;
/** @type {number} */
export var MAX_FONT_WEIGHT = 600;
/** @type {number} */
export var FONT_WEIGHT_STEP = 100;
/** @type {ReadonlyArray<number>} */
export var FONT_WEIGHTS = [200, 300, 600];
/** @type {FontFamily} */
export var DEFAULT_FONT_FAMILY = 'mono';
/** @type {ReadonlyArray<FontFamily>} */
export var FONT_FAMILIES = ['mono', 'sans-serif', 'serif', 'dyslexic'];
/** @type {number} */
export var COPY_FEEDBACK_MS = 400;
/** @type {number} */
export var PERSIST_DELAY_MS = 300;
/** @type {RegExp} */
export var SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
/** @type {number} */
export var MAX_SLUG_LENGTH = 64;

/** @type {Readonly<{ theme: string, fontSize: string, fontFamily: string, fontWeight: string, fontItalic: string, toolbarIcons: string }>} */
export var STORAGE_KEYS = {
  theme: 'plaintext:theme',
  fontSize: 'plaintext:fontSize',
  fontFamily: 'plaintext:fontFamily',
  fontWeight: 'plaintext:fontWeight',
  fontItalic: 'plaintext:fontItalic',
  toolbarIcons: 'plaintext:toolbarIcons'
};

/** @type {Readonly<{ textDraft: string }>} */
export var SESSION_KEYS = {
  textDraft: 'plaintext:textDraft'
};

/** @type {Readonly<{ light: string, dark: string }>} */
export var THEME_COLORS = { light: '#fffdf7', dark: '#38342e' };

// ---- Functions ----

/**
 * Clamp a font size value to the allowed range.
 * @param {number} n
 * @returns {number}
 */
export function clampFontSize(n) {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, n));
}

/**
 * Parse a stored font size string into a number. Returns NaN if null.
 * @param {string | null} v
 * @returns {number}
 */
export function parseStoredFontSize(v) {
  return v === null ? NaN : Number(v);
}

/**
 * Clamp a font weight value to the allowed range, rounding to the nearest step.
 * @param {number} n
 * @returns {number}
 */
export function clampFontWeight(n) {
  var best = FONT_WEIGHTS[0];
  for (var i = 1; i < FONT_WEIGHTS.length; i++) {
    if (Math.abs(n - FONT_WEIGHTS[i]) < Math.abs(n - best)) {
      best = FONT_WEIGHTS[i];
    }
  }
  return best;
}

/**
 * Parse a stored font weight string into a valid weight value.
 * Returns DEFAULT_FONT_WEIGHT if null or not a valid number.
 * @param {string | null} v
 * @returns {number}
 */
export function parseStoredFontWeight(v) {
  if (v === null) return DEFAULT_FONT_WEIGHT;
  var n = Number(v);
  return Number.isFinite(n) ? clampFontWeight(n) : DEFAULT_FONT_WEIGHT;
}

/**
 * Parse a stored font italic string into a boolean.
 * @param {string | null} v
 * @returns {boolean}
 */
export function parseStoredFontItalic(v) {
  return v === 'true';
}

/**
 * Normalize a stored font family string to a valid FontFamily value.
 * @param {string | null} v
 * @returns {FontFamily}
 */
export function normalizeFontFamily(v) {
  if (v === 'sans-serif' || v === 'serif' || v === 'dyslexic') return v;
  return 'mono';
}

/**
 * Map of font families to supported abstract weight slots (200=light, 300=regular, 600=bold).
 * @type {Readonly<Record<FontFamily, ReadonlyArray<number>>>}
 */
export var FONT_FAMILY_WEIGHTS = {
  'mono': [200, 300, 600],
  'sans-serif': [200, 300, 600],
  'serif': [300, 600],
  'dyslexic': [300, 600]
};

/**
 * Normalize a stored theme string to a valid Theme value.
 * @param {string | null} v
 * @returns {Theme}
 */
export function normalizeTheme(v) {
  return v === 'dark' ? 'dark' : 'light';
}

/**
 * Normalize a stored toolbar visibility string to a boolean.
 * @param {string | null} v
 * @returns {boolean}
 */
export function normalizeToolbarVisibility(v) {
  return v === 'visible';
}

/**
 * Compare two version vectors. Returns negative if a < b, 0 if equal, positive if a > b.
 * Compares by updatedAt first, then sourceTabId, then saveSequence.
 * @param {Version | null} a
 * @param {Version | null} b
 * @returns {number}
 */
export function compareVersions(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
  if (a.sourceTabId !== b.sourceTabId) return a.sourceTabId.localeCompare(b.sourceTabId);
  return a.saveSequence - b.saveSequence;
}

/**
 * Check if a candidate version is strictly newer than the current version.
 * @param {Version | null} candidate
 * @param {Version | null} current
 * @returns {boolean}
 */
export function isVersionNewer(candidate, current) {
  return compareVersions(candidate, current) > 0;
}

/**
 * Extract a Version from any object that has version fields (DocumentRecord, SyncMessage, etc.).
 * @param {{ updatedAt: number, sourceTabId: string, saveSequence: number }} v
 * @returns {Version}
 */
export function toVersion(v) {
  return { updatedAt: v.updatedAt, sourceTabId: v.sourceTabId, saveSequence: v.saveSequence };
}

/**
 * Create a DocumentRecord from text, a version vector, and a document slug.
 * @param {string} text
 * @param {Version} version
 * @param {string} slug
 * @returns {DocumentRecord}
 */
export function createRecord(text, version, slug) {
  return {
    id: slug,
    text: text,
    updatedAt: version.updatedAt,
    sourceTabId: version.sourceTabId,
    saveSequence: version.saveSequence
  };
}

/**
 * Extract a document slug from a URL pathname.
 * Returns 'current' for root, the lowercase slug for valid paths,
 * or null for static files (paths with dots) and invalid slugs.
 * @param {string} pathname
 * @returns {string | null}
 */
export function getSlugFromPath(pathname) {
  // Only single-segment paths are valid slugs; multi-segment paths are static assets
  var stripped = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!stripped) return 'current';
  if (stripped.indexOf('/') !== -1) return null;
  var segment = stripped.toLowerCase();
  if (segment.length > MAX_SLUG_LENGTH) return null;
  if (segment.indexOf('.') !== -1) return null;
  if (!SLUG_PATTERN.test(segment)) return null;
  return segment;
}

/**
 * Return a slug-scoped BroadcastChannel name.
 * @param {string} slug
 * @returns {string}
 */
export function syncChannelName(slug) {
  return 'plaintext:text-sync:' + slug;
}

/**
 * Return a slug-scoped sessionStorage key for crash-recovery drafts.
 * @param {string} slug
 * @returns {string}
 */
export function sessionDraftKey(slug) {
  return 'plaintext:textDraft:' + slug;
}
