import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // server: {
  //   proxy: {
  //     '/api': 'http://localhost:5000',
  //   },
  // },

  server: {
    proxy: {
      '/api': {
        target: 'http://nerl_backend:5000',
        changeOrigin: true,
      },
    },
  },
});
