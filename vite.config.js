import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// host: true binds to 0.0.0.0 so the app is reachable from network previews.
// allowedHosts: true permits proxied preview hosts (and any custom domain you deploy behind).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    sourcemap: false,
    target: 'es2019',
  },
});
