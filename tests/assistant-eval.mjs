// Regression test for the ARGUS assistant.
//
//   node tests/assistant-eval.mjs --db path/to/db.json --user admin --password secret [--node ktn] [--ai] [--only name]
//
// - Works on a temporary COPY of the database (changes made by "confirm" steps are thrown away).
// - Uses the built-in assistant unless --ai is given (then GROQ_API_KEY etc. from the environment
//   are used, which spends free-tier quota).
// - The right answers are worked out here from the data itself (not by the assistant's own tools).
// - Exit code 1 when anything fails.
import { spawn } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { applyCriteria } from "../shared/criteria.js";
import { deployability } from "../shared/deployability.js";
import { eventsByVehicleOn } from "../shared/schedule.js";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);
const dbPath = arg("db");
if (!dbPath) {
  console.error("Usage: node tests/assistant-eval.mjs --db <db.json> --user <admin> --password <pw> [--node ktn] [--ai] [--only name]");
  process.exit(2);
}
const node = arg("node", "ktn");
const only = arg("only");
const port = 5900 + Math.floor(Math.random() * 90);

// ---- a server on a throw-away copy
const dir = mkdtempSync(join(tmpdir(), "argus-eval-"));
const copy = join(dir, "db.json");
copyFileSync(dbPath, copy);
const env = { ...process.env, PORT: String(port), FLEET_DB: copy, NO_PROXY: "*" };
if (!flag("ai")) Object.assign(env, { GROQ_API_KEY: "", AI_API_KEY: "", ANTHROPIC_API_KEY: "" });
const app = spawn("node", [join(here, "../server/index.js")], { cwd: dir, env, stdio: "ignore" });
const stop = (code) => {
  app.kill();
  rmSync(dir, { recursive: true, force: true });
  process.exit(code);
};
setTimeout(() => {
  console.error("Timed out.");
  stop(2);
}, 10 * 60_000);

const base = `http://127.0.0.1:${port}/api`;
const H = (t) => ({ "content-type": "application/json", "x-fleet-node": node, ...(t ? { authorization: `Bearer ${t}` } : {}) });
const call = async (method, path, token, body) => {
  const res = await fetch(base + path, { method, headers: H(token), body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
for (let i = 0; i < 40; i += 1) {
  try {
    await fetch(base + "/health");
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 250));
  }
}
const login = async (username, password) => (await call("POST", "/auth/login", null, { username, password })).data.token;
const admin = await login(arg("user", "admin"), arg("password", ""));
if (!admin) {
  console.error("Could not log in - check --user / --password / --node.");
  stop(2);
}
// a Fleet Commander for "as": "commander" cases (password reset on the COPY only)
let commander = null;
const users = (await call("GET", "/users", admin)).data.users ?? [];
const cmd = users.find((u) => u.role !== "admin");
if (cmd) {
  await call("PATCH", `/users/${cmd.id}`, admin, { password: "eval-pass-1" });
  commander = await login(cmd.username, "eval-pass-1");
}

// ---- the truth, worked out independently
const truthData = async () => {
  const all = (await call("GET", "/bootstrap", admin)).data;
  applyCriteria(all.criteria);
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10); // Singapore day
  const ev = eventsByVehicleOn(all.events ?? [], today);
  return all.vehicles.map((v) => ({ ...v, status: deployability(v, all.disregards ?? {}, ev.get(v.id) ?? []).status }));
};
const compact = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
const typeHas = (type, part) => {
  // the part must start where a word of the type starts ("MB" is not inside "AMB")
  const c = compact(type);
  const p = compact(part);
  let at = 0;
  const starts = new Set();
  for (const w of String(type).toUpperCase().match(/[A-Z]+|\d+/g) ?? []) {
    starts.add(at);
    at += w.length;
  }
  for (let i = c.indexOf(p); i >= 0; i = c.indexOf(p, i + 1)) if (starts.has(i)) return true;
  return false;
};
let vehicles = await truthData();
const types = [...new Set(vehicles.map((v) => v.type))];
const byCount = types.map((t) => [t, vehicles.filter((v) => v.type === t).length]).sort((a, b) => b[1] - a[1]);
const fills = {
  MID1: vehicles[0]?.mid,
  MID2: vehicles[1]?.mid,
  MID3: vehicles[2]?.mid,
  DOWN_MID: vehicles.find((v) => v.status === "no")?.mid ?? vehicles[0]?.mid,
  TYPE: byCount[0]?.[0],
};
const fill = (x) =>
  typeof x === "string"
    ? x.replace(/\{(\w+)\}/g, (m, k) => fills[k] ?? m)
    : Array.isArray(x)
      ? x.map(fill)
      : x && typeof x === "object"
        ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, fill(v)]))
        : x;
