// The fleet API: accounts, sign up / log in, and vehicles.
//
// createApi() returns a plain Node request handler (req, res, next). It is
// used in two places:
//   - inside the Vite dev server (see vite.config.js), for `npm run dev`
//   - by server/index.js, for `npm start` after `npm run build`
// Only Node's built-in modules are used, so there is nothing extra to install.
import crypto from "node:crypto";
import { createStore } from "./store.js";
import { hashPassword, verifyPassword, newToken, hashToken } from "./auth.js";
import {
  ROLES,
  UNASSIGNED,
  BLOCK_FIELDS,
  MAINTENANCE_FIELDS,
  MAINTENANCE_LEVELS,
  DEFAULT_DISREGARDS,
  GENERAL_SHEETS,
  SCHEDULE_KINDS,
} from "../shared/config.js";
import { sheetKey, nameInSheet } from "../shared/naming.js";
import { daysBetween, isIsoDate, isTime } from "../shared/schedule.js";
import { DEPLOYED_FIELDS } from "../shared/config.js";
import { applyCriteria, cleanCriteriaName, criteriaKey, DEFAULT_CRITERIA, CATEGORIES } from "../shared/criteria.js";
import { isCoreField } from "../shared/titles.js";
import { assistantRoutes } from "./assistant.js";

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

// The criteria can change (Criteria page / import), so these are worked out each time
const blockFieldNames = () => BLOCK_FIELDS.map((f) => f.name);
const allFieldNames = () => [...blockFieldNames(), ...MAINTENANCE_FIELDS];

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

