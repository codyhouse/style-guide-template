import { defineConfig } from 'vite';

// Port 8000, never another: drafts and uploaded files are stored per origin.
export default defineConfig({
  server: { port: 8000, strictPort: true },
  preview: { port: 8000, strictPort: true },
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.js'] },
});
