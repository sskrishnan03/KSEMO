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
      '/api/web-search': 'http://localhost:3001',
      '/api/news': 'http://localhost:3001',
      '/api/hn-top': 'http://localhost:3001',
      '/api/transcribe': 'http://localhost:3001',
      '/api/tts': 'http://localhost:3001',
      // Streaming STT websocket (ws://localhost:5173/api/stt → :3001).
      '/api/stt': { target: 'http://localhost:3001', ws: true },
    },
  },
});
