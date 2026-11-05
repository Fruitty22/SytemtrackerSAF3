// Reading vehicles out of Excel files - the website version of the workbook
// macros, so files only have to be imported ONCE:
//
//   detectLayout()   find the header row, MID and type columns, and every
//                    criteria column - with the macro's fuzzy title matching
//                    ("Veh No. (MID)", "Type of Vehicle", "WHEEL -CHOKE ")
//   checkSheet()     the macro's "Check File" (SOP) report for one sheet
//   scanCriteria()   the macro's "Scan Criteria": columns that are not
//                    classified yet, across every sheet
//   readVehicles()   the cleaned vehicles on one sheet
//
// Plain functions (no React), so they're easy to test and adjust.
import { normalizeLevel } from "./vehicle.js";
import { sheetKey, nameInSheet } from "../../shared/naming.js";
import { isCoreField, matchCriteria, normalizeTitle, titlesMatch } from "../../shared/titles.js";

const MID_HEADER = /\bMID\b/i;

// "3SG Chong_3SG Kim Jungwoo" -> "3sgchong3sgkimjungwoo"
export const normalizeName = sheetKey;

// The workbook's own settings / report sheets (IsSystemSheet). They hold no
// fleet of their own; CriteriaConfig and DisregardConfig are read for their settings.
export const CONFIG_SHEETS = [
  "CriteriaConfig",
  "DisregardConfig",
  "DisregardLog",
  "Criteria List",
  "Disregard List",
];
export const isConfigSheet = (name) => CONFIG_SHEETS.some((s) => sheetKey(s) === sheetKey(name));

