// The fleet API: accounts, sign up / log in, and vehicles.
//
// createApi() returns a plain Node request handler (req, res, next). It is
// used in two places:
//   - inside the Vite dev server (see vite.config.js), for `npm run dev`
//   - by server/index.js, for `npm start` after `npm run build`
// Only Node's built-in modules are used, so there is nothing extra to install.
import path from "node:path";
import crypto from "node:crypto";
import { openDb, openJsonList } from "./db.js";
import { hashPassword, verifyPassword, newToken, hashToken } from "./auth.js";
import {
  ROLES,
  UNASSIGNED,
  BLOCK_FIELDS,
  MAINTENANCE_FIELDS,
  MAINTENANCE_LEVELS,
  DEFAULT_DISREGARDS,
  GENERAL_SHEETS,
} from "../shared/config.js";
import { sheetKey, nameInSheet } from "../shared/naming.js";

const SESSION_HOURS = 12;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 20000;
const LOGIN_MAX_FAILS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();
const text = (value, max = 200) =>
  (value == null ? "" : String(value)).trim().slice(0, max);

// ---------------------------------------------------------------- validation

const USERNAME_RE = /^[a-z0-9._-]{2,32}$/;

function cleanUsername(value) {
  const username = text(value, 64).toLowerCase();
  if (!USERNAME_RE.test(username)) {
    fail(400, "Username must be 2-32 characters: letters, numbers, dot, dash or underscore.");
  }
  return username;
}

function cleanName(value) {
  const name = text(value, 60);
  if (name.length < 2) fail(400, "Please enter a display name (for example 3SG Rizq).");
  return name;
}

function cleanPassword(value) {
  const password = value == null ? "" : String(value);
  if (password.length < 6) fail(400, "Password must be at least 6 characters.");
  if (password.length > 200) fail(400, "Password is too long.");
  return password;
}

function cleanRole(value) {
  if (!Object.hasOwn(ROLES, value)) fail(400, "Unknown role.");
  return value;
}

// Whole-fleet sheets (Dashboard, MID Details...) never belong to an account
const isGeneralSheet = (name) => GENERAL_SHEETS.some((g) => sheetKey(g) === sheetKey(name));

// Excel worksheet names linked to an account (used to auto-assign on import)
function cleanSheets(value) {
  const list = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(list.map((s) => text(s, 31)).filter((s) => s && !isGeneralSheet(s)))].slice(0, 20);
}

const cleanMid = (value) => {
  const mid = text(value, 40).toUpperCase();
  if (!mid) fail(400, "MID number is required.");
  return mid;
};

const cleanType = (value) => {
  const type = text(value, 60).toUpperCase();
  if (!type) fail(400, "Vehicle type is required.");
  return type;
};

const BLOCK_FIELD_NAMES = BLOCK_FIELDS.map((f) => f.name);
const ALL_FIELD_NAMES = [...BLOCK_FIELD_NAMES, ...MAINTENANCE_FIELDS];

// "UNASSIGNED", "", null -> null (nobody manages it yet)
const ownerValue = (value) => (value === UNASSIGNED || value == null || value === "" ? null : value);

// ---------------------------------------------------------------- http helpers

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(json);
}

function parseBody(buffer) {
  if (buffer.length > MAX_BODY_BYTES) throw new HttpError(413, "That request is too large.");
  if (buffer.length === 0) return {};
  try {
    const body = JSON.parse(buffer.toString("utf8"));
    return body && typeof body === "object" ? body : {};
  } catch {
    throw new HttpError(400, "Invalid JSON in request.");
  }
}

function readBody(req) {
  // on Vercel the body has already been read into req.rawBody
  if (Buffer.isBuffer(req.rawBody)) return Promise.resolve().then(() => parseBody(req.rawBody));
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) tooBig = true;
      else chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooBig) return reject(new HttpError(413, "That request is too large."));
      if (chunks.length === 0) return resolve({});
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve(body && typeof body === "object" ? body : {});
      } catch {
        reject(new HttpError(400, "Invalid JSON in request."));
      }
    });
    req.on("error", reject);
  });
}

function route(method, pattern, auth, handler) {
  const keys = [];
  const source = pattern.replace(/:(\w+)/g, (_, key) => {
    keys.push(key);
    return "([^/]+)";
  });
  return { method, re: new RegExp(`^${source}/?$`), keys, auth, handler };
}

// ---------------------------------------------------------------- the API

