// Vercel entry point for every /api/... request (see vercel.json).
// Runs the same API as `npm run dev` / `npm start` (server/api.js), but with the
// data loaded from and saved to Redis (server/vercel-store.js).
import { createApi } from "../server/api.js";
import { loadState, saveState } from "../server/vercel-store.js";

export const config = { maxDuration: 30 };

const MAX_TRIES = 12;
const loginFails = new Map(); // kept while this Vercel instance stays warm

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Collects what the API writes, so nothing is sent until the data is saved
function captureResponse() {
  const out = { statusCode: 200, headers: {}, body: "" };
  return {
    out,
    get statusCode() {
      return out.statusCode;
    },
    set statusCode(v) {
      out.statusCode = v;
    },
    setHeader(name, value) {
      out.headers[name] = value;
    },
    end(body = "") {
      out.body = body;
    },
  };
}

export default async function handler(req, res) {
  // vercel.json rewrites /api/anything to /api?__path=anything
  const url = new URL(req.url, "http://localhost");
  const sub = url.searchParams.get("__path");
  if (sub != null) {
    url.searchParams.delete("__path");
    const qs = url.searchParams.toString();
    req.url = `/api/${sub}${qs ? `?${qs}` : ""}`;
  }

  try {
    const rawBody = ["POST", "PATCH", "PUT", "DELETE"].includes(req.method)
      ? await readRaw(req)
      : Buffer.alloc(0);

    for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
      const state = await loadState();
      let changed = false;
      const store = {
        db: { data: state.db, save: () => (changed = true) },
        deleted: { items: state.deleted, save: () => (changed = true) },
      };
      // the API keeps `deleted.items` as the live list, so read it back after
      const api = createApi({ store, loginFails });
      const fake = captureResponse();
      await api(
        { method: req.method, url: req.url, headers: req.headers, socket: req.socket, rawBody },
        fake,
        null
      );

      const ok = fake.out.statusCode < 400;
      if (changed && ok) {
        const saved = await saveState(state.rev, store.db.data, store.deleted.items);
        if (!saved) {
          // someone else saved first: wait a moment, then run again on fresh data
          await new Promise((r) => setTimeout(r, 20 + Math.random() * 60 * attempt));
          continue;
        }
      }

      res.statusCode = fake.out.statusCode;
      for (const [k, v] of Object.entries(fake.out.headers)) res.setHeader(k, v);
      return res.end(fake.out.body);
    }

    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "The server is busy. Please try again." }));
  } catch (err) {
    console.error("[fleet-api]", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: err.message || "Something went wrong on the server." }));
  }
}
