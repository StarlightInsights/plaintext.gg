import type { PersistedTextVersion } from '$lib/editor';
import { isPersistedTextVersionShape } from '$lib/text-sync';

export type SessionTextDraft = {
	text: string;
	version: PersistedTextVersion;
};

export function loadStoredValue(key: string): string | null {
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function saveStoredValue(key: string, value: string): void {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// Storage can fail in private or restricted contexts.
	}
}

export function updateThemeColorMetaTags(color: string): void {
	document.querySelectorAll('meta[name="theme-color"]').forEach((element) => {
		if (element instanceof HTMLMetaElement) {
			element.content = color;
		}
	});
}

export function readSessionTextDraft(key: string): SessionTextDraft | null {
	try {
		const rawDraft = window.sessionStorage.getItem(key);
		if (!rawDraft) {
			return null;
		}

		const parsedDraft = JSON.parse(rawDraft) as Partial<SessionTextDraft>;
		const version = parsedDraft.version as Partial<PersistedTextVersion> | undefined;
		if (typeof parsedDraft.text !== 'string' || !isPersistedTextVersionShape(version)) {
			return null;
		}

		return {
			text: parsedDraft.text,
			version: {
				updatedAt: version.updatedAt,
				sourceTabId: version.sourceTabId,
				saveSequence: version.saveSequence
			}
		};
	} catch {
		return null;
	}
}

export function writeSessionTextDraft(
	key: string,
	text: string,
	version: PersistedTextVersion
): void {
	try {
		window.sessionStorage.setItem(
			key,
			JSON.stringify({
				text,
				version
			} satisfies SessionTextDraft)
		);
	} catch {
		// Session storage can fail in restricted contexts.
	}
}

export function clearSessionTextDraft(key: string): void {
	try {
		window.sessionStorage.removeItem(key);
	} catch {
		// Session storage can fail in restricted contexts.
	}
}
