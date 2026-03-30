import type { PersistedTextVersion } from '$lib/editor';

export type TextSyncMessage = PersistedTextVersion & {
	type: 'text-updated';
};

export function isPersistedTextVersionShape(
	value: Partial<PersistedTextVersion> | undefined
): value is PersistedTextVersion {
	return (
		!!value &&
		typeof value.updatedAt === 'number' &&
		typeof value.sourceTabId === 'string' &&
		typeof value.saveSequence === 'number'
	);
}

export function toPersistedTextVersion(version: PersistedTextVersion): PersistedTextVersion {
	return {
		updatedAt: version.updatedAt,
		sourceTabId: version.sourceTabId,
		saveSequence: version.saveSequence
	};
}

export function createTextSyncMessage(version: PersistedTextVersion): TextSyncMessage {
	return { type: 'text-updated', ...toPersistedTextVersion(version) };
}

export function parseTextSyncMessage(value: unknown): TextSyncMessage | null {
	if (!value || typeof value !== 'object') {
		return null;
	}

	const candidate = value as Partial<TextSyncMessage>;
	if (candidate.type !== 'text-updated') {
		return null;
	}

	if (
		typeof candidate.updatedAt !== 'number' ||
		typeof candidate.sourceTabId !== 'string' ||
		typeof candidate.saveSequence !== 'number'
	) {
		return null;
	}

	return {
		type: candidate.type,
		updatedAt: candidate.updatedAt,
		sourceTabId: candidate.sourceTabId,
		saveSequence: candidate.saveSequence
	};
}
