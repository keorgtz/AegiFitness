import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["AegiFit-Icon.png"],
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
            src: "/AegiFit-Icon.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/AegiFit-Icon.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/AegiFit-Icon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        // Las imágenes de ejercicios (745 WebP, ~12 MB) NO se precachean:
        // se cachean en runtime bajo demanda (offline real sin inflar el SW install)
        globIgnores: ["**/exercises/**"],
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
