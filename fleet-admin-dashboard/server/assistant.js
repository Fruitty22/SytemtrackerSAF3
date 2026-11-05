// The AI assistant: answers how-to questions, looks up live fleet data, and
// PREPARES changes. It never saves anything itself: each change comes back to
// the browser as a card, and only when the user presses Confirm does the
// browser call the normal API (which checks permissions and values again).
//
// Which "brain" answers (environment variables), first one set wins:
//   GROQ_API_KEY        FREE: Groq's free tier (console.groq.com), model openai/gpt-oss-120b
//   AI_API_KEY + AI_BASE_URL (+ AI_MODEL)   any other OpenAI-compatible service
//   ANTHROPIC_API_KEY   Claude API (paid), model ANTHROPIC_MODEL or claude-haiku-5-5
//   (none)              the BUILT-IN assistant: rules, no AI, free, nothing leaves the app
// If the AI service fails or its free quota is used up, the built-in one answers instead.
//   APP_TIMEZONE        optional, default Asia/Singapore ("today" for bookings)
import { HELP_GUIDE } from "./assistant-guide.js";
import { runBuiltin } from "./assistant-builtin.js";
import {
  BLOCK_FIELDS,
  DEPLOY_LABELS,
  MAINTENANCE_FIELDS,
  ROLES,
  SCHEDULE_KINDS,
  DEPLOYED_FIELDS,
} from "../shared/config.js";
import { deployability, reasonText, statusLabel, disregardsFor } from "../shared/deployability.js";
import { eventsByVehicleOn, isIsoDate } from "../shared/schedule.js";
import { titlesMatch, normalizeTitle } from "../shared/titles.js";

const MAX_TURNS = 20; // messages of history sent to the model
const MAX_TOOL_ROUNDS = 6;
const MAX_ACTIONS = 25;
const RATE_LIMIT = 10; // AI messages per user per minute (free quotas are per account)
const recent = new Map(); // userId -> [timestamps]