function readBody(req) {
  // On Vercel the request arrives with its body already read (req.body)
  let preParsed;
  try {
    preParsed = req.body;
  } catch {
    return Promise.reject(new HttpError(400, "Invalid JSON in request."));
  }
  if (preParsed != null) {
    if (typeof preParsed === "string" || Buffer.isBuffer(preParsed)) {
      try {
        const body = JSON.parse(String(preParsed) || "{}");
        return Promise.resolve(body && typeof body === "object" ? body : {});
      } catch {
        return Promise.reject(new HttpError(400, "Invalid JSON in request."));
      }
    }
    return Promise.resolve(typeof preParsed === "object" ? preParsed : {});
  }
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

// options.snapshot: keep a copy of the database before this route changes it
function route(method, pattern, auth, handler, options = {}) {
  const keys = [];
  const source = pattern.replace(/:(\w+)/g, (_, key) => {
    keys.push(key);
    return "([^/]+)";
  });
  return { method, re: new RegExp(`^${source}/?$`), keys, auth, handler, options };
}

// ---------------------------------------------------------------- the API

export function createApi({ store = createStore() } = {}) {
  const loginFails = new Map(); // "ip|username" -> { count, first }

  // Everything the API knows, built around one loaded copy of the database.
  // A fresh copy is loaded for every request (the server may run as many
  // separate copies on Vercel), so nothing here is kept between requests.
  function openApp(data) {
    const D = data;
    let dirty = false;
    // handlers call db.save() after a change; the change is written to the
    // database once the handler has finished (see the request handler below)
    const db = { save: () => (dirty = true) };
    D.deletedAccounts ??= [];
    // every deleted account is kept (same fields as an account, plus who
    // deleted it and when), so an admin can look it up or restore it
    const deleted = {
      get items() {
        return D.deletedAccounts;
      },
      set items(list) {
        D.deletedAccounts = list;
      },
      save: () => (dirty = true),
    };

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

    D.events ??= []; // calendar bookings (see shared/schedule.js)

    // The criteria list (the workbook's CriteriaConfig sheet). A new database
    // starts with the criteria in shared/config.js.
    if (!Array.isArray(D.criteria) || D.criteria.length === 0) {
      D.criteria = DEFAULT_CRITERIA.map((c) => ({ ...c, addedAt: now(), addedBy: "default" }));
      db.save();
    }
    applyCriteria(D.criteria);

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
          if (!blockFieldNames().includes(field)) fail(400, `Unknown blocked field: ${field}.`);
        }
        v.ignoredBlocks = [...new Set(list)];
      }

      // blocked-style fields: { "OVERSEAS": { value: "EX WALLABY" }, "TASKING": null }
      if ("blocks" in body) {
        const changes = body.blocks;
        if (!changes || typeof changes !== "object") fail(400, "Invalid blocked-field data.");
        v.blocks = { ...(v.blocks ?? {}) };
        for (const [field, entry] of Object.entries(changes)) {
          if (!blockFieldNames().includes(field)) fail(400, `Unknown blocked field: ${field}.`);
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

    // ---- calendar events (bookings)

    const vehicleExists = (id) => D.vehicles.some((v) => v.id === id);
    const visibleIds = (user, ids) =>
      ids.filter((id) => {
        const v = D.vehicles.find((x) => x.id === id);
        return v && canSeeVehicle(user, v);
      });

    function canSeeEvent(user, e) {
      return user.role === "admin" || e.createdBy === user.id || visibleIds(user, e.vehicleIds).length > 0;
    }
    // you can change a booking you made, or one that books a vehicle you manage
    const canEditEvent = (user, e) => canSeeEvent(user, e);

    // what a user gets: vehicles they can't see are left out (and counted)
    function publicEvent(user, e) {
      const existing = e.vehicleIds.filter(vehicleExists);
      const vehicleIds = user.role === "admin" ? existing : visibleIds(user, existing);
      return { ...e, vehicleIds, otherVehicles: existing.length - vehicleIds.length };
    }

    function getEventFor(user, id) {
      const e = D.events.find((x) => x.id === id);
      if (!e || !canSeeEvent(user, e)) fail(404, "Booking not found.");
      return e;
    }

    // Validates a new booking or a change. Returns the complete booking; nothing
    // is saved unless every field is valid.
    function checkedEvent(body, user, original = null) {
      const e = original
        ? structuredClone(original)
        : { id: newId(), createdBy: user.id, createdByName: user.name, createdAt: now(), vehicleIds: [] };
      const has = (key) => !original || key in body;

      if (has("kind")) {
        const kind = SCHEDULE_KINDS.find((k) => k.key === body.kind);
        if (!kind) fail(400, "Choose what kind of booking this is.");
        e.kind = kind.key;
      }
      if (has("title")) {
        const title = String(body.title ?? "").trim();
        if (!title) fail(400, "Give the booking a title.");
        if (title.length > 80) fail(400, "The title can be at most 80 characters.");
        e.title = title;
      }
      if (has("field")) {
        const field = String(body.field ?? "TASKING").trim().toUpperCase();
        if (!DEPLOYED_FIELDS.includes(field)) fail(400, `Shows as must be one of ${DEPLOYED_FIELDS.join(", ")}.`);
        e.field = field;
      }
      if (has("tasking")) {
        const tasking = String(body.tasking ?? "").trim().toUpperCase();
        if (tasking.length > 40) fail(400, "The tasking value can be at most 40 characters.");
        e.tasking = tasking;
      }
      if (has("start")) {
        if (!isIsoDate(body.start)) fail(400, "Choose a valid start date.");
        e.start = body.start;
      }
      if (has("end")) {
        if (body.end && !isIsoDate(body.end)) fail(400, "Choose a valid end date.");
        e.end = body.end || e.start; // no end date = a one-day booking
      }
      if (e.end < e.start) fail(400, "The end date can't be before the start date.");
      if (daysBetween(e.start, e.end) > 366) fail(400, "A booking can be at most a year long.");
      for (const key of ["startTime", "endTime"]) {
        if (has(key)) {
          const t = String(body[key] ?? "");
          if (t && !isTime(t)) fail(400, "Times must look like 08:00.");
          e[key] = t;
        }
      }
      if (e.start === e.end && e.startTime && e.endTime && e.endTime < e.startTime) {
        fail(400, "The end time can't be before the start time.");
      }
      if (has("notes")) {
        const notes = String(body.notes ?? "").trim();
        if (notes.length > 500) fail(400, "Notes can be at most 500 characters.");
        e.notes = notes;
      }
      if (has("vehicleIds")) {
        if (!Array.isArray(body.vehicleIds)) fail(400, "Choose the vehicles.");
        const wanted = [...new Set(body.vehicleIds.map(String))];
        for (const id of wanted) {
          const v = D.vehicles.find((x) => x.id === id);
          if (!v || !canSeeVehicle(user, v)) fail(400, "One of the chosen vehicles doesn't exist or isn't yours.");
        }
        // keep vehicles on the booking that this user can't see (someone else's)
        const hidden = original ? original.vehicleIds.filter((id) => vehicleExists(id) && !visibleIds(user, [id]).length) : [];
        e.vehicleIds = [...hidden, ...wanted];
      }
      if (e.kind !== "tasking") {
        e.tasking = "";
        e.field = "";
      } else e.field ||= "TASKING";
      if (e.kind !== "tasking") e.tasking = "";
      else if (!e.tasking) e.tasking = e.title.toUpperCase().slice(0, 40);
      if (SCHEDULE_KINDS.find((k) => k.key === e.kind).effect !== "none" && e.vehicleIds.length === 0) {
        fail(400, "Choose at least one vehicle.");
      }
      e.startTime ??= "";
      e.endTime ??= "";
      e.notes ??= "";
      if (original) {
        e.updatedAt = now();
        e.updatedBy = user.name;
      }
      return e;
    }

    const routes = [
      // ---------------- auth
      route("GET", "/api/auth/status", "public", () => ({
        hasUsers: D.users.length > 0,
        signupOpen: D.users.length === 0 || !/^(false|0|no)$/i.test(process.env.ALLOW_SIGNUP ?? ""),
      })),

      route("POST", "/api/auth/signup", "public", ({ body }) => {
        // ALLOW_SIGNUP=false: only an Admin can create accounts (Accounts page).
        // The very first account can always be made.
        if (D.users.length > 0 && /^(false|0|no)$/i.test(process.env.ALLOW_SIGNUP ?? "")) {
          fail(403, "Sign-up is switched off. Ask an Admin to create an account for you.");
        }
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
        criteria: D.criteria,
      })),

      // ---------------- criteria (the workbook's CriteriaConfig sheet)
      route("GET", "/api/criteria", "user", () => ({ criteria: D.criteria })),

      // Add / reclassify / remove criteria (Admin; used by the import's
      // "Scan criteria" step and the Criteria page).
      // body: { set?: [{ name, category }], remove?: ["NAME"], reset?: true }
      //   category: MAINTENANCE | BLOCKED | IGNORE
      route("PUT", "/api/criteria", "admin", ({ body, user }) => {
        const set = Array.isArray(body.set) ? body.set : [];
        const remove = Array.isArray(body.remove) ? body.remove : [];
        if (set.length + remove.length > 300) fail(400, "Too many changes at once.");
        let changed = 0;
        if (body.reset === true) {
          D.criteria = DEFAULT_CRITERIA.map((c) => ({ ...c, addedAt: now(), addedBy: user.name }));
          changed += 1;
        }
        for (const name of remove) {
          const before = D.criteria.length;
          D.criteria = D.criteria.filter((c) => criteriaKey(c.name) !== criteriaKey(name));
          changed += before - D.criteria.length;
        }
        for (const item of set) {
          const name = cleanCriteriaName(item?.name);
          if (!name || !criteriaKey(name)) fail(400, "A criteria needs a name.");
          if (!Object.hasOwn(CATEGORIES, item?.category)) fail(400, `Choose a category for ${name}.`);
          if (isCoreField(name)) {
            fail(400, `${name} is one of the fixed columns (MID, vehicle type, location...), not a criteria.`);
          }
          const existing = D.criteria.find((c) => criteriaKey(c.name) === criteriaKey(name));
          if (!existing) {
            D.criteria.push({ name, category: item.category, addedAt: now(), addedBy: user.name });
            changed += 1;
          } else if (existing.category !== item.category) {
            Object.assign(existing, { category: item.category, changedAt: now(), changedBy: user.name });
            changed += 1;
          }
        }
        if (!D.criteria.some((c) => c.category !== "IGNORE")) fail(400, "Keep at least one criteria.");
        if (changed) {
          applyCriteria(D.criteria);
          db.save();
        }
        return { criteria: D.criteria, changed };
      }),

      // Every account can change these (they apply to every vehicle of that type)
      route("PUT", "/api/disregards", "user", ({ body, user }) => {
        const type = cleanType(body.type);
        const ignored = Array.isArray(body.ignored) ? body.ignored : fail(400, "Send the list of ignored fields.");
        for (const field of ignored) {
          if (!allFieldNames().includes(field)) fail(400, `Unknown field: ${field}.`);
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
            if (!blockFieldNames().includes(field)) continue;
            const next = text(value, 100);
            if (next !== (existing?.blocks?.[field]?.value ?? "")) blocks[field] = next ? { value: next } : null;
          }
          if (Object.keys(maintenance).length) patch.maintenance = maintenance;
          if (Object.keys(blocks).length) patch.blocks = blocks;
          // the workbook's Remarks column (only when it has something in it)
          const remarks = text(row.remarks, 1000);
          if (remarks && remarks !== (existing?.remarks ?? "")) patch.remarks = remarks;
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

        // disregard rules found in the workbook (its DisregardConfig sheet)
        // { "VAMTAC CREW": ["AIRCON", ...] } - replaces the rules for those types
        let disregardTypes = 0;
        if (body.disregards && typeof body.disregards === "object") {
          const known = new Set(allFieldNames());
          for (const [rawType, fields] of Object.entries(body.disregards).slice(0, 300)) {
            if (!Array.isArray(fields)) continue;
            const type = text(rawType, 60).toUpperCase();
            if (!type) continue;
            const list = [...new Set(fields.map((f) => text(f, 40)).filter((f) => known.has(f)))];
            const current = D.disregards[type] ?? [];
            if (list.length === current.length && list.every((f) => current.includes(f))) continue;
            D.disregards[type] = list;
            D.disregardsUpdated[type] = { at: now(), by: `${user.name} (import)` };
            disregardTypes += 1;
          }
        }
        result.disregardTypes = disregardTypes;

        // vehicles from these sheets that are NOT in the workbook any more,
        // and that the admin ticked to delete
        if (Array.isArray(body.deleteIds) && body.deleteIds.length) {
          const ids = new Set(body.deleteIds.map(String));
          const before = D.vehicles.length;
          D.vehicles = D.vehicles.filter((v) => !ids.has(v.id));
          result.deleted = before - D.vehicles.length;
          D.events = D.events.map((e) => ({ ...e, vehicleIds: e.vehicleIds.filter((id) => !ids.has(id)) }));
        } else result.deleted = 0;

        if (result.created || result.updated || changedLinks || disregardTypes || result.deleted) {
          D.lastImport = { at: now(), by: user.name, created: result.created, updated: result.updated };
          db.save();
        }
        return result;
      }, { snapshot: "import" }),

      // Is there an import that can be undone?
      route("GET", "/api/vehicles/import/undo", "admin", async ({ store }) => {
        const snap = await store.loadSnapshot("import");
        const available = !!snap?.data && D.lastImportUndone !== snap.savedAt;
        return { available, savedAt: available ? snap.savedAt : null, lastImport: D.lastImport ?? null };
      }),

      // Put everything back the way it was before the last import (logins are kept)
      route("POST", "/api/vehicles/import/undo", "admin", async ({ store }) => {
        const snap = await store.loadSnapshot("import");
        if (!snap?.data || D.lastImportUndone === snap.savedAt) fail(404, "There is no import to undo.");
        const sessions = D.sessions;
        for (const key of Object.keys(D)) delete D[key];
        Object.assign(D, structuredClone(snap.data), { sessions, lastImportUndone: snap.savedAt });
        applyCriteria(D.criteria);
        db.save();
        return { restoredTo: snap.savedAt };
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

      // ---------------- calendar bookings
      route("GET", "/api/events", "user", ({ user }) => ({
        events: D.events.filter((e) => canSeeEvent(user, e)).map((e) => publicEvent(user, e)),
      })),

      route("POST", "/api/events", "user", ({ user, body }) => {
        const e = checkedEvent(body, user);
        D.events.push(e);
        db.save();
        return { event: publicEvent(user, e) };
      }),

      route("PATCH", "/api/events/:id", "user", ({ user, params, body }) => {
        const original = getEventFor(user, params.id);
        if (!canEditEvent(user, original)) fail(403, "You can't change this booking.");
        const e = checkedEvent(body, user, original);
        D.events = D.events.map((x) => (x.id === e.id ? e : x));
        db.save();
        return { event: publicEvent(user, e) };
      }),

      route("DELETE", "/api/events/:id", "user", ({ user, params }) => {
        const e = getEventFor(user, params.id);
        if (!canEditEvent(user, e)) fail(403, "You can't delete this booking.");
        D.events = D.events.filter((x) => x.id !== e.id);
        db.save();
        return { ok: true };
      }),

      // ---------------- the AI assistant (server/assistant.js)
      ...assistantRoutes({
        D,
        route,
        fail,
        canSeeVehicle,
        vehicleOut,
        patchedVehicle,
        newVehicle,
        checkedEvent,
        publicEvent,
        canSeeEvent,
        findUser,
      }),
    ];

    return { routes, D, isDirty: () => dirty, sessionFor };
  }

  // ---- the request handler
  //
  // For each request: load the database, run the route, and if it changed
  // anything save it. If someone else saved in the meantime the save is
  // refused (version check) and the request is run again on the new data, so
  // two commanders editing at the same moment never overwrite each other.

  const MAX_ATTEMPTS = 10;
  // wait a little (more each time, and a bit random) before trying again
  const backOff = (attempt) => new Promise((r) => setTimeout(r, Math.random() * 40 * attempt + 10));

  return async function fleetApi(req, res, next) {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/")) {
      if (next) return next();
      return send(res, 404, { error: "Not found." });
    }

    try {
      const body = ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) ? await readBody(req) : {};
      const ip = String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || req.socket?.remoteAddress || "";

      for (let attempt = 1; ; attempt += 1) {
        const { data, version } = await store.load();
        const app = openApp(data);

        let match = null;
        const r = app.routes.find((candidate) => {
          if (candidate.method !== req.method) return false;
          match = candidate.re.exec(url.pathname);
          return !!match;
        });
        if (!r) fail(404, "Not found.");

        const params = {};
        r.keys.forEach((key, i) => {
          params[key] = decodeURIComponent(match[i + 1]);
        });

        const auth = r.auth === "public" ? null : app.sessionFor(req);
        if (r.auth !== "public" && !auth) fail(401, "Please log in again.");
        if (r.auth === "admin" && auth.user.role !== "admin") {
          fail(403, "Only an administrator can do that.");
        }

        // a copy of the database before an import, so it can be undone
        const before = r.options.snapshot ? structuredClone(app.D) : null;

        const result = await r.handler({
          req,
          params,
          query: url.searchParams,
          body,
          user: auth?.user,
          session: auth?.session,
          ip,
          store,
        });

        if (app.isDirty()) {
          const saved = await store.save(app.D, version);
          if (!saved) {
            if (attempt < MAX_ATTEMPTS) {
              await backOff(attempt);
              continue;
            }
            fail(409, "Someone else was saving at the same moment. Please try again.");
          }
          if (before) {
            await store.saveSnapshot(r.options.snapshot, before).catch((err) => {
              console.error("[fleet-api] could not keep a copy for undo:", err.message);
            });
          }
        }
        return send(res, 200, result);
      }
    } catch (err) {
      if (err instanceof HttpError || err.expose) send(res, err.status ?? 500, { error: err.message });
      else {
        console.error("[fleet-api]", err);
        send(res, 500, { error: "Something went wrong on the server." });
      }
    }
  };
}
