import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig(({ mode }) => ({
  root: path.join(root, 'ui'),
  base: './',
  plugins: [vue()],
  build: {
    outDir: path.resolve(root, mode === 'ios' ? '../star-pets-ios/StarPets/web' : 'assets/web'),
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
  },
  server: { host: '127.0.0.1' },
}));