const todayIn = (tz) => {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

// ---------------------------------------------------------------- tools (what the model may call)

const MID_PROP = { type: "string", description: "The vehicle's MID number, e.g. 21714" };

const TOOLS = [
  {
    name: "fleet_summary",
    description:
      "Counts of AVAILABLE / DEPLOYED / UNAVAILABLE vehicles the user can see today, per vehicle type and per commander, and the most common reasons. Use for 'how many', 'readiness', 'what is down' questions.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Only this vehicle type (optional)" },
        commander: { type: "string", description: "Only this commander's vehicles (Admin, optional)" },
      },
    },
  },
  {
    name: "search_vehicles",
    description:
      "Find vehicles the user can see. Every filter is optional and they combine. Returns MID, type, status, reasons, commander. Use before proposing changes to several vehicles.",
    input_schema: {
      type: "object",
      properties: {
        mids: { type: "array", items: { type: "string" }, description: "Exact MIDs" },
        type: { type: "string", description: "Vehicle type (spelling is matched loosely)" },
        status: { type: "string", enum: ["available", "deployed", "unavailable"] },
        reason: { type: "string", description: "Text that must appear in a reason, e.g. 'AIRCON', 'TASKING', 'VOR'" },
        text: { type: "string", description: "Text to find in MID, type, remarks or any field value" },
        commander: { type: "string", description: "Commander name (Admin)" },
        limit: { type: "integer", description: "Max results, default 40, max 200" },
      },
    },
  },
  {
    name: "get_vehicle",
    description: "Everything about one vehicle: status and why, every blocked field and maintenance item (with who set it and when), ignored criteria, remarks and bookings.",
    input_schema: { type: "object", properties: { mid: MID_PROP }, required: ["mid"] },
  },
  {
    name: "list_bookings",
    description: "Calendar bookings the user can see, optionally only those overlapping a date range or for one vehicle.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "YYYY-MM-DD" },
        to: { type: "string", description: "YYYY-MM-DD" },
        mid: MID_PROP,
      },
    },
  },
  {
    name: "get_rules",
    description: "The criteria list (blocked fields and Y/N maintenance items) and the disregard rules (criteria ignored per vehicle type).",
    input_schema: { type: "object", properties: { type: { type: "string", description: "Only this vehicle type (optional)" } } },
  },
  {
    name: "propose_vehicle_change",
    description:
      "PREPARE (not save) a change to one existing vehicle. The user sees a card and must press Confirm. Use one call per vehicle. " +
      "blocks: blocked-field name -> new text value, or \"\" to clear it (e.g. {\"TASKING\": \"XCA\"}, {\"VOR STATUS\": \"X\"}). " +
      "maintenance: item name -> \"Y\", \"N\" or \"\" to clear (e.g. {\"AIRCON\": \"N\"}). " +
      "Field names must be from get_rules. Only include what the user asked to change.",
    input_schema: {
      type: "object",
      properties: {
        mid: MID_PROP,
        blocks: { type: "object", additionalProperties: { type: "string" } },
        maintenance: { type: "object", additionalProperties: { type: "string", enum: ["Y", "N", ""] } },
        remarks: { type: "string", description: "New remarks (replaces the old ones)" },
        type: { type: "string", description: "New vehicle type" },
        note: { type: "string", description: "Remark saved with changed maintenance items (optional)" },
      },
      required: ["mid"],
    },
  },
  {
    name: "propose_new_vehicle",
    description: "PREPARE (not save) a new vehicle. The user must press Confirm. Check with get_vehicle first that the MID doesn't exist.",
    input_schema: {
      type: "object",
      properties: {
        mid: MID_PROP,
        type: { type: "string" },
        remarks: { type: "string" },
        blocks: { type: "object", additionalProperties: { type: "string" } },
        maintenance: { type: "object", additionalProperties: { type: "string", enum: ["Y", "N", ""] } },
      },
      required: ["mid", "type"],
    },
  },
  {
    name: "propose_booking",
    description:
      "PREPARE (not save) a calendar booking. The user must press Confirm. kind: tasking (vehicles show as DEPLOYED), servicing or maintenance (UNAVAILABLE), other (no status change). Dates YYYY-MM-DD; end defaults to start.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: SCHEDULE_KINDS.map((k) => k.key) },
        title: { type: "string" },
        start: { type: "string" },
        end: { type: "string" },
        mids: { type: "array", items: { type: "string" } },
        tasking: { type: "string", description: "Tasking value shown on the vehicles (tasking only)" },
        field: { type: "string", enum: DEPLOYED_FIELDS, description: "Show as (tasking only), default TASKING" },
        startTime: { type: "string", description: "HH:MM (optional)" },
        endTime: { type: "string", description: "HH:MM (optional)" },
        notes: { type: "string" },
      },
      required: ["kind", "title", "start", "mids"],
    },
  },
];

// ---------------------------------------------------------------- which service answers

function pickProvider() {
  const env = process.env;
  if (env.GROQ_API_KEY) {
    return {
      kind: "openai",
      key: env.GROQ_API_KEY,
      base: "https://api.groq.com/openai/v1",
      model: env.AI_MODEL || "openai/gpt-oss-120b",
      label: "AI (Groq, free tier)",
    };
  }
  if (env.AI_API_KEY && env.AI_BASE_URL) {
    return { kind: "openai", key: env.AI_API_KEY, base: env.AI_BASE_URL, model: env.AI_MODEL || "", label: "AI" };
  }
  if (env.ANTHROPIC_API_KEY) return { kind: "anthropic", key: env.ANTHROPIC_API_KEY, label: "AI (Claude)" };
  return { kind: "builtin", label: "Built-in" };
}

const aiError = (status) => {
  const err = new Error(`AI service error ${status}`);
  err.quota = status === 429;
  return err;
};

