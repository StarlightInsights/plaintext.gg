import type { PersistedTextVersion } from '$lib/editor';

const TEXT_DATABASE_NAME = 'plaintext';
const TEXT_DATABASE_VERSION = 1;
const TEXT_STORE_NAME = 'documents';
const CURRENT_TEXT_RECORD_ID = 'current';

export type PersistedTextRecord = PersistedTextVersion & {
	id: typeof CURRENT_TEXT_RECORD_ID;
	text: string;
};

let databasePromise: Promise<IDBDatabase> | null = null;

function wrapRequest<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
	});
}

function openDatabase(): Promise<IDBDatabase> {
	if (databasePromise) {
		return databasePromise;
	}

	databasePromise = new Promise((resolve, reject) => {
		const request = window.indexedDB.open(TEXT_DATABASE_NAME, TEXT_DATABASE_VERSION);

		request.onupgradeneeded = () => {
			const database = request.result;

			if (!database.objectStoreNames.contains(TEXT_STORE_NAME)) {
				database.createObjectStore(TEXT_STORE_NAME, { keyPath: 'id' });
			}
		};

		request.onsuccess = () => {
			const database = request.result;

			database.onversionchange = () => {
				database.close();
			};

			resolve(database);
		};

		request.onerror = () => {
			databasePromise = null;
			reject(request.error ?? new Error('Failed to open IndexedDB.'));
		};

		request.onblocked = () => {
			reject(new Error('IndexedDB upgrade blocked.'));
		};
	});

	return databasePromise;
}

export function createPersistedTextRecord(
	text: string,
	version: PersistedTextVersion
): PersistedTextRecord {
	return {
		id: CURRENT_TEXT_RECORD_ID,
		text,
		updatedAt: version.updatedAt,
		sourceTabId: version.sourceTabId,
		saveSequence: version.saveSequence
	};
}

export async function readPersistedTextRecord(): Promise<PersistedTextRecord | null> {
	const database = await openDatabase();
	const transaction = database.transaction(TEXT_STORE_NAME, 'readonly');
	const store = transaction.objectStore(TEXT_STORE_NAME);
	const record = await wrapRequest(
		store.get(CURRENT_TEXT_RECORD_ID) as IDBRequest<PersistedTextRecord | undefined>
	);

	return record ?? null;
}

export async function writePersistedTextRecord(
	record: PersistedTextRecord
): Promise<PersistedTextRecord> {
	const database = await openDatabase();
	const transaction = database.transaction(TEXT_STORE_NAME, 'readwrite');
	const store = transaction.objectStore(TEXT_STORE_NAME);

	await wrapRequest(store.put(record));
	await new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
	});

	return record;
}