export function createApi({
  dbFile = process.env.FLEET_DB || path.resolve(process.cwd(), "server/data/db.json"),
  // store: { db: { data, save }, deleted: { items, save } } - used on Vercel,
  // where the data lives in Redis instead of a file (see server/vercel-store.js)
  store = null,
  loginFails = new Map(), // "ip|username" -> { count, first }
} = {}) {
  const db = store ? store.db : openDb(dbFile);
  const D = db.data;
  // every deleted account is kept here (same fields as in db.json, plus who
  // deleted it and when), so an admin can look it up or restore it
  const deleted = store
    ? store.deleted
    : openJsonList(path.join(path.dirname(dbFile), "deleted-accounts.json"));

  // Disregards (fields ignored per vehicle type). Types listed in config.js
  // DEFAULT_DISREGARDS are added if the database doesn't have them yet; a type
  // someone has already set (even to "nothing ignored") is left alone.
  D.disregards ??= {};
  D.disregardsUpdated ??= {};
  let addedDefaults = false;
  for (const [type, fields] of Object.entries(DEFAULT_DISREGARDS)) {
    if (!(type in D.disregards)) {
      D.disregards[type] = [...fields];
      addedDefaults = true;
    }
  }
  if (addedDefaults) db.save();

  // whole-fleet sheets can't be linked to an account (an older import did that)
  let cleaned = false;
  for (const u of D.users) {
    const kept = (u.sheets ?? []).filter((s) => !isGeneralSheet(s));
    if (kept.length !== (u.sheets ?? []).length) {
      u.sheets = kept;
      cleaned = true;
    }
  }
  const claimable = (D.sheets ?? []).filter((s) => !isGeneralSheet(s.name));
  if (claimable.length !== (D.sheets ?? []).length) {
    D.sheets = claimable;
    cleaned = true;
  }
  if (cleaned) db.save();

  // drop sessions that expired while the server was off
  const live = D.sessions.filter((s) => Date.parse(s.expiresAt) > Date.now());
  if (live.length !== D.sessions.length) {
    D.sessions = live;
    db.save();
  }

  // ---- lookups and output shapes

  const findUser = (id) => D.users.find((u) => u.id === id);
  const findUserByUsername = (username) =>
    D.users.find((u) => u.username === String(username).trim().toLowerCase());
  const usernameTaken = (username, exceptId) =>
    D.users.some((u) => u.id !== exceptId && u.username === username);
  const nameTaken = (name, exceptId) =>
    D.users.some((u) => u.id !== exceptId && u.name.toLowerCase() === name.toLowerCase());
  const adminCount = () => D.users.filter((u) => u.role === "admin").length;

  const publicUser = (u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    roleLabel: ROLES[u.role] ?? u.role,
    sheets: u.sheets ?? [],
    createdAt: u.createdAt,
  });

  // ---- worksheets and who manages which vehicle
  //
  // Each vehicle has ONE owner (ownerId, or null = Unassigned) and remembers the
  // sheet it was imported from (sourceSheet). Several accounts can link the same
  // sheet; when the owner is one of them, ALL of them manage the vehicle.
  // So "3SG Chong" and "3SG Jungwoo" can share "3SG Chong_3SG Kim Jungwoo".
  const linksSheet = (u, sheet) => (u?.sheets ?? []).some((s) => sheetKey(s) === sheetKey(sheet));
  const sheetUsers = (sheet) => D.users.filter((u) => linksSheet(u, sheet));

  function managerIds(v) {
    const owner = v.ownerId ? findUser(v.ownerId) : null;
    if (!owner) return [];
    if (v.sourceSheet && linksSheet(owner, v.sourceSheet)) {
      return [owner.id, ...sheetUsers(v.sourceSheet).filter((u) => u.id !== owner.id).map((u) => u.id)];
    }
    return [owner.id];
  }
  const vehicleCount = (userId) => D.vehicles.filter((v) => managerIds(v).includes(userId)).length;
  const ownedCount = (userId) => D.vehicles.filter((v) => v.ownerId === userId).length;

  // Give `target` the vehicles that came from these sheets, unless they're
  // already with someone who manages that sheet.
  // fromAdminsOnly: also leave vehicles an Admin gave to another commander.
  function moveSheetVehicles(target, sheets, actor, { fromAdminsOnly }) {
    const keys = new Set(sheets.map(sheetKey));
    let moved = 0;
    D.vehicles = D.vehicles.map((v) => {
      if (!v.sourceSheet || !keys.has(sheetKey(v.sourceSheet)) || v.ownerId === target.id) return v;
      const owner = v.ownerId ? findUser(v.ownerId) : null;
      if (owner && linksSheet(owner, v.sourceSheet)) return v; // already with a manager of this sheet
      if (fromAdminsOnly && owner && owner.role !== "admin") return v;
      moved += 1;
      return { ...v, ownerId: target.id, updatedAt: now(), updatedBy: actor.name };
    });
    return moved;
  }

  // `user` no longer has `sheet`: the vehicles they owned from it go to someone
  // still on that sheet, or become Unassigned
  function releaseSheet(user, sheet) {
    const heir = sheetUsers(sheet).find((u) => u.id !== user.id) ?? null;
    let moved = 0;
    for (const v of D.vehicles) {
      if (v.ownerId === user.id && v.sourceSheet && sheetKey(v.sourceSheet) === sheetKey(sheet)) {
        v.ownerId = heir?.id ?? null;
        moved += 1;
      }
    }
    return moved;
  }

  const vehicleOut = (v) => {
    const ids = managerIds(v);
    return {
      ...v,
      managerIds: ids,
      ownerName: ids.length ? ids.map((id) => findUser(id).name).join(" & ") : "Unassigned",
    };
  };

  // ---- sessions

  function startSession(user) {
    const token = newToken();
    D.sessions = D.sessions.filter((s) => Date.parse(s.expiresAt) > Date.now());
    D.sessions.push({
      tokenHash: hashToken(token),
      userId: user.id,
      createdAt: now(),
      expiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString(),
    });
    return token;
  }

  function sessionFor(req) {
    const header = req.headers.authorization || "";
    const match = /^Bearer\s+([a-f0-9]{64})$/i.exec(header);
    if (!match) return null;
    const tokenHash = hashToken(match[1]);
    const session = D.sessions.find((s) => s.tokenHash === tokenHash);
    if (!session || Date.parse(session.expiresAt) <= Date.now()) return null;
    const user = findUser(session.userId);
    return user ? { session, user } : null;
  }

  // ---- login throttling (per IP + username)

  const throttleKey = (ip, username) => `${ip}|${String(username).toLowerCase()}`;
  function checkThrottle(key) {
    const entry = loginFails.get(key);
    if (!entry) return;
    if (Date.now() - entry.first > LOGIN_WINDOW_MS) loginFails.delete(key);
    else if (entry.count >= LOGIN_MAX_FAILS) {
      fail(429, "Too many failed log-in attempts. Please wait 15 minutes and try again.");
    }
  }
  function recordFail(key) {
    const entry = loginFails.get(key);
    if (!entry || Date.now() - entry.first > LOGIN_WINDOW_MS) {
      loginFails.set(key, { count: 1, first: Date.now() });
    } else entry.count += 1;
  }

  // ---- vehicles

  function canSeeVehicle(user, v) {
    return user.role === "admin" || managerIds(v).includes(user.id);
  }

  function getVehicleFor(user, id) {
    const v = D.vehicles.find((x) => x.id === id);
    if (!v || !canSeeVehicle(user, v)) fail(404, "Vehicle not found.");
    return v;
  }

  function ensureMidFree(mid, exceptId) {
    const clash = D.vehicles.find((v) => v.id !== exceptId && v.mid === mid);
    if (clash) fail(409, `MID ${mid} already exists (${clash.type}).`);
  }

  // Validates `body` and applies it to a COPY of the vehicle. Nothing in the
  // database changes unless every field is valid.
  function patchedVehicle(original, body, user) {
    const v = structuredClone(original);

    if ("mid" in body) {
      v.mid = cleanMid(body.mid);
      ensureMidFree(v.mid, v.id);
    }
    if ("type" in body) v.type = cleanType(body.type);
    if ("statusRemark" in body) v.statusRemark = text(body.statusRemark, 500);
    if ("remarks" in body) v.remarks = text(body.remarks, 1000);

    if ("ownerId" in body) {
      const next = ownerValue(body.ownerId);
      if (next !== (v.ownerId ?? null)) {
        if (user.role !== "admin") fail(403, "Only an administrator can change who manages a vehicle.");
        if (next && !findUser(next)) fail(400, "That account doesn't exist.");
        v.ownerId = next;
      }
    }

    if ("maintenance" in body) {
      const changes = body.maintenance;
      if (!changes || typeof changes !== "object") fail(400, "Invalid maintenance data.");
      v.maintenance = { ...(v.maintenance ?? {}) };
      for (const [field, entry] of Object.entries(changes)) {
        if (!MAINTENANCE_FIELDS.includes(field)) fail(400, `Unknown maintenance field: ${field}.`);
        if (entry === null || entry?.level === "") {
          delete v.maintenance[field];
          continue;
        }
        const level = entry?.level;
        if (!MAINTENANCE_LEVELS.some((l) => l.value === level)) {
          fail(400, `Unknown maintenance level for ${field}.`);
        }
        v.maintenance[field] = {
          level,
          remark: text(entry.remark, 500),
          updatedAt: now(),
          updatedBy: user.name,
        };
      }
    }

    // blocked-style fields this ONE vehicle ignores (not counted for AVA),
    // separate from the per-type disregards: ["VOR STATUS", ...]
    if ("ignoredBlocks" in body) {
      const list = Array.isArray(body.ignoredBlocks) ? body.ignoredBlocks : fail(400, "Invalid ignored fields.");
      for (const field of list) {
        if (!BLOCK_FIELD_NAMES.includes(field)) fail(400, `Unknown blocked field: ${field}.`);
      }
      v.ignoredBlocks = [...new Set(list)];
    }

    // blocked-style fields: { "OVERSEAS": { value: "EX WALLABY" }, "TASKING": null }
    if ("blocks" in body) {
      const changes = body.blocks;
      if (!changes || typeof changes !== "object") fail(400, "Invalid blocked-field data.");
      v.blocks = { ...(v.blocks ?? {}) };
      for (const [field, entry] of Object.entries(changes)) {
        if (!BLOCK_FIELD_NAMES.includes(field)) fail(400, `Unknown blocked field: ${field}.`);
        const value = entry === null ? "" : text(entry?.value, 100);
        if (!value) {
          delete v.blocks[field];
          continue;
        }
        v.blocks[field] = { value, updatedAt: now(), updatedBy: user.name };
      }
    }

    v.updatedAt = now();
    v.updatedBy = user.name;
    return v;
  }

  function newVehicle(body, user) {
    let ownerId = user.id;
    if (user.role === "admin" && "ownerId" in body) ownerId = ownerValue(body.ownerId);
    if (ownerId && !findUser(ownerId)) fail(400, "That account doesn't exist.");
    const base = {
      id: newId(),
      mid: "",
      type: "",
      statusRemark: "",
      remarks: "",
      maintenance: {},
      blocks: {},
      ignoredBlocks: [],
      ownerId,
      sourceSheet: null,
      createdAt: now(),
    };
    // mid and type are required on create
    return patchedVehicle(base, { ...body, mid: body.mid, type: body.type, ownerId }, {
      ...user,
      role: "admin", // owner was already checked above
    });
  }

  // ---- handlers

  const routes = [
    // ---------------- auth
    route("GET", "/api/auth/status", "public", () => ({ hasUsers: D.users.length > 0 })),

    route("POST", "/api/auth/signup", "public", ({ body }) => {
      const username = cleanUsername(body.username);
      const name = cleanName(body.name);
      const password = cleanPassword(body.password);
      if (findUserByUsername(username)) fail(409, "That username is already taken.");
      if (nameTaken(name)) fail(409, "An account with that display name already exists.");

      const user = {
        id: newId(),
        username,
        name,
        role: D.users.length === 0 ? "admin" : "commander",
        ...hashPassword(password),
        createdAt: now(),
      };
      D.users.push(user);
      const token = startSession(user);
      db.save();
      return { token, user: publicUser(user) };
    }),

    route("POST", "/api/auth/login", "public", ({ body, ip }) => {
      const key = throttleKey(ip, body.username ?? "");
      checkThrottle(key);
      const user = findUserByUsername(body.username ?? "");
      if (!user || !verifyPassword(body.password ?? "", user)) {
        recordFail(key);
        fail(401, "Invalid username or password.");
      }
      loginFails.delete(key);
      const token = startSession(user);
      db.save();
      return { token, user: publicUser(user) };
    }),

    route("POST", "/api/auth/logout", "user", ({ session }) => {
      D.sessions = D.sessions.filter((s) => s !== session);
      db.save();
      return { ok: true };
    }),

    route("GET", "/api/auth/me", "user", ({ user }) => ({ user: publicUser(user) })),

    // Change your own username and/or display name
    route("PATCH", "/api/auth/me", "user", ({ user, body }) => {
      const changes = {};
      if ("username" in body) {
        changes.username = cleanUsername(body.username);
        if (usernameTaken(changes.username, user.id)) fail(409, "That username is already taken.");
      }
      if ("name" in body) {
        changes.name = cleanName(body.name);
        if (nameTaken(changes.name, user.id)) {
          fail(409, "An account with that display name already exists.");
        }
      }
      Object.assign(user, changes);
      db.save();
      return { user: publicUser(user) };
    }),

    route("POST", "/api/auth/password", "user", ({ user, session, body }) => {
      if (!verifyPassword(body.currentPassword ?? "", user)) {
        fail(400, "Your current password is not correct.");
      }
      Object.assign(user, hashPassword(cleanPassword(body.newPassword)));
      // log out this account everywhere else
      D.sessions = D.sessions.filter((s) => s.userId !== user.id || s === session);
      db.save();
      return { ok: true };
    }),

    // ---------------- accounts (admin only)
    route("GET", "/api/users", "admin", () => ({
      users: D.users.map((u) => ({ ...publicUser(u), vehicleCount: vehicleCount(u.id) })),
    })),

    route("POST", "/api/users", "admin", ({ body }) => {
      const username = cleanUsername(body.username);
      const name = cleanName(body.name);
      const password = cleanPassword(body.password);
      const role = cleanRole(body.role ?? "commander");
      if (findUserByUsername(username)) fail(409, "That username is already taken.");
      if (nameTaken(name)) fail(409, "An account with that display name already exists.");
      const user = {
        id: newId(),
        username,
        name,
        role,
        sheets: cleanSheets(body.sheets),
        ...hashPassword(password),
        createdAt: now(),
      };
      D.users.push(user);
      db.save();
      return { user: { ...publicUser(user), vehicleCount: 0 } };
    }),

    route("PATCH", "/api/users/:id", "admin", ({ params, body, user: me }) => {
      const target = findUser(params.id);
      if (!target) fail(404, "Account not found.");
      const changes = {};
      if ("username" in body) {
        changes.username = cleanUsername(body.username);
        if (usernameTaken(changes.username, target.id)) fail(409, "That username is already taken.");
      }
      if ("name" in body) {
        changes.name = cleanName(body.name);
        if (nameTaken(changes.name, target.id)) {
          fail(409, "An account with that display name already exists.");
        }
      }
      let addedSheets = [];
      let removedSheets = [];
      if ("sheets" in body) {
        changes.sheets = cleanSheets(body.sheets);
        const before = new Set((target.sheets ?? []).map(sheetKey));
        const after = new Set(changes.sheets.map(sheetKey));
        addedSheets = changes.sheets.filter((sheet) => !before.has(sheetKey(sheet)));
        removedSheets = (target.sheets ?? []).filter((sheet) => !after.has(sheetKey(sheet)));
      }
      if ("role" in body && body.role !== target.role) {
        changes.role = cleanRole(body.role);
        if (target.id === me.id) fail(400, "You can't change your own role.");
        if (target.role === "admin" && adminCount() <= 1) {
          fail(400, "There must always be at least one administrator.");
        }
      }
      if (body.password) Object.assign(changes, hashPassword(cleanPassword(body.password)));

      Object.assign(target, changes);
      let moved = 0;
      // sheets taken off: their vehicles go to whoever still has the sheet, or Unassigned
      for (const sheet of removedSheets) releaseSheet(target, sheet);
      if (addedSheets.length) {
        // bring the sheet's vehicles unless they're already with someone sharing it
        moved = moveSheetVehicles(target, addedSheets, me, { fromAdminsOnly: false });
      }
      if (changes.passwordHash && target.id !== me.id) {
        D.sessions = D.sessions.filter((s) => s.userId !== target.id);
      }
      db.save();
      return { user: { ...publicUser(target), vehicleCount: vehicleCount(target.id) }, moved };
    }),

    route("DELETE", "/api/users/:id", "admin", ({ params, query, user: me }) => {
      const target = findUser(params.id);
      if (!target) fail(404, "Account not found.");
      if (target.id === me.id) fail(400, "You can't delete your own account.");
      if (target.role === "admin" && adminCount() <= 1) {
        fail(400, "There must always be at least one administrator.");
      }
      const owned = ownedCount(target.id);
      const reassignRaw = query.get("reassignTo");
      const reassignTo = ownerValue(reassignRaw);
      if (owned > 0) {
        if (!reassignRaw) {
          fail(409, `This account still manages ${owned} vehicle(s). Choose who should take them over.`);
        }
        if (reassignTo === target.id || (reassignTo && !findUser(reassignTo))) {
          fail(400, "Choose another account to take over the vehicles.");
        }
        for (const v of D.vehicles) if (v.ownerId === target.id) v.ownerId = reassignTo;
      }
      // archive first, so the account is never lost if a save fails half-way
      deleted.items.push({
        ...target,
        deletedAt: now(),
        deletedBy: me.name,
        vehiclesMoved: owned,
        vehiclesMovedTo: owned ? (reassignTo ? findUser(reassignTo).name : "Unassigned") : null,
      });
      deleted.save();
      D.users = D.users.filter((u) => u.id !== target.id);
      D.sessions = D.sessions.filter((s) => s.userId !== target.id);
      db.save();
      return { ok: true, moved: owned };
    }),

    // ---------------- deleted accounts (admin only)
    route("GET", "/api/users/deleted", "admin", () => ({
      users: deleted.items
        .map((u) => ({
          ...publicUser(u),
          deletedAt: u.deletedAt,
          deletedBy: u.deletedBy,
          vehiclesMoved: u.vehiclesMoved ?? 0,
          vehiclesMovedTo: u.vehiclesMovedTo ?? null,
        }))
        .sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt))),
    })),

    // Bring a deleted account back with its old password (vehicles stay where they were moved)
    route("POST", "/api/users/deleted/:id/restore", "admin", ({ params }) => {
      const record = deleted.items.find((u) => u.id === params.id);
      if (!record) fail(404, "That deleted account isn't in the archive.");
      if (findUser(record.id)) fail(409, "That account already exists.");
      if (findUserByUsername(record.username)) {
        fail(409, `The username "${record.username}" has been taken by another account.`);
      }
      if (nameTaken(record.name)) fail(409, `The name "${record.name}" is now used by another account.`);
      const { deletedAt, deletedBy, vehiclesMoved, vehiclesMovedTo, ...user } = record;
      D.users.push(user);
      db.save();
      deleted.items = deleted.items.filter((u) => u !== record);
      deleted.save();
      return { user: { ...publicUser(user), vehicleCount: 0 } };
    }),

    // Remove an account from the archive for good
    route("DELETE", "/api/users/deleted/:id", "admin", ({ params }) => {
      const before = deleted.items.length;
      deleted.items = deleted.items.filter((u) => u.id !== params.id);
      if (deleted.items.length === before) fail(404, "That deleted account isn't in the archive.");
      deleted.save();
      return { ok: true };
    }),

    // ---------------- worksheets (from the last import)
    route("GET", "/api/sheets", "user", ({ user }) => ({
      sheets: (D.sheets ?? []).map((s) => {
        const linked = sheetUsers(s.name);
        const mine = linked.some((u) => u.id === user.id);
        return {
          name: s.name,
          vehicles: s.vehicles,
          claimedBy: linked.length ? linked.map((u) => u.name).join(" & ") : null,
          mine,
          // you can join a sheet someone else has if your name is in the sheet name
          canJoin: !mine && linked.length > 0 && nameInSheet(user.name, s.name),
        };
      }),
    })),

    // "This sheet is mine": link it to your account and take its vehicles.
    // A sheet someone already has can be shared if your name is in the sheet
    // name ("3SG Jungwoo" can join "3SG Chong_3SG Kim Jungwoo"); otherwise an
    // Admin has to add you on the Accounts page.
    route("POST", "/api/sheets/claim", "user", ({ user, body }) => {
      const sheet = (D.sheets ?? []).find((s) => sheetKey(s.name) === sheetKey(body.sheet));
      if (!sheet) fail(404, "That worksheet isn't in the last import. Ask an Admin to import the workbook again.");
      const others = sheetUsers(sheet.name).filter((u) => u.id !== user.id);
      if (others.length && !linksSheet(user, sheet.name) && !nameInSheet(user.name, sheet.name)) {
        fail(
          409,
          `"${sheet.name}" is already linked to ${others.map((u) => u.name).join(" & ")}. Ask an Admin to add you to it.`
        );
      }
      if (!linksSheet(user, sheet.name)) user.sheets = cleanSheets([...(user.sheets ?? []), sheet.name]);
      const moved = moveSheetVehicles(user, [sheet.name], user, { fromAdminsOnly: true });
      db.save();
      return { user: publicUser(user), moved, shared: others.length > 0 };
    }),

    // Stop managing a sheet (its vehicles stay with whoever owns them)
    route("POST", "/api/sheets/leave", "user", ({ user, body }) => {
      if (!linksSheet(user, body.sheet)) fail(404, "That sheet isn't linked to your account.");
      user.sheets = (user.sheets ?? []).filter((s) => sheetKey(s) !== sheetKey(body.sheet));
      // vehicles you owned from that sheet go to someone still sharing it, or Unassigned
      releaseSheet(user, body.sheet);
      db.save();
      return { user: publicUser(user) };
    }),

    // ---------------- disregards: fields NOT counted for a vehicle type
    route("GET", "/api/disregards", "user", () => ({
      disregards: D.disregards,
      updated: D.disregardsUpdated,
    })),

    // Every account can change these (they apply to every vehicle of that type)
    route("PUT", "/api/disregards", "user", ({ body, user }) => {
      const type = cleanType(body.type);
      const ignored = Array.isArray(body.ignored) ? body.ignored : fail(400, "Send the list of ignored fields.");
      for (const field of ignored) {
        if (!ALL_FIELD_NAMES.includes(field)) fail(400, `Unknown field: ${field}.`);
      }
      D.disregards[type] = [...new Set(ignored)]; // [] = nothing ignored (kept, so defaults don't come back)
      D.disregardsUpdated[type] = { at: now(), by: user.name };
      db.save();
      return { disregards: D.disregards, updated: D.disregardsUpdated };
    }),

    // ---------------- vehicles
    route("GET", "/api/vehicles", "user", ({ user }) => ({
      vehicles: D.vehicles.filter((v) => canSeeVehicle(user, v)).map(vehicleOut),
    })),

    route("GET", "/api/vehicles/:id", "user", ({ user, params }) => ({
      vehicle: vehicleOut(getVehicleFor(user, params.id)),
    })),

    route("POST", "/api/vehicles", "user", ({ user, body }) => {
      const vehicle = newVehicle(body, user);
      D.vehicles.push(vehicle);
      db.save();
      return { vehicle: vehicleOut(vehicle) };
    }),

    route("PATCH", "/api/vehicles/:id", "user", ({ user, params, body }) => {
      const original = getVehicleFor(user, params.id);
      const updated = patchedVehicle(original, body, user);
      D.vehicles[D.vehicles.indexOf(original)] = updated;
      db.save();
      return { vehicle: vehicleOut(updated) };
    }),

    route("DELETE", "/api/vehicles/:id", "user", ({ user, params }) => {
      const v = getVehicleFor(user, params.id);
      D.vehicles = D.vehicles.filter((x) => x !== v);
      db.save();
      return { ok: true };
    }),

    // Bulk add/update from an Excel workbook (Admin only - the workbook is the
    // master list, commanders claim their sheet).
    // body: {
    //   rows: [{ mid, type, ownerId, sheet, line,
    //            maintenance?: { "MLC": "Y" | "N" | "" },
    //            blocks?:      { "OVERSEAS": "EX WALLABY" | "" } }],
    //   onDuplicate: "skip" | "owner" | "update",   what to do with MIDs that exist
    //   sheetLinks?: { [userId]: ["sheet name"] },   remember sheet -> account
    //   sheets?: [{ name, vehicles }]                 commanders' sheets in this workbook
    // }
    // ownerId "UNASSIGNED" = nobody yet. "update" also overwrites type and the
    // maintenance / blocked values from the workbook (blank cells clear them).
    route("POST", "/api/vehicles/import", "admin", ({ user, body }) => {
      const rows = Array.isArray(body.rows) ? body.rows : fail(400, "No rows to import.");
      if (rows.length > MAX_IMPORT_ROWS) fail(400, `Import at most ${MAX_IMPORT_ROWS} rows at a time.`);
      const mode = ["skip", "owner", "update"].includes(body.onDuplicate) ? body.onDuplicate : "skip";

      const result = { created: 0, updated: 0, unchanged: 0, skipped: 0, errors: [] };
      const byMid = new Map(D.vehicles.map((v) => [v.mid, v]));
      const addError = (line, message) => {
        if (result.errors.length < 50) result.errors.push(`${line}: ${message}`);
        else if (result.errors.length === 50) result.errors.push("...more errors not shown");
      };

      // workbook values -> patch, only for values that differ from `existing`
      const levelOf = (value) => {
        const level = text(value, 5).toUpperCase();
        return MAINTENANCE_LEVELS.some((l) => l.value === level) ? level : "";
      };
      function recordPatch(row, existing) {
        const patch = {};
        const maintenance = {};
        for (const [field, value] of Object.entries(row.maintenance ?? {})) {
          if (!MAINTENANCE_FIELDS.includes(field)) continue;
          const level = levelOf(value);
          if (level !== (existing?.maintenance?.[field]?.level ?? "")) {
            maintenance[field] = level ? { level, remark: "" } : null;
          }
        }
        const blocks = {};
        for (const [field, value] of Object.entries(row.blocks ?? {})) {
          if (!BLOCK_FIELD_NAMES.includes(field)) continue;
          const next = text(value, 100);
          if (next !== (existing?.blocks?.[field]?.value ?? "")) blocks[field] = next ? { value: next } : null;
        }
        if (Object.keys(maintenance).length) patch.maintenance = maintenance;
        if (Object.keys(blocks).length) patch.blocks = blocks;
        return patch;
      }

      rows.forEach((row, index) => {
        const line = text(row?.line, 80) || `Row ${index + 1}`;
        try {
          const mid = cleanMid(row?.mid);
          const ownerId = "ownerId" in (row ?? {}) ? ownerValue(row.ownerId) : user.id;
          if (ownerId && !findUser(ownerId)) fail(400, "The account it was assigned to doesn't exist.");
          const sheet = text(row.sheet, 31) || null;
          const existing = byMid.get(mid);

          if (!existing) {
            const created = newVehicle({ mid, type: row.type, ownerId, ...recordPatch(row, null) }, user);
            created.sourceSheet = sheet;
            D.vehicles.push(created);
            byMid.set(mid, created);
            result.created += 1;
            return;
          }

          if (mode === "skip") {
            result.skipped += 1;
            return;
          }
          const patch = {};
          if (ownerId !== (existing.ownerId ?? null)) patch.ownerId = ownerId ?? UNASSIGNED;
          if (mode === "update") {
            const type = text(row.type, 60).toUpperCase();
            if (type && type !== existing.type) patch.type = type;
            Object.assign(patch, recordPatch(row, existing));
          }
          const sheetChanged = sheet && existing.sourceSheet !== sheet;
          if (Object.keys(patch).length === 0 && !sheetChanged) {
            result.unchanged += 1;
            return;
          }
          const updated = patchedVehicle(existing, patch, user);
          if (sheet) updated.sourceSheet = sheet;
          D.vehicles[D.vehicles.indexOf(existing)] = updated;
          byMid.set(mid, updated);
          result.updated += 1;
        } catch (err) {
          if (!(err instanceof HttpError)) throw err;
          addError(line, err.message);
        }
      });

      // remember which worksheet belongs to which account, for next time
      let changedLinks = 0;
      if (body.sheetLinks && typeof body.sheetLinks === "object") {
        for (const [userId, sheets] of Object.entries(body.sheetLinks)) {
          const target = findUser(userId);
          if (!target) continue;
          const merged = cleanSheets([...(target.sheets ?? []), ...cleanSheets(sheets)]);
          if (merged.length !== (target.sheets ?? []).length) {
            target.sheets = merged;
            changedLinks += 1;
          }
        }
      }

      // the commanders' sheets in this workbook, so commanders can claim theirs
      if (Array.isArray(body.sheets)) {
        D.sheets = body.sheets
          .map((s) => ({ name: text(s?.name, 31), vehicles: Number(s?.vehicles) || 0 }))
          .filter((s) => s.name && !isGeneralSheet(s.name))
          .slice(0, 200);
        changedLinks += 1;
      }

      if (result.created || result.updated || changedLinks) db.save();
      return result;
    }),

    // Give several vehicles to one account (admin)
    // ownerId "UNASSIGNED" takes them off everyone
    route("POST", "/api/vehicles/assign", "admin", ({ user, body }) => {
      const ids = Array.isArray(body.ids) ? body.ids : fail(400, "No vehicles chosen.");
      const ownerId = ownerValue(body.ownerId);
      if (ownerId && !findUser(ownerId)) fail(400, "That account doesn't exist.");
      const wanted = new Set(ids);
      let moved = 0;
      D.vehicles = D.vehicles.map((v) => {
        if (!wanted.has(v.id) || (v.ownerId ?? null) === ownerId) return v;
        moved += 1;
        return patchedVehicle(v, { ownerId: ownerId ?? UNASSIGNED }, user);
      });
      if (moved) db.save();
      return { moved };
    }),

    // Delete several vehicles at once (only ones you're allowed to see)
    route("POST", "/api/vehicles/delete", "user", ({ user, body }) => {
      const ids = new Set(Array.isArray(body.ids) ? body.ids : []);
      const before = D.vehicles.length;
      D.vehicles = D.vehicles.filter((v) => !(ids.has(v.id) && canSeeVehicle(user, v)));
      const deletedCount = before - D.vehicles.length;
      if (deletedCount) db.save();
      return { deleted: deletedCount };
    }),
  ];

  // ---- the request handler

  return async function fleetApi(req, res, next) {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/")) {
      if (next) return next();
      return send(res, 404, { error: "Not found." });
    }

    try {
      let match = null;
      const r = routes.find((candidate) => {
        if (candidate.method !== req.method) return false;
        match = candidate.re.exec(url.pathname);
        return !!match;
      });
      if (!r) fail(404, "Not found.");

      const params = {};
      r.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(match[i + 1]);
      });

      const auth = r.auth === "public" ? null : sessionFor(req);
      if (r.auth !== "public" && !auth) fail(401, "Please log in again.");
      if (r.auth === "admin" && auth.user.role !== "admin") {
        fail(403, "Only an administrator can do that.");
      }

      const body = ["POST", "PATCH", "PUT", "DELETE"].includes(req.method)
        ? await readBody(req)
        : {};

      const result = await r.handler({
        req,
        params,
        query: url.searchParams,
        body,
        user: auth?.user,
        session: auth?.session,
        // Vercel puts the visitor's address in x-forwarded-for; elsewhere that
        // header could be faked, so it is only trusted on Vercel
        ip:
          (process.env.VERCEL &&
            String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim()) ||
          req.socket?.remoteAddress ||
          "",
      });
      send(res, 200, result);
    } catch (err) {
      if (err instanceof HttpError) send(res, err.status, { error: err.message });
      else {
        console.error("[fleet-api]", err);
        send(res, 500, { error: "Something went wrong on the server." });
      }
    }
  };
}