const systemText = ({ user, today, page }) =>
  "You are the help assistant inside the Fleet Admin Dashboard, a web app that tracks military fleet vehicle " +
  "serviceability (Singapore, SAF transport). Answer in short, plain English with concrete steps (page names and button " +
  "labels exactly as in the guide). Use the tools for any question about actual vehicles, counts or bookings - never guess data. " +
  "When the user asks to add, change or book something, look the vehicle(s) up, then call the propose_* tools; the app then " +
  "shows each change as a card with Confirm / Cancel. Never say a change is saved: say it is ready to confirm. " +
  "You cannot delete vehicles, change accounts, passwords, disregards or criteria - explain which page does that instead. " +
  "If a request is ambiguous (which vehicle? which value?), ask one short question. Keep data answers compact (lists, counts). " +
  "Use simple formatting only: **bold** and '- ' bullet lines, no tables.\n\n" +
  HELP_GUIDE +
  `\n\nToday is ${today}. The user is ${user.name} (${ROLES[user.role] ?? user.role}). ` +
  (user.role === "admin"
    ? "As Admin they can see every vehicle and every page."
    : "As a Fleet Commander they only see their own vehicles; Admin-only pages are Accounts, NC Dashboard, Manage Criteria and Import from Excel.") +
  (page ? ` They are on the page: ${page}.` : "");

