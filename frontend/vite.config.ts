import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Proxy API + socket traffic to the gateway so the browser sees ONE origin.
  // This makes Better Auth's session cookie first-party (SameSite=Lax works);
  // without it, the :5173 app can't send the cookie the :4000 gateway sets.
  // changeOrigin:false preserves the Host so Better Auth's baseURL matches.
  server: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: false },
      '/socket.io': { target: 'http://localhost:4000', ws: true, changeOrigin: false },
    },
  },
})
