import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

function onnxWasmServePlugin(): Plugin {
  return {
    name: "onnx-wasm-serve",
    resolveId(id) {
      if (id.startsWith("/onnx/")) {
        return id;
      }
      return null;
    },
    load(id) {
      if (id.startsWith("/onnx/")) {
        const cleanId = id.split("?")[0];
        const filePath = path.resolve(__dirname, "public" + cleanId);
        if (fs.existsSync(filePath) && (filePath.endsWith(".mjs") || filePath.endsWith(".js"))) {
          return fs.readFileSync(filePath, "utf-8");
        }
      }
      return null;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && (req.url.startsWith("/onnx/") || req.url.startsWith("/models/"))) {
          const cleanUrl = req.url.split("?")[0];
          const filePath = path.resolve(__dirname, "public" + cleanUrl);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            if (cleanUrl.endsWith(".mjs") || cleanUrl.endsWith(".js")) {
              res.setHeader("Content-Type", "application/javascript");
            } else if (cleanUrl.endsWith(".wasm")) {
              res.setHeader("Content-Type", "application/wasm");
            } else if (cleanUrl.endsWith(".onnx")) {
              res.setHeader("Content-Type", "application/octet-stream");
            }
            res.setHeader("Access-Control-Allow-Origin", "*");
            return fs.createReadStream(filePath).pipe(res);
          }
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), onnxWasmServePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["onnxruntime-web", "@techstark/opencv-js"],
  },
  server: {
    port: 3000,
    hmr: {
      overlay: false,
    },
  },
});
