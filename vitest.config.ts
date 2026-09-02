import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./scripts/server-only.mjs', import.meta.url)),
    },
  },
  test: {
    coverage: { enabled: false },
    include: ['tests/**/*.test.ts'],
  },
});
