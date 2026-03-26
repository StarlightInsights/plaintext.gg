export const STORAGE_KEYS = {
	text: 'plaintext:text',
	theme: 'plaintext:theme',
	fontSize: 'plaintext:fontSize'
} as const;

export const DEFAULT_FONT_SIZE = 14;
export const FONT_STEP = 2;
export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 34;
export const COPY_FEEDBACK_DURATION_MS = 400;
export const TEXT_PERSIST_DELAY_MS = 300;

export function clampFontSize(nextFontSize: number): number {
	return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, nextFontSize));
}

export function parseStoredFontSize(value: string | null): number {
	return value === null ? Number.NaN : Number(value);
}

export function normalizeTheme(value: string | null): 'light' | 'dark' {
	return value === 'dark' ? 'dark' : 'light';
}
