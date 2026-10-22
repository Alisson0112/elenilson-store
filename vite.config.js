import { defineConfig } from 'vite';

// base './' permite publicar em qualquer subcaminho (ex.: GitHub Pages /repo/).
export default defineConfig({
  base: './',
  build: { sourcemap: false, target: 'es2020' },
  test: { environment: 'node' },
});