// 0 -> A, 25 -> Z, 26 -> AA ...
export const columnLetter = (index) => {
  if (index === "" || index == null) return "-";
  let letters = "";
  for (let n = Number(index) + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
};

const cellText = (row, index) =>
  index === "" || index == null ? "" : String(row?.[index] ?? "").trim();

// A MID cell: has a digit, is short, isn't a sentence
export const looksLikeMid = (value) => {
  const text = String(value ?? "").trim();
  return text.length > 0 && text.length <= 20 && /\d/.test(text) && !/\s{2,}/.test(text);
};

// a heading that is just "MID", "MID NO.", "MID NUMBER", "MID #"
const PLAIN_MID_HEADER = /^MID\s*(NO\.?|NUMBER|NUM|#)?\s*:?$/i;

// criteria that are counted (Maintenance / Blocked), not "ignore"
const counted = (criteria) => criteria.filter((c) => c.category === "MAINTENANCE" || c.category === "BLOCKED");

// Columns that are criteria, like the macro's GetColByTitle: for each criteria,
// the first column whose title means the same.
// -> { "VOR STATUS": 36, "WHEEL-CHOKE": 15, ... }
export function findFieldColumns(header, criteria, skip = []) {
  const columns = {};
  const used = new Set(skip.filter((i) => i !== "" && i != null));
  for (const c of counted(criteria)) {
    const i = header.findIndex((h, index) => !used.has(index) && String(h ?? "").trim() && titlesMatch(h, c.name));
    if (i >= 0) {
      columns[c.name] = i;
      used.add(i);
    }
  }
  return columns;
}

// Column titles on the header row that are not a fixed column and not in the
// criteria list at all (not even as "ignore") -> [{ title, index }]
export function unclassifiedColumns(header, criteria, layout) {
  const out = [];
  header.forEach((raw, index) => {
    const title = String(raw ?? "").replace(/\s+/g, " ").trim();
    if (!title || index === layout?.mid || index === layout?.type) return;
    if (isCoreField(title)) return;
    if (matchCriteria(title, criteria)) return;
    out.push({ title, index });
  });
  return out;
}

// Find where the vehicle table is on a sheet: the "MID" heading with the most
// MID-looking values under it (looks at the first 40 rows), the type column,
// the remarks column and every criteria column on the same header row.
// Returns null if the sheet has no vehicle list.
export function detectLayout(rows, criteria) {
  const candidates = [];
  const limit = Math.min(rows.length, 40);
  for (let r = 0; r < limit; r += 1) {
    const row = rows[r] ?? [];
    const filled = row.filter((cell) => String(cell ?? "").trim()).length;
    row.forEach((cell, c) => {
      const heading = String(cell ?? "").trim();
      if (!heading || heading.length > 30) return;
      if (!MID_HEADER.test(heading) && !titlesMatch(heading, "MID")) return;
      let count = 0;
      for (let k = r + 1; k < Math.min(rows.length, r + 31); k += 1) {
        if (looksLikeMid(rows[k]?.[c])) count += 1;
      }
      if (count > 0) {
        candidates.push({ r, c, count, plain: PLAIN_MID_HEADER.test(heading), filled });
      }
    });
  }
  if (candidates.length === 0) return null;
  // prefer a plain "MID" heading, then more MIDs under it, then a fuller header row
  candidates.sort(
    (a, b) => Number(b.plain) - Number(a.plain) || b.count - a.count || b.filled - a.filled
  );
  const best = candidates[0];
  return layoutFromHeader(rows, best.r + 1, best.c, criteria);
}

// The layout for a given header row (Excel row number) and MID column
export function layoutFromHeader(rows, headerRow, mid, criteria, overrides = {}) {
  const raw = (rows[headerRow - 1] ?? []).map((h) => String(h ?? "").trim());
  const upper = raw.map((h) => h.toUpperCase());
  const find = (test) => {
    const i = raw.findIndex((h, index) => index !== mid && h && test(h, upper[index]));
    return i >= 0 ? i : "";
  };
  let type = "type" in overrides ? overrides.type : find((h) => titlesMatch(h, "VEHICLE TYPE"));
  if (type === "") type = find((_, u) => /TYPE/.test(u) || /PLATFORM|MODEL/.test(u) || /^VEH(ICLE)?S?$/.test(u));
  const remarks = find((h) => titlesMatch(h, "REMARK"));
  return {
    headerRow,
    mid,
    type,
    remarks,
    fixedType: overrides.fixedType ?? "",
    fields: findFieldColumns(raw, criteria, [mid, type, remarks]),
  };
}

// The vehicles on one sheet, using a layout from detectLayout (or set by hand).
// Each vehicle gets the values of every criteria column found on the sheet
// (blank cells included, so re-importing can clear a value).
// blockNames: the names of the Blocked criteria (everything else is a Y/N item)
export function readVehicles(rows, layout, blockNames) {
  if (!layout || layout.mid === "" || layout.mid == null) return [];
  const isBlock = new Set(blockNames);
  const fields = Object.entries(layout.fields ?? {});
  const out = [];
  const seen = new Set();
  rows.slice(layout.headerRow).forEach((row, i) => {
    const mid = cellText(row, layout.mid).toUpperCase().replace(/\s+/g, " ");
    if (!looksLikeMid(mid) || seen.has(mid)) return;
    seen.add(mid);
    const maintenance = {};
    const blocks = {};
    for (const [field, col] of fields) {
      if (isBlock.has(field)) blocks[field] = cellText(row, col).replace(/\s+/g, " ");
      else maintenance[field] = normalizeLevel(cellText(row, col));
    }
    out.push({
      mid,
      type: cleanType(layout.type === "" ? layout.fixedType ?? "" : cellText(row, layout.type)),
      maintenance,
      blocks,
      remarks: cellText(row, layout.remarks).replace(/\s+/g, " "),
      line: layout.headerRow + i + 1, // Excel row number
    });
  });
  return out;
}

// "  Vamtac   crew " -> "VAMTAC CREW"
export const cleanType = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

// Types that differ only in spaces, case or punctuation are the same type
// (like the macro's GetAllVehicleTypes). Returns a function that turns any
// spelling into the one already in use.
export function typeStandardizer(knownTypes) {
  const byKey = new Map();
  for (const t of knownTypes) {
    const key = normalizeTitle(t);
    if (key && !byKey.has(key)) byKey.set(key, cleanType(t));
  }
  return (type) => {
    const clean = cleanType(type);
    const key = normalizeTitle(clean);
    if (!key) return clean;
    if (!byKey.has(key)) byKey.set(key, clean);
    return byKey.get(key);
  };
}

// ---------------------------------------------------------------- Check File

// The macro's CheckFileCompliance for one sheet:
//   [ERROR]   no MID column, no vehicle type column, the same MID twice
//   [WARNING] a row with a type but no MID, a MID but no type,
//             a column that is not classified yet
// -> { sheet, headerRow, rowCount, errors, warnings, items: [{ level, text, details }] }
export function checkSheet(name, rows, layout, criteria) {
  const items = [];
  let errors = 0;
  let warnings = 0;
  const add = (level, text, details = []) => {
    items.push({ level, text, details });
    if (level === "error") errors += details.length || 1;
    if (level === "warning") warnings += details.length || 1;
  };

  if (!layout) {
    add("error", "No MID column found.");
    return { sheet: name, headerRow: null, rowCount: 0, errors, warnings, items };
  }
  add("ok", `MID column found (column ${columnLetter(layout.mid)}).`);
  if (layout.type === "") {
    if (layout.fixedType) add("ok", `Every vehicle on this sheet is a ${layout.fixedType}.`);
    else add("error", "No Vehicle Type column found.");
  } else add("ok", `Vehicle Type column found (column ${columnLetter(layout.type)}).`);

  // data rows: from under the header to the last row with a MID
  let last = layout.headerRow;
  for (let r = rows.length - 1; r >= layout.headerRow; r -= 1) {
    if (cellText(rows[r], layout.mid)) {
      last = r + 1;
      break;
    }
  }
  const counts = new Map();
  const blankMid = [];
  const blankType = [];
  const notMid = [];
  for (let r = layout.headerRow; r < last; r += 1) {
    const row = rows[r];
    const mid = cellText(row, layout.mid).toUpperCase();
    const type = layout.type === "" ? layout.fixedType : cellText(row, layout.type);
    const excelRow = r + 1;
    if (!mid && type) blankMid.push(`Row ${excelRow} (Type: ${type})`);
    else if (mid && layout.type !== "" && !type) blankType.push(`Row ${excelRow} (MID: ${mid})`);
    if (mid && !looksLikeMid(mid)) notMid.push(`Row ${excelRow} ("${mid}")`);
    else if (mid && type) counts.set(mid, [...(counts.get(mid) ?? []), excelRow]);
  }
  const rowCount = Math.max(0, last - layout.headerRow);
  items.push({ level: "info", text: `Header row: ${layout.headerRow} · data rows found: ${rowCount}`, details: [] });

  const dups = [...counts.entries()].filter(([, at]) => at.length > 1);
  if (dups.length === 0) add("ok", "No duplicate MIDs within this sheet.");
  else {
    add(
      "error",
      `${dups.length} duplicate MID(s) found - only the first row of each is imported:`,
      dups.map(([mid, at]) => `MID ${mid} (rows ${at.join(", ")})`)
    );
  }
  if (blankMid.length === 0) add("ok", "No rows missing MID.");
  else add("warning", `${blankMid.length} row(s) have a Vehicle Type but no MID (not imported):`, blankMid);
  if (layout.type !== "") {
    if (blankType.length === 0) add("ok", "No rows missing Vehicle Type.");
    else add("warning", `${blankType.length} row(s) have a MID but no Vehicle Type:`, blankType);
  }
  if (notMid.length) {
    add("warning", `${notMid.length} row(s) have something in the MID column that isn't a vehicle number (not imported):`, notMid);
  }

  const header = (rows[layout.headerRow - 1] ?? []).map((h) => String(h ?? "").trim());
  const unknown = unclassifiedColumns(header, criteria, layout);
  if (unknown.length === 0) add("ok", "All columns are recognized / classified.");
  else {
    add(
      "warning",
      `${unknown.length} unrecognized column(s) (not yet classified - see Scan criteria):`,
      unknown.map((u) => `${u.title} (column ${columnLetter(u.index)})`)
    );
  }

  // which columns were read as criteria, and under what title
  const renamed = Object.entries(layout.fields)
    .filter(([field, col]) => normalizeTitle(header[col]) !== normalizeTitle(field))
    .map(([field, col]) => `"${header[col].replace(/\s+/g, " ")}" -> ${field}`);
  if (renamed.length) items.push({ level: "info", text: "Column titles standardised:", details: renamed });

  return { sheet: name, headerRow: layout.headerRow, rowCount, errors, warnings, items };
}

// ---------------------------------------------------------------- Scan Criteria

const YES_NO = new Set(["Y", "N", "YES", "NO"]);
const looksLikeDateOrNumber = (v) =>
  /^\d+([./-]\d+){0,2}$/.test(v) || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(v) || !Number.isNaN(Date.parse(v));

// What a column probably is, from the values in it
function suggestCategory(values) {
  if (values.length === 0) return null;
  const yn = values.filter((v) => YES_NO.has(v.toUpperCase())).length;
  if (yn / values.length >= 0.6) return "MAINTENANCE";
  const dates = values.filter(looksLikeDateOrNumber).length;
  if (dates / values.length >= 0.6) return "IGNORE";
  return null;
}

// The macro's ScanAllCriteria: every column on every fleet sheet that is not
// classified yet. Columns that mean the same (fuzzy match) are one entry.
// sheets: [{ name, rows, layout }]
// -> [{ title, sheets: ["3SG Rizq", ...], samples: ["Y", "N"], suggestion }]
export function scanCriteria(sheets, criteria) {
  const found = [];
  for (const s of sheets) {
    if (!s.layout) continue;
    const header = (s.rows[s.layout.headerRow - 1] ?? []).map((h) => String(h ?? "").trim());
    for (const { title, index } of unclassifiedColumns(header, criteria, s.layout)) {
      let entry = found.find((f) => titlesMatch(f.title, title));
      if (!entry) {
        entry = { title, sheets: [], values: [] };
        found.push(entry);
      }
      if (!entry.sheets.includes(s.name)) entry.sheets.push(s.name);
      for (const row of s.rows.slice(s.layout.headerRow, s.layout.headerRow + 400)) {
        const v = cellText(row, index);
        if (v && entry.values.length < 200) entry.values.push(v);
      }
    }
  }
  return found.map(({ values, ...f }) => ({
    ...f,
    samples: [...new Set(values)].slice(0, 6),
    filled: values.length,
    suggestion: suggestCategory(values),
  }));
}

// ---------------------------------------------------------------- settings sheets

const rowsAfterHeader = (rows, test) => {
  const h = rows.findIndex((r) => (r ?? []).some((c) => test(String(c ?? "").trim())));
  return h < 0 ? { header: [], data: [] } : { header: rows[h].map((c) => String(c ?? "").trim()), data: rows.slice(h + 1) };
};

// CriteriaConfig sheet -> [{ name, category }]
export function readCriteriaConfig(rows) {
  const { header, data } = rowsAfterHeader(rows, (c) => titlesMatch(c, "Criteria Name"));
  const n = header.findIndex((c) => titlesMatch(c, "Criteria Name"));
  const k = header.findIndex((c) => titlesMatch(c, "Category"));
  if (n < 0 || k < 0) return [];
  return data
    .map((r) => ({ name: cellText(r, n), category: cellText(r, k).toUpperCase() }))
    .filter((c) => c.name && ["MAINTENANCE", "BLOCKED"].includes(c.category));
}

// DisregardConfig sheet -> { "VAMTAC CREW": ["AIRCON", ...] }
export function readDisregardConfig(rows) {
  const { header, data } = rowsAfterHeader(rows, (c) => titlesMatch(c, "Vehicle Type"));
  const t = header.findIndex((c) => titlesMatch(c, "Vehicle Type"));
  const k = header.findIndex((c) => titlesMatch(c, "Criteria"));
  if (t < 0 || k < 0) return {};
  const out = {};
  for (const r of data) {
    const type = cleanType(cellText(r, t));
    const field = cellText(r, k);
    if (type && field) (out[type] ??= []).push(field);
  }
  return out;
}

// ---------------------------------------------------------------- accounts

// Which account a worksheet belongs to:
//   1. an account that has this sheet linked (claimed, or set on the Accounts page)
//   2. an account whose display name or username IS the sheet name ("3SG Rizq", "NC")
//   3. exactly one account whose name (ranks ignored) is in the sheet name
//      ("3SG Jungwoo" is in "3SG Chong_3SG Kim Jungwoo", "3WO Firdaus" in "FIRDAUS")
// A sheet linked to several accounts is shared by all of them.
export function matchAccount(sheetName, users) {
  const n = normalizeName(sheetName);
  if (!n) return null;
  const linked = users.find((u) => (u.sheets ?? []).some((s) => normalizeName(s) === n));
  if (linked) return linked;
  const exact = users.find((u) => normalizeName(u.name) === n || normalizeName(u.username) === n);
  if (exact) return exact;
  const partial = users.filter((u) => nameInSheet(u.name, sheetName));
  return partial.length === 1 ? partial[0] : null;
}

// Is this a whole-fleet sheet (Dashboard, MID Details...) rather than a commander's?
export const isGeneralSheet = (sheetName, generalSheets) =>
  generalSheets.some((g) => normalizeName(g) === normalizeName(sheetName));

// Combine every sheet into one list with one row per MID.
// plans: [{ name, vehicles, ownerId, priority }]   (ownerId "" = don't import)
//   priority 3 = a sheet that belongs to an account (linked, matched or chosen)
//   priority 2 = a commander's sheet nobody has claimed yet
//   priority 1 = a general sheet (Dashboard, MID Details...)
// When a MID is on several sheets, the higher-priority sheet decides the owner
// (and is remembered as the vehicle's sheet, so it moves when the sheet is claimed);
// a type or field value missing on that sheet is filled in from the others.
export function mergeSheets(plans, fallbackType = "") {
  const byMid = new Map();
  let duplicates = 0;
  for (const plan of plans) {
    if (!plan.ownerId) continue;
    for (const v of plan.vehicles) {
      const entry = {
        mid: v.mid,
        type: v.type,
        maintenance: v.maintenance ?? {},
        blocks: v.blocks ?? {},
        remarks: v.remarks ?? "",
        ownerId: plan.ownerId,
        priority: plan.priority,
        sheet: plan.name,
        line: `${plan.name} row ${v.line}`,
      };
      const existing = byMid.get(v.mid);
      if (!existing) {
        byMid.set(v.mid, entry);
        continue;
      }
      duplicates += 1;
      const [winner, other] = entry.priority > existing.priority ? [entry, existing] : [existing, entry];
      byMid.set(v.mid, {
        ...winner,
        type: winner.type || other.type,
        remarks: winner.remarks || other.remarks,
        maintenance: { ...other.maintenance, ...winner.maintenance },
        blocks: { ...other.blocks, ...winner.blocks },
      });
    }
  }
  const fallback = cleanType(fallbackType);
  const rows = [...byMid.values()].map(({ priority, ...r }) => ({ ...r, type: r.type || fallback }));
  return {
    rows,
    duplicates,
    missingType: rows.filter((r) => !r.type).length,
  };
}
