import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
  react(),
  VitePWA({
  
    registerType: "autoUpdate",
    includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
    manifest: {
      name: "AME",
      short_name: "AME",
      description: "AME - Apoio Missional",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#0a0a0a",
      theme_color: "#ef4444",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
      ]
    },
    workbox: {
      navigateFallback: "/index.html",
      globPatterns: ["**/*.{js,css,html,ico,webmanifest}"],
      globIgnores: ["**/icons/logo-login.svg"],                 //remove svg from cache
       maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4MB
    },
  }),
],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
