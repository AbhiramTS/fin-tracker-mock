import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
  // For GitHub Pages with custom domain: base: "/"
  // For github.io/<repo>: base: "/fintracker/"
  base: "/",
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:   ["react", "react-dom"],
          radix:    [
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-progress",
          ],
          charts:   ["recharts"],
          firebase: ["firebase/app", "firebase/firestore"],
        },
      },
    },
  },
});
