import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  // Set base to "/" for a custom domain, or "/repo-name/" for GitHub Pages
  // without a custom domain (e.g. base: "/fintracker/")
  base: "/",
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:   ["react", "react-dom"],
          charts:   ["recharts"],
          firebase: ["firebase/app", "firebase/firestore"],
        },
      },
    },
  },
});
