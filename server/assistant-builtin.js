// The BUILT-IN assistant: no AI service, no API key, nothing leaves the app, free.
//
// It understands the common things people ask, with simple rules:
//   - how-to questions        -> the matching part of the user guide (assistant-guide.js)
//   - "how many / summary"    -> live counts
//   - "which are unavailable / on tasking / 6 TON GS" -> lists
//   - "21714" / "why is 21714 down" -> that vehicle
//   - "set 21714 aircon N", "put 21717 on tasking XCA", "clear VOR on 21718",
//     "21714 tyres Y and MLC N" -> change cards (saved only after Confirm)
// It uses the same tools (and the same permission checks) as the AI assistants.
import { HELP_GUIDE } from "./assistant-guide.js";
import { BLOCK_FIELDS, MAINTENANCE_FIELDS, DEPLOY_LABELS } from "../shared/config.js";

// ---------------------------------------------------------------- help search

const STOP = new Set(
  "a an the to of in on for and or is are do does how i my me we can what which where when why you your it this that with be by from at as page vehicle vehicles"
    .split(" ")
);
const words = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => w.replace(/(ing|ed|es|s)$/, ""));

// the guide split into sections: [{ title, text, words }]
const SECTIONS = (() => {
  const out = [];
  let current = null;
  for (const line of HELP_GUIDE.split("\n")) {
    const h = /^(#{2,3})\s+(.*)$/.exec(line);
    if (h) {
      current = { title: h[2].trim(), lines: [] };
      out.push(current);
    } else if (current && line.trim()) current.lines.push(line);
  }
  return out.map((s) => ({ ...s, text: s.lines.join("\n"), words: new Set(words(`${s.title} ${s.title} ${s.lines.join(" ")}`)) }));
})();

// For the AI: the guide's section titles, and one section by (part of) its title or keywords
export const guideTitles = () => SECTIONS.map((x) => x.title);
export function guideSection(topic) {
  const t = String(topic ?? "").toLowerCase().trim();
  const byTitle = SECTIONS.find((x) => x.title.toLowerCase().includes(t)) ?? SECTIONS.find((x) => t.includes(x.title.toLowerCase().split(/[ (:]/)[0]));
  if (byTitle) return `${byTitle.title}\n${byTitle.text}`;
  return helpAnswer(t) ?? `No guide section for "${topic}". Sections: ${guideTitles().join("; ")}`;
}

function helpAnswer(question) {
  const q = words(question);
  if (!q.length) return null;
  const scored = SECTIONS.map((s) => {
    const titleWords = new Set(words(s.title));
    const score = q.reduce((n, w) => n + (s.words.has(w) ? 1 : 0) + (titleWords.has(w) ? 2 : 0), 0);
    return { s, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length || scored[0].score < Math.min(2, q.length)) return null;
  const best = scored[0].s;
  const also = scored.slice(1, 3).filter((x) => x.score >= scored[0].score - 1).map((x) => x.s.title);
  return `**${best.title}**\n${best.text}${also.length ? `\n\nSee also: ${also.join(", ")}.` : ""}`;
}

// how-to topics -> the guide section that answers them (first match wins)
const HOWTO = [
  [/\b(import|upload|excel file|commanders?'? files?|macro)/, "Importing Excel"],
  [/\b(book|booking|calendar|schedul)/, "Calendar"],
  [/\b(password|username|display name|log ?out|log ?in|sign ?up|account)/, "Accounts and roles"],
  [/\b(export|download)/, "Exporting"],
  [/\b(worksheet|claim|my sheet)/, "Worksheets"],
  [/\b(disregard|ignore.*type)/, "Manage Disregards"],
  [/\b(criteria|new column|classif)/, "Manage Criteria"],
  [/\b(y\/n|maintenance|aircon|tyres?|mlc|avi|item)/, "Edit Maintenance Level"],
  [/\b(block|unblock|vor|tasking|standby|overseas|tloan|self drive)/, "Edit Blocked Vehicles"],
  [/\b(add|new|edit|delete|remove|assign|filter).*\bvehicle|vehicle.*\b(add|edit|delete|remove|assign)/, "Manage Vehicles"],
  [/\b(dashboard|readiness)/, "Fleet Commander Dashboard"],
  [/\b(phone|mobile|menu)/, "Accounts and roles"],
  [/\b(assistant|chat|bot)/, "This assistant"],
];

// ---------------------------------------------------------------- field names in free text

const ALIASES = {
  "VOR STATUS": ["vor"],
  "SELF DRIVE": ["selfdrive", "self-drive"],
  TLOAN: ["t loan", "t-loan"],
  "SAFETY BELTS / STRAP": ["safety belt", "safety belts", "seat belt", "seat belts", "seatbelt", "belts", "strap"],
  "KEY/FUEL TAG": ["fuel tag", "key tag", "key fuel tag"],
  "WHEEL-CHOKE": ["wheel chock", "wheel choke", "chock"],
  "SEATS CONDITION": ["seats", "seat condition"],
  "CUSHION COVER": ["cushion"],
  "P-PLATE": ["p plate", "pplate"],
  "AVI SLIP": ["avi"],
  "VC STICKER": ["vc"],
  "BII TOOL": ["bii"],
  FE: ["fire extinguisher"],
  TYRES: ["tyre", "tire", "tires"],
  AIRCON: ["air con", "air-con", "aircond"],
  CLEANINESS: ["cleanliness", "clean"],
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phraseRe = (phrase) =>
  new RegExp(`(?<![a-z0-9])${phrase.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(esc).join("[\\s\\-/_.]*")}(?![a-z0-9])`, "i");

function fieldMatchers() {
  const list = [
    ...BLOCK_FIELDS.map((f) => ({ name: f.name, kind: "block" })),
    ...MAINTENANCE_FIELDS.map((name) => ({ name, kind: "maintenance" })),
  ];
  const out = [];
  for (const f of list) {
    for (const p of [f.name, ...(ALIASES[f.name] ?? [])]) {
      if (p.replace(/[^a-z0-9]/gi, "").length < 2) continue;
      out.push({ ...f, phrase: p, re: phraseRe(p), len: p.length });
    }
  }
  return out.sort((a, b) => b.len - a.len); // "IVC 2" before "IVC", "VOR STATUS" before "VOR"
}

// every field mentioned in a piece of text: [{ name, kind, index, end }]
function findFields(text) {
  const found = [];
  const taken = [];
  for (const m of fieldMatchers()) {
    const hit = m.re.exec(text);
    if (!hit) continue;
    const start = hit.index;
    const end = start + hit[0].length;
    if (taken.some(([a, b]) => start < b && end > a)) continue; // inside a longer match
    if (found.some((f) => f.name === m.name)) continue;
    taken.push([start, end]);
    found.push({ name: m.name, kind: m.kind, index: start, end });
  }
  return found.sort((a, b) => a.index - b.index);
}

const YES = /^(y|yes|ok|okay|good|pass|passed|serviceable|svc|done|fixed|present|have|got|✓)$/i;
const NO = /^(n|no|not ok|bad|fail|failed|faulty|unserviceable|u\/s|us|missing|broken|spoilt|expired|❌)$/i;
const CLEAR = /\b(clear|clears|cleared|remove|removed|unblock|unblocked|release|released|reset|blank|empty|delete|cancel|off)\b/i;
const CHANGE = /\b(set|mark|change|update|put|make|clear|remove|unblock|release|reset|assign|send|move|is now|now|to [yn])\b/i;

// ---------------------------------------------------------------- the assistant

export function runBuiltin({ question, tools, today, user }) {
  const h = tools.handlers;
  const text = question.trim();
  const lower = text.toLowerCase();

  if (/^(hi|hello|hey|good (morning|afternoon|evening)|yo|sup)\b[\s!.]*$/i.test(text)) {
    return reply(`Hi ${user.name}! Ask me how to use a page, about your vehicles ("which are unavailable?"), or for a change ("set 21714 aircon N").`);
  }
  if (/^(thanks|thank you|ok|okay|noted|great|cool)\b[\s!.]*$/i.test(text)) return reply("You're welcome!");

  // "what does DEPLOYED mean", "what is a disregard"
  const term = /\b(?:what(?:'s| is| are| does)?|meaning of|define)\s+(?:an?\s+|the\s+)?([a-z /-]+?)(?:\s+mean)?\s*\??$/i.exec(text)?.[1]?.toLowerCase().trim();
  const GLOSSARY = [
    [/^(deployed|available|unavailable|ava|not ava|status|serviceable)/, "Vehicle status (how AVAILABLE / NOT AVAILABLE is worked out - same as the Excel criteria)"],
    [/^disregard/, "Manage Disregards (everyone)"],
    [/^criteri/, "Manage Criteria (Admin)"],
    [/^(blocked|blocked field|vor|vor status|tasking|standby|tloan|self drive|overseas)/, "Vehicle status (how AVAILABLE / NOT AVAILABLE is worked out - same as the Excel criteria)"],
    [/^(maintenance|item|y\/?n|maintenance item)/, "Vehicle status (how AVAILABLE / NOT AVAILABLE is worked out - same as the Excel criteria)"],
    [/^(worksheet|sheet|claim)/, "Worksheets (Fleet Commanders)"],
    [/^(booking|calendar)/, "Calendar (Manage Vehicles -> View: Calendar)"],
    [/^(admin|commander|fleet commander|role)/, "Accounts and roles"],
  ];
  const glossary = term && GLOSSARY.find(([re]) => re.test(term));
  if (glossary) {
    const sec = SECTIONS.find((x) => x.title === glossary[1]);
    if (sec) return reply(`**${sec.title}**\n${sec.text}`);
  }

  // MIDs mentioned (3+ digits, or things like "MID 155") that this user can see
  const candidates = [...new Set((text.match(/\b[A-Z]{0,3}\d{3,7}[A-Z]?\b/gi) ?? []).map((m) => m.toUpperCase()))];
  const midMention = /\bmid\s*(?:no\.?|number)?\s*:?\s*([a-z0-9-]+)/gi;
  for (const m of text.matchAll(midMention)) candidates.push(m[1].toUpperCase());
  const known = candidates.length ? h.search_vehicles({ mids: candidates, limit: 200 }).vehicles.map((v) => v.mid) : [];
  const unknownMids = candidates.filter((m) => /^\d{3,7}$/.test(m) && !known.includes(m));
  const fields = findFields(text);

  // ---- 0. a booking: "book 21714 21717 for tasking XCA tomorrow", "book 21714 servicing 12/11 to 14/11"
  if (/\b(book|booking|reserve|schedule)\b/i.test(lower) && (known.length || unknownMids.length) && !/\bhow\b/i.test(lower)) {
    if (!known.length) return reply(`I can't find vehicle ${unknownMids.join(", ")} among the vehicles you can see.`);
    const kind = /servic/i.test(lower) ? "servicing" : /maint/i.test(lower) ? "maintenance" : /\b(remind|note|other)\b/i.test(lower) ? "other" : "tasking";
    const dates = findDates(text, today);
    if (!dates.length) {
      return reply(`Which date? e.g. "book ${known[0]} for ${kind} XCA tomorrow" or "... 12/11 to 14/11".`);
    }
    const start = dates[0];
    const end = dates[1] && dates[1] >= start ? dates[1] : start;
    // the tasking / title words: what's left after taking out MIDs, dates and filler
    const rest = text
      .replace(/\b(book|booking|reserve|schedule|please|pls|for|on|from|to|until|till|and|the|vehicles?|mid|tasking|servicing|service|maintenance|reminder|other|today|tomorrow|tmr|tmrw|next|this|week|day|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)\b/gi, " ")
      .replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/gi, " ")
      .replace(/\b[A-Z]{0,3}\d{3,7}[A-Z]?\b/gi, " ")
      .replace(/[^a-z0-9'/() -]+/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
    const title = rest || kind.toUpperCase();
    const r = h.propose_booking({ kind, title, start, end, mids: known, tasking: kind === "tasking" ? title : undefined });
    if (!r.prepared) return reply(`I couldn't prepare that booking: ${r.error}`);
    return reply(`Here is the booking - check and press **Confirm** to save.${unknownMids.length ? `\n- Not found: ${unknownMids.join(", ")}` : ""}`);
  }

  // ---- 1. a change: "set 21714 aircon N", "put 21717 on tasking XCA",
  //         "21714 tyres Y and MLC N", "set 21714 tyres N and clear VOR on 21718"
  const asks = /^\s*(why|what|how|is|does|which|when|who|show|list)\b/i.test(lower) && !CHANGE.test(lower);
  const wantsChange = !asks && fields.length > 0 && (known.length > 0 || unknownMids.length > 0) && (CHANGE.test(lower) || fields.some((f) => valueAfter(text, f, fields) !== null));
  if (wantsChange) {
    if (!known.length) return reply(`I can't find vehicle ${unknownMids.join(", ")} among the vehicles you can see. Check the MID number.`);
    // each part of the sentence keeps its own vehicles and values
    const midsIn = (t) => known.filter((m) => new RegExp(`(?<![A-Z0-9])${esc(m)}(?![A-Z0-9])`, "i").test(t));
    const groups = [];
    let pending = [];
    let last = [];
    for (const clause of text.split(/\s*(?:,|;|\band\b|&|\bthen\b|\balso\b)\s*/i).filter((c) => c.trim())) {
      const mids = midsIn(clause);
      const fs = findFields(clause);
      if (!fs.length) {
        pending.push(...mids);
        continue;
      }
      const use = mids.length ? [...pending, ...mids] : pending.length ? pending : last;
      pending = [];
      last = use;
      groups.push({ clause, fields: fs, mids: use });
    }
    if (pending.length && groups.length) groups[groups.length - 1].mids.push(...pending);
    if (groups.length && !groups[0].mids.length) groups[0].mids = known;

    const perMid = new Map(); // mid -> { blocks, maintenance }
    const problems = [];
    for (const g of groups) {
      for (const f of g.fields) {
        let value = valueAfter(g.clause, f, g.fields);
        const clearing = CLEAR.test(segmentFor(g.clause, f, g.fields)) || (value !== null && /^(clear|blank|nil|none|-)$/i.test(value));
        const example = g.mids[0] ?? known[0];
        if (f.kind === "maintenance") {
          if (clearing) value = "";
          else if (value !== null && YES.test(value)) value = "Y";
          else if (value !== null && NO.test(value)) value = "N";
          else {
            problems.push(`${f.name} needs Y or N (e.g. "set ${example} ${f.name.toLowerCase()} N").`);
            continue;
          }
        } else {
          if (clearing) value = "";
          else if (!value) value = f.name === "VOR STATUS" ? "X" : null;
          if (value === null) {
            problems.push(`What should ${f.name} say? (e.g. "put ${example} on ${f.name.toLowerCase()} XCA").`);
            continue;
          }
        }
        for (const mid of g.mids) {
          const c = perMid.get(mid) ?? {};
          (c[f.kind === "maintenance" ? "maintenance" : "blocks"] ??= {})[f.name] = value;
          perMid.set(mid, c);
        }
      }
    }
    if (!perMid.size) return reply(problems.join("\n") || "Tell me the vehicle and the value, e.g. \"set 21714 aircon N\".");
    const results = [...perMid].map(([mid, changes]) => ({ mid, r: h.propose_vehicle_change({ mid, ...changes }) }));
    const ok = results.filter((x) => x.r.prepared);
    const failed = results.filter((x) => !x.r.prepared);
    const lines = [];
    if (ok.length) lines.push(`Here ${ok.length === 1 ? "is the change" : `are ${ok.length} changes`} - check and press **Confirm** to save.`);
    for (const x of failed) lines.push(`- ${x.mid}: ${x.r.error}`);
    if (unknownMids.length) lines.push(`- Not found: ${unknownMids.join(", ")}`);
    if (problems.length) lines.push(...problems.map((p) => `- ${p}`));
    return reply(lines.join("\n"));
  }

  // ---- 2. one or a few vehicles: "21714", "why is 21714 unavailable"
  if (known.length && known.length <= 5) {
    return reply(known.map((mid) => vehicleText(h.get_vehicle({ mid }))).join("\n\n"));
  }
  if (known.length > 5) {
    const list = h.search_vehicles({ mids: known, limit: 200 });
    return reply(listText(list, `${known.length} vehicles`));
  }
  if (unknownMids.length && !/\b(how|what|where|why)\b/.test(lower)) {
    return reply(`I can't find vehicle ${unknownMids.join(", ")} among the vehicles you can see.`);
  }

  // ---- 3. data questions
  const typeHit = matchType(text, h);
  const status = /\b(unavailable|not available|not ava|down|unserviceable|u\/s|broken|can'?t (be )?(used|deploy))\b/i.test(lower)
    ? "unavailable"
    : /\b(deployed|in use|out on)\b/i.test(lower)
      ? "deployed"
      : /\b(available|serviceable|ava|free|ready)\b/i.test(lower) && !/\bnot\b/i.test(lower)
        ? "available"
        : null;
  const reasonField = fields[0]?.name;
  const isData =
    /\b(how many|count|number of|total|summary|overview|readiness|status|which|list|show|who|what'?s? (is )?(down|out)|give|get|find|search|display|tell me|all|any|every|those|vehicles? (on|with|that|in))\b/i.test(lower) ||
    // just naming a field or type: "overseas vehicles", "6 TON GS", "standby?"
    (fields.length > 0 && !CHANGE.test(lower)) ||
    (typeHitEarly(text, h) && text.split(/\s+/).length <= 6);

  if (isData && (status || typeHit || reasonField) && !/\bhow (do|can|to)\b/i.test(lower)) {
    if (/\b(how many|count|number of|total)\b/i.test(lower) && !reasonField && !/\b(which|list|show)\b/i.test(lower)) {
      return reply(summaryText(h.fleet_summary({ type: typeHit ?? undefined }), typeHit, status));
    }
    const list = h.search_vehicles({
      status: status ?? undefined,
      type: typeHit ?? undefined,
      reason: reasonField ?? undefined,
      limit: 60,
    });
    const label = [typeHit, status && { unavailable: DEPLOY_LABELS.no, deployed: DEPLOY_LABELS.deployed, available: DEPLOY_LABELS.yes }[status], reasonField && `with ${reasonField}`]
      .filter(Boolean)
      .join(" ");
    return reply(listText(list, label || "vehicles"));
  }
  if (/\b(summary|overview|readiness|how many|how's the fleet|fleet status|status today|total)\b/i.test(lower) && !/\bhow (do|can|to)\b/i.test(lower)) {
    return reply(summaryText(h.fleet_summary({}), null, null));
  }
  if (/\b(bookings?|calendar|scheduled|booked)\b/i.test(lower) && /\b(what|which|list|show|any|today|tomorrow|week)\b/i.test(lower) && !/\bhow (do|can|to)\b/i.test(lower)) {
    const b = h.list_bookings({ from: today });
    if (!b.bookings.length) return reply("No bookings from today on.");
    return reply(
      `Bookings from today (${today}):\n` +
        b.bookings.slice(0, 20).map((e) => `- ${e.start}${e.end !== e.start ? ` to ${e.end}` : ""}: **${e.title}** (${e.kind}${e.tasking ? ` ${e.tasking}` : ""}) - ${e.vehicles.join(", ")}`).join("\n")
    );
  }

  // ---- 4. how-to: the user guide (topic first, then the best-matching section)
  if (/\b(how|where|can i|can we|steps?|way to|help|guide|explain)\b/i.test(lower)) {
    const topic = HOWTO.find(([re]) => re.test(lower));
    const sec = topic && SECTIONS.find((x) => x.title.startsWith(topic[1]));
    if (sec) return reply(`**${sec.title}**\n${sec.text}`);
  }
  const help = helpAnswer(text);
  if (help) return reply(help);

  return reply(
    `Sorry, I didn't understand that. I'm the built-in assistant, so keep it simple - for example:\n` +
      `- "How do I import Excel files?"\n- "How many vehicles are unavailable?"\n- "Which 6 TON GS are down?"\n` +
      `- "Why is 21714 unavailable?"\n- "Set 21714 aircon N"\n- "Put 21717 on tasking XCA"\n- "Clear VOR on 21718"` +
      (user.role === "admin" ? "" : "")
  );

  function reply(textOut) {
    return { reply: textOut, actions: tools.actions };
  }
}

// ---------------------------------------------------------------- dates in free text

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
};
const addDays = (isoDay, n) => {
  const [y, m, d] = isoDay.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
};

// dates in the order they're written (Singapore style: day before month)
export function findDates(text, today) {
  const [ty] = today.split("-").map(Number);
  const found = [];
  const re = /\b(today|tomorrow|tmr|tmrw|day after tomorrow|next\s+(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*|(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*|\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*(?:\s+\d{4})?)\b/gi;
  for (const m of text.matchAll(re)) {
    const t = m[1].toLowerCase();
    let d = null;
    if (t === "today") d = today;
    else if (t === "tomorrow" || t === "tmr" || t === "tmrw") d = addDays(today, 1);
    else if (t === "day after tomorrow") d = addDays(today, 2);
    else if (/^(next\s+)?(mon|tue|wed|thu|fri|sat|sun)/.test(t)) {
      const want = DAYS.indexOf(/(mon|tue|wed|thu|fri|sat|sun)/.exec(t)[1]);
      const [y, mo, da] = today.split("-").map(Number);
      const now = new Date(Date.UTC(y, mo - 1, da)).getUTCDay();
      let diff = (want - now + 7) % 7 || 7;
      if (t.startsWith("next") && diff < 7) diff += 0;
      d = addDays(today, diff);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(t)) d = t;
    else if (/^\d{1,2}[/.-]\d{1,2}/.test(t)) {
      const [a, b, c] = t.split(/[/.-]/).map(Number);
      const year = c ? (c < 100 ? 2000 + c : c) : ty;
      d = iso(year, b, a);
      if (d && !c && d < today) d = iso(year + 1, b, a); // "5/1" in December = next January
    } else {
      const mm = /(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/.exec(t);
      const month = MONTHS.indexOf(mm[2].slice(0, 3)) + 1;
      const year = mm[3] ? Number(mm[3]) : ty;
      d = iso(year, month, Number(mm[1]));
      if (d && !mm[3] && d < today) d = iso(year + 1, month, Number(mm[1]));
    }
    if (d) found.push(d);
  }
  return found;
}

// the piece of text that belongs to one field ("... aircon N and tyres Y")
function segmentFor(text, f, fields) {
  const i = fields.indexOf(f);
  const next = fields[i + 1];
  const start = i === 0 ? 0 : fields[i - 1].end;
  return text.slice(start, next ? next.index : text.length);
}

// the value written after a field name: "tasking XCA" -> "XCA", "aircon to N" -> "N"
function valueAfter(text, f, fields) {
  const i = fields.indexOf(f);
  const next = fields[i + 1];
  let raw = text.slice(f.end, next ? next.index : text.length);
  raw = raw
    .replace(/\b(and|&|also|then|plus)\s*$/i, "")
    .replace(/[,;.!?]+\s*$/, "")
    .replace(/\b(for|on|of)\s+(mid\s*)?[A-Z]{0,3}\d{3,7}[A-Z]?\b.*$/i, "")
    .replace(/\b(mid\s*)?\d{3,7}\b/gi, " ")
    .replace(/^\s*(field|item|status|value|level)?\s*(to|as|=|:|is|=>|->|with|for|be)?\s*/i, "")
    .replace(/\b(please|pls|thanks|thank you)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  // text BEFORE the field: "mark 21714 N for aircon"
  if (!raw) {
    const before = text.slice(i === 0 ? 0 : fields[i - 1].end, f.index).replace(/\b\d{3,7}\b/g, " ");
    const yn = /\b(y|n|yes|no|ok|not ok|faulty|serviceable|unserviceable)\s*(for|on)?\s*$/i.exec(before.trim());
    if (yn) return yn[1];
    return null;
  }
  if (/^(clear|blank|nil|none|-)$/i.test(raw)) return raw;
  return raw.toUpperCase().slice(0, 100);
}

function typeHitEarly(text, h) {
  return !!matchType(text, h);
}

function matchType(text, h) {
  const types = [...new Set(h.search_vehicles({ limit: 200 }).vehicles.map((v) => v.type))];
  const all = h.fleet_summary({}).perType ? Object.keys(h.fleet_summary({}).perType) : types;
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9()]+/g, " ")} `;
  return (
    all
      .sort((a, b) => b.length - a.length)
      .find((t) => lower.includes(` ${t.toLowerCase().replace(/[^a-z0-9()]+/g, " ").trim()} `)) ?? null
  );
}

function summaryText(s, type, status) {
  const head = `${type ? `**${type}**` : "Your fleet"} today (${s.date}): **${s.total}** vehicles`;
  const lines = [
    head,
    `- ${DEPLOY_LABELS.yes}: ${s[DEPLOY_LABELS.yes]}`,
    `- ${DEPLOY_LABELS.deployed}: ${s[DEPLOY_LABELS.deployed]}`,
    `- ${DEPLOY_LABELS.no}: ${s[DEPLOY_LABELS.no]}`,
    `- Readiness: ${s.readinessPercent}%`,
  ];
  if (s.topReasons.length) lines.push("", `Most common reasons: ${s.topReasons.slice(0, 6).map(([r, n]) => `${r} (${n})`).join(", ")}`);
  if (!type) {
    const types = Object.entries(s.perType).sort((a, b) => b[1].unavailable - a[1].unavailable).slice(0, 6);
    if (types.length) {
      lines.push("", "By type (available / deployed / unavailable):");
      for (const [t, c] of types) lines.push(`- ${t}: ${c.available} / ${c.deployed} / ${c.unavailable}`);
    }
  }
  if (status) lines.push("", `Ask "which ${type ?? ""} are ${status}" for the list.`.replace(/\s+/g, " "));
  return lines.join("\n");
}

function listText(list, rawLabel) {
  const label = /^with\b/.test(rawLabel) ? `vehicles ${rawLabel}` : rawLabel;
  if (!list.found) return `No ${label} found.`;
  const lines = [`**${list.found}** ${label}${list.found > list.shown ? ` (first ${list.shown})` : ""}:`];
  for (const v of list.vehicles) {
    lines.push(`- **${v.mid}** ${v.type} - ${v.status}${v.reasons.length ? `: ${v.reasons.join(", ")}` : ""}`);
  }
  return lines.join("\n");
}

function vehicleText(v) {
  if (v.error) return v.error;
  const lines = [`**${v.mid}** - ${v.type} - **${v.status}**`, `Commander: ${v.commander}`];
  if (v.reasons.length) lines.push(`Why: ${v.reasons.join(", ")}`);
  const blocked = v.blockedFields.filter((f) => f.value);
  if (blocked.length) lines.push(`Blocked fields: ${blocked.map((f) => `${f.field}: ${f.value}${f.counted ? "" : " (ignored)"}`).join(", ")}`);
  const ns = v.maintenanceItems.filter((i) => i.value === "N");
  if (ns.length) lines.push(`Items N: ${ns.map((i) => `${i.item}${i.counted ? "" : " (ignored)"}`).join(", ")}`);
  if (v.remarks) lines.push(`Remarks: ${v.remarks}`);
  if (v.upcomingBookings.length) lines.push(`Bookings: ${v.upcomingBookings.map((b) => `${b.title} ${b.start}${b.end !== b.start ? `-${b.end}` : ""}`).join("; ")}`);
  return lines.join("\n");
}
