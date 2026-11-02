// Production server: `npm run build` then `npm start`.
// Serves the built app from dist/ and the API from the same port, and listens
// on every network interface so other computers on your network can open it.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApi } from "./api.js";

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || "0.0.0.0";
const DIST = path.resolve(process.cwd(), "dist");
const INDEX = path.join(DIST, "index.html");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function serveStatic(req, res) {
  if (!fs.existsSync(INDEX)) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("No build found. Run `npm run build` first, then `npm start`.");
  }

  let pathname = "/";
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    /* fall back to index.html */
  }

  let file = path.join(DIST, pathname);
  const insideDist = file === DIST || file.startsWith(DIST + path.sep);
  if (!insideDist || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = INDEX; // let the React router handle the URL
  }

  const headers = {
    "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    // built assets have a content hash in their name, so they can be cached
    "Cache-Control": file.includes(`${path.sep}assets${path.sep}`)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  };
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}

const api = createApi();

http
  .createServer((req, res) => api(req, res, () => serveStatic(req, res)))
  .listen(PORT, HOST, () => {
    console.log(`\nFleet admin dashboard is running:`);
    console.log(`  This computer:  http://localhost:${PORT}`);
    for (const nets of Object.values(os.networkInterfaces())) {
      for (const net of nets ?? []) {
        if (net.family === "IPv4" && !net.internal) {
          console.log(`  On your network: http://${net.address}:${PORT}`);
        }
      }
    }
    console.log("\nPress Ctrl+C to stop.\n");
  });
