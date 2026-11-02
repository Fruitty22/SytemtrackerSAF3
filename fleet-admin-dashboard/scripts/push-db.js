// Upload your local database (server/data/db.json + deleted-accounts.json) to
// the Vercel Redis database, replacing what is there.
//
//   1. In Vercel: Project -> Storage -> your Upstash database -> ".env.local" tab,
//      copy KV_REST_API_URL and KV_REST_API_TOKEN into a file called .env.local
//      in this folder (it is git-ignored).
//   2. npm run push-db
import fs from "node:fs";
import path from "node:path";
import { overwriteState, loadState } from "../server/vercel-store.js";

const dir = path.resolve(process.cwd(), "server/data");
const dbFile = path.join(dir, "db.json");
const delFile = path.join(dir, "deleted-accounts.json");

if (!fs.existsSync(dbFile)) {
  console.error(`No ${dbFile} found - nothing to upload.`);
  process.exit(1);
}
const db = JSON.parse(fs.readFileSync(dbFile, "utf8"));
const deleted = fs.existsSync(delFile) ? JSON.parse(fs.readFileSync(delFile, "utf8")) : [];

const current = await loadState();
if (current.db.users.length && !process.argv.includes("--force")) {
  console.error(
    `The online database already has ${current.db.users.length} account(s) and ` +
      `${current.db.vehicles.length} vehicle(s).\nRun "npm run push-db -- --force" to replace them.`
  );
  process.exit(1);
}
await overwriteState(db, deleted);
console.log(
  `Uploaded ${db.users?.length ?? 0} account(s) and ${db.vehicles?.length ?? 0} vehicle(s) to Vercel.`
);
