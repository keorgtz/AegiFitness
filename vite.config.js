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
				short_name: "AegiFitness",
				description: "Tu PWA personal para rutinas, dietas y métricas.",
				theme_color: "#070b18",
				background_color: "#070b18",
				display: "standalone",
				orientation: "portrait",
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
		}),
	],
});
