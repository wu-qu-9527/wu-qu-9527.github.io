import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://wu-qu-9527.github.io',
  base: '/',
  output: 'static',
  telemetry: false,
  vite: {
    plugins: [tailwindcss()],
  },
});