// OpenAI-style chat completions with tool calls (Groq, and most other services)
async function runOpenAI({ provider, user, today, history, tools, page }) {
  const messages = [{ role: "system", content: systemText({ user, today, page }) }, ...history];
  const fnTools = tools.list.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const res = await fetch(`${provider.base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(provider.model ? { model: provider.model } : {}),
        messages,
        tools: fnTools,
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[assistant]", res.status, data?.error?.message);
      throw aiError(res.status);
    }
    const msg = data.choices?.[0]?.message ?? {};
    const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    if (!calls.length || round === MAX_TOOL_ROUNDS) {
      const reply = String(msg.content ?? "").trim();
      return {
        reply: reply || (tools.actions.length ? "Here are the changes - check them and press Confirm." : "Sorry, I couldn't work that out."),
        actions: tools.actions,
      };
    }
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: calls });
    for (const call of calls) {
      let result;
      try {
        const args = JSON.parse(call.function?.arguments || "{}");
        const handler = tools.handlers[call.function?.name];
        result = handler ? handler(args) : { error: `Unknown tool ${call.function?.name}` };
      } catch (err) {
        result = { error: err instanceof SyntaxError ? "The tool input wasn't valid JSON." : "That lookup failed." };
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 30_000) });
    }
  }
  return { reply: "Sorry, I couldn't work that out.", actions: tools.actions };
}

// ---------------------------------------------------------------- the routes

export function assistantRoutes(ctx) {
  const { D, route, fail, canSeeVehicle, vehicleOut, patchedVehicle, newVehicle, checkedEvent, canSeeEvent } = ctx;

  async function chat({ user, body }) {

    const history = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-MAX_TURNS)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    while (history.length && history[0].role !== "user") history.shift();
    // two messages in a row from the same side (e.g. "(Saved ...)" notes) become one
    for (let i = history.length - 1; i > 0; i -= 1) {
      if (history[i].role === history[i - 1].role) {
        history[i - 1].content += `\n${history[i].content}`;
        history.splice(i, 1);
      }
    }
    if (!history.length || history[history.length - 1].role !== "user") fail(400, "Type a question first.");

    const today = todayIn(process.env.APP_TIMEZONE || "Asia/Singapore");
    const provider = pickProvider();
    if (provider.kind !== "builtin") {
      // keeps one person from using up the free AI quota for everyone
      const now = Date.now();
      const times = (recent.get(user.id) ?? []).filter((t) => now - t < 60_000);
      if (times.length >= RATE_LIMIT) fail(429, "That's a lot of questions in a minute - please wait a moment.");
      times.push(now);
      recent.set(user.id, times);
    }
    const page = String(body.page ?? "").slice(0, 80);
    const builtin = () => runBuiltin({ question: history[history.length - 1].content, tools: makeTools({ user, today }), today, user });
    if (provider.kind === "builtin") return { ...builtin(), mode: provider.label };
    try {
      const tools = makeTools({ user, today });
      const run = provider.kind === "anthropic" ? runModel : runOpenAI;
      return { ...(await run({ provider, key: provider.key, user, today, history, tools, page })), mode: provider.label };
    } catch (err) {
      // free quota used up / service down: the built-in assistant still answers
      console.error("[assistant] falling back to built-in:", err.message);
      const out = builtin();
      return {
        ...out,
        reply: `(The AI service isn't answering right now${err.quota ? " - the free quota may be used up for now" : ""}, so this is the built-in assistant.)\n\n${out.reply}`,
        mode: "Built-in",
      };
    }
  }

  // ---- helpers on the live data

  function makeTools({ user, today }) {
    const visible = D.vehicles.filter((v) => canSeeVehicle(user, v));
    const todayEvents = eventsByVehicleOn(D.events, today);
    const statusOf = (v) => deployability(v, D.disregards, todayEvents.get(v.id) ?? []);
    const byMid = (mid) => {
      const key = String(mid ?? "").trim().toUpperCase();
      return visible.find((v) => v.mid === key) ?? null;
    };
    const ownerName = (v) => vehicleOut(v).ownerName;
    const brief = (v) => {
      const d = statusOf(v);
      return {
        mid: v.mid,
        type: v.type,
        status: statusLabel(d.status),
        reasons: d.reasons.map(reasonText),
        commander: ownerName(v),
        ...(v.remarks ? { remarks: v.remarks } : {}),
      };
    };
    const sameType = (a, b) => normalizeTitle(a) === normalizeTitle(b) || titlesMatch(a, b);
    const fieldName = (name, list) => list.find((f) => normalizeTitle(f) === normalizeTitle(name)) ?? list.find((f) => titlesMatch(f, name));
    const blockNames = () => BLOCK_FIELDS.map((f) => f.name);
    const actions = [];

    // turn the model's {"aircon": "n"} into the API's patch format, checking every name
    function fieldPatch(input, problems) {
      const patch = {};
      if (input.blocks && typeof input.blocks === "object") {
        for (const [raw, value] of Object.entries(input.blocks)) {
          const field = fieldName(raw, blockNames());
          if (!field) {
            problems.push(`"${raw}" is not a blocked field (they are: ${blockNames().join(", ")})`);
            continue;
          }
          const text = String(value ?? "").trim().toUpperCase();
          (patch.blocks ??= {})[field] = text ? { value: text } : null;
        }
      }
      if (input.maintenance && typeof input.maintenance === "object") {
        for (const [raw, value] of Object.entries(input.maintenance)) {
          const field = fieldName(raw, MAINTENANCE_FIELDS);
          if (!field) {
            problems.push(`"${raw}" is not a maintenance item (they are: ${MAINTENANCE_FIELDS.join(", ")})`);
            continue;
          }
          const level = String(value ?? "").trim().toUpperCase().slice(0, 1);
          if (level && !["Y", "N"].includes(level)) {
            problems.push(`${field} can only be Y, N or blank`);
            continue;
          }
          (patch.maintenance ??= {})[field] = level ? { level, remark: String(input.note ?? "").slice(0, 200) } : null;
        }
      }
      return patch;
    }

    const describeChanges = (before, patch) => {
      const lines = [];
      for (const [f, e] of Object.entries(patch.blocks ?? {})) {
        lines.push({ field: f, from: before?.blocks?.[f]?.value ?? "", to: e?.value ?? "" });
      }
      for (const [f, e] of Object.entries(patch.maintenance ?? {})) {
        lines.push({ field: f, from: before?.maintenance?.[f]?.level ?? "", to: e?.level ?? "" });
      }
      if ("remarks" in patch) lines.push({ field: "Remarks", from: before?.remarks ?? "", to: patch.remarks });
      if ("type" in patch) lines.push({ field: "Type", from: before?.type ?? "", to: patch.type });
      return lines.filter((l) => l.from !== l.to);
    };

    const tryValidate = (fn) => {
      try {
        return { value: fn() };
      } catch (err) {
        if (err.status) return { error: err.message };
        throw err;
      }
    };

    const handlers = {
      fleet_summary({ type, commander }) {
        let list = visible;
        if (type) list = list.filter((v) => sameType(v.type, type));
        if (commander) list = list.filter((v) => titlesMatch(ownerName(v), commander) || ownerName(v).toLowerCase().includes(commander.toLowerCase()));
        const totals = { available: 0, deployed: 0, unavailable: 0 };
        const perType = {};
        const perCommander = {};
        const reasons = {};
        for (const v of list) {
          const d = statusOf(v);
          totals[d.status] += 1;
          (perType[v.type] ??= { available: 0, deployed: 0, unavailable: 0 })[d.status] += 1;
          (perCommander[ownerName(v)] ??= { available: 0, deployed: 0, unavailable: 0 })[d.status] += 1;
          for (const r of d.reasons) {
            const k = r.kind === "maintenance" ? `${r.field} (N)` : r.field;
            reasons[k] = (reasons[k] ?? 0) + 1;
          }
        }
        return {
          date: today,
          total: list.length,
          [DEPLOY_LABELS.yes]: totals.available,
          [DEPLOY_LABELS.deployed]: totals.deployed,
          [DEPLOY_LABELS.no]: totals.unavailable,
          readinessPercent: list.length ? Math.round((totals.available / list.length) * 100) : 0,
          perType,
          perCommander: user.role === "admin" ? perCommander : undefined,
          topReasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 15),
        };
      },

      search_vehicles({ mids, type, status, reason, text, commander, limit }) {
        let list = visible;
        if (Array.isArray(mids) && mids.length) {
          const want = new Set(mids.map((m) => String(m).trim().toUpperCase()));
          list = list.filter((v) => want.has(v.mid));
        }
        if (type) list = list.filter((v) => sameType(v.type, type) || v.type.includes(String(type).toUpperCase()));
        if (commander) list = list.filter((v) => ownerName(v).toLowerCase().includes(String(commander).toLowerCase()));
        let rows = list.map((v) => ({ v, d: statusOf(v) }));
        if (status) rows = rows.filter((r) => r.d.status === status);
        if (reason) {
          const q = String(reason).toUpperCase();
          rows = rows.filter((r) => r.d.reasons.some((x) => reasonText(x).toUpperCase().includes(q)));
        }
        if (text) {
          const q = String(text).toUpperCase();
          rows = rows.filter(({ v }) =>
            [v.mid, v.type, v.remarks, ...Object.values(v.blocks ?? {}).map((b) => b?.value)].some((x) => String(x ?? "").toUpperCase().includes(q))
          );
        }
        const max = Math.min(Math.max(Number(limit) || 40, 1), 200);
        return { found: rows.length, shown: Math.min(rows.length, max), vehicles: rows.slice(0, max).map(({ v }) => brief(v)) };
      },

      get_vehicle({ mid }) {
        const v = byMid(mid);
        if (!v) return { error: `No vehicle with MID ${mid} that this user can see.` };
        const d = statusOf(v);
        const bookings = D.events
          .filter((e) => e.vehicleIds.includes(v.id) && e.end >= today)
          .map((e) => ({ kind: e.kind, title: e.title, start: e.start, end: e.end, tasking: e.tasking || undefined }));
        return {
          ...brief(v),
          blockedFields: d.blockRows.map((r) => ({
            field: r.field,
            value: r.value,
            counted: r.counted,
            ...(r.ignoredBy ? { ignoredBy: r.ignoredBy } : {}),
            ...(v.blocks?.[r.field] ? { setBy: v.blocks[r.field].updatedBy, setAt: v.blocks[r.field].updatedAt } : {}),
          })),
          maintenanceItems: d.itemRows.map((r) => ({
            item: r.field,
            value: r.value || "(blank)",
            counted: r.counted,
            ...(v.maintenance?.[r.field]?.remark ? { remark: v.maintenance[r.field].remark } : {}),
          })),
          upcomingBookings: bookings,
          worksheet: v.sourceSheet ?? null,
          lastUpdated: v.updatedAt ? `${v.updatedAt} by ${v.updatedBy}` : null,
        };
      },

      list_bookings({ from, to, mid }) {
        const v = mid ? byMid(mid) : null;
        if (mid && !v) return { error: `No vehicle with MID ${mid} that this user can see.` };
        const start = isIsoDate(from) ? from : "0000-01-01";
        const end = isIsoDate(to) ? to : "9999-12-31";
        const midOf = new Map(D.vehicles.map((x) => [x.id, x.mid]));
        const list = D.events
          .filter((e) => canSeeEvent(user, e) && e.start <= end && e.end >= start && (!v || e.vehicleIds.includes(v.id)))
          .slice(0, 100)
          .map((e) => ({
            kind: e.kind,
            title: e.title,
            start: e.start,
            end: e.end,
            tasking: e.tasking || undefined,
            vehicles: e.vehicleIds.filter((id) => visible.some((x) => x.id === id)).map((id) => midOf.get(id)),
            by: e.createdByName,
          }));
        return { today, bookings: list };
      },

      get_rules({ type }) {
        const rules = type
          ? { [type]: disregardsFor(D.disregards, String(type).toUpperCase()) }
          : Object.fromEntries(Object.entries(D.disregards).filter(([, l]) => l.length));
        return {
          blockedFields: BLOCK_FIELDS.map((f) => f.name),
          maintenanceItems: MAINTENANCE_FIELDS,
          notCriteria: D.criteria.filter((c) => c.category === "IGNORE").map((c) => c.name),
          disregardsByType: rules,
        };
      },

      propose_vehicle_change(input) {
        if (actions.length >= MAX_ACTIONS) return { error: `At most ${MAX_ACTIONS} changes in one go.` };
        const v = byMid(input.mid);
        if (!v) return { error: `No vehicle with MID ${input.mid} that this user can see.` };
        const problems = [];
        const patch = fieldPatch(input, problems);
        if (typeof input.remarks === "string") patch.remarks = input.remarks.trim();
        if (typeof input.type === "string" && input.type.trim()) patch.type = input.type.trim().toUpperCase();
        if (problems.length) return { error: problems.join("; ") };
        const changes = describeChanges(v, patch);
        if (!changes.length) return { error: "Nothing would change - the vehicle already has those values." };
        const check = tryValidate(() => patchedVehicle(v, patch, user));
        if (check.error) return { error: check.error };
        const after = deployability(check.value, D.disregards, todayEvents.get(v.id) ?? []);
        const action = {
          id: `a${actions.length + 1}`,
          kind: "update",
          title: `Update ${v.mid} (${v.type})`,
          changes,
          statusBefore: statusLabel(statusOf(v).status),
          statusAfter: statusLabel(after.status),
          request: { method: "PATCH", path: `/vehicles/${v.id}`, body: patch },
        };
        actions.push(action);
        return { prepared: true, card: action.title, changes, statusAfter: action.statusAfter, note: "Waiting for the user to press Confirm - NOT saved yet." };
      },

      propose_new_vehicle(input) {
        if (actions.length >= MAX_ACTIONS) return { error: `At most ${MAX_ACTIONS} changes in one go.` };
        const mid = String(input.mid ?? "").trim().toUpperCase();
        if (D.vehicles.some((x) => x.mid === mid)) return { error: `MID ${mid} already exists.` };
        const problems = [];
        const patch = fieldPatch(input, problems);
        if (problems.length) return { error: problems.join("; ") };
        const body = { mid, type: String(input.type ?? "").trim().toUpperCase(), remarks: String(input.remarks ?? "").trim(), ...patch };
        const check = tryValidate(() => newVehicle(body, user));
        if (check.error) return { error: check.error };
        const after = deployability(check.value, D.disregards, []);
        const action = {
          id: `a${actions.length + 1}`,
          kind: "create",
          title: `Add vehicle ${mid} (${body.type})`,
          changes: describeChanges({}, { ...patch, type: body.type, ...(body.remarks ? { remarks: body.remarks } : {}) }),
          statusAfter: statusLabel(after.status),
          request: { method: "POST", path: "/vehicles", body },
        };
        actions.push(action);
        return { prepared: true, card: action.title, note: "Waiting for the user to press Confirm - NOT saved yet." };
      },

      propose_booking(input) {
        if (actions.length >= MAX_ACTIONS) return { error: `At most ${MAX_ACTIONS} changes in one go.` };
        const mids = Array.isArray(input.mids) ? input.mids : [];
        const missing = mids.filter((m) => !byMid(m));
        if (missing.length) return { error: `These MIDs aren't vehicles this user can see: ${missing.join(", ")}` };
        const body = {
          kind: input.kind,
          title: String(input.title ?? "").trim(),
          start: input.start,
          end: input.end || input.start,
          startTime: input.startTime ?? "",
          endTime: input.endTime ?? "",
          notes: input.notes ?? "",
          tasking: input.tasking ?? "",
          field: input.field ?? "TASKING",
          vehicleIds: mids.map((m) => byMid(m).id),
        };
        const check = tryValidate(() => checkedEvent(body, user));
        if (check.error) return { error: check.error };
        const e = check.value;
        const kind = SCHEDULE_KINDS.find((k) => k.key === e.kind);
        const action = {
          id: `a${actions.length + 1}`,
          kind: "booking",
          title: `Book ${kind.label}: ${e.title}`,
          changes: [
            { field: "Dates", from: "", to: e.start === e.end ? e.start : `${e.start} to ${e.end}` },
            { field: "Vehicles", from: "", to: mids.map((m) => String(m).toUpperCase()).join(", ") },
            ...(e.tasking ? [{ field: e.field || "TASKING", from: "", to: e.tasking }] : []),
          ],
          request: { method: "POST", path: "/events", body },
        };
        actions.push(action);
        return { prepared: true, card: action.title, note: "Waiting for the user to press Confirm - NOT saved yet." };
      },
    };

    return { list: TOOLS, handlers, actions };
  }

  async function runModel({ key, user, today, history, tools, page }) {
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
    const base = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");
    const system = [
      {
        type: "text",
        text:
          "You are the help assistant inside the Fleet Admin Dashboard, a web app that tracks military fleet vehicle " +
          "serviceability (Singapore, SAF transport). Answer in short, plain English with concrete steps (page names and button " +
          "labels exactly as in the guide). Use the tools for any question about actual vehicles, counts or bookings - never guess data. " +
          "When the user asks to add, change or book something, look the vehicle(s) up, then call the propose_* tools; the app then " +
          "shows each change as a card with Confirm / Cancel. Never say a change is saved: say it is ready to confirm. " +
          "You cannot delete vehicles, change accounts, passwords, disregards or criteria - explain which page does that instead. " +
          "If a request is ambiguous (which vehicle? which value?), ask one short question. Keep data answers compact (lists, counts).\n\n" +
          HELP_GUIDE,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text:
          `Today is ${today}. The user is ${user.name} (${ROLES[user.role] ?? user.role}). ` +
          (user.role === "admin"
            ? "As Admin they can see every vehicle and every page."
            : "As a Fleet Commander they only see their own vehicles; Admin-only pages are Accounts, NC Dashboard, Manage Criteria and Import from Excel.") +
          (page ? ` They are on the page: ${page}.` : ""),
      },
    ];
    const messages = history.map((m) => ({ role: m.role, content: m.content }));

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
      const res = await fetch(`${base}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2000,
          system,
          tools: tools.list,
          messages,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[assistant]", res.status, data?.error?.message);
        throw aiError(res.status);
      }
      const content = Array.isArray(data.content) ? data.content : [];
      const calls = content.filter((b) => b.type === "tool_use");
      if (data.stop_reason !== "tool_use" || calls.length === 0 || round === MAX_TOOL_ROUNDS) {
        const reply = content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return { reply: reply || (tools.actions.length ? "Here are the changes - check them and press Confirm." : "Sorry, I couldn't work that out."), actions: tools.actions };
      }
      messages.push({ role: "assistant", content });
      messages.push({
        role: "user",
        content: calls.map((call) => {
          let result;
          try {
            const handler = tools.handlers[call.name];
            result = handler ? handler(call.input ?? {}) : { error: `Unknown tool ${call.name}` };
          } catch (err) {
            console.error("[assistant] tool", call.name, err);
            result = { error: "That lookup failed." };
          }
          return {
            type: "tool_result",
            tool_use_id: call.id,
            content: JSON.stringify(result).slice(0, 60_000),
            ...(result?.error ? { is_error: true } : {}),
          };
        }),
      });
    }
    return { reply: "Sorry, I couldn't work that out.", actions: tools.actions };
  }

  return [
    route("POST", "/api/assistant/chat", "user", chat),
    route("GET", "/api/assistant/status", "user", () => {
      const p = pickProvider();
      return { enabled: true, mode: p.label, ai: p.kind !== "builtin" };
    }),
  ];
}
