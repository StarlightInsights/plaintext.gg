<script lang="ts">
	import { onMount } from 'svelte';

	let { children } = $props();

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
