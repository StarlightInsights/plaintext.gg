<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		dialogButtonClass,
		dialogContentClass,
		dialogDescriptionClass,
		dialogTitleClass,
		iconButtonClass
	} from '$lib/css-classes';

	let {
		open = $bindable(false),
		triggerLabel,
		triggerIcon,
		title,
		children
	}: {
		open: boolean;
		triggerLabel: string;
		triggerIcon: Snippet;
		title: string;
		children: Snippet;
	} = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	const dialogId = crypto.randomUUID().slice(0, 8);
	const titleId = `dialog-title-${dialogId}`;
	const descriptionId = `dialog-desc-${dialogId}`;

	$effect(() => {
		if (!dialogEl) {
			return;
		}

		if (open && !dialogEl.open) {
			dialogEl.showModal();
		} else if (!open && dialogEl.open) {
			dialogEl.close();
		}
	});

	function handleTriggerClick(): void {
		open = true;
	}

	function handleClose(): void {
		open = false;
	}

	function handleDialogClick(event: MouseEvent): void {
		if (event.target === dialogEl) {
			open = false;
		}
	}
</script>

<button type="button" class={iconButtonClass} aria-label={triggerLabel} onclick={handleTriggerClick}>
	{@render triggerIcon()}
</button>
<dialog
	bind:this={dialogEl}
	class={dialogContentClass}
	aria-labelledby={titleId}
	aria-describedby={descriptionId}
	onclose={handleClose}
	onclick={handleDialogClick}
>
	<div class="grid gap-5 p-4">
		<div class="flex items-start justify-between gap-4">
			<h2
				id={titleId}
				class={dialogTitleClass}
				style="font-family: var(--font-family-title);"
			>
				{title}
			</h2>
			<button
				type="button"
				class={dialogButtonClass}
				aria-label="Close dialog"
				onclick={() => { open = false; }}
			>
				x
			</button>
		</div>

		<div
			id={descriptionId}
			class={dialogDescriptionClass}
			style="font-family: var(--font-family-dialog);"
		>
			{@render children()}
		</div>
	</div>
</dialog>
