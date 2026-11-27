import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { pwaPlugin } from './pwa/pwaPlugin.ts';

export default defineConfig({
  plugins: [react(), pwaPlugin()],
  preview: {
    host: '0.0.0.0',
    port: 8080,
    strictPort: true,
    allowedHosts: [
      'DigitalMechanic.develonica.group',
      'digitalmechanic.develonica.group',
      'localhost',
      '127.0.0.1',
    ],
  },
});
