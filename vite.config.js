import { defineConfig } from 'vite';
import autoprefixer from 'autoprefixer';
import { resolve, relative, sep } from 'path';
import { readdirSync, existsSync } from 'fs';

/* ============================================================
   Amour Affairs website — Vite multi-page build
   ------------------------------------------------------------
   Source lives in website/ (one folder per URL, each with its
   own index.html). Every index.html found there is a page, so a
   new page only needs a folder — no list to keep in sync here.
   Output: dist/ (deployed as-is to the web root).
   ============================================================ */

const SITE = resolve(__dirname, 'website');
const SKIP = new Set(['public', 'src', 'node_modules']);

function findPages(dir, depth = 0) {
  const pages = [];
  if (existsSync(resolve(dir, 'index.html'))) pages.push(resolve(dir, 'index.html'));
  if (depth > 2) return pages;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP.has(entry.name) || entry.name.startsWith('.')) continue;
    pages.push(...findPages(resolve(dir, entry.name), depth + 1));
  }
  return pages;
}

// Rollup entry names: "main" for the homepage, otherwise the folder path
// ("guides/_post" → "guides-_post"). Names only affect chunk file names.
const input = Object.fromEntries(
  findPages(SITE).map((file) => {
    const rel = relative(SITE, resolve(file, '..')).split(sep).join('/');
    return [rel ? rel.replace(/\//g, '-') : 'main', file];
  }),
);

/**
 * Preload the two web-font files every page renders its first screen with
 * (latin, upright). Text then paints in the final font instead of swapping in
 * a moment later, which avoids a visible reflow (layout shift). The file names
 * carry content hashes, so they are looked up in the finished bundle.
 */
function preloadCriticalFonts() {
  const CRITICAL = [/cormorant-garamond-latin-wght-normal-.*\.woff2$/, /montserrat-latin-wght-normal-.*\.woff2$/];
  return {
    name: 'aa-preload-critical-fonts',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html; // dev server: nothing hashed to point at
        const files = Object.keys(ctx.bundle).filter((f) => CRITICAL.some((re) => re.test(f)));
        return files.map((f) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${f}`, crossorigin: '' },
          injectTo: 'head-prepend',
        }));
      },
    },
  };
}

export default defineConfig({
  plugins: [preloadCriticalFonts()],
  root: SITE,
  envDir: SITE,
  publicDir: resolve(SITE, 'public'),
  css: {
    postcss: { plugins: [autoprefixer()] },
  },
  server: { port: 3000, open: true },
  preview: { port: 4173 },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    minify: 'terser',
    cssMinify: true,
    rollupOptions: { input },
  },
});
