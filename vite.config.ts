import { crx } from '@crxjs/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  build: {
    rollupOptions: {
      // Pages not referenced by the manifest (block is reached via
      // declarativeNetRequest redirect; onboarding/viewer via runtime.getURL).
      input: {
        block: 'src/surfaces/block/index.html',
        onboarding: 'src/surfaces/onboarding/index.html',
        viewer: 'src/surfaces/viewer/index.html',
      },
    },
  },
})