const countOf = ({ type, status }) => vehicles.filter((v) => (!type || typeHas(v.type, type)) && (!status || v.status === status)).length;
const hasNumber = (reply, n) => new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(reply);

// ---- run
const { cases } = JSON.parse(readFileSync(join(here, "assistant-questions.json"), "utf8"));
let pass = 0;
let fail = 0;
let skip = 0;
for (const c of cases) {
  if (only && !c.name.includes(only)) continue;
  if (c.requires && !types.some((t) => typeHas(t, c.requires))) {
    skip += 1;
    console.log(`- skip  ${c.name} (no ${c.requires} vehicles)`);
    continue;
  }
  const token = c.as === "commander" ? commander : admin;
  if (!token) {
    skip += 1;
    console.log(`- skip  ${c.name} (no commander account)`);
    continue;
  }
  const messages = [];
  let context = null;
  for (const step of c.steps) {
    const ask = fill(step.ask);
    messages.push({ role: "user", content: ask });
    const r = await call("POST", "/assistant/chat", token, { messages, context });
    const reply = String(r.data.reply ?? r.data.error ?? "");
    const cards = r.data.actions ?? [];
    messages.push({ role: "assistant", content: reply });
    if (r.data.context) context = r.data.context;
    const e = fill(step.expect ?? {});
    const problems = [];
    if (r.status !== 200) problems.push(`HTTP ${r.status}`);
    for (const x of e.replyHas ?? []) if (!reply.toLowerCase().includes(String(x).toLowerCase())) problems.push(`reply lacks "${x}"`);
    for (const x of e.replyLacks ?? []) if (reply.toLowerCase().includes(String(x).toLowerCase())) problems.push(`reply has "${x}"`);
    if (typeof e.cards === "number" && cards.length !== e.cards) problems.push(`${cards.length} cards, expected ${e.cards}`);
    if (e.cards && typeof e.cards === "object" && (cards.length < (e.cards.min ?? 0) || cards.length > (e.cards.max ?? 1e9))) {
      problems.push(`${cards.length} cards, expected ${e.cards.min}-${e.cards.max}`);
    }
    for (const x of e.cardsHave ?? []) if (!cards.some((a) => a.title.includes(x))) problems.push(`no card for "${x}"`);
    for (const x of e.cardsLack ?? []) if (cards.some((a) => a.title.includes(x))) problems.push(`a card for "${x}"`);
    if (e.count) {
      const n = countOf(e.count);
      if (!hasNumber(reply, n)) problems.push(`expected the number ${n}`);
    }
    if (e.listCount) {
      const n = countOf(e.listCount);
      if (!hasNumber(reply, n)) problems.push(`expected ${n} vehicles in the list`);
    }
    if (step.confirm) {
      for (const a of cards) {
        const s = await call(a.request.method, `${a.request.path}`, token, a.request.body);
        if (s.status !== 200) problems.push(`saving "${a.title}" failed (${s.status})`);
        messages.push({ role: "assistant", content: `(Saved: ${a.title}.)` });
      }
      vehicles = await truthData();
    }
    const ok = !problems.length;
    ok ? (pass += 1) : (fail += 1);
    console.log(`${ok ? "  ok  " : "  FAIL"} ${c.name}: "${ask}"${ok ? "" : `\n         ${problems.join("; ")}\n         reply: ${reply.replace(/\s+/g, " ").slice(0, 220)}`}`);
  }
}
console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped (${flag("ai") ? "AI" : "built-in"} assistant)`);
stop(fail ? 1 : 0);
