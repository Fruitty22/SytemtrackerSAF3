// Small wrapper around fetch() for talking to the fleet API (server/api.js).
const TOKEN_KEY = "fleet.token";
const NODE_KEY = "fleet.node"; // which node (shared/nodes.js) this browser is in

export const nodeStore = {
  get() {
    try {
      return localStorage.getItem(NODE_KEY);
    } catch {
      return null;
    }
  },
  set(key) {
    try {
      if (key) localStorage.setItem(NODE_KEY, key);
      else localStorage.removeItem(NODE_KEY);
    } catch {
      /* storage blocked */
    }
  },
};

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked: the login just won't survive a refresh */
    }
  },
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// A request that hasn't answered after this long is given up (and a read is
// tried once more), so a page never sits on its loading bars forever.
const TIMEOUT_MS = 20000;

async function send(path, method, headers, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: ctrl.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw new ApiError("The server took too long to answer. Please try again.", 0);
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  } finally {
    clearTimeout(timer);
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const token = tokenStore.get();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const node = nodeStore.get();
  if (node) headers["X-Fleet-Node"] = node;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await send(path, method, headers, body);
    // a read that failed on the server's side (e.g. a slow start) is tried once more
    if (method === "GET" && res.status >= 500) res = await send(path, method, headers, body);
  } catch (err) {
    if (method !== "GET") throw err;
    res = await send(path, method, headers, body); // reads are safe to try again
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // session expired or account removed: send the user back to the login page
    if (res.status === 401 && token) window.dispatchEvent(new Event("fleet:logged-out"));
    throw new ApiError(data.error || `Request failed (${res.status}).`, res.status);
  }
  return data;
}
