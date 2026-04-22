import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

// Single Vite config builds both the React SPA and the Hono Worker that
// serves the API. The Cloudflare plugin reads wrangler.toml for bindings,
// wires local D1/KV/R2 emulators, and routes asset requests to the SPA.
// The SPA's client entrypoint is src/react-app/main.tsx, referenced from
// index.html at the repo root of this workspace.
export default defineConfig({
  plugins: [react(), cloudflare()],
  build: {
    // Emit the client bundle + assets here; wrangler serves this directory
    // via the `assets` binding declared in wrangler.toml.
    outDir: 'dist',
    emptyOutDir: true,
  },
});
