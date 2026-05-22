import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@dynamic-labs") || id.includes("node_modules/@turnkey") || id.includes("node_modules/@simplewebauthn")) {
            return "dynamic";
          }

          if (id.includes("node_modules/lucide-react") || id.includes("node_modules/lucide")) {
            return "icons";
          }

          if (id.includes("node_modules/firebase")) {
            return "firebase";
          }

          if (id.includes("node_modules/wagmi") || id.includes("node_modules/viem") || id.includes("node_modules/@tanstack")) {
            return "wallet";
          }

          if (id.includes("node_modules")) {
            return "vendor";
          }

          return undefined;
        }
      }
    }
  }
});
