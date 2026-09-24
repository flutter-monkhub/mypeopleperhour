import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // `@/…` → admin/src, `@shared/…` → ./shared/src (vendored copy of ../shared) (types, logic, content, date utils)
      '@shared': r('./shared/src'),
      '@seed': r('./shared/generated/seed.json'),
      '@': r('./src'),
    },
  },
  build: {
    // The seed (`@seed`, ~1.6 MB) is its own lazy chunk, fetched only on first load / reset.
    chunkSizeWarningLimit: 1800,
  },
})
