import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  build: { rollupOptions: { input: {
    experiment: fileURLToPath(new URL('./index.html',import.meta.url)),
    drafting: fileURLToPath(new URL('./drafting.html',import.meta.url)),
  } } },
});
