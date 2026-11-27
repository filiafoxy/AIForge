import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { pwaPlugin } from './pwa/pwaPlugin.ts';

export default defineConfig({
  plugins: [react(), pwaPlugin()],
});
