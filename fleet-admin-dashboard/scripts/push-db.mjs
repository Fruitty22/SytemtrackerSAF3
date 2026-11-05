// Copy your local database (server/data/db.json) into Supabase - run once when
// you move to the cloud, so you keep your accounts, vehicles and bookings.
//
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... npm run db:push
//
// (Windows PowerShell: $env:SUPABASE_URL="..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."; npm run db:push)
// It refuses to overwrite a cloud database that already has data, unless you add --force.
import fs from "node:fs";
import path from "node:path";
import { supabaseStore, emptyDb } from "../server/store.js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first (Supabase -> Project Settings -> API).");
  process.exit(1);
}
const dir = path.resolve("server/data");
const file = path.join(dir, "db.json");
if (!fs.existsSync(file)) {
  console.error(`No local database at ${file}.`);
  process.exit(1);
}
const local = { ...emptyDb(), ...JSON.parse(fs.readFileSync(file, "utf8")) };
const oldDeleted = path.join(dir, "deleted-accounts.json");
if (fs.existsSync(oldDeleted) && !local.deletedAccounts?.length) {
  const list = JSON.parse(fs.readFileSync(oldDeleted, "utf8"));
  if (Array.isArray(list)) local.deletedAccounts = list;
}

const store = supabaseStore({ url, key });
const { data, version } = await store.load();
const hasData = data.users.length > 0 || data.vehicles.length > 0;
if (hasData && !process.argv.includes("--force")) {
  console.error(`The cloud database already has ${data.users.length} account(s) and ${data.vehicles.length} vehicle(s). Add --force to replace them.`);
  process.exit(1);
}
local.sessions = []; // everyone logs in again on the new site
if (!(await store.save(local, version))) {
  console.error("Someone saved to the cloud database at the same moment - run it again.");
  process.exit(1);
}
console.log(`Done: ${local.users.length} account(s), ${local.vehicles.length} vehicle(s), ${local.events?.length ?? 0} booking(s) copied to Supabase.`);
