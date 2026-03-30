<script lang="ts">
	import { browser } from '$app/environment';
	import { tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import {
		clampFontSize,
		comparePersistedTextVersions,
		COPY_FEEDBACK_DURATION_MS,
		DEFAULT_FONT_SIZE,
		FONT_STEP,
		isPersistedTextVersionNewer,
		MAX_FONT_SIZE,
		MIN_FONT_SIZE,
		normalizeToolbarIconsVisibility,
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
	import { copyPlainText, downloadPlainTextFile } from '$lib/clipboard';
	import {
		loadStoredValue,
		saveStoredValue,
		updateThemeColorMetaTags,
		readSessionTextDraft,
		writeSessionTextDraft,
		clearSessionTextDraft
	} from '$lib/local-storage';
	import {
		toPersistedTextVersion,
		createTextSyncMessage,
		parseTextSyncMessage
	} from '$lib/text-sync';
	import { controlButtonClass, iconButtonClass, toolbarIconClass } from '$lib/css-classes';
	import InfoDialog from '$lib/components/InfoDialog.svelte';
	import {
		ThemeLightIcon,
		ThemeDarkIcon,
		SaveIcon,
		CopyIcon,
		CopyFeedbackIcon,
		FontUpIcon,
		FontDownIcon,
		InfoIcon,
		PrivacyIcon,
		ThanksIcon,
		ToolbarVisibleIcon,
		ToolbarHiddenIcon
	} from '$lib/components/icons';

	type CopyFeedback = 'idle' | 'success' | 'error';

	const THEME_COLORS = {
		light: '#fffdf7',
		dark: '#38342e'
	} as const;

	const fontSizeButtonClass = [
		controlButtonClass,
		'max-sm:min-h-11 max-sm:min-w-[2.75rem] max-sm:px-[0.2rem] max-sm:py-2'
	];
	const hiddenFloatingIconButtonClass = `${iconButtonClass} opacity-65 hover:opacity-100 focus-visible:opacity-100`;
	const textareaBaseClass =
		'block h-full min-h-0 w-full box-border resize-none border-0 bg-transparent px-3 pb-3 leading-[1.65] text-[var(--text-primary)] caret-[var(--text-primary)] outline-none duration-180 ease-out sm:px-4 sm:pb-4';
	const browserQuietingAttributes: Record<string, string> = {
		autocorrect: 'off'
	};

	let editor = $state<HTMLTextAreaElement | null>(null);
	let visibleToolbarHeader = $state<HTMLElement | null>(null);
	let whyDialogOpen = $state(false);
	let privacyDialogOpen = $state(false);
	let thanksDialogOpen = $state(false);
	let copyFeedback = $state<CopyFeedback>('idle');
	let text = $state('');
	let theme = $state<'light' | 'dark'>('light');
	let showToolbarIcons = $state(true);
	let fontSize = $state(DEFAULT_FONT_SIZE);
	let textPersistTimeout = 0;
	let copyFeedbackTimeout = 0;
	let persistedTextVersion: PersistedTextVersion | null = null;
	let broadcastChannel: BroadcastChannel | null = null;
	let persistTextChain = Promise.resolve();
	let hasPendingLocalTextEdits = false;
	let localSaveSequence = 0;
	let pendingTextVersion: PersistedTextVersion | null = null;
	let visibleToolbarHeight = $state(0);
	let initialLayoutReady = $state(false);
	let enableUiMotion = $state(false);

	const tabId = browser ? createTabId() : 'server';

	let canIncreaseFont = $derived(fontSize < MAX_FONT_SIZE);
	let canDecreaseFont = $derived(fontSize > MIN_FONT_SIZE);

	if (browser) {
		theme = normalizeTheme(loadStoredValue(STORAGE_KEYS.theme));
		showToolbarIcons = normalizeToolbarIconsVisibility(loadStoredValue(STORAGE_KEYS.toolbarIcons));

		const storedFontSize = parseStoredFontSize(loadStoredValue(STORAGE_KEYS.fontSize));
		fontSize = Number.isFinite(storedFontSize)
			? clampFontSize(storedFontSize)
			: DEFAULT_FONT_SIZE;
	}

	$effect(() => {
		if (!browser) {
			return;
		}

		document.documentElement.dataset.theme = theme;
		document.documentElement.style.colorScheme = theme;
		document.documentElement.style.backgroundColor = THEME_COLORS[theme];
		updateThemeColorMetaTags(THEME_COLORS[theme]);
	});

	$effect(() => {
		if (!browser || initialLayoutReady) {
			return;
		}

		if (showToolbarIcons && !visibleToolbarHeader) {
			return;
		}

		let isCancelled = false;
		let readyAnimationFrame = 0;

		const settleInitialLayout = async () => {
			if ('fonts' in document) {
				try {
					await document.fonts.ready;
				} catch {
					// Keep the first render moving even if the font set rejects.
				}
			}

			if (isCancelled) {
				return;
			}

			if (showToolbarIcons && visibleToolbarHeader) {
				visibleToolbarHeight = Math.ceil(visibleToolbarHeader.getBoundingClientRect().height);
			}

			readyAnimationFrame = window.requestAnimationFrame(() => {
				if (isCancelled) {
					return;
				}

				initialLayoutReady = true;
			});
		};

		void settleInitialLayout();

		return () => {
			isCancelled = true;
			window.cancelAnimationFrame(readyAnimationFrame);
		};
	});

	$effect(() => {
		if (!browser || !initialLayoutReady || enableUiMotion) {
			return;
		}

		const animationFrame = window.requestAnimationFrame(() => {
			enableUiMotion = true;
		});

		return () => {
			window.cancelAnimationFrame(animationFrame);
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

	$effect(() => {
		if (!browser || !visibleToolbarHeader || !showToolbarIcons) {
			return;
		}

		const updateToolbarHeight = () => {
			visibleToolbarHeight = Math.ceil(visibleToolbarHeader?.getBoundingClientRect().height ?? 0);
		};

		updateToolbarHeight();

		const resizeObserver = new ResizeObserver(() => {
			updateToolbarHeight();
		});

		resizeObserver.observe(visibleToolbarHeader);
		window.addEventListener('resize', updateToolbarHeight);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', updateToolbarHeight);
		};
	});

	function createTabId(): string {
		if (typeof window.crypto?.randomUUID === 'function') {
			return window.crypto.randomUUID();
		}

		return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	}

	function clearTextPersistence(): void {
		if (!textPersistTimeout) {
			return;
		}

		window.clearTimeout(textPersistTimeout);
		textPersistTimeout = 0;
	}

	function createNextTextVersion(): PersistedTextVersion {
		return {
			updatedAt: Date.now(),
			sourceTabId: tabId,
			saveSequence: ++localSaveSequence
		};
	}

	function scheduleTextPersistence(nextText: string): void {
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
		const sessionDraft = readSessionTextDraft(SESSION_STORAGE_KEYS.textDraft);

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
			clearSessionTextDraft(SESSION_STORAGE_KEYS.textDraft);
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
					clearSessionTextDraft(SESSION_STORAGE_KEYS.textDraft);
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
			clearSessionTextDraft(SESSION_STORAGE_KEYS.textDraft);
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

	function showCopyFeedbackState(didSucceed: boolean): void {
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

	function handleInput(event: Event): void {
		const target = event.currentTarget as HTMLTextAreaElement;
		text = target.value;
		hasPendingLocalTextEdits = true;
		pendingTextVersion = createNextTextVersion();
		writeSessionTextDraft(SESSION_STORAGE_KEYS.textDraft, text, pendingTextVersion);
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

		if (event.key === STORAGE_KEYS.toolbarIcons) {
			showToolbarIcons = normalizeToolbarIconsVisibility(event.newValue);
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

	function handleThemePressedChange(pressed: boolean): void {
		theme = pressed ? 'dark' : 'light';
		saveStoredValue(STORAGE_KEYS.theme, theme);
	}

	function handleToolbarIconsPressedChange(pressed: boolean): void {
		showToolbarIcons = !pressed;
		saveStoredValue(STORAGE_KEYS.toolbarIcons, !pressed ? 'visible' : 'hidden');
	}

	function changeFontSize(delta: number): void {
		setFontSize(fontSize + delta);
	}

	async function handleCopyClick(): Promise<void> {
		try {
			const didCopy = await copyPlainText(text);
			showCopyFeedbackState(didCopy);

			if (didCopy) {
				pulseEditorCopyFeedback();
			}
		} catch {
			showCopyFeedbackState(false);
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
		content="the distraction-free writing tool that strips formatting and does not use AI"
	/>
	<meta
		name="keywords"
		content="plain text editor, distraction free writing, browser notes, plaintext.gg"
	/>
	<meta name="author" content="Starlight Insights" />
	<meta property="og:title" content="plaintext.gg" />
	<meta
		property="og:description"
		content="the distraction-free writing tool that strips formatting and does not use AI"
	/>
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="plaintext.gg" />
	<meta
		name="twitter:description"
		content="the distraction-free writing tool that strips formatting and does not use AI"
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
	class={[
		'app-shell relative grid min-h-dvh grid-rows-[1fr] bg-[var(--bg)] text-[var(--text-primary)] transition-[background-color,color] duration-180 ease-out',
		!initialLayoutReady && 'invisible pointer-events-none'
	]}
	style="font-family: var(--font-family-main);"
>
	{#if showToolbarIcons}
		<header
			bind:this={visibleToolbarHeader}
			in:fly={enableUiMotion ? { y: -10, duration: 180 } : { y: 0, duration: 0 }}
			out:fly={enableUiMotion ? { y: -10, duration: 140 } : { y: 0, duration: 0 }}
			class="absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-[0.94rem] font-light transition-[background-color,border-color,color] duration-180 ease-out sm:items-center sm:pr-14 max-sm:px-3 max-sm:text-base"
			style="font-family: var(--font-family-header); font-weight: 300;"
		>
			<nav
				class="flex flex-wrap items-center gap-2"
				aria-label="Info"
			>
				<InfoDialog bind:open={whyDialogOpen} triggerLabel="Why plaintext?" title="why plaintext.gg?">
					{#snippet triggerIcon()}
						<InfoIcon class={toolbarIconClass} />
					{/snippet}
					<p class="m-0">plaintext.gg is a distraction-free writing tool.</p>
					<p class="m-0">no ai. no formatting.</p>
					<p class="m-0">just open the page and start typing.</p>
					<p class="m-0">
						your text is saved locally in your browser. nothing is sent to any
						server. ever.
					</p>
					<p class="m-0">just a simple way to write, take notes, and strip formatting.</p>
					<p class="m-0">
						<a
							href="https://github.com/StarlightInsights/plaintext.gg"
							target="_blank"
						>
							open-source
						</a>.
					</p>
				</InfoDialog>
				<InfoDialog bind:open={privacyDialogOpen} triggerLabel="Privacy" title="privacy">
					{#snippet triggerIcon()}
						<PrivacyIcon class={toolbarIconClass} />
					{/snippet}
					<p class="m-0">plaintext.gg stores text in your browser&apos;s IndexedDB.</p>
					<p class="m-0">
						theme, toolbar visibility, and font size stay in your browser&apos;s
						localStorage.
					</p>
					<p class="m-0">
						no cookies. no analytics. no tracking. no accounts.
					</p>
					<p class="m-0">hosted on bunny.net</p>
					<p class="m-0">your text never leaves your device.</p>
					<p class="m-0">
						fonts and icons are bundled with the site.
					</p>
					<p class="m-0">
						we believe the best privacy policy is not needing one at all.
					</p>
				</InfoDialog>
				<InfoDialog bind:open={thanksDialogOpen} triggerLabel="Thanks" title="thanks">
					{#snippet triggerIcon()}
						<ThanksIcon class={toolbarIconClass} />
					{/snippet}
					<p class="m-0">
						thank you
						<a href="https://commitmono.com/?utm_source=plaintext.gg" target="_blank">
							Commit Mono
						</a>.
					</p>
					<p class="m-0">
						thank you
						<a href="https://phosphoricons.com/?utm_source=plaintext.gg" target="_blank">
							Phosphor
						</a>.
					</p>
					</InfoDialog>
			</nav>
			<div
				class="ml-auto flex flex-wrap items-center gap-2 sm:pl-3 max-sm:ml-0 max-sm:w-full max-sm:justify-start max-sm:gap-1"
				role="group"
				aria-label="Editor controls"
			>
				{#if showToolbarIcons}
					<div
						class="flex items-center gap-1 max-sm:gap-0.5"
						role="group"
						aria-label="Font size controls"
					>
						<button
							type="button"
							class={fontSizeButtonClass}
							aria-label="Increase font size"
							disabled={!canIncreaseFont}
							onclick={() => changeFontSize(FONT_STEP)}
						>
							<FontUpIcon class={toolbarIconClass} />
						</button>
						<button
							type="button"
							class={fontSizeButtonClass}
							aria-label="Decrease font size"
							disabled={!canDecreaseFont}
							onclick={() => changeFontSize(-FONT_STEP)}
						>
							<FontDownIcon class={toolbarIconClass} />
						</button>
					</div>

					<button
						type="button"
						class={iconButtonClass}
						aria-label="Save as plaintext file"
						onclick={handleSaveClick}
					>
						<SaveIcon class={toolbarIconClass} />
					</button>
					<button
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
							<CopyIcon class={toolbarIconClass} />
						{:else}
							<CopyFeedbackIcon class={toolbarIconClass} />
						{/if}
					</button>
					<button
						type="button"
						class={iconButtonClass}
						aria-pressed={theme === 'dark'}
						aria-label={`Toggle theme. Current theme: ${theme}.`}
						onclick={() => handleThemePressedChange(theme !== 'dark')}
					>
						{#if theme === 'dark'}
							<ThemeDarkIcon class={toolbarIconClass} />
						{:else}
							<ThemeLightIcon class={toolbarIconClass} />
						{/if}
					</button>
					<button
						type="button"
						class={[iconButtonClass, 'sm:hidden']}
						aria-pressed={!showToolbarIcons}
						aria-label="Hide navigation icons and editor controls"
						onclick={() => handleToolbarIconsPressedChange(showToolbarIcons)}
					>
						<ToolbarVisibleIcon class={toolbarIconClass} />
					</button>
				{/if}
			</div>
		</header>
	{/if}

	<div class="absolute top-2.5 right-4 z-30 hidden sm:block">
		<button
			type="button"
			class={iconButtonClass}
			aria-pressed={!showToolbarIcons}
			aria-label={
				showToolbarIcons ? 'Hide navigation icons and editor controls' : 'Show navigation icons and editor controls'
			}
			onclick={() => handleToolbarIconsPressedChange(showToolbarIcons)}
		>
			{#if showToolbarIcons}
				<ToolbarVisibleIcon class={toolbarIconClass} />
			{:else}
				<ToolbarHiddenIcon class={toolbarIconClass} />
			{/if}
		</button>
	</div>

	{#if !showToolbarIcons}
		<div class="absolute top-2 right-3 z-30 sm:hidden">
			<button
				type="button"
				class={hiddenFloatingIconButtonClass}
				aria-pressed={!showToolbarIcons}
				aria-label="Show navigation icons and editor controls"
				onclick={() => handleToolbarIconsPressedChange(showToolbarIcons)}
			>
				<ToolbarHiddenIcon class={toolbarIconClass} />
			</button>
		</div>
	{/if}

	<main class="relative min-h-0 overflow-hidden">
		<textarea
			bind:this={editor}
			{...browserQuietingAttributes}
			value={text}
			class={[
				textareaBaseClass,
				enableUiMotion
					? 'transition-[background-color,color,caret-color,padding-top,padding-right]'
					: 'transition-[background-color,color,caret-color]',
				showToolbarIcons
					? 'pt-[calc(var(--visible-toolbar-height,0px)+0.75rem)] sm:pt-[calc(var(--visible-toolbar-height,0px)+1rem)]'
					: 'pr-14 pt-10 sm:pr-16 sm:pt-12'
			]}
			style:--visible-toolbar-height={`${visibleToolbarHeight}px`}
			style:font-size={`${fontSize}px`}
			aria-label="Plain text editor"
			aria-autocomplete="none"
			placeholder="just plain text..."
			spellcheck="false"
			autocapitalize="none"
			autocomplete="off"
			inputmode="text"
			enterkeyhint="enter"
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
