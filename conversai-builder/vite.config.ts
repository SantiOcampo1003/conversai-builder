import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [
      "precisely-cause-murray-yard.trycloudflare.com",
      ".trycloudflare.com",
      ".ngrok-free.app",
      ".ngrok.io",
      "localhost"
    ]
  },
  preview: {
    host: "0.0.0.0",
    port: 8080,
    allowedHosts: [
      ".railway.app",
      ".up.railway.app",
      "conversai-builder-production.up.railway.app",
      "localhost"
    ]
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
