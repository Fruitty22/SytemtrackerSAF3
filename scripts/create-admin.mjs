// Force-create an Admin account (or reset an existing account's password and
// make it Admin) directly in the database. Nothing else is changed.
//
// Cloud database (Supabase), Windows PowerShell:
//   $env:SUPABASE_URL="https://xxxx.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
//   node scripts/create-admin.mjs <username> <password> "<Display Name>"
//
// Without SUPABASE_URL it changes the local server/data/db.json instead.
import path from "node:path";
import crypto from "node:crypto";
import { fileStore, supabaseStore } from "../server/store.js";
import { hashPassword } from "../server/auth.js";

const [usernameArg, password, nameArg] = process.argv.slice(2);
const username = String(usernameArg ?? "").trim().toLowerCase();
if (!/^[a-z0-9._-]{2,32}$/.test(username) || !password) {
  console.error('Usage: node scripts/create-admin.mjs <username> <password> "<Display Name>"');
  console.error("Username: 2-32 letters, numbers, dot, dash or underscore. Password: at least 6 characters.");
  process.exit(1);
}
if (password.length < 6) {
  console.error("The password must be at least 6 characters.");
  process.exit(1);
}
const name = String(nameArg ?? username).trim().slice(0, 60);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const store =
  url && key ? supabaseStore({ url, key }) : fileStore(path.resolve(process.env.FLEET_DB || "server/data/db.json"));
console.log(url && key ? `Using the cloud database at ${url}` : "Using the local server/data/db.json");

for (let attempt = 1; attempt <= 5; attempt += 1) {
  const { data, version } = await store.load();
  const existing = data.users.find((u) => u.username === username);
  let action;
  if (existing) {
    Object.assign(existing, { role: "admin", ...hashPassword(password) });
    if (nameArg) existing.name = name;
    action = `Reset the password of "${username}" and made it Admin`;
  } else {
    const clash = data.users.find((u) => u.name.toLowerCase() === name.toLowerCase());
    data.users.push({
      id: crypto.randomUUID(),
      username,
      name: clash ? `${name} (admin)` : name,
      role: "admin",
      sheets: [],
      ...hashPassword(password),
      createdAt: new Date().toISOString(),
    });
    action = `Created the Admin account "${username}"`;
  }
  // log that account out everywhere, so the new password is the only way in
  const user = data.users.find((u) => u.username === username);
  data.sessions = (data.sessions ?? []).filter((s) => s.userId !== user.id);

  if (await store.save(data, version)) {
    console.log(`${action}. Log in with username "${username}" and your password.`);
    console.log(`Accounts now: ${data.users.map((u) => `${u.username} (${u.role})`).join(", ")}`);
    process.exit(0);
  }
}
console.error("Someone was saving at the same moment 5 times in a row - run it again.");
process.exit(1);
