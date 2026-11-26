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
import { runBuiltin, guideSection, guideTitles, findFields } from "./assistant-builtin.js";
import { closest } from "./assistant-fuzzy.js";
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

const MAX_TURNS = 10; // messages of history sent to the model (each costs free-tier tokens)
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
      "Today's AVAILABLE / DEPLOYED / UNAVAILABLE counts, per type and commander, and top reasons.",
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
      "Find vehicles (all filters optional, combined). Returns MID, type, status, reasons, commander.",
    input_schema: {
      type: "object",
      properties: {
        mids: { type: "array", items: { type: "string" }, description: "Exact MIDs" },
        type: { type: "string", description: "Vehicle type (spelling is matched loosely)" },
        status: { type: "string", enum: ["available", "deployed", "unavailable"], description: "available, deployed or unavailable (lower case)" },
        reason: { type: "string", description: "Field in the reasons, e.g. OVERSEAS, AIRCON, VOR" },
        text: { type: "string", description: "Text in MID, type, remarks or a field value" },
        commander: { type: "string", description: "Commander's name or the Excel worksheet name, e.g. 3SG Rizq" },
        limit: { type: "integer", description: "Default 60" },
      },
    },
  },
  {
    name: "analyse_fleet",
    description:
      "Compare / rank groups in one call: counts, readiness % and top reasons per type, commander, worksheet, reason or status. Use for 'which commander has most...', 'compare', 'top problems', 'breakdown'.",
    input_schema: {
      type: "object",
      properties: {
        group_by: { type: "string", enum: ["type", "commander", "worksheet", "reason", "status"] },
        type: { type: "string", description: "Filter: vehicle type (optional)" },
        commander: { type: "string", description: "Filter: commander or worksheet (optional)" },
        status: { type: "string", enum: ["available", "deployed", "unavailable"] },
        reason: { type: "string", description: "Filter: reason field, e.g. VOR (optional)" },
      },
      required: ["group_by"],
    },
  },
  {
    name: "get_vehicle",
    description: "One vehicle: status, reasons, blocked fields, Y/N items, remarks, bookings.",
    input_schema: { type: "object", properties: { mid: MID_PROP }, required: ["mid"] },
  },
  {
    name: "list_bookings",
    description: "Calendar bookings, optionally in a date range or for one vehicle.",
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
    description: "Field names (blocked fields, Y/N items) and disregard rules per vehicle type.",
    input_schema: { type: "object", properties: { type: { type: "string", description: "Only this vehicle type (optional)" } } },
  },
  {
    name: "propose_disregard",
    description:
      "Prepare (NOT save) a disregard change for a whole VEHICLE TYPE: the items stop (ignore) or start again (count) counting for EVERY vehicle of that type in this node. " +
      "Use for 'ignore/disregard/don't count X for MB G300', 'count X again for all 6 tons'. type can be loose ('mb', '6 ton', 'luv') - every matching type gets a card; type \"all\" = every type. Never use propose_vehicle_change for this.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Vehicle type, loose wording ok, or \"all\"" },
        ignore: { type: "array", items: { type: "string" }, description: "Items/fields to stop counting" },
        count: { type: "array", items: { type: "string" }, description: "Items/fields to count again" },
      },
      required: ["type"],
    },
  },
  {
    name: "propose_criteria",
    description:
      "Admin only. Prepare (NOT save) a change to the criteria list, which applies to the WHOLE node fleet: category MAINTENANCE (Y/N item), BLOCKED (blocks when filled) or IGNORE (not a criteria, never counted). " +
      "Use for 'make X a maintenance criteria', 'stop using X as a criteria for every vehicle', 'add column X as blocked'. remove = delete the criteria.",
    input_schema: {
      type: "object",
      properties: {
        set: {
          type: "array",
          items: { type: "object", properties: { name: { type: "string" }, category: { type: "string", enum: ["MAINTENANCE", "BLOCKED", "IGNORE"] } }, required: ["name", "category"] },
        },
        remove: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "propose_vehicle_change",
    description:
      "Prepare (NOT save) a change to one vehicle; user confirms. blocks: {FIELD: text or \"\" to clear}, e.g. {\"TASKING\": \"XCA\"}. maintenance: {ITEM: \"Y\"|\"N\"|\"\"}. Only what was asked.",
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
    description: "Prepare (NOT save) a new vehicle; user confirms.",
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
      "Prepare (NOT save) a booking; user confirms. tasking = DEPLOYED, servicing/maintenance = UNAVAILABLE, other = no change. Dates YYYY-MM-DD.",
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
      models: env.AI_MODEL ? [env.AI_MODEL, ...GROQ_MODELS.filter((m) => m !== env.AI_MODEL)] : GROQ_MODELS,
      label: "AI (Groq, free tier)",
    };
  }
  if (env.AI_API_KEY && env.AI_BASE_URL) {
    const gemini = /generativelanguage\.googleapis\.com/.test(env.AI_BASE_URL);
    return {
      kind: "openai",
      key: env.AI_API_KEY.trim(),
      base: env.AI_BASE_URL.trim(),
      model: (env.AI_MODEL || "").trim(),
      label: gemini ? `AI (Gemini${env.AI_MODEL ? ` ${env.AI_MODEL.trim().replace(/^models\//, "")}` : ""})` : "AI",
    };
  }
  if (env.ANTHROPIC_API_KEY) return { kind: "anthropic", key: env.ANTHROPIC_API_KEY, label: "AI (Claude)" };
  return { kind: "builtin", label: "Built-in" };
}

const aiError = (status) => {
  const err = new Error(`AI service error ${status}`);
  err.quota = status === 429;
  return err;
};

// The instructions for Groq / OpenAI-style services. Kept SHORT on purpose:
// Groq's free tier allows only ~8,000 tokens a minute, so the user guide is
// not sent every time - the model asks for the part it needs (help_guide tool).
const systemText = ({ user, today, page, nodeName, prev, withGuide = true, names = null }) =>
  "You are the assistant in ARGUS, a fleet serviceability web app (SAF transport, Singapore). " +
  "Status: AVAILABLE; DEPLOYED (out on TASKING / SELF DRIVE / TLOAN / OVERSEAS or a tasking booking); UNAVAILABLE (VOR STATUS has X, " +
  "STANDBY or another blocked field has text, a Y/N maintenance item is N, or a servicing booking today). " +
  "Rules: use tools for ANY fleet data (it is the data imported from the Excel files), never guess or invent MIDs, names or numbers. " +
  "Quote counts exactly as the tool gives them (found / total). When listing, list every vehicle returned; if found > shown, say how many more there are. " +
  "A commander may be named by account or by Excel worksheet name - pass it as commander. For how-to questions call help_guide and answer with exact page and button names. " +
  (!names || names.some((n) => n.startsWith("propose_"))
    ? "For changes or bookings call the propose_* tools; the user must press Confirm on each card, so say it is ready to confirm, never saved. " +
      "You cannot delete vehicles or change accounts. "
    : "") +
  "Ask one short question if unclear. " +
  (!names || names.includes("propose_disregard")
    ? "DISREGARDS are per VEHICLE TYPE and apply to every vehicle of that type (e.g. 'ignore P-PLATE for all MB G300', 'don't count aircon for 6 tonners', 'count canopy again for luv'): use propose_disregard, never propose_vehicle_change. " +
      "CRITERIA (Admin only) decide whether a column counts at all for the whole fleet: use propose_criteria. If a type name doesn't match, show the types and ask. "
    : "") +
  (!names || names.includes("analyse_fleet")
    ? "For comparisons, rankings, 'which commander/type has most', breakdowns or 'analyse' call analyse_fleet (one call), not many searches. "
    : "") +
  "Understand loose wording: 6 tonner = 6 TON, luv = AGILIS AUTO (LUV), u/s / down / not ava = unavailable, svc = serviceable/available. " +
  "Answer style: first line = the direct answer with the key number; then up to 8 short bullets (most important first); if there is more, say how many more and offer to list them. " +
  "Use **bold** for numbers/MIDs and '- ' bullets, no tables. " +
  (withGuide ? `Guide sections: ${guideTitles().join("; ")}. ` : "") +
  (nodeName
    ? `This is the ${nodeName} node: ALL the data the tools return is ${nodeName}'s fleet, so "${nodeName}" / "${nodeName} node" means the whole fleet (do not pass it as commander or type). `
    : "") +
  `Today is ${today}. User: ${user.name}, ${ROLES[user.role] ?? user.role}` +
  (user.role === "admin" ? " (sees everything)." : " (sees only own vehicles; no Admin pages).") +
  (page ? ` Current page: ${page}.` : "") +
  contextText(prev);

// what this chat was about, so follow-ups work: "which of those...", "same for luv", "undo"
export function contextText(prev) {
  if (!prev) return "";
  const out = [];
  const l = prev.lastList;
  if (l?.mids?.length) {
    const f = l.filters ? ` (${Object.entries(l.filters).map(([k, v]) => `${k}=${v}`).join(", ")})` : "";
    out.push(`Last list${f}: ${l.found ?? l.mids.length} vehicles, MIDs ${l.mids.slice(0, 40).join(" ")}${l.mids.length > 40 ? " ..." : ""}. "those/them/these" = this list (pass these mids).`);
  } else if (prev.filters) {
    out.push(`Last question was about ${Object.entries(prev.filters).map(([k, v]) => `${k}=${v}`).join(", ")}.`);
  }
  const a = prev.lastAction;
  if (a?.items?.length) {
    out.push(`Last change proposed: ${a.items.slice(0, 4).map((x) => `${x.tool} ${JSON.stringify(x.input)}`).join("; ").slice(0, 500)}. "same for X" / "also X" = repeat it for X.`);
    if (a.undo?.length) out.push(`To undo it call: ${a.undo.slice(0, 6).map((x) => `${x.tool} ${JSON.stringify(x.input)}`).join("; ").slice(0, 600)}.`);
    else if (a.noUndo) out.push("It can't be undone from the chat (delete it on its page).");
  }
  return out.length ? ` Earlier in this chat: ${out.join(" ")}` : "";
}

// Only the tools a question needs are sent (each one costs free-tier tokens every call).
// The order stays the same so the start of every request is identical.
const TOOL_GROUPS = [
  { tools: ["help_guide"], re: /\b(how (do|can|to|does|is|should)|where|what (is|are|does)|explain|page|button|guide|help|can i|steps?|meaning|mean)\b/i },
  { tools: ["analyse_fleet"], re: /\b(compar|most|least|rank|top|worst|best|breakdown|per|each|analy|by (type|commander|reason|worksheet)|which (commander|type|worksheet)s?|trend|summary|overview|readiness)/i },
  { tools: ["list_bookings", "propose_booking"], re: /\b(book|booking|calendar|schedul|reserve|tomorrow|tmr|next (week|month)|from .* to |until|mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}[/-]\d{1,2})/i },
  { tools: ["propose_vehicle_change", "propose_new_vehicle", "get_rules"], re: /\b(set|mark|change|update|put|make|clear|remove|unblock|release|reset|assign|send|move|add|new vehicle|create|fix|to [yn]\b|is now|[yn]$)/i },
  { tools: ["propose_disregard", "propose_criteria", "get_rules"], re: /\b(disregard|ignore|don'?t count|do not count|not count|stop counting|count\w* .*again|criteri|rules?|fields?|items?)/i },
];
const CORE_TOOLS = ["search_vehicles", "fleet_summary", "get_vehicle"];
export function pickToolNames(question, prev, allNames) {
  const want = new Set(CORE_TOOLS);
  for (const g of TOOL_GROUPS) if (g.re.test(question)) g.tools.forEach((t) => want.add(t));
  // a follow-up on the last change needs that change's tool
  if (prev?.lastAction?.items?.length && /\b(same|undo|revert|reverse|back|again|also|too|as well|those|them|it)\b/i.test(question)) {
    for (const x of [...prev.lastAction.items, ...(prev.lastAction.undo ?? [])]) want.add(x.tool);
  }
  // nothing specific asked: also allow analysis and the guide
  if (want.size === CORE_TOOLS.length) ["analyse_fleet", "help_guide"].forEach((t) => want.add(t));
  return allNames.filter((n) => want.has(n));
}

const HELP_TOOL = {
  name: "help_guide",
  description: "Get a section of the app's user guide (how to use a page or feature).",
  input_schema: {
    type: "object",
    properties: { topic: { type: "string", description: "Section title or keywords, e.g. 'Calendar', 'Importing Excel', 'Edit Blocked Vehicles'" } },
    required: ["topic"],
  },
};

// Groq models to try in order. Each has its own free per-minute allowance,
// so when one is busy the next one answers.
// (free tier, tokens a minute: gpt-oss 8k, kimi-k2 10k, llama-3.3 12k, llama-4-scout 30k)
const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "moonshotai/kimi-k2-instruct-0905",
  "llama-3.3-70b-versatile",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "openai/gpt-oss-20b",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A tool result as JSON of at most `max` characters, always valid: long
// vehicle / booking lists are shortened and "shown" / "note" say how many.
const RESULT_MAX = 12000;
export function fitResult(result, max = RESULT_MAX) {
  let json = JSON.stringify(result);
  if (json.length <= max || !result || typeof result !== "object") return json.length <= max ? json : JSON.stringify({ error: "Too much data - ask for a narrower list." });
  const key = ["vehicles", "rows", "groups", "bookings"].find((k) => Array.isArray(result[k])) ?? null;
  if (!key) {
    const slim = { ...result };
    delete slim.perCommander;
    json = JSON.stringify(slim);
    return json.length <= max ? json : json.slice(0, 0) + JSON.stringify({ error: "Too much data - ask for a narrower list." });
  }
  let n = result[key].length;
  while (n > 0) {
    n = Math.floor(n * 0.8);
    const out = { ...result, [key]: result[key].slice(0, n), shown: n, note: `Only the first ${n} of ${result.found ?? result[key].length} are listed - say how many there are in total and offer to narrow down (by type, commander or reason).` };
    json = JSON.stringify(out);
    if (json.length <= max) return json;
  }
  return JSON.stringify({ ...result, [key]: [], note: "List too long - give the total and ask the user to narrow it down." });
}

// OpenAI-style chat completions with tool calls (Groq, and most other services)
async function runOpenAI({ provider, user, today, history, tools, page, prev }) {
  const models = provider.models ?? [provider.model];
  let lastErr;
  for (const model of models) {
    try {
      return await runOpenAIModel({ provider, model, user, today, history, tools, page, prev });
    } catch (err) {
      lastErr = err;
      if (!err.quota) throw err; // a wrong key won't get better with another model
      console.error(`[assistant] ${model} is busy (${err.message}) - trying the next model`);
      tools.actions.length = 0;
    }
  }
  throw lastErr;
}

async function runOpenAIModel({ provider, model, user, today, history, tools, page, prev }) {
  const question = history[history.length - 1]?.content ?? "";
  const all = [HELP_TOOL, ...tools.list];
  const names = pickToolNames(question, prev, all.map((t) => t.name));
  const system = systemText({ user, today, page, nodeName: tools.nodeName, prev, withGuide: names.includes("help_guide"), names });
  const messages = [{ role: "system", content: system }, ...history];
  const fnTools = all.filter((t) => names.includes(t.name)).map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
  const handlers = { ...tools.handlers, help_guide: ({ topic }) => ({ text: guideSection(topic) }) };

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    let res;
    let data;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      res = await fetch(`${provider.base.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(model ? { model } : {}),
          messages,
          tools: fnTools,
          tool_choice: "auto",
          temperature: 0.2,
          // gpt-oss models "think" before answering and that counts here too:
          // too small a limit cut answers off half way (or left them empty)
          // (Gemini "thinking" models need more room for the same answer)
          max_tokens: /gemini/i.test(model ?? "") ? 4096 : 2000,
          ...(/gpt-oss/.test(model ?? "") ? { reasoning_effort: "low" } : {}),
        }),
      });
      data = await res.json().catch(() => ({}));
      // busy for a few seconds only: wait and try once more
      const wait = Number(res.headers.get("retry-after"));
      if (res.status === 429 && attempt === 0 && wait > 0 && wait <= 6) {
        await sleep(wait * 1000);
        continue;
      }
      break;
    }
    if (!res.ok) {
      const message = String(data?.error?.message ?? "");
      console.error("[assistant]", model, res.status, message);
      const err = aiError(res.status);
      // too many tokens / requests for this model right now -> try another model
      err.quota = res.status === 429 || res.status === 413 || /rate limit|tokens per|too large/i.test(message);
      // a model that can't call tools properly -> try another model
      if (res.status === 400 && /tool|function/i.test(message)) err.quota = true;
      // a model Groq has retired / renamed -> just try the next one
      if (res.status === 404 || /model.*(not found|does not exist|decommission|not supported)|unknown model/i.test(message)) err.quota = true;
      err.message = message.slice(0, 160) || err.message;
      throw err;
    }
    const msg = data.choices?.[0]?.message ?? {};
    if (data.choices?.[0]?.finish_reason === "length" && !String(msg.content ?? "").trim() && !msg.tool_calls?.length) {
      const e = aiError(429); // try the next model, then the built-in assistant
      e.message = "answer too long";
      throw e;
    }
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
        const handler = handlers[call.function?.name];
        const name = call.function?.name;
        result = handler ? handler(name === "search_vehicles" || name === "fleet_summary" ? { ...args, compact: true } : args) : { error: `Unknown tool ${name}` };
      } catch (err) {
        result = { error: err instanceof SyntaxError ? "The tool input wasn't valid JSON." : "That lookup failed." };
      }
      // keep tool results small (free tier token limit) WITHOUT cutting the
      // JSON in half: long lists are shortened and the model is told so
      messages.push({ role: "tool", tool_call_id: call.id, content: fitResult(result) });
    }
  }
  return { reply: "Sorry, I couldn't work that out.", actions: tools.actions };
}

// ---------------------------------------------------------------- follow-up memory

// the context the app sends back: only known shapes, small, never trusted for permissions
// (every change it leads to is checked again, and saved only after the user confirms)
const TOOL_NAMES = new Set(["propose_vehicle_change", "propose_new_vehicle", "propose_booking", "propose_disregard", "propose_criteria"]);
export function cleanContext(c) {
  if (!c || typeof c !== "object") return null;
  const str = (x, n = 40) => (typeof x === "string" ? x.slice(0, n) : undefined);
  const filters = (f) =>
    f && typeof f === "object"
      ? Object.fromEntries(["type", "commander", "status", "reason"].filter((k) => str(f[k])).map((k) => [k, str(f[k])]))
      : null;
  const calls = (list) =>
    (Array.isArray(list) ? list : [])
      .filter((x) => x && TOOL_NAMES.has(x.tool) && x.input && typeof x.input === "object" && JSON.stringify(x.input).length < 3000)
      .slice(0, 25)
      .map((x) => ({ tool: x.tool, input: x.input }));
  const out = {};
  const l = c.lastList;
  if (l && Array.isArray(l.mids)) {
    out.lastList = {
      mids: l.mids.filter((m) => typeof m === "string").map((m) => m.slice(0, 16)).slice(0, 60),
      found: Number.isFinite(l.found) ? l.found : undefined,
      filters: filters(l.filters),
    };
  }
  const f = filters(c.filters);
  if (f && Object.keys(f).length) out.filters = f;
  if (c.lastAction && typeof c.lastAction === "object") {
    const items = calls(c.lastAction.items);
    if (items.length) out.lastAction = { items, undo: calls(c.lastAction.undo), ...(c.lastAction.noUndo ? { noUndo: true } : {}) };
  }
  return Object.keys(out).length ? out : null;
}

// questions the built-in answers as well as the AI: plain counts, greetings, thanks
export function isSimple(question, prev) {
  const q = String(question ?? "").trim().toLowerCase();
  if (/^(undo|undo (that|it|the last change)|revert|revert (that|it)|put it back|change it back)[\s!.]*$/.test(q)) return true;
  if (/^(hi|hello|hey|thanks|thank you|ok|okay|noted|great|cool)\b[\s!.]*$/.test(q)) return true;
  if (!/^(how many|how much|count|total|number of)\b/.test(q)) return false;
  if (/\b(why|compare|vs|versus|most|least|each|per|by|and|or|if|when|book|which|those|them|these|they|same|commander|worksheet|sheet)\b/.test(q)) return false;
  return q.split(/\s+/).length <= 10 && !(prev && /\b(it|that)\b/.test(q));
}

// ---------------------------------------------------------------- the routes

export function assistantRoutes(ctx) {
  const { D, route, fail, canSeeVehicle, vehicleOut, patchedVehicle, newVehicle, checkedEvent, canSeeEvent, nodeName } = ctx;

  async function chat({ user, body }) {

    const history = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-MAX_TURNS)
      // older answers are only context: keep them short
      .map((m) => ({ role: m.role, content: m.content.slice(0, m.role === "assistant" ? 700 : 1500) }));
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
    if (provider.kind !== "builtin" && !isSimple(history[history.length - 1].content, cleanContext(body.context))) {
      // keeps one person from using up the free AI quota for everyone
      const now = Date.now();
      const times = (recent.get(user.id) ?? []).filter((t) => now - t < 60_000);
      if (times.length >= RATE_LIMIT) fail(429, "That's a lot of questions in a minute - please wait a moment.");
      times.push(now);
      recent.set(user.id, times);
    }
    const page = String(body.page ?? "").slice(0, 80);
    const prev = cleanContext(body.context);
    const question = history[history.length - 1].content;
    const builtin = () => {
      const tools = makeTools({ user, today, prev });
      return { ...runBuiltin({ question, tools, today, user, prev }), context: tools.context() };
    };
    if (provider.kind === "builtin") return { ...builtin(), mode: provider.label };
    // simple counts and greetings: the built-in answers instantly and saves the free AI quota
    if (isSimple(question, prev)) {
      const out = builtin();
      if (!/^Sorry\b/.test(out.reply)) return { ...out, mode: "Built-in (instant)" };
    }
    try {
      const tools = makeTools({ user, today, prev });
      const run = provider.kind === "anthropic" ? runModel : runOpenAI;
      return { ...(await run({ provider, key: provider.key, user, today, history, tools, page, prev })), context: tools.context(), mode: provider.label };
    } catch (err) {
      // free quota used up / service down: the built-in assistant still answers
      console.error("[assistant] falling back to built-in:", err.message);
      const out = builtin();
      return {
        ...out,
        reply: `(The AI is ${err.quota ? "busy (free limit reached for this minute)" : "not answering"} - built-in answer:)\n\n${out.reply}`,
        mode: "Built-in",
      };
    }
  }

  // ---- helpers on the live data

  function makeTools({ user, today, prev = null }) {
    const visible = D.vehicles.filter((v) => canSeeVehicle(user, v));
    // what this chat was about (sent back by the app with the next question):
    // the last list of vehicles, the filters used and the last change (+ how to undo it)
    const memo = {
      lastList: prev?.lastList ?? null,
      filters: prev?.filters ?? null,
      lastAction: prev?.lastAction ?? null,
      notes: [],
      fresh: true, // the first change proposed this turn replaces lastAction
    };
    const rememberAction = (tool, input, undo) => {
      if (memo.fresh) {
        memo.lastAction = { items: [], undo: [] };
        memo.fresh = false;
      }
      memo.lastAction.items.push({ tool, input });
      if (undo === null) memo.lastAction.noUndo = true;
      else if (undo) memo.lastAction.undo.push(...(Array.isArray(undo) ? undo : [undo]));
    };
    const todayEvents = eventsByVehicleOn(D.events, today);
    const statusOf = (v) => deployability(v, D.disregards, todayEvents.get(v.id) ?? []);
    const byMid = (mid) => {
      const key = String(mid ?? "").trim().toUpperCase();
      return visible.find((v) => v.mid === key) ?? null;
    };
    const ownerName = (v) => vehicleOut(v).ownerName;

    // ---- loose names for disregards / criteria
    const allFields = () => [...BLOCK_FIELDS.map((f) => f.name), ...MAINTENANCE_FIELDS];
    const compact = (x) => String(x ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    // ["p plate", "aircon"] -> { names: ["P-PLATE", "AIRCON"], unknown: [] }
    const resolveFields = (list) => {
      const names = [];
      const unknown = [];
      for (const raw of Array.isArray(list) ? list : list ? [list] : []) {
        const exact = allFields().find((f) => compact(f) === compact(raw));
        const guess = exact ? null : findFields(String(raw))[0];
        const hit = exact ?? guess?.name;
        if (guess?.fuzzy) memo.notes.push(`read "${guess.fuzzy}" as ${guess.name}`);
        if (hit) names.push(hit);
        else if (String(raw).trim()) unknown.push(String(raw).trim());
      }
      return { names: [...new Set(names)], unknown };
    };
    // every vehicle type in this node (plus types that only have disregard rules)
    const nodeTypes = () =>
      [...new Set([...D.vehicles.map((v) => v.type), ...Object.keys(D.disregards ?? {})].filter(Boolean))].sort();
    const TYPE_ALIASES = [
      [/\b(luvs?|agilis)\b/i, "AGILIS"],
      [/\b(g\s*wagons?|g300s?|merc(edes)?|mb)\b/i, "MB"],
      [/\b(\d{1,2})\s*-?\s*(tons?|tonnes?|tonners?|t)\b/i, (m) => `${m[1]}TON`],
      [/\bvamtacs?\b/i, "VAMTAC"],
      [/\b(ambulances?|amb)\b/i, "AMB"],
    ];
    // "mb" -> both MB G300 types, "6 ton" -> every 6 TON type, "all" -> every type
    const resolveTypes = (query) => {
      const q = String(query ?? "").trim();
      const types = nodeTypes();
      if (!q || /^(all|every|everything|whole fleet|all types|all vehicles|fleet)$/i.test(q)) return /^\s*$/.test(q) ? [] : types;
      const exact = types.filter((t) => compact(t) === compact(q));
      if (exact.length) return exact;
      let cleaned = q.replace(/\b(all|every|the|whole|fleet|of|vehicles?|types?|for)\b/gi, " ");
      const parts = [];
      for (const [re, part] of TYPE_ALIASES) {
        const m = re.exec(cleaned);
        if (m) {
          parts.push(typeof part === "function" ? part(m) : part);
          cleaned = cleaned.replace(m[0], " ");
        }
      }
      // remaining words/numbers: "g300 tower" -> G, 300, TOWER
      parts.push(...(cleaned.toUpperCase().match(/[A-Z]+|\d+/g) ?? []));
      if (!parts.length) return [];
      // a part must start where a word of the type starts ("MB" is not inside "AMB"), and must
      // not run part-way into the next word ("VAMTACC" is not VAMTAC + the C of CREW)
      const hits = (t, part) => {
        const c = compact(t);
        const starts = new Set();
        const ends = new Set();
        let at = 0;
        for (const w of t.toUpperCase().match(/[A-Z]+|\d+/g) ?? []) {
          starts.add(at);
          at += w.length;
          ends.add(at);
        }
        for (let i = c.indexOf(part); i >= 0; i = c.indexOf(part, i + 1)) {
          if (!starts.has(i)) continue;
          const end = i + part.length;
          const crosses = [...starts].some((x) => x > i && x < end);
          if (ends.has(end) || !crosses) return true;
        }
        return false;
      };
      // a typo in a word ("vamtacc", "agillis", "himar") -> the closest word of a type name
      const typeWords = [...new Set(types.flatMap((t) => t.toUpperCase().match(/[A-Z]+|\d+/g) ?? []))].map((w) => ({ key: w, value: w }));
      for (let i = 0; i < parts.length; i += 1) {
        if (types.some((t) => hits(t, parts[i]))) continue;
        const fix = closest(parts[i], typeWords);
        if (fix) {
          memo.notes.push(`read "${parts[i].toLowerCase()}" as ${fix.value}`);
          parts[i] = fix.value;
        }
      }
      return types.filter((t) => parts.every((p) => hits(t, p)));
    };

    const brief = (v) => {
      const d = statusOf(v);
      return {
        mid: v.mid,
        type: v.type,
        status: statusLabel(d.status),
        reasons: d.reasons.map(reasonText),
        commander: ownerName(v),
        ...(v.sourceSheet && v.sourceSheet !== ownerName(v) ? { worksheet: v.sourceSheet } : {}),
        ...(v.remarks ? { remarks: v.remarks } : {}),
      };
    };
    // the AI (or a person) may say "UNAVAILABLE", "not available", "down"...
    const normStatus = (x) => {
      const t = String(x ?? "").toLowerCase().replace(/[^a-z ]/g, " ").trim();
      if (!t) return null;
      if (/\b(un ?available|not available|not ava|down|unserviceable|u s|broken|nmc)\b/.test(t)) return "unavailable";
      if (/\b(deployed|in use|out)\b/.test(t)) return "deployed";
      if (/\b(available|serviceable|ava|ready|free|ok)\b/.test(t)) return "available";
      return null;
    };
    // a commander can be named by their account or by the Excel worksheet the vehicles came from
    const ofCommander = (v, who) => {
      const q = String(who ?? "").trim().toLowerCase();
      if (!q) return true;
      const names = [ownerName(v), v.sourceSheet].filter(Boolean).map((n) => String(n).toLowerCase());
      return names.some((n) => n.includes(q) || q.includes(n) || titlesMatch(n, q));
    };
    // a filter word that is really the node itself ("khatib node") means everything
    const nodeWords = new Set(
      [nodeName, `${nodeName} node`, "this node", "my node", "node", "all", "everyone", "everything", "fleet", "whole fleet"]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase())
    );
    const isNodeWord = (x) => nodeWords.has(String(x ?? "").trim().toLowerCase().replace(/\s+/g, " "));
    // a commander / type nobody has -> say so (with the real names) instead of "0 vehicles"
    const unknownFilter = ({ type, commander }) => {
      if (commander && !isNodeWord(commander) && !visible.some((v) => ofCommander(v, commander))) {
        const names = handlers._names();
        return { error: `No commander or worksheet called "${commander}" in this node.`, commandersAndWorksheets: names.slice(0, 60) };
      }
      if (type && !isNodeWord(type) && !visible.some((v) => typeMatches(v, type))) {
        return { error: `No vehicle type "${type}" in this node.`, types: [...new Set(visible.map((v) => v.type))] };
      }
      return null;
    };
    // {X: {available, deployed, unavailable}} -> {X: "avail/deployed/unavail"}
    const squash = (o) => Object.fromEntries(Object.entries(o).map(([k, c]) => [k, `${c.available}/${c.deployed}/${c.unavailable}`]));
    const plainType = (v, type) => sameType(v.type, type) || v.type.includes(String(type).toUpperCase().trim());
    // "vamtacc", "6 tonners", "luv" -> the real types (only when the plain match finds nothing)
    const looseCache = new Map();
    const looseTypes = (type) => {
      const key = String(type);
      if (!looseCache.has(key)) looseCache.set(key, new Set(visible.some((v) => plainType(v, type)) ? [] : resolveTypes(type)));
      return looseCache.get(key);
    };
    const typeMatches = (v, type) => plainType(v, type) || looseTypes(type).has(v.type);
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
      // (built-in assistant only) every vehicle type this user can see - not remembered as a "list"
      _types() {
        return [...new Set(visible.map((v) => v.type))];
      },
      // (built-in assistant only) every commander / worksheet name this user can see
      _names() {
        return [...new Set(visible.flatMap((v) => [ownerName(v), v.sourceSheet]).filter((n) => n && n !== "Unassigned"))];
      },

      fleet_summary({ type, commander, compact }) {
        const bad = unknownFilter({ type, commander });
        if (bad) return bad;
        if (isNodeWord(type)) type = undefined;
        if (isNodeWord(commander)) commander = undefined;
        let list = visible;
        if (type) list = list.filter((v) => typeMatches(v, type));
        if (commander) list = list.filter((v) => ofCommander(v, commander));
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
          ...(compact ? { counts: "available/deployed/unavailable" } : {}),
          readinessPercent: list.length ? Math.round((totals.available / list.length) * 100) : 0,
          perType: compact ? squash(perType) : perType,
          perCommander: user.role === "admin" ? (compact ? squash(perCommander) : perCommander) : undefined,
          worksheets: [...new Set(list.map((v) => v.sourceSheet).filter(Boolean))].length,
          topReasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 15),
        };
      },

      search_vehicles({ mids, type, status, reason, text, commander, limit, compact }) {
        const bad = unknownFilter({ type, commander });
        if (bad) return bad;
        if (isNodeWord(type)) type = undefined;
        if (isNodeWord(commander)) commander = undefined;
        if (isNodeWord(text)) text = undefined;
        let list = visible;
        if (Array.isArray(mids) && mids.length) {
          const want = new Set(mids.map((m) => String(m).trim().toUpperCase()));
          list = list.filter((v) => want.has(v.mid));
        }
        if (type) list = list.filter((v) => typeMatches(v, type));
        if (commander) list = list.filter((v) => ofCommander(v, commander));
        let rows = list.map((v) => ({ v, d: statusOf(v) }));
        const st = normStatus(status);
        if (st) rows = rows.filter((r) => r.d.status === st);
        if (reason) {
          const q = String(reason).toUpperCase();
          rows = rows.filter((r) => r.d.reasons.some((x) => reasonText(x).toUpperCase().includes(q)));
        }
        if (text) {
          const q = String(text).toUpperCase();
          rows = rows.filter(({ v }) =>
            [v.mid, v.type, v.remarks, v.sourceSheet, ownerName(v), ...Object.values(v.blocks ?? {}).map((b) => b?.value)].some((x) =>
              String(x ?? "").toUpperCase().includes(q)
            )
          );
        }
        const max = Math.min(Math.max(Number(limit) || 60, 1), 200);
        const shown = rows.slice(0, max).map(({ v }) => brief(v));
        if (compact) {
          // the AI gets one short row per vehicle (far fewer tokens than objects)
          return {
            found: rows.length,
            shown: shown.length,
            columns: "MID | type | status | reasons | commander (worksheet) | remarks",
            rows: shown.map((b) =>
              [b.mid, b.type, b.status, b.reasons.join(", ") || "-", b.commander + (b.worksheet ? ` (${b.worksheet})` : ""), (b.remarks ?? "").slice(0, 80) || "-"].join(" | ")
            ),
          };
        }
        return { found: rows.length, shown: shown.length, vehicles: shown };
      },

      analyse_fleet({ group_by, type, commander, status, reason }) {
        const bad = unknownFilter({ type, commander });
        if (bad) return bad;
        if (isNodeWord(type)) type = undefined;
        if (isNodeWord(commander)) commander = undefined;
        const by = ["type", "commander", "worksheet", "reason", "status"].includes(group_by) ? group_by : "type";
        let rows = visible
          .filter((v) => (!type || typeMatches(v, type)) && (!commander || ofCommander(v, commander)))
          .map((v) => ({ v, d: statusOf(v) }));
        const st = normStatus(status);
        if (st) rows = rows.filter((r) => r.d.status === st);
        if (reason) rows = rows.filter((r) => r.d.reasons.some((x) => reasonText(x).toUpperCase().includes(String(reason).toUpperCase())));
        const groups = new Map();
        const add = (key, r) => {
          const g = groups.get(key) ?? { total: 0, available: 0, deployed: 0, unavailable: 0, reasons: {}, mids: [] };
          g.total += 1;
          g[r.d.status] += 1;
          for (const x of r.d.reasons) {
            const k = x.kind === "maintenance" ? `${x.field} (N)` : x.field;
            g.reasons[k] = (g.reasons[k] ?? 0) + 1;
          }
          if (g.mids.length < 12 && r.d.status !== "available") g.mids.push(r.v.mid);
          groups.set(key, g);
        };
        for (const r of rows) {
          if (by === "reason") {
            const keys = [...new Set(r.d.reasons.map((x) => (x.kind === "maintenance" ? `${x.field} (N)` : x.field)))];
            for (const k of keys.length ? keys : ["(no problem)"]) add(k, r);
          } else {
            const key = by === "type" ? r.v.type : by === "commander" ? ownerName(r.v) : by === "worksheet" ? r.v.sourceSheet || "(no worksheet)" : statusLabel(r.d.status);
            add(key, r);
          }
        }
        const out = [...groups.entries()]
          .map(([key, g]) => ({
            [by]: key,
            total: g.total,
            available: g.available,
            deployed: g.deployed,
            unavailable: g.unavailable,
            readinessPercent: g.total ? Math.round((g.available / g.total) * 100) : 0,
            topReasons: Object.entries(g.reasons).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ${n}`).join(", ") || "-",
            notAvailableMids: g.mids.join(" "),
          }))
          .sort((a, b) => b.unavailable - a.unavailable || b.total - a.total);
        return { date: today, groupedBy: by, vehiclesCounted: rows.length, groups: out.slice(0, 40) };
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
          vehicleTypes: nodeTypes(),
        };
      },

      propose_disregard(input) {
        const wanted = { ignore: resolveFields(input.ignore), count: resolveFields(input.count) };
        const unknown = [...wanted.ignore.unknown, ...wanted.count.unknown];
        if (unknown.length) return { error: `Not a field or item: ${unknown.join(", ")}. Fields: ${allFields().join(", ")}` };
        if (!wanted.ignore.names.length && !wanted.count.names.length) return { error: "Say which items to ignore or count again." };
        const types = resolveTypes(input.type);
        if (!types.length) {
          return { error: `No vehicle type matches "${input.type}". Types in this node: ${nodeTypes().join(", ")}. Ask the user which one.` };
        }
        const made = [];
        for (const type of types) {
          if (actions.length >= MAX_ACTIONS) break;
          const current = disregardsFor(D.disregards, type);
          const next = [...new Set([...current, ...wanted.ignore.names])].filter((f) => !wanted.count.names.includes(f));
          const same = next.length === current.length && next.every((f) => current.includes(f));
          if (same) continue;
          const rules = { ...D.disregards };
          for (const k of Object.keys(rules)) if (normalizeTitle(k) === normalizeTitle(type)) delete rules[k];
          rules[type] = next;
          const ofType = D.vehicles.filter((v) => normalizeTitle(v.type) === normalizeTitle(type));
          const moves = {}; // "UNAVAILABLE → DEPLOYED": 3
          for (const v of ofType) {
            const ev = todayEvents.get(v.id) ?? [];
            const before = deployability(v, D.disregards, ev).status;
            const after = deployability(v, rules, ev).status;
            if (before !== after) {
              const k = `${statusLabel(before)} → ${statusLabel(after)}`;
              moves[k] = (moves[k] ?? 0) + 1;
            }
          }
          const added = next.filter((f) => !current.includes(f));
          const removed = current.filter((f) => !next.includes(f));
          const action = {
            id: `a${actions.length + 1}`,
            kind: "disregard",
            title: `Disregards for every ${type}`,
            changes: [
              ...(added.length ? [{ field: "Stop counting", from: "", to: added.join(", ") }] : []),
              ...(removed.length ? [{ field: "Count again", from: "", to: removed.join(", ") }] : []),
              { field: "Ignored list", from: current.join(", ") || "none", to: next.join(", ") || "none" },
              {
                field: "Vehicles",
                from: "",
                to: `${ofType.length} ${type}` + (Object.keys(moves).length ? ` (${Object.entries(moves).map(([k, n]) => `${n} ${k}`).join(", ")})` : " (no status changes)"),
              },
            ],
            request: { method: "PUT", path: "/disregards", body: { type, ignored: next } },
          };
          actions.push(action);
          made.push({ type, vehicles: ofType.length, statusChanges: moves });
          rememberAction(
            "propose_disregard",
            { type, ignore: wanted.ignore.names, count: wanted.count.names },
            { tool: "propose_disregard", input: { type, ignore: removed, count: added } }
          );
        }
        if (!made.length) return { error: `Nothing would change - ${types.join(", ")} already ${wanted.ignore.names.length ? "ignore" : "count"} those items.` };
        return { prepared: true, ...(memo.notes.length ? { assumed: memo.notes.join("; ") } : {}), cards: made, note: "One card per vehicle type. Waiting for the user to press Confirm - NOT saved yet." };
      },

      propose_criteria(input) {
        if (user.role !== "admin") {
          return { error: "Only an Admin can change criteria. A Fleet Commander can stop an item counting for a vehicle type instead, e.g. \"ignore AIRCON for all 6 TON GS\"." };
        }
        if (actions.length >= MAX_ACTIONS) return { error: `At most ${MAX_ACTIONS} changes in one go.` };
        const LABEL = { MAINTENANCE: "Maintenance (Y/N)", BLOCKED: "Blocked field", IGNORE: "Not a criteria (never counted)" };
        const find = (name) => {
          const key = String(name ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
          return D.criteria.find((c) => c.name.toUpperCase().replace(/[^A-Z0-9]/g, "") === key) ??
            D.criteria.find((c) => c.name === resolveFields([name]).names[0]);
        };
        const set = [];
        const changes = [];
        const undoSet = [];
        const undoRemove = [];
        for (const item of Array.isArray(input.set) ? input.set : []) {
          const category = String(item?.category ?? "").toUpperCase();
          if (!LABEL[category]) return { error: `Category must be MAINTENANCE, BLOCKED or IGNORE (got ${item?.category}).` };
          const existing = find(item?.name);
          const name = existing?.name ?? String(item?.name ?? "").replace(/\s+/g, " ").trim().toUpperCase();
          if (!name) return { error: "A criteria needs a name." };
          if (existing?.category === category) continue;
          set.push({ name, category });
          if (existing) undoSet.push({ name, category: existing.category });
          else undoRemove.push(name);
          changes.push({ field: name, from: existing ? LABEL[existing.category] : "(new)", to: LABEL[category] });
        }
        const remove = [];
        for (const raw of Array.isArray(input.remove) ? input.remove : []) {
          const existing = find(raw);
          if (!existing) return { error: `No criteria called ${raw}.` };
          remove.push(existing.name);
          undoSet.push({ name: existing.name, category: existing.category });
          changes.push({ field: existing.name, from: LABEL[existing.category], to: "(removed)" });
        }
        if (!changes.length) return { error: "Nothing would change - the criteria already look like that." };
        const action = {
          id: `a${actions.length + 1}`,
          kind: "criteria",
          title: "Criteria for the whole fleet",
          changes,
          request: { method: "PUT", path: "/criteria", body: { set, remove } },
        };
        actions.push(action);
        rememberAction("propose_criteria", { set, remove }, { tool: "propose_criteria", input: { set: undoSet, remove: undoRemove } });
        return { prepared: true, card: action.title, changes, note: "Applies to every vehicle in this node. Waiting for the user to press Confirm - NOT saved yet." };
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
        const undo = { mid: v.mid };
        for (const f of Object.keys(patch.blocks ?? {})) (undo.blocks ??= {})[f] = v.blocks?.[f]?.value ?? "";
        for (const f of Object.keys(patch.maintenance ?? {})) (undo.maintenance ??= {})[f] = v.maintenance?.[f]?.level ?? "";
        if ("remarks" in patch) undo.remarks = v.remarks ?? "";
        if ("type" in patch) undo.type = v.type;
        const { mid: _m, ...same } = input;
        rememberAction("propose_vehicle_change", { mid: v.mid, ...same }, { tool: "propose_vehicle_change", input: undo });
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
        rememberAction("propose_new_vehicle", { ...input }, null);
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
        rememberAction("propose_booking", { ...input }, null);
        return { prepared: true, card: action.title, note: "Waiting for the user to press Confirm - NOT saved yet." };
      },
    };

    // remember what was looked up, for "those", "them", "the same"
    const pick = (a) => {
      const f = Object.fromEntries(["type", "commander", "status", "reason"].filter((k) => a?.[k]).map((k) => [k, String(a[k]).slice(0, 40)]));
      return Object.keys(f).length ? f : null;
    };
    const lookups = {
      search_vehicles(a, r) {
        const mids = r.vehicles?.map((v) => v.mid) ?? r.rows?.map((x) => String(x).split("|")[0].trim()) ?? [];
        if (mids.length) memo.lastList = { mids: mids.slice(0, 60), found: r.found ?? mids.length, filters: pick(a) };
      },
      get_vehicle(a, r) {
        if (r.mid) memo.lastList = { mids: [r.mid], found: 1, filters: null };
      },
      fleet_summary(a) {
        memo.filters = pick(a);
      },
      analyse_fleet(a) {
        memo.filters = pick(a);
      },
    };
    for (const [name, fn] of Object.entries(lookups)) {
      const original = handlers[name];
      handlers[name] = (args = {}) => {
        const r = original(args);
        if (r && !r.error) fn(args, r);
        return r;
      };
    }
    // what goes back to the app (and comes back with the next question)
    const context = () => ({ lastList: memo.lastList, filters: memo.filters, lastAction: memo.lastAction });

    return { list: TOOLS, handlers, actions, nodeName, memo, context };
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
          "You cannot delete vehicles, change accounts or passwords - explain which page does that instead. " +
          "Disregards (per vehicle type, every vehicle of that type): propose_disregard. Criteria (Admin only, whole fleet): propose_criteria. " +
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
          // (Gemini "thinking" models need more room for the same answer)
          max_tokens: /gemini/i.test(model ?? "") ? 4096 : 2000,
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
