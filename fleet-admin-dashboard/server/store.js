// Where the database is kept.
//
//   - On Vercel (or anywhere SUPABASE_URL is set): a free Supabase Postgres
//     database. The whole fleet database is one JSON document in the table
//     `fleet_store` (see supabase/schema.sql).
//   - On your own computer (`npm run dev` / `npm start`) without SUPABASE_URL:
//     the JSON file server/data/db.json, like before.
//
// Both work the same way:
//   load()                -> { data, version }   a fresh copy you may change
//   save(data, version)   -> true, or false if someone else saved first
//                            (then the request is simply run again on the new data)
//   saveSnapshot(name, data) / loadSnapshot(name)   a copy kept before each import,
//                            so an import can be undone
//
// "version" goes up by one on every save. Two people saving at the same moment
// can't overwrite each other: the second save sees the version has moved on.
import fs from "node:fs";
import path from "node:path";

export const emptyDb = () => ({
  version: 1,
  users: [],
  sessions: [],
  vehicles: [],
  sheets: [],
  events: [],
  criteria: [],
  deletedAccounts: [],
});

const clone = (x) => structuredClone(x);

export function createStore() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (url && key) return supabaseStore({ url, key });
  if (url && !key) return brokenStore("SUPABASE_URL is set but SUPABASE_SERVICE_ROLE_KEY is missing.");
  if (process.env.VERCEL) {
    return brokenStore(
      "No database is connected. In Vercel add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "(Project -> Settings -> Environment Variables), then redeploy. See DEPLOY.md."
    );
  }
  return fileStore(process.env.FLEET_DB || path.resolve(process.cwd(), "server/data/db.json"));
}

function brokenStore(message) {
  const fail = async () => {
    const err = new Error(message);
    err.status = 503;
    err.expose = true;
    throw err;
  };
  return { kind: "none", load: fail, save: fail, saveSnapshot: fail, loadSnapshot: fail };
}

// ---------------------------------------------------------------- local file

export function fileStore(file) {
  const dir = path.dirname(file);
  let current = null; // { data, version }

  function open() {
    if (current) return current;
    fs.mkdirSync(dir, { recursive: true });
    let data = emptyDb();
    if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, "utf8");
      try {
        data = { ...emptyDb(), ...JSON.parse(text) };
      } catch (err) {
        throw new Error(
          `The database file ${file} is not valid JSON (${err.message}). ` +
            "Fix it, or restore it from db.backup.json in the same folder."
        );
      }
      // keep a copy of the database as it was when the server started
      fs.writeFileSync(path.join(dir, "db.backup.json"), text);
    }
    // older versions kept deleted accounts in their own file
    const oldDeleted = path.join(dir, "deleted-accounts.json");
    if (fs.existsSync(oldDeleted)) {
      try {
        const list = JSON.parse(fs.readFileSync(oldDeleted, "utf8"));
        if (Array.isArray(list) && list.length && !data.deletedAccounts?.length) data.deletedAccounts = list;
      } catch {
        /* ignore a broken old archive */
      }
    }
    current = { data, version: 0 };
    write(data);
    return current;
  }

  function write(data) {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  }

  const snapFile = (name) => path.join(dir, `snapshot-${name.replace(/[^a-z0-9-]/gi, "")}.json`);

  return {
    kind: "file",
    file,
    async load() {
      const c = open();
      return { data: clone(c.data), version: c.version };
    },
    async save(data, version) {
      const c = open();
      if (version !== c.version) return false;
      write(data);
      current = { data: clone(data), version: c.version + 1 };
      return true;
    },
    async saveSnapshot(name, data) {
      fs.writeFileSync(snapFile(name), JSON.stringify({ savedAt: new Date().toISOString(), data }));
    },
    async loadSnapshot(name) {
      if (!fs.existsSync(snapFile(name))) return null;
      return JSON.parse(fs.readFileSync(snapFile(name), "utf8"));
    },
  };
}

// ---------------------------------------------------------------- Supabase

// Talks to Supabase's REST API with plain fetch(), so there is nothing extra to
// install. The service-role key stays on the server; the browser never sees it.
export function supabaseStore({ url, key, table = "fleet_store", fetchImpl = globalThis.fetch }) {
  const base = `${url.replace(/\/+$/, "")}/rest/v1/${table}`;
  const headers = {
    apikey: key,
    // legacy service_role keys are JWTs and also go in Authorization;
    // the newer "sb_secret_..." keys only go in the apikey header
    ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
    "Content-Type": "application/json",
  };
  let cache = null; // { data, version } - reused while nobody else has saved

  async function call(method, query, body, prefer) {
    const res = await fetchImpl(`${base}?${query}`, {
      method,
      headers: prefer ? { ...headers, Prefer: prefer } : headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      const hint =
        res.status === 404 || /relation .* does not exist|Could not find the table/i.test(text)
          ? ` The table "${table}" doesn't exist yet: run supabase/schema.sql in the Supabase SQL editor.`
          : "";
      const err = new Error(`Database error (${res.status}).${hint}`);
      err.status = 503;
      err.expose = true;
      err.detail = text.slice(0, 300);
      throw err;
    }
    return text ? JSON.parse(text) : null;
  }

  const MAIN = "id=eq.main";

  return {
    kind: "supabase",
    async load() {
      // a tiny request first: has anything changed since we last read it?
      const rows = await call("GET", `${MAIN}&select=version`);
      if (!rows.length) {
        await call("POST", "on_conflict=id", { id: "main", version: 0, data: emptyDb() }, "resolution=ignore-duplicates,return=minimal");
        cache = { data: emptyDb(), version: 0 };
        return { data: emptyDb(), version: 0 };
      }
      const version = Number(rows[0].version);
      if (!cache || cache.version !== version) {
        const full = await call("GET", `${MAIN}&select=version,data`);
        cache = { data: { ...emptyDb(), ...(full[0]?.data ?? {}) }, version: Number(full[0]?.version ?? version) };
      }
      return { data: clone(cache.data), version: cache.version };
    },
    async save(data, version) {
      const rows = await call(
        "PATCH",
        `${MAIN}&version=eq.${version}&select=version`,
        { data, version: version + 1, updated_at: new Date().toISOString() },
        "return=representation"
      );
      if (!rows?.length) {
        cache = null;
        return false; // someone else saved first
      }
      cache = { data: clone(data), version: version + 1 };
      return true;
    },
    async saveSnapshot(name, data) {
      await call(
        "POST",
        "on_conflict=id",
        { id: `snapshot:${name}`, version: 0, data: { savedAt: new Date().toISOString(), data }, updated_at: new Date().toISOString() },
        "resolution=merge-duplicates,return=minimal"
      );
    },
    async loadSnapshot(name) {
      const rows = await call("GET", `id=eq.${encodeURIComponent(`snapshot:${name}`)}&select=data`);
      return rows?.[0]?.data ?? null;
    },
  };
}
