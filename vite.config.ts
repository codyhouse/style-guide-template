import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

// Port 8000, never another: drafts and uploaded files are stored per origin.
export default defineConfig({
  plugins: [vue()],
  server: { port: 8000, strictPort: true },
  preview: { port: 8000, strictPort: true },
  // license: the bundled libraries' notices, written to dist/.vite/license.md
  build: { target: 'es2022', license: true },
  test: { include: ['tests/**/*.test.ts'] },
});
