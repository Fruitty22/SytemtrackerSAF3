// Database for the Vercel version of the app.
//
// Vercel throws away files between requests, so server/data/db.json can't be
// used there. Instead the same data (users, sessions, vehicles, sheets,
// disregards + the deleted-accounts archive) is kept as one JSON value in an
// Upstash Redis database, added from the Vercel dashboard:
//   Project -> Storage -> Create Database -> Upstash for Redis (free plan)
// Vercel then adds the connection settings to the project automatically.
//
// Every request reads the latest copy. If the request changed anything, the new
// copy is written back only if nobody else saved in the meantime (a "revision"
// check); otherwise the request is run again on the fresh data. So two
// commanders editing at the same moment can't overwrite each other.
import { Redis } from "@upstash/redis";

const STATE_KEY = "fleet:state";
const REV_KEY = "fleet:rev";

// Save only if the revision is still the one we read
const SAVE_IF_UNCHANGED = `
local current = redis.call('GET', KEYS[2]) or '0'
if current ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3])
return 1
`;

let client;
export function redis() {
  if (client) return client;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "No database connected. In Vercel: Project -> Storage -> Create Database -> " +
        "Upstash for Redis, connect it to this project, then redeploy."
    );
  }
  client = new Redis({ url, token, automaticDeserialization: false });
  return client;
}

const emptyDb = () => ({ version: 1, users: [], sessions: [], vehicles: [], sheets: [] });

// -> { rev, db, deleted }
export async function loadState() {
  const raw = await redis().get(STATE_KEY);
  if (!raw) return { rev: "0", db: emptyDb(), deleted: [] };
  const state = JSON.parse(raw);
  return {
    rev: String(state.rev ?? "0"),
    db: { ...emptyDb(), ...state.db },
    deleted: Array.isArray(state.deleted) ? state.deleted : [],
  };
}

// true if saved, false if someone else saved first
export async function saveState(prevRev, db, deleted) {
  const rev = String(Number(prevRev) + 1);
  const value = JSON.stringify({ rev, savedAt: new Date().toISOString(), db, deleted });
  const ok = await redis().eval(SAVE_IF_UNCHANGED, [STATE_KEY, REV_KEY], [prevRev, value, rev]);
  return Number(ok) === 1;
}

// Replace everything (used by scripts/push-db.js to upload a local db.json)
export async function overwriteState(db, deleted) {
  const { rev } = await loadState();
  const next = String(Number(rev) + 1);
  const value = JSON.stringify({ rev: next, savedAt: new Date().toISOString(), db, deleted });
  await redis().set(STATE_KEY, value);
  await redis().set(REV_KEY, next);
}
