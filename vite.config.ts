import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Dev-only guard: when a browser tab drops its live-reload connection abruptly, Node can emit an
 * unhandled socket 'error' (ECONNRESET) that kills the whole dev server. Swallow socket-level
 * errors so a closed tab never takes `npm run dev` down.
 */
function ignoreSocketResets(): Plugin {
  return {
    name: "ignore-socket-resets",
    apply: "serve",
    configureServer(server) {
      server.httpServer?.on("connection", (socket) => {
        socket.on("error", () => {});
      });
      server.httpServer?.on("clientError", (_err, socket) => {
        socket.destroy();
      });
    },
  };
}

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), ignoreSocketResets()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
