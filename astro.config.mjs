// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

import vercel from '@astrojs/vercel';
import { readdirSync } from 'node:fs';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    ssr: { external: ['playwright-core', '@sparticuz/chromium', 'jsdom'] }
  },

  integrations: [react()],
  output: 'server',
  adapter: vercel({ maxDuration: 60, includeFiles: readdirSync(new URL('./node_modules/@sparticuz/chromium/bin/', import.meta.url)).filter(name => name.endsWith('.br')).map(name => `node_modules/@sparticuz/chromium/bin/${name}`) })
});
