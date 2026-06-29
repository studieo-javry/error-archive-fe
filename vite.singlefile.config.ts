import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// Build the whole SPA into a single, self-contained chunk so it can be inlined into one
// index.html (see scripts/inline-singlefile.mjs). No code-splitting, CSS in one file,
// every asset inlined as a data URI. `base: './'` keeps the few remaining refs relative
// so the file works both when served and (UI-only) when opened via file://.
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  base: './',
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: false,
    chunkSizeWarningLimit: 100_000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
})
