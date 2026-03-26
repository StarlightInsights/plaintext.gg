<script lang="ts">
	import { browser } from '$app/environment';
	import { asset } from '$app/paths';
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

	type DialogId = 'why' | 'privacy';
	type CopyFeedback = 'idle' | 'success' | 'error';
	type TextSyncMessage = PersistedTextVersion & {
		type: 'text-updated';
	};
	const THEME_COLORS = {
		light: '#fffdf7',
		dark: '#38342e'
	} as const;

	let editor = $state<HTMLTextAreaElement | null>(null);
	let whyDialog = $state<HTMLDialogElement | null>(null);
	let privacyDialog = $state<HTMLDialogElement | null>(null);
	let activeDialog = $state<DialogId | null>(null);
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

	const homeHref = '/';
	const fontLicenseHref = asset('/OFL.txt');
	const tabId = browser ? createTabId() : 'server';
	const controlButtonClass =
		'inline-flex cursor-pointer items-center justify-center bg-transparent p-0 text-[oklch(0.49_0_89.88)] no-underline touch-manipulation transition-colors duration-150 ease-out hover:text-[var(--text-primary)] focus-visible:text-[var(--text-primary)] focus-visible:outline-none disabled:cursor-default disabled:text-[var(--text-placeholder)]';
	const dialogButtonClass =
		'appearance-none border-0 bg-transparent p-0 text-[var(--text-secondary)] transition-colors duration-180 ease-out hover:text-[var(--text-primary)] focus-visible:text-[var(--text-primary)] focus-visible:outline-none';

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
		if (whyDialog && activeDialog !== 'why' && whyDialog.open) {
			whyDialog.close();
		}

		if (privacyDialog && activeDialog !== 'privacy' && privacyDialog.open) {
			privacyDialog.close();
		}

		const dialog =
			activeDialog === 'why' ? whyDialog : activeDialog === 'privacy' ? privacyDialog : null;

		if (dialog && !dialog.open) {
			dialog.showModal();
		}
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
		try {
			const record = await readPersistedTextRecord();
			if (!record || isCancelled()) {
				return;
			}

			const nextVersion = toPersistedTextVersion(record);
			if (hasPendingLocalTextEdits) {
				if (isPersistedTextVersionNewer(nextVersion, persistedTextVersion)) {
					persistedTextVersion = nextVersion;
				}

				return;
			}

			await updateTextFromPersistence(record.text, nextVersion);
		} catch {
			// IndexedDB can be unavailable in restricted contexts.
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

		const nextVersion = createNextTextVersion();
		const nextRecord = createPersistedTextRecord(nextText, nextVersion);

		persistTextChain = persistTextChain
			.catch(() => undefined)
			.then(async () => {
				const writtenRecord = await writePersistedTextRecord(nextRecord);
				const writtenVersion = toPersistedTextVersion(writtenRecord);

				persistedTextVersion = writtenVersion;

				if (text === writtenRecord.text) {
					hasPendingLocalTextEdits = false;
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

	function openDialog(dialogId: DialogId): void {
		activeDialog = dialogId;
	}

	function closeDialog(): void {
		activeDialog = null;
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

	function toggleTheme(): void {
		theme = theme === 'light' ? 'dark' : 'light';
		saveStoredValue(STORAGE_KEYS.theme, theme);
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

	function handleDialogBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			closeDialog();
		}
	}

	function handleDialogClosed(dialogId: DialogId): void {
		if (activeDialog === dialogId) {
			activeDialog = null;
		}
	}
</script>

<svelte:head>
	<title>plaintext.gg</title>
	<meta
		name="description"
		content="plaintext.gg is a distraction-free plain text editor that saves locally in your browser."
	/>
	<meta
		name="keywords"
		content="plain text editor, distraction free writing, browser notes, plaintext.gg"
	/>
	<meta name="author" content="Starlight Insights" />
	<meta property="og:title" content="plaintext.gg" />
	<meta
		property="og:description"
		content="A distraction-free plain text editor that saves locally in your browser."
	/>
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="plaintext.gg" />
	<meta
		name="twitter:description"
		content="A distraction-free plain text editor that saves locally in your browser."
	/>
</svelte:head>

<svelte:window
	onfocus={handleWindowFocus}
	onstorage={handleStorage}
	onpagehide={flushTextPersistence}
/>
<svelte:document onvisibilitychange={handleVisibilityChange} />

<div
	data-theme={theme}
	class="app-shell grid min-h-dvh grid-rows-[auto_1fr] bg-[var(--bg)] text-[var(--text-primary)] transition-[background-color,color] duration-180 ease-out"
	style="font-family: var(--font-family-main);"
>
	<header
		class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg)] px-4 py-3.5 text-[0.94rem] font-light transition-[background-color,border-color,color] duration-180 ease-out max-sm:gap-3 max-sm:px-3 max-sm:py-3 max-sm:text-base"
		style="font-family: var(--font-family-header); font-weight: 300;"
	>
		<nav class="flex flex-wrap items-center gap-[0.875rem] max-sm:gap-x-3 max-sm:gap-y-[0.35rem]" aria-label="Info">
			<a class={controlButtonClass} href={homeHref}>plaintext.gg</a>
			<button class={controlButtonClass} type="button" onclick={() => openDialog('why')}>
				why?
			</button>
			<button class={controlButtonClass} type="button" onclick={() => openDialog('privacy')}>
				privacy
			</button>
		</nav>

		<nav
			class="ml-auto flex flex-wrap items-center gap-[0.875rem] pl-[0.9rem] max-sm:ml-0 max-sm:pl-0 max-sm:gap-x-3 max-sm:gap-y-[0.35rem]"
			aria-label="Editor"
		>
			<span
				class="flex items-center gap-[0.4rem] max-sm:gap-[0.5rem]"
				aria-label="Font size controls"
			>
				<button
					class={[
						controlButtonClass,
						'max-sm:min-h-11 max-sm:min-w-[2.75rem] max-sm:px-[0.2rem] max-sm:py-2'
					]}
					type="button"
					aria-label="Increase font size"
					disabled={!canIncreaseFont}
					onclick={() => changeFontSize(FONT_STEP)}
				>
					+
				</button>
				<button
					class={[
						controlButtonClass,
						'max-sm:min-h-11 max-sm:min-w-[2.75rem] max-sm:px-[0.2rem] max-sm:py-2'
					]}
					type="button"
					aria-label="Decrease font size"
					disabled={!canDecreaseFont}
					onclick={() => changeFontSize(-FONT_STEP)}
				>
					-
				</button>
			</span>

			<button class={controlButtonClass} type="button" onclick={handleSaveClick}>save</button>
			<button
				class={[
					controlButtonClass,
					copyFeedback === 'success' && 'copy-feedback-success text-[var(--text-primary)]',
					copyFeedback === 'error' && 'copy-feedback-error text-[var(--feedback-error)]'
				]}
				type="button"
				onclick={handleCopyClick}
				onmouseleave={clearCopyFeedback}
			>
				<span>copy</span>
			</button>
			<button
				class={controlButtonClass}
				type="button"
				aria-label={`Toggle theme. Current theme: ${theme}.`}
				onclick={toggleTheme}
			>
				{theme}
			</button>
		</nav>
	</header>

	<main class="min-h-0">
		<textarea
			bind:this={editor}
			value={text}
			class="h-full min-h-0 w-full resize-none border-0 bg-transparent px-3 pt-4 pb-3 leading-[1.65] text-[var(--text-primary)] caret-[var(--text-primary)] outline-none transition-[background-color,color,caret-color] duration-180 ease-out sm:px-4 sm:pt-5 sm:pb-4"
			style:font-size={`${fontSize}px`}
			aria-label="Plain text editor"
			placeholder="just plain text..."
			spellcheck="false"
			autocapitalize="none"
			autocomplete="off"
			data-gramm="false"
			data-gramm_editor="false"
			data-enable-grammarly="false"
			data-ms-editor="false"
			translate="no"
			oninput={handleInput}
		></textarea>
	</main>

	<dialog
		bind:this={whyDialog}
		class="plain-dialog w-[min(32rem,calc(100vw-1rem))] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-0 text-[var(--text-primary)] transition-[background-color,border-color,color] duration-180 ease-out sm:w-[min(32rem,calc(100vw-2rem))]"
		aria-labelledby="why-title"
		onclick={handleDialogBackdropClick}
		onclose={() => handleDialogClosed('why')}
	>
		<div class="grid gap-5 p-4">
			<div class="flex items-start justify-between gap-4">
				<h2
					id="why-title"
					class="m-0 text-base font-normal"
					style="font-family: var(--font-family-title);"
				>
					why plaintext?
				</h2>
				<button class={dialogButtonClass} type="button" aria-label="Close dialog" onclick={closeDialog}>
					x
				</button>
			</div>

			<div
				class="dialog-copy grid gap-4 leading-[1.65] text-[var(--text-primary)]"
				style="font-family: var(--font-family-dialog);"
			>
				<p class="m-0">plaintext.gg is a distraction-free writing tool.</p>
				<p class="m-0">no formatting. no folders. no sync conflicts.</p>
				<p class="m-0">just open the page and start typing.</p>
				<p class="m-0">your text is saved locally in your browser. nothing is sent to any server. ever.</p>
				<p class="m-0">it is the simplest way to write.</p>
			</div>
		</div>
	</dialog>

	<dialog
		bind:this={privacyDialog}
		class="plain-dialog w-[min(32rem,calc(100vw-1rem))] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-0 text-[var(--text-primary)] transition-[background-color,border-color,color] duration-180 ease-out sm:w-[min(32rem,calc(100vw-2rem))]"
		aria-labelledby="privacy-title"
		onclick={handleDialogBackdropClick}
		onclose={() => handleDialogClosed('privacy')}
	>
		<div class="grid gap-5 p-4">
			<div class="flex items-start justify-between gap-4">
				<h2
					id="privacy-title"
					class="m-0 text-base font-normal"
					style="font-family: var(--font-family-title);"
				>
					privacy
				</h2>
				<button class={dialogButtonClass} type="button" aria-label="Close dialog" onclick={closeDialog}>
					x
				</button>
			</div>

			<div
				class="dialog-copy grid gap-4 leading-[1.65] text-[var(--text-primary)]"
				style="font-family: var(--font-family-dialog);"
			>
				<p class="m-0">plaintext.gg stores text in your browser&apos;s IndexedDB.</p>
				<p class="m-0">theme and font size stay in your browser&apos;s localStorage.</p>
				<p class="m-0">no cookies. no analytics. no tracking. no accounts. no server. no cloud database.</p>
				<p class="m-0">your text never leaves your device.</p>
				<p class="m-0">
					all fonts are bundled locally with the site. the bundled font license is available at
					<a href={fontLicenseHref}>/OFL.txt</a>.
				</p>
				<p class="m-0">we believe the best privacy policy is not needing one at all.</p>
			</div>
		</div>
	</dialog>
</div>
