// Small wrapper around fetch() for talking to the fleet API (server/api.js).
const TOKEN_KEY = "fleet.token";

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

export async function api(path, { method = "GET", body } = {}) {
  const token = tokenStore.get();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the server. Is `npm run dev` still running?", 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // session expired or account removed: send the user back to the login page
    if (res.status === 401 && token) window.dispatchEvent(new Event("fleet:logged-out"));
    throw new ApiError(data.error || `Request failed (${res.status}).`, res.status);
  }
  return data;
}
