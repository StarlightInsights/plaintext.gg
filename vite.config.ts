import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // Target modern browsers so lightningcss preserves color-mix(), backdrop-filter
  // (unprefixed), and other evergreen features. Without this, compiled CSS
  // strips backdrop-filter for older Safari compat.
  build: {
    cssTarget: ['chrome120', 'firefox120', 'safari17'],
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
