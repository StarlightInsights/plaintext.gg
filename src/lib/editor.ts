export const STORAGE_KEYS = {
	theme: 'plaintext:theme',
	fontSize: 'plaintext:fontSize'
} as const;

export const DEFAULT_FONT_SIZE = 14;
export const FONT_STEP = 2;
export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 34;
export const COPY_FEEDBACK_DURATION_MS = 400;
export const TEXT_PERSIST_DELAY_MS = 300;
export const TEXT_SYNC_CHANNEL_NAME = 'plaintext:text-sync';

export type PersistedTextVersion = {
	updatedAt: number;
	sourceTabId: string;
	saveSequence: number;
};

export function clampFontSize(nextFontSize: number): number {
	return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, nextFontSize));
}

export function parseStoredFontSize(value: string | null): number {
	return value === null ? Number.NaN : Number(value);
}

export function normalizeTheme(value: string | null): 'light' | 'dark' {
	return value === 'dark' ? 'dark' : 'light';
}

export function comparePersistedTextVersions(
	left: PersistedTextVersion | null,
	right: PersistedTextVersion | null
): number {
	if (!left && !right) {
		return 0;
	}

	if (!left) {
		return -1;
	}

	if (!right) {
		return 1;
	}

	if (left.updatedAt !== right.updatedAt) {
		return left.updatedAt - right.updatedAt;
	}

	if (left.sourceTabId !== right.sourceTabId) {
		return left.sourceTabId.localeCompare(right.sourceTabId);
	}

	return left.saveSequence - right.saveSequence;
}

export function isPersistedTextVersionNewer(
	candidate: PersistedTextVersion | null,
	current: PersistedTextVersion | null
): boolean {
	return comparePersistedTextVersions(candidate, current) > 0;
}
