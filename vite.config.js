import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createApi } from "./server/api.js";

// Runs the fleet API (server/api.js) inside the Vite dev server, so
// `npm run dev` starts the app AND the database server together.
function fleetApi() {
  let api;
  const handler = (req, res, next) => {
    api ??= createApi(); // opens server/data/db.json on the first request
    return api(req, res, next);
  };
  return {
    name: "fleet-api",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // .env / .env.local settings (SUPABASE_URL, ANTHROPIC_API_KEY...) for the API.
  // Only the server sees them; the browser only ever gets VITE_... variables.
  Object.assign(process.env, { ...loadEnv(mode, process.cwd(), ""), ...process.env });
  return config;
});

const config = {
  plugins: [react(), fleetApi()],
  server: {
    port: 5000,
    // the database file changes all the time; don't reload the page for it
    watch: { ignored: ["**/server/data/**"] },
  },
  preview: {
    port: 5000,
  },
};
