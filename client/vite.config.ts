import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { randomUUID } from "node:crypto";

const buildVersion = randomUUID();

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(buildVersion) },
  plugins: [
    react(),
    {
      name: "aegifitness-build-version",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version: buildVersion }) });
        this.emitFile({ type: "asset", fileName: "sw-version.js", source:
          `self.addEventListener('message', event => { if (event.data?.type === 'AEGI_VERSION') event.ports[0]?.postMessage(${JSON.stringify(buildVersion)}); });` });
      },
    },
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["AegiFit-Icon.png", "aegifitness-ecg-*.png"],
      manifest: {
        name: "AegiFitness",
        short_name: "AegiFit",
        description: "Tu PWA personal para rutinas, dietas y métricas.",
        theme_color: "#f5f6fb",
        background_color: "#f5f6fb",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          {
            src: "/aegifitness-ecg-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/aegifitness-ecg-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/aegifitness-ecg-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        importScripts: ["/sw-version.js"],
        navigateFallbackDenylist: [/^\/api\//],
        // Las imágenes de ejercicios (745 WebP, ~12 MB) NO se precachean:
        // se cachean en runtime bajo demanda (offline real sin inflar el SW install)
        globIgnores: ["**/exercises/**", "**/version.json", "**/sw-version.js"],
        runtimeCaching: [
          {
            urlPattern: /\/exercises\/flat\/.*\.webp$/,
            handler: "CacheFirst",
            options: {
              cacheName: "exercise-images",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:5212",
    },
  },
});
