<script lang="ts">
	import { browser } from '$app/environment';
	import { Button, Dialog, Toggle } from 'bits-ui';
	import { tick } from 'svelte';
	import {
		clampFontSize,
		comparePersistedTextVersions,
		COPY_FEEDBACK_DURATION_MS,
		DEFAULT_FONT_SIZE,
		FONT_STEP,
		isPersistedTextVersionNewer,
		MAX_FONT_SIZE,
		MIN_FONT_SIZE,
		normalizeTheme,
		parseStoredFontSize,
		SESSION_STORAGE_KEYS,
		type PersistedTextVersion,
		STORAGE_KEYS,
		TEXT_PERSIST_DELAY_MS,
		TEXT_SYNC_CHANNEL_NAME
	} from '$lib/editor';
	import {
		createPersistedTextRecord,
		readPersistedTextRecord,
		writePersistedTextRecord
	} from '$lib/text-persistence';

	type CopyFeedback = 'idle' | 'success' | 'error';
	type TextSyncMessage = PersistedTextVersion & {
		type: 'text-updated';
	};
	type SessionTextDraft = {
		text: string;
		version: PersistedTextVersion;
	};
	const THEME_COLORS = {
		light: '#fffdf7',
		dark: '#38342e'
	} as const;

	let editor = $state<HTMLTextAreaElement | null>(null);
	let whyDialogOpen = $state(false);
	let privacyDialogOpen = $state(false);
	let thanksDialogOpen = $state(false);
	let sisterSitesDialogOpen = $state(false);
	let copyFeedback = $state<CopyFeedback>('idle');
	let text = $state('');
	let theme = $state<'light' | 'dark'>('light');
	let fontSize = $state(DEFAULT_FONT_SIZE);
	let textPersistTimeout = 0;
	let copyFeedbackTimeout = 0;
	let persistedTextVersion: PersistedTextVersion | null = null;
	let broadcastChannel: BroadcastChannel | null = null;
	let persistTextChain = Promise.resolve();
	let hasPendingLocalTextEdits = false;
	let localSaveSequence = 0;
	let pendingTextVersion: PersistedTextVersion | null = null;

	const tabId = browser ? createTabId() : 'server';
	const controlButtonClass =
		'inline-flex cursor-pointer items-center justify-center bg-transparent p-0 text-[oklch(0.49_0_89.88)] no-underline touch-manipulation transition-colors duration-150 ease-out hover:text-[var(--text-primary)] focus-visible:text-[var(--text-primary)] focus-visible:outline-none disabled:cursor-default disabled:text-[var(--text-placeholder)]';
	const iconButtonClass = `${controlButtonClass} h-8 w-8 p-1 max-sm:min-h-11 max-sm:min-w-[2.75rem] max-sm:p-2`;
	const toolbarIconClass = 'pointer-events-none h-[1.3rem] w-[1.3rem] shrink-0 fill-current';
	const dialogButtonClass =
		'appearance-none border-0 bg-transparent p-0 text-[var(--text-secondary)] transition-colors duration-180 ease-out hover:text-[var(--text-primary)] focus-visible:text-[var(--text-primary)] focus-visible:outline-none';
	const browserQuietingAttributes: Record<string, string> = {
		autocorrect: 'off'
	};

	let canIncreaseFont = $derived(fontSize < MAX_FONT_SIZE);
	let canDecreaseFont = $derived(fontSize > MIN_FONT_SIZE);

	if (browser) {
		theme = normalizeTheme(loadStoredValue(STORAGE_KEYS.theme));

		const storedFontSize = parseStoredFontSize(loadStoredValue(STORAGE_KEYS.fontSize));
		fontSize = Number.isFinite(storedFontSize)
			? clampFontSize(storedFontSize)
			: DEFAULT_FONT_SIZE;
	}

	$effect(() => {
		if (!browser) {
			return;
		}

		document.documentElement.style.colorScheme = theme;
		const themeColorMeta = document.querySelector('meta[name="theme-color"]');
		if (themeColorMeta instanceof HTMLMetaElement) {
			themeColorMeta.content = THEME_COLORS[theme];
		}

		return () => {
			document.documentElement.style.removeProperty('color-scheme');
		};
	});

	$effect(() => {
		if (!browser) {
			return;
		}

		let isCancelled = false;

		if (typeof BroadcastChannel !== 'undefined') {
			broadcastChannel = new BroadcastChannel(TEXT_SYNC_CHANNEL_NAME);
			broadcastChannel.onmessage = (event) => {
				void handleTextBroadcast(event);
			};
		}

		void initializeTextPersistence(() => isCancelled);

		return () => {
			isCancelled = true;
			broadcastChannel?.close();
			broadcastChannel = null;
		};
	});

	$effect(() => {
		return () => {
			void flushTextPersistence();

			if (copyFeedbackTimeout) {
				window.clearTimeout(copyFeedbackTimeout);
			}
		};
	});

	function createTabId(): string {
		if (typeof window.crypto?.randomUUID === 'function') {
			return window.crypto.randomUUID();
		}

		return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	}

	function loadStoredValue(key: string): string | null {
		try {
			return window.localStorage.getItem(key);
		} catch {
			return null;
		}
	}

	function saveStoredValue(key: string, value: string): void {
		try {
			window.localStorage.setItem(key, value);
		} catch {
			// Storage can fail in private or restricted contexts.
		}
	}

	function readSessionTextDraft(): SessionTextDraft | null {
		try {
			const rawDraft = window.sessionStorage.getItem(SESSION_STORAGE_KEYS.textDraft);
			if (!rawDraft) {
				return null;
			}

			const parsedDraft = JSON.parse(rawDraft) as Partial<SessionTextDraft>;
			const version = parsedDraft.version as Partial<PersistedTextVersion> | undefined;
			if (
				typeof parsedDraft.text !== 'string' ||
				!version ||
				typeof version.updatedAt !== 'number' ||
				typeof version.sourceTabId !== 'string' ||
				typeof version.saveSequence !== 'number'
			) {
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

	function writeSessionTextDraft(nextText: string, version: PersistedTextVersion): void {
		try {
			window.sessionStorage.setItem(
				SESSION_STORAGE_KEYS.textDraft,
				JSON.stringify({
					text: nextText,
					version
				} satisfies SessionTextDraft)
			);
		} catch {
			// Session storage can fail in restricted contexts.
		}
	}

	function clearSessionTextDraft(): void {
		try {
			window.sessionStorage.removeItem(SESSION_STORAGE_KEYS.textDraft);
		} catch {
			// Session storage can fail in restricted contexts.
		}
	}

	function clearTextPersistence(): void {
		if (!textPersistTimeout) {
			return;
		}

		window.clearTimeout(textPersistTimeout);
		textPersistTimeout = 0;
	}

	function toPersistedTextVersion(version: PersistedTextVersion): PersistedTextVersion {
		return {
			updatedAt: version.updatedAt,
			sourceTabId: version.sourceTabId,
			saveSequence: version.saveSequence
		};
	}

	function createTextSyncMessage(version: PersistedTextVersion): TextSyncMessage {
		return {
			type: 'text-updated',
			updatedAt: version.updatedAt,
			sourceTabId: version.sourceTabId,
			saveSequence: version.saveSequence
		};
	}

	function parseTextSyncMessage(value: unknown): TextSyncMessage | null {
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

	function createNextTextVersion(): PersistedTextVersion {
		return {
			updatedAt: Date.now(),
			sourceTabId: tabId,
			saveSequence: ++localSaveSequence
		};
	}

	function scheduleTextPersistence(nextText: string): void {
		if (!browser) {
			return;
		}

		clearTextPersistence();
		textPersistTimeout = window.setTimeout(() => {
			textPersistTimeout = 0;
			void persistText(nextText);
		}, TEXT_PERSIST_DELAY_MS);
	}

	async function flushTextPersistence(): Promise<void> {
		if (!browser) {
			return;
		}

		clearTextPersistence();
		await persistText(text);
	}

	function setFontSize(nextFontSize: number, shouldPersist = true): void {
		const clampedFontSize = clampFontSize(nextFontSize);
		fontSize = clampedFontSize;

		if (shouldPersist) {
			saveStoredValue(STORAGE_KEYS.fontSize, String(clampedFontSize));
		}
	}

	async function updateTextFromPersistence(
		nextText: string,
		nextVersion: PersistedTextVersion
	): Promise<void> {
		hasPendingLocalTextEdits = false;
		persistedTextVersion = nextVersion;

		if (!editor || editor.value === nextText) {
			text = nextText;
			return;
		}

		const isFocused = document.activeElement === editor;
		const selectionStart = editor.selectionStart;
		const selectionEnd = editor.selectionEnd;
		const selectionDirection = editor.selectionDirection ?? 'none';

		text = nextText;
		await tick();

		if (isFocused && editor) {
			editor.setSelectionRange(
				Math.min(selectionStart, nextText.length),
				Math.min(selectionEnd, nextText.length),
				selectionDirection
			);
		}
	}

	async function initializeTextPersistence(isCancelled: () => boolean): Promise<void> {
		const sessionDraft = readSessionTextDraft();

		try {
			const record = await readPersistedTextRecord();
			if (isCancelled()) {
				return;
			}

			if (sessionDraft && (!record || isPersistedTextVersionNewer(sessionDraft.version, record))) {
				await updateTextFromPersistence(sessionDraft.text, sessionDraft.version);
				pendingTextVersion = sessionDraft.version;
				hasPendingLocalTextEdits = true;
				scheduleTextPersistence(sessionDraft.text);
				return;
			}

			if (!record) {
				return;
			}

			const nextVersion = toPersistedTextVersion(record);
			if (hasPendingLocalTextEdits) {
				if (isPersistedTextVersionNewer(nextVersion, persistedTextVersion)) {
					persistedTextVersion = nextVersion;
				}

				return;
			}

			pendingTextVersion = null;
			clearSessionTextDraft();
			await updateTextFromPersistence(record.text, nextVersion);
		} catch {
			if (isCancelled() || !sessionDraft) {
				return;
			}

			await updateTextFromPersistence(sessionDraft.text, sessionDraft.version);
			pendingTextVersion = sessionDraft.version;
			hasPendingLocalTextEdits = true;
			scheduleTextPersistence(sessionDraft.text);
		}
	}

	function broadcastTextUpdate(version: PersistedTextVersion): void {
		if (!broadcastChannel) {
			return;
		}

		broadcastChannel.postMessage(createTextSyncMessage(version));
	}

	async function persistText(nextText: string): Promise<void> {
		if (!browser || !hasPendingLocalTextEdits) {
			return;
		}

		const nextVersion = pendingTextVersion ?? createNextTextVersion();
		const nextRecord = createPersistedTextRecord(nextText, nextVersion);

		persistTextChain = persistTextChain
			.catch(() => undefined)
			.then(async () => {
				const writtenRecord = await writePersistedTextRecord(nextRecord);
				const writtenVersion = toPersistedTextVersion(writtenRecord);

				persistedTextVersion = writtenVersion;

				if (
					pendingTextVersion &&
					comparePersistedTextVersions(pendingTextVersion, writtenVersion) <= 0
				) {
					pendingTextVersion = null;
				}

				if (text === writtenRecord.text && !pendingTextVersion) {
					hasPendingLocalTextEdits = false;
					clearSessionTextDraft();
				}

				broadcastTextUpdate(writtenVersion);
			});

		try {
			await persistTextChain;
		} catch {
			// Keep the editor usable even if persistence fails.
		}
	}

	async function refreshTextFromPersistence(
		minimumVersion: PersistedTextVersion | null = null
	): Promise<void> {
		try {
			const record = await readPersistedTextRecord();
			if (!record) {
				return;
			}

			const nextVersion = toPersistedTextVersion(record);
			if (minimumVersion && comparePersistedTextVersions(nextVersion, minimumVersion) < 0) {
				return;
			}

			if (!isPersistedTextVersionNewer(nextVersion, persistedTextVersion)) {
				return;
			}

			if (hasPendingLocalTextEdits) {
				return;
			}

			clearTextPersistence();
			pendingTextVersion = null;
			clearSessionTextDraft();
			await updateTextFromPersistence(record.text, nextVersion);
		} catch {
			// Ignore transient IndexedDB read failures.
		}
	}

	async function handleTextBroadcast(event: MessageEvent<unknown>): Promise<void> {
		const message = parseTextSyncMessage(event.data);
		if (!message || message.sourceTabId === tabId) {
			return;
		}

		const nextVersion = toPersistedTextVersion(message);
		if (!isPersistedTextVersionNewer(nextVersion, persistedTextVersion)) {
			return;
		}

		await refreshTextFromPersistence(nextVersion);
	}

	function clearCopyFeedback(): void {
		if (copyFeedbackTimeout) {
			window.clearTimeout(copyFeedbackTimeout);
			copyFeedbackTimeout = 0;
		}

		copyFeedback = 'idle';
	}

	function showCopyFeedback(didSucceed: boolean): void {
		clearCopyFeedback();
		copyFeedback = didSucceed ? 'success' : 'error';
		copyFeedbackTimeout = window.setTimeout(() => {
			copyFeedback = 'idle';
			copyFeedbackTimeout = 0;
		}, COPY_FEEDBACK_DURATION_MS);
	}

	function pulseEditorCopyFeedback(): void {
		if (!editor?.value) {
			return;
		}

		editor.classList.remove('editor-copy-feedback');
		void editor.offsetWidth;
		editor.classList.add('editor-copy-feedback');
	}

	async function copyPlainText(value: string): Promise<boolean> {
		if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) {
			const item = new ClipboardItem({
				'text/plain': new Blob([value], { type: 'text/plain' })
			});

			await navigator.clipboard.write([item]);
			return true;
		}

		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(value);
			return true;
		}

		if (!editor) {
			return false;
		}

		const selectionStart = editor.selectionStart;
		const selectionEnd = editor.selectionEnd;
		const selectionDirection = editor.selectionDirection ?? 'none';

		editor.focus();
		editor.select();
		const didCopy = document.execCommand('copy');
		editor.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
		return didCopy;
	}

	function downloadPlainTextFile(value: string): void {
		const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement('a');

		link.href = url;
		link.download = 'plaintext.txt';
		document.body.append(link);
		link.click();
		link.remove();
		window.URL.revokeObjectURL(url);
	}

	function handleInput(event: Event): void {
		const target = event.currentTarget as HTMLTextAreaElement;
		text = target.value;
		hasPendingLocalTextEdits = true;
		pendingTextVersion = createNextTextVersion();
		writeSessionTextDraft(text, pendingTextVersion);
		scheduleTextPersistence(text);
	}

	async function handleStorage(event: StorageEvent): Promise<void> {
		if (event.storageArea !== window.localStorage || !event.key) {
			return;
		}

		if (event.key === STORAGE_KEYS.theme) {
			theme = normalizeTheme(event.newValue);
			return;
		}

		if (event.key === STORAGE_KEYS.fontSize) {
			const nextFontSize = parseStoredFontSize(event.newValue);
			setFontSize(Number.isFinite(nextFontSize) ? nextFontSize : DEFAULT_FONT_SIZE, false);
		}
	}

	function handleVisibilityChange(): void {
		if (document.visibilityState === 'hidden') {
			void flushTextPersistence();
			return;
		}

		void refreshTextFromPersistence();
	}

	function handleWindowFocus(): void {
		void refreshTextFromPersistence();
	}

	function setTheme(nextTheme: 'light' | 'dark'): void {
		theme = nextTheme;
		saveStoredValue(STORAGE_KEYS.theme, theme);
	}

	function handleThemePressedChange(pressed: boolean): void {
		setTheme(pressed ? 'dark' : 'light');
	}

	function changeFontSize(delta: number): void {
		setFontSize(fontSize + delta);
	}

	async function handleCopyClick(): Promise<void> {
		try {
			const didCopy = await copyPlainText(text);
			showCopyFeedback(didCopy);

			if (didCopy) {
				pulseEditorCopyFeedback();
			}
		} catch {
			showCopyFeedback(false);
		}
	}

	function handleSaveClick(): void {
		downloadPlainTextFile(text);
	}
</script>

<svelte:head>
	<title>plaintext.gg</title>
	<meta
		name="description"
		content="the distraction-free writing tool that strips formatting and don't uses ai"
	/>
	<meta
		name="keywords"
		content="plain text editor, distraction free writing, browser notes, plaintext.gg"
	/>
	<meta name="author" content="Starlight Insights" />
	<meta property="og:title" content="plaintext.gg" />
	<meta
		property="og:description"
		content="the distraction-free writing tool that strips formatting and don't uses ai"
	/>
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="plaintext.gg" />
	<meta
		name="twitter:description"
		content="the distraction-free writing tool that strips formatting and don't uses ai"
	/>
</svelte:head>

<svelte:window
	onfocus={handleWindowFocus}
	onstorage={handleStorage}
	onpagehide={flushTextPersistence}
/>
<svelte:document onvisibilitychange={handleVisibilityChange} />

{#snippet themeLightIcon()}
	<svg
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 256 256"
		class={toolbarIconClass}
	>
		<path
			d="M139.84,84.41v0a68.22,68.22,0,0,0-41.65,46v-.11a44.08,44.08,0,0,0-38.54,5h0a48,48,0,1,1,80.19-50.94Z"
			opacity="0.2"
		></path>
		<path
			d="M164,72a76.2,76.2,0,0,0-20.26,2.73,55.63,55.63,0,0,0-9.41-11.54l9.51-13.57a8,8,0,1,0-13.11-9.18L121.22,54A55.9,55.9,0,0,0,96,48c-.58,0-1.16,0-1.74,0L91.37,31.71a8,8,0,1,0-15.75,2.77L78.5,50.82A56.1,56.1,0,0,0,55.23,65.67L41.61,56.14a8,8,0,1,0-9.17,13.11L46,78.77A55.55,55.55,0,0,0,40,104c0,.57,0,1.15,0,1.72L23.71,108.6a8,8,0,0,0,1.38,15.88,8.24,8.24,0,0,0,1.39-.12l16.32-2.88a55.74,55.74,0,0,0,5.86,12.42A52,52,0,0,0,84,224h80a76,76,0,0,0,0-152ZM56,104a40,40,0,0,1,72.54-23.24,76.26,76.26,0,0,0-35.62,40,52.14,52.14,0,0,0-31,4.17A40,40,0,0,1,56,104ZM164,208H84a36,36,0,1,1,4.78-71.69c-.37,2.37-.63,4.79-.77,7.23a8,8,0,0,0,16,.92,58.91,58.91,0,0,1,1.88-11.81c0-.16.09-.32.12-.48A60.06,60.06,0,1,1,164,208Z"
		></path>
	</svg>
{/snippet}

{#snippet themeDarkIcon()}
	<svg
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 256 256"
		class={toolbarIconClass}
	>
		<path
			d="M106.31,130.38ZM102.38,17.62h0A64.06,64.06,0,0,1,25.62,94.38h0A64.12,64.12,0,0,0,63,138.93h0a44.08,44.08,0,0,1,43.33-8.54,68.13,68.13,0,0,1,45.47-47.32l.15,0c0-1,.07-2,.07-3A64,64,0,0,0,102.38,17.62Z"
			opacity="0.2"
		></path>
		<path
			d="M172,72a76.45,76.45,0,0,0-12.36,1A71.93,71.93,0,0,0,104.17,9.83a8,8,0,0,0-9.59,9.58A56.05,56.05,0,0,1,40,88a56.45,56.45,0,0,1-12.59-1.42,8,8,0,0,0-9.59,9.59,72.22,72.22,0,0,0,32.29,45.06A52,52,0,0,0,92,224h80a76,76,0,0,0,0-152ZM37.37,104c.87,0,1.75,0,2.63,0a72.08,72.08,0,0,0,72-72c0-.89,0-1.78,0-2.67a55.63,55.63,0,0,1,32,48,76.28,76.28,0,0,0-43,43.4A52,52,0,0,0,62,129.59,56.22,56.22,0,0,1,37.37,104ZM172,208H92a36,36,0,1,1,4.78-71.69c-.37,2.37-.63,4.79-.77,7.23a8,8,0,0,0,16,.92,58.91,58.91,0,0,1,1.88-11.81c0-.16.09-.32.12-.48A60.06,60.06,0,1,1,172,208Z"
		></path>
	</svg>
{/snippet}

{#snippet saveIcon()}
	<svg
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 256 256"
		class={toolbarIconClass}
	>
		<path
			d="M216,83.31V208a8,8,0,0,1-8,8H176V152a8,8,0,0,0-8-8H88a8,8,0,0,0-8,8v64H48a8,8,0,0,1-8-8V48a8,8,0,0,1,8-8H172.69a8,8,0,0,1,5.65,2.34l35.32,35.32A8,8,0,0,1,216,83.31Z"
			opacity="0.2"
		></path>
		<path
			d="M219.31,72,184,36.69A15.86,15.86,0,0,0,172.69,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V83.31A15.86,15.86,0,0,0,219.31,72ZM168,208H88V152h80Zm40,0H184V152a16,16,0,0,0-16-16H88a16,16,0,0,0-16,16v56H48V48H172.69L208,83.31ZM160,72a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h56A8,8,0,0,1,160,72Z"
		></path>
	</svg>
{/snippet}

{#snippet copyIcon()}
	<svg
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 256 256"
		class={toolbarIconClass}
	>
		<path d="M216,40V168H168V88H88V40Z" opacity="0.2"></path>
		<path
			d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"
		></path>
	</svg>
{/snippet}

{#snippet copyFeedbackIcon()}
	<svg
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 256 256"
		class={toolbarIconClass}
	>
		<path
			d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32Zm-8,128H176V88a8,8,0,0,0-8-8H96V48H208Z"
		></path>
	</svg>
{/snippet}

{#snippet plusIcon()}
	<svg
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 256 256"
		class={toolbarIconClass}
	>
		<path
			d="M200,112H56l72-72Z"
			opacity="0.2"
		></path>
		<path
			d="M205.66,106.34l-72-72a8,8,0,0,0-11.32,0l-72,72A8,8,0,0,0,56,120h64v96a8,8,0,0,0,16,0V120h64a8,8,0,0,0,5.66-13.66ZM75.31,104,128,51.31,180.69,104Z"
		></path>
	</svg>
{/snippet}

{#snippet minusIcon()}
	<svg
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 256 256"
		class={toolbarIconClass}
	>
		<path
			d="M200,144l-72,72L56,144Z"
			opacity="0.2"
		></path>
		<path
			d="M207.39,140.94A8,8,0,0,0,200,136H136V40a8,8,0,0,0-16,0v96H56a8,8,0,0,0-5.66,13.66l72,72a8,8,0,0,0,11.32,0l72-72A8,8,0,0,0,207.39,140.94ZM128,204.69,75.31,152H180.69Z"
		></path>
	</svg>
{/snippet}

{#snippet whyIcon()}
	<svg
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 256 256"
		class={toolbarIconClass}
	>
		<path
			d="M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z"
			opacity="0.2"
		></path>
		<path
			d="M144,176a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176Zm88-48A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128ZM124,96a12,12,0,1,0-12-12A12,12,0,0,0,124,96Z"
		></path>
	</svg>
{/snippet}

{#snippet privacyIcon()}
	<svg
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 256 256"
		class={toolbarIconClass}
	>
		<path
			d="M144,139.72,160,176H96l16-36.28a32,32,0,1,1,32,0Z"
			opacity="0.2"
		></path>
		<path
			d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm40-104a40,40,0,1,0-65.94,30.44L88.68,172.77A8,8,0,0,0,96,184h64a8,8,0,0,0,7.32-11.23l-13.38-30.33A40.14,40.14,0,0,0,168,112ZM136.68,143l11,25.05H108.27l11-25.05A8,8,0,0,0,116,132.79a24,24,0,1,1,24,0A8,8,0,0,0,136.68,143Z"
		></path>
	</svg>
{/snippet}

{#snippet thanksIcon()}
	<svg
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 256 256"
		class={toolbarIconClass}
	>
		<path
			d="M229.66,197,197,229.66a8,8,0,0,1-11.31,0l-18.35-18.35,44-44,18.35,18.35A8,8,0,0,1,229.66,197ZM26.34,185.66a8,8,0,0,0,0,11.31L59,229.66a8,8,0,0,0,11.31,0l18.35-18.35-44-44Z"
			opacity="0.2"
		></path>
		<path
			d="M235.32,180l-36.24-36.25L162.62,23.46A21.76,21.76,0,0,0,128,12.93,21.76,21.76,0,0,0,93.38,23.46L56.92,143.76,20.68,180a16,16,0,0,0,0,22.62l32.69,32.69a16,16,0,0,0,22.63,0L124.28,187a40.68,40.68,0,0,0,3.72-4.29,40.68,40.68,0,0,0,3.72,4.29L180,235.32a16,16,0,0,0,22.63,0l32.69-32.69A16,16,0,0,0,235.32,180ZM64.68,224,32,191.32l12.69-12.69,32.69,32.69ZM120,158.75a23.85,23.85,0,0,1-7,17L88.68,200,56,167.32l13.65-13.66a8,8,0,0,0,2-3.34l37-122.22A5.78,5.78,0,0,1,120,29.78Zm23,17a23.85,23.85,0,0,1-7-17v-129a5.78,5.78,0,0,1,11.31-1.68l37,122.22a8,8,0,0,0,2,3.34l14.49,14.49-33.4,32ZM191.32,224l-12.56-12.57,33.39-32L224,191.32Z"
		></path>
	</svg>
{/snippet}

{#snippet sisterSitesIcon()}
	<svg
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 256 256"
		class={toolbarIconClass}
	>
		<path
			d="M188,96a20,20,0,0,0-20,20V60a20,20,0,0,0-40,0V44a20,20,0,0,0-40,0V76a20,20,0,0,0-40,0v76a80,80,0,0,0,160,0V116A20,20,0,0,0,188,96ZM128,200c-32,0-48-32-48-32s16-32,48-32,48,32,48,32S160,200,128,200Z"
			opacity="0.2"
		></path>
		<path
			d="M188,88a27.75,27.75,0,0,0-12,2.71V60a28,28,0,0,0-41.36-24.6A28,28,0,0,0,80,44v6.71A27.75,27.75,0,0,0,68,48,28,28,0,0,0,40,76v76a88,88,0,0,0,176,0V116A28,28,0,0,0,188,88Zm12,64a72,72,0,0,1-144,0V76a12,12,0,0,1,24,0v36a8,8,0,0,0,16,0V44a12,12,0,0,1,24,0v60a8,8,0,0,0,16,0V60a12,12,0,0,1,24,0v60a8,8,0,0,0,16,0v-4a12,12,0,0,1,24,0Zm-60,16a12,12,0,1,1-12-12A12,12,0,0,1,140,168Zm-12-40c-36.52,0-54.41,34.94-55.16,36.42a8,8,0,0,0,0,7.16C73.59,173.06,91.48,208,128,208s54.41-34.94,55.16-36.42a8,8,0,0,0,0-7.16C182.41,162.94,164.52,128,128,128Zm0,64c-20.63,0-33.8-16.52-38.7-24,4.9-7.48,18.07-24,38.7-24s33.81,16.53,38.7,24C161.8,175.48,148.63,192,128,192Z"
		></path>
	</svg>
{/snippet}

<div
	data-theme={theme}
	class="app-shell grid min-h-dvh grid-rows-[auto_1fr] bg-[var(--bg)] text-[var(--text-primary)] transition-[background-color,color] duration-180 ease-out"
	style="font-family: var(--font-family-main);"
>
	<header
		class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-[0.94rem] font-light transition-[background-color,border-color,color] duration-180 ease-out max-sm:gap-3 max-sm:px-3 max-sm:py-2.5 max-sm:text-base"
		style="font-family: var(--font-family-header); font-weight: 300;"
	>
		<nav class="flex flex-wrap items-center gap-[0.45rem] max-sm:gap-x-[0.35rem] max-sm:gap-y-[0.25rem]" aria-label="Info">
			<Dialog.Root bind:open={whyDialogOpen}>
				<Dialog.Trigger class={iconButtonClass} aria-label="Why plaintext?">
					{@render whyIcon()}
				</Dialog.Trigger>
				<Dialog.Overlay class="plain-dialog-overlay fixed inset-0 z-20" />
				<Dialog.Content
					class="plain-dialog fixed top-1/2 left-1/2 z-30 w-[min(32rem,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-[var(--panel-border)] bg-[var(--panel-bg)] p-0 text-[var(--text-primary)] outline-none transition-[background-color,border-color,color] duration-180 ease-out sm:w-[min(32rem,calc(100vw-2rem))]"
				>
					<div class="grid gap-5 p-4">
						<div class="flex items-start justify-between gap-4">
							<Dialog.Title
								level={2}
								class="m-0 text-base font-normal"
								style="font-family: var(--font-family-title);"
							>
								why plaintext.gg?
							</Dialog.Title>
							<Dialog.Close class={dialogButtonClass} aria-label="Close dialog">
								x
							</Dialog.Close>
						</div>

						<Dialog.Description
							class="dialog-copy grid gap-4 leading-[1.65] text-[var(--text-primary)]"
							style="font-family: var(--font-family-dialog);"
						>
							<p class="m-0">plaintext.gg is a distraction-free writing tool.</p>
							<p class="m-0">no ai. no formatting.</p>
							<p class="m-0">just open the page and start typing.</p>
							<p class="m-0">
								your text is saved locally in your browser. nothing is sent to any
								server. ever.
							</p>
							<p class="m-0">just a simple way to write, take notes, and strip formatting.</p>
							<p class="m-0">
								Apache-2.0
								<a
									href="https://github.com/StarlightInsights/Plaintext.gg/"
									target="_blank"
									rel="noreferrer"
								>
									github.com/StarlightInsights/Plaintext.gg
								</a>
							</p>
						</Dialog.Description>
					</div>
				</Dialog.Content>
			</Dialog.Root>
			<Dialog.Root bind:open={privacyDialogOpen}>
				<Dialog.Trigger class={iconButtonClass} aria-label="Privacy">
					{@render privacyIcon()}
				</Dialog.Trigger>
				<Dialog.Overlay class="plain-dialog-overlay fixed inset-0 z-20" />
				<Dialog.Content
					class="plain-dialog fixed top-1/2 left-1/2 z-30 w-[min(32rem,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-[var(--panel-border)] bg-[var(--panel-bg)] p-0 text-[var(--text-primary)] outline-none transition-[background-color,border-color,color] duration-180 ease-out sm:w-[min(32rem,calc(100vw-2rem))]"
				>
					<div class="grid gap-5 p-4">
						<div class="flex items-start justify-between gap-4">
							<Dialog.Title
								level={2}
								class="m-0 text-base font-normal"
								style="font-family: var(--font-family-title);"
							>
								privacy
							</Dialog.Title>
							<Dialog.Close class={dialogButtonClass} aria-label="Close dialog">
								x
							</Dialog.Close>
						</div>

						<Dialog.Description
							class="dialog-copy grid gap-4 leading-[1.65] text-[var(--text-primary)]"
							style="font-family: var(--font-family-dialog);"
						>
							<p class="m-0">plaintext.gg stores text in your browser&apos;s IndexedDB.</p>
							<p class="m-0">
								theme and font size stay in your browser&apos;s localStorage.
							</p>
							<p class="m-0">
								no cookies. no analytics. no tracking. no accounts. no server. no
								cloud database.
							</p>
							<p class="m-0">your text never leaves your device.</p>
							<p class="m-0">
								fonts and icons are bundled with the site.
							</p>
							<p class="m-0">
								we believe the best privacy policy is not needing one at all.
							</p>
						</Dialog.Description>
					</div>
				</Dialog.Content>
			</Dialog.Root>
			<Dialog.Root bind:open={thanksDialogOpen}>
				<Dialog.Trigger class={iconButtonClass} aria-label="Thanks">
					{@render thanksIcon()}
				</Dialog.Trigger>
				<Dialog.Overlay class="plain-dialog-overlay fixed inset-0 z-20" />
				<Dialog.Content
					class="plain-dialog fixed top-1/2 left-1/2 z-30 w-[min(32rem,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-[var(--panel-border)] bg-[var(--panel-bg)] p-0 text-[var(--text-primary)] outline-none transition-[background-color,border-color,color] duration-180 ease-out sm:w-[min(32rem,calc(100vw-2rem))]"
				>
					<div class="grid gap-5 p-4">
						<div class="flex items-start justify-between gap-4">
							<Dialog.Title
								level={2}
								class="m-0 text-base font-normal"
								style="font-family: var(--font-family-title);"
							>
								thanks
							</Dialog.Title>
							<Dialog.Close class={dialogButtonClass} aria-label="Close dialog">
								x
							</Dialog.Close>
						</div>

						<Dialog.Description
							class="dialog-copy grid gap-4 leading-[1.65] text-[var(--text-primary)]"
							style="font-family: var(--font-family-dialog);"
						>
							<p class="m-0">
								thank you
								<a href="https://commitmono.com/" target="_blank" rel="noreferrer">
									Commit Mono
								</a>.
							</p>
							<p class="m-0">
								thank you
								<a href="https://phosphoricons.com/" target="_blank" rel="noreferrer">
									Phosphor
								</a>.
							</p>
							<p class="m-0">
								thank you
								<a href="https://bits-ui.com/" target="_blank" rel="noreferrer">
									Bits UI
								</a>.
							</p>
						</Dialog.Description>
					</div>
				</Dialog.Content>
			</Dialog.Root>
			<Dialog.Root bind:open={sisterSitesDialogOpen}>
				<Dialog.Trigger class={iconButtonClass} aria-label="Sister sites">
					{@render sisterSitesIcon()}
				</Dialog.Trigger>
				<Dialog.Overlay class="plain-dialog-overlay fixed inset-0 z-20" />
				<Dialog.Content
					class="plain-dialog fixed top-1/2 left-1/2 z-30 w-[min(32rem,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-[var(--panel-border)] bg-[var(--panel-bg)] p-0 text-[var(--text-primary)] outline-none transition-[background-color,border-color,color] duration-180 ease-out sm:w-[min(32rem,calc(100vw-2rem))]"
				>
					<div class="grid gap-5 p-4">
						<div class="flex items-start justify-between gap-4">
							<Dialog.Title
								level={2}
								class="m-0 text-base font-normal"
								style="font-family: var(--font-family-title);"
							>
								sister sites
							</Dialog.Title>
							<Dialog.Close class={dialogButtonClass} aria-label="Close dialog">
								x
							</Dialog.Close>
						</div>

						<Dialog.Description
							class="dialog-copy grid gap-4 leading-[1.65] text-[var(--text-primary)]"
							style="font-family: var(--font-family-dialog);"
						>
							<p class="m-0">Fly By Starlight</p>
							<p class="m-0">Starlight Calendar</p>
						</Dialog.Description>
					</div>
				</Dialog.Content>
			</Dialog.Root>
		</nav>

		<div
			class="ml-auto flex flex-wrap items-center gap-[0.875rem] pl-[0.9rem] max-sm:ml-0 max-sm:pl-0 max-sm:gap-x-3 max-sm:gap-y-[0.35rem]"
			role="group"
			aria-label="Editor controls"
		>
			<div
				class="flex items-center gap-[0.2rem] max-sm:gap-[0.3rem]"
				role="group"
				aria-label="Font size controls"
			>
				<Button.Root
					type="button"
					class={[
						controlButtonClass,
						'max-sm:min-h-11 max-sm:min-w-[2.75rem] max-sm:px-[0.2rem] max-sm:py-2'
					]}
					aria-label="Increase font size"
					disabled={!canIncreaseFont}
					onclick={() => changeFontSize(FONT_STEP)}
				>
					{@render plusIcon()}
				</Button.Root>
				<Button.Root
					type="button"
					class={[
						controlButtonClass,
						'max-sm:min-h-11 max-sm:min-w-[2.75rem] max-sm:px-[0.2rem] max-sm:py-2'
					]}
					aria-label="Decrease font size"
					disabled={!canDecreaseFont}
					onclick={() => changeFontSize(-FONT_STEP)}
				>
					{@render minusIcon()}
				</Button.Root>
			</div>

			<Button.Root
				type="button"
				class={iconButtonClass}
				aria-label="Save as plaintext file"
				onclick={handleSaveClick}
			>
				{@render saveIcon()}
			</Button.Root>
			<Button.Root
				type="button"
				class={[
					iconButtonClass,
					copyFeedback === 'success' && 'copy-feedback-success text-[var(--text-primary)]',
					copyFeedback === 'error' && 'copy-feedback-error text-[var(--feedback-error)]'
				]}
				aria-label={
					copyFeedback === 'success'
						? 'Copied'
						: copyFeedback === 'error'
							? 'Copy failed'
							: 'Copy plain text'
				}
				onclick={handleCopyClick}
				onmouseleave={clearCopyFeedback}
			>
				{#if copyFeedback === 'idle'}
					{@render copyIcon()}
				{:else}
					{@render copyFeedbackIcon()}
				{/if}
			</Button.Root>
			<Toggle.Root
				class={iconButtonClass}
				pressed={theme === 'dark'}
				aria-label={`Toggle theme. Current theme: ${theme}.`}
				onPressedChange={handleThemePressedChange}
			>
				{#if theme === 'dark'}
					{@render themeDarkIcon()}
				{:else}
					{@render themeLightIcon()}
				{/if}
			</Toggle.Root>
		</div>
		</header>

	<main class="min-h-0 overflow-hidden">
		<textarea
			bind:this={editor}
			{...browserQuietingAttributes}
			value={text}
			class="block h-full min-h-0 w-full box-border resize-none border-0 bg-transparent px-3 pt-4 pb-3 leading-[1.65] text-[var(--text-primary)] caret-[var(--text-primary)] outline-none transition-[background-color,color,caret-color] duration-180 ease-out sm:px-4 sm:pt-5 sm:pb-4"
			style:font-size={`${fontSize}px`}
			aria-label="Plain text editor"
			aria-autocomplete="none"
			placeholder="just plain text..."
			spellcheck="false"
			autocapitalize="none"
			autocomplete="off"
			inputmode="text"
			enterkeyhint="done"
			data-form-type="other"
			data-lpignore="true"
			data-1p-ignore="true"
			data-bwignore="true"
			data-gramm="false"
			data-gramm_editor="false"
			data-enable-grammarly="false"
			data-ms-editor="false"
			translate="no"
			oninput={handleInput}
		></textarea>
	</main>
</div>
