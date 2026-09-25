import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        autoprefixer(),
      ],
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    minify: 'terser',
    cssMinify: true,
    rollupOptions: {
      input: {
        main:               resolve(__dirname, 'index.html'),
        about:              resolve(__dirname, 'about/index.html'),
        shop:               resolve(__dirname, 'shop/index.html'),
        weddings:           resolve(__dirname, 'weddings/index.html'),
        films:              resolve(__dirname, 'films/index.html'),
        coupleShoots:       resolve(__dirname, 'couple-shoots/index.html'),
        premiumAlbums:      resolve(__dirname, 'premium-albums/index.html'),
        privacyPolicy:      resolve(__dirname, 'privacy-policy/index.html'),
        disclaimer:         resolve(__dirname, 'disclaimer/index.html'),
        careers:            resolve(__dirname, 'careers/index.html'),
        termsAndConditions: resolve(__dirname, 'terms-and-conditions/index.html'),
        faqs:               resolve(__dirname, 'faqs/index.html'),
        contact:            resolve(__dirname, 'contact/index.html'),
        testimonials:       resolve(__dirname, 'testimonials/index.html'),
        guides:             resolve(__dirname, 'guides/index.html'),
        guideArticle:       resolve(__dirname, 'guides/_post/index.html'),
        caseStudies:        resolve(__dirname, 'case-studies/index.html'),
        caseStudy:          resolve(__dirname, 'case-studies/_story/index.html'),
        taherHusain:        resolve(__dirname, 'taher-husain/index.html'),
        puneVenues:         resolve(__dirname, 'wedding-photography-pune-venues/index.html'),
      }
    }
  },
});
