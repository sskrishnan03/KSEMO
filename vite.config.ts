import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/send-email': 'http://localhost:3001',
      '/forgot-password': 'http://localhost:3001',
      '/reset-password': 'http://localhost:3001',
    },
  },
});
