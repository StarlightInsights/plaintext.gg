<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		if (!import.meta.env.PROD) {
			return;
		}

		void import('virtual:pwa-register').then(({ registerSW }) => {
			registerSW({
				immediate: true,
				onRegisterError(error: unknown) {
					console.error('Service worker registration failed.', error);
				}
			});
		});
	});
</script>

{@render children()}
