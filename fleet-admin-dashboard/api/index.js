// Vercel serverless function: every /api/... request comes here (see vercel.json)
// and is handled by the same API as `npm run dev` / `npm start` (server/api.js).
import { createApi } from "../server/api.js";

const api = createApi();

export default async function handler(req, res) {
  // vercel.json rewrites /api/vehicles/123 to /api?__path=vehicles/123 - put it back
  const url = new URL(req.url, "http://localhost");
  const path = url.searchParams.get("__path");
  if (path !== null) {
    url.searchParams.delete("__path");
    const query = url.searchParams.toString();
    req.url = `/api/${path.replace(/^\/+/, "")}${query ? `?${query}` : ""}`;
  }
  await api(req, res);
}
